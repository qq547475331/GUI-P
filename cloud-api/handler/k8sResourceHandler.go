package handler

import (
	"cloud-deployment-api/model"
	"context"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// 修改缓存类型定义
var (
	namespacesCache     = make(map[string][]map[string]interface{})
	namespacesTimestamp = make(map[string]time.Time)
	podsCache           = make(map[string]interface{})  // 新增 pods 缓存
	podsTimestamp       = make(map[string]time.Time)    // 新增 pods 时间戳
	cacheMutex          = &sync.RWMutex{}
	inProgressRequests  = make(map[string]bool)
	requestMutex        = &sync.Mutex{}
)

// 辅助函数：将命名空间对象转换为字符串数组
func convertNamespacesToStrings(namespaces []map[string]interface{}) []string {
	result := make([]string, 0, len(namespaces))
	for _, ns := range namespaces {
		if name, ok := ns["name"].(string); ok {
			result = append(result, name)
		}
	}
	return result
}

// GetK8sNamespaces 获取Kubernetes命名空间列表（优化版）
func GetK8sNamespaces(c *gin.Context) {
	id := c.Param("id")
	requestKey := "namespaces:" + id
	
	// 检查是否有相同请求正在处理
	requestMutex.Lock()
	if inProgressRequests[requestKey] {
		// 当有重复请求时直接返回默认命名空间列表，但状态码保持200
		requestMutex.Unlock()
		log.Printf("检测到并发命名空间请求，返回默认命名空间: %s", id)
		c.JSON(http.StatusOK, []string{"default", "kube-system", "kube-public"})
		return
	}
	
	// 标记请求处理中
	inProgressRequests[requestKey] = true
	requestMutex.Unlock()
	
	// 请求结束时清理标记
	defer func() {
		requestMutex.Lock()
		delete(inProgressRequests, requestKey)
		requestMutex.Unlock()
		log.Printf("命名空间请求处理完成: %s", id)
	}()
	
	// 直接从缓存获取命名空间
	namespacesCache, err := model.GetNamespacesFromCache(id)
	if err == nil && len(namespacesCache) > 0 {
		// 缓存命中，直接返回
		log.Printf("命名空间缓存命中，直接返回: %s", id)
		
		// 转换并返回结果
		namespaceList := make([]string, len(namespacesCache))
		for i, ns := range namespacesCache {
			namespaceList[i] = ns.Name
		}
		
		c.JSON(http.StatusOK, namespaceList)
		
		// 检查是否需要后台异步更新缓存（超过1小时）
		if len(namespacesCache) > 0 && time.Since(namespacesCache[0].LastSyncedAt) > 1*time.Hour {
			// 使用goroutine异步触发更新，不阻塞当前请求
			go func() {
				if err := model.RefreshNamespaceCache(id, model.GetK8sManager()); err != nil {
					log.Printf("后台刷新命名空间缓存失败: %s, %v", id, err)
				}
			}()
		}
		return
	}
	
	// 缓存未命中，尝试使用优化函数一次性获取并缓存
	log.Printf("命名空间缓存未命中，从API获取并缓存: %s", id)
	namespaceList, err := model.GetNamespacesList(id, model.GetK8sManager())
	if err != nil {
		log.Printf("获取命名空间列表失败: %s, %v", id, err)
		c.JSON(http.StatusOK, []string{"default", "kube-system", "kube-public"})
		return
	}
	
	log.Printf("成功获取命名空间列表: %s, 数量: %d", id, len(namespaceList))
	c.JSON(http.StatusOK, namespaceList)
}

// GetK8sPods 获取Kubernetes Pod列表
func GetK8sPods(c *gin.Context) {
	id := c.Param("id")
	namespace := c.DefaultQuery("namespace", "")
	requestKey := fmt.Sprintf("pods:%s:%s", id, namespace)
	
	// 检查是否有相同请求正在处理
	requestMutex.Lock()
	if inProgressRequests[requestKey] {
		requestMutex.Unlock()
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error": "请求处理中，请稍后再试",
			"code": "REQUEST_IN_PROGRESS",
		})
		return
	}
	
	// 检查缓存
	cacheMutex.RLock()
	pods, cacheExists := podsCache[requestKey]
	timestamp, timeExists := podsTimestamp[requestKey]
	cacheMutex.RUnlock()
	
	// 如果缓存有效（存在且不超过5分钟）
	if cacheExists && timeExists && time.Since(timestamp) < 5*time.Minute {
		// 添加缓存命中日志
		log.Printf("Pod缓存命中: %s, 命名空间: %s", id, namespace)
		c.JSON(http.StatusOK, pods)
		return
	}
	
	// 标记请求处理中
	inProgressRequests[requestKey] = true
	requestMutex.Unlock()
	
	// 请求结束时清理标记
	defer func() {
		requestMutex.Lock()
		delete(inProgressRequests, requestKey)
		requestMutex.Unlock()
	}()
	
	// 首先从数据库获取 kubeconfig
	kubeConfig, err := model.GetKubeConfigByIDFromDB(id)
	if err != nil {
		log.Printf("无法从数据库获取KubeConfig (ID: %s): %v", id, err)
		// 返回空数组而不是错误
		c.JSON(http.StatusOK, []map[string]interface{}{})
		return
	}
	
	// 确保 K8s Manager 已初始化该配置
	err = model.GetK8sManager().InitializeConfig(id, kubeConfig.Content)
	if err != nil {
		log.Printf("初始化KubeConfig失败 (ID: %s): %v", id, err)
		// 返回空数组而不是错误
		c.JSON(http.StatusOK, []map[string]interface{}{})
		return
	}
	
	// 验证 kubeconfig
	err = model.GetK8sManager().ValidateKubeConfig(id)
	if err != nil {
		log.Printf("验证KubeConfig失败 (ID: %s): %v", id, err)
		// 返回空数组而不是错误
		c.JSON(http.StatusOK, []map[string]interface{}{})
		return
	}
	
	// 调用 Kubernetes 获取 Pods
	result, err := model.GetK8sManager().GetPods(id, namespace)
	if err != nil {
		log.Printf("获取Pod列表失败 (ID: %s, namespace: %s): %v", id, namespace, err)
		// 返回空数组而不是错误
		c.JSON(http.StatusOK, []map[string]interface{}{})
		return
	}
	
	// 更新缓存
	cacheMutex.Lock()
	podsCache[requestKey] = result
	podsTimestamp[requestKey] = time.Now()
	cacheMutex.Unlock()
	
	c.JSON(http.StatusOK, result)
}

// GetK8sDeployments 获取Kubernetes Deployment列表
func GetK8sDeployments(c *gin.Context) {
	id := c.Param("id")
	namespace := c.DefaultQuery("namespace", "")  // 修改为空字符串
	
	// 验证kubeconfig
	err := model.GetK8sManager().ValidateKubeConfig(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Invalid kubeconfig: %v", err)})
		return
	}
	
	// 获取客户端
	client, err := model.GetK8sManager().GetClient(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取客户端失败: %v", err),
			"code": "CLIENT_ERROR",
		})
		return
	}
	
	// 直接使用客户端获取 Deployments
	deployments, err := client.AppsV1().Deployments(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取 Deployments 失败: %v", err),
			"code": "DEPLOYMENTS_FETCH_FAILED",
		})
		return
	}
	
	c.JSON(http.StatusOK, deployments)
}

// GetK8sServices 获取Kubernetes Service列表
func GetK8sServices(c *gin.Context) {
	id := c.Param("id")
	namespace := c.DefaultQuery("namespace", "")  // 修改为空字符串
	
	// 验证kubeconfig
	err := model.GetK8sManager().ValidateKubeConfig(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get services: %v", err)})
		return
	}
	
	// 获取客户端
	client, err := model.GetK8sManager().GetClient(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取客户端失败: %v", err),
			"code": "CLIENT_ERROR",
		})
		return
	}
	
	// 直接使用客户端获取 Services
	services, err := client.CoreV1().Services(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取 Services 失败: %v", err),
			"code": "SERVICES_FETCH_FAILED",
		})
		return
	}
	
	c.JSON(http.StatusOK, services)
}

// GetK8sStatefulSets 获取Kubernetes StatefulSet列表
func GetK8sStatefulSets(c *gin.Context) {
	id := c.Param("id")
	namespace := c.DefaultQuery("namespace", "")  // 默认为空字符串，表示所有命名空间
	
	// 首先从数据库获取 kubeconfig
	kubeConfig, err := model.GetKubeConfigByIDFromDB(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("无法从数据库获取 KubeConfig: %v", err),
			"code": "CONFIG_NOT_FOUND",
		})
		return
	}
	
	// 确保 K8s Manager 已初始化该配置
	err = model.GetK8sManager().InitializeConfig(id, kubeConfig.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("初始化 KubeConfig 失败: %v", err),
			"code": "CONFIG_INIT_FAILED",
		})
		return
	}
	
	// 获取客户端
	client, err := model.GetK8sManager().GetClient(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取 Kubernetes 客户端失败: %v", err),
			"code": "CLIENT_ERROR",
		})
		return
	}
	
	// 获取 StatefulSets
	statefulsets, err := client.AppsV1().StatefulSets(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取 StatefulSets 失败: %v", err),
			"code": "RESOURCE_FETCH_FAILED",
		})
		return
	}
	
	c.JSON(http.StatusOK, statefulsets)
}

// GetK8sDaemonSets 获取Kubernetes DaemonSet列表
func GetK8sDaemonSets(c *gin.Context) {
	id := c.Param("id")
	namespace := c.DefaultQuery("namespace", "")  // 默认为空字符串，表示所有命名空间
	
	// 验证kubeconfig
	err := model.GetK8sManager().ValidateKubeConfig(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Invalid kubeconfig: %v", err)})
		return
	}
	
	// 调用Kubernetes获取DaemonSets
	client, err := model.GetK8sManager().GetClient(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取客户端失败: %v", err)})
		return
	}
	
	daemonsets, err := client.AppsV1().DaemonSets(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取 DaemonSets 失败: %v", err)})
		return
	}
	
	c.JSON(http.StatusOK, daemonsets)
}

// GetK8sJobs 获取Kubernetes Job列表
func GetK8sJobs(c *gin.Context) {
	id := c.Param("id")
	namespace := c.DefaultQuery("namespace", "")  // 默认为空字符串，表示所有命名空间
	
	// 验证kubeconfig
	err := model.GetK8sManager().ValidateKubeConfig(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Invalid kubeconfig: %v", err)})
		return
	}
	
	// 调用Kubernetes获取Jobs
	client, err := model.GetK8sManager().GetClient(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取客户端失败: %v", err)})
		return
	}
	
	jobs, err := client.BatchV1().Jobs(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取 Jobs 失败: %v", err)})
		return
	}
	
	c.JSON(http.StatusOK, jobs)
}

// GetK8sPodLogs 获取Kubernetes Pod日志
func GetK8sPodLogs(c *gin.Context) {
	id := c.Param("id")
	namespace := c.DefaultQuery("namespace", "default")
	podName := c.Param("podName")
	containerName := c.DefaultQuery("container", "")
	tailLines := c.DefaultQuery("tailLines", "100")
	
	// 转换tailLines为int
	tail, err := strconv.Atoi(tailLines)
	if err != nil {
		tail = 100
	}
	
	// 验证kubeconfig
	err = model.GetK8sManager().ValidateKubeConfig(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Invalid kubeconfig: %v", err)})
		return
	}
	
	// 调用Kubernetes获取Pod日志
	logs, err := model.GetK8sManager().GetPodLogs(id, namespace, podName, containerName, tail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get pod logs: %v", err)})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"logs": logs})
}

// GetK8sResources 获取Kubernetes集群资源
func GetK8sResources(c *gin.Context) {
	id := c.Param("id")
	namespace := c.DefaultQuery("namespace", "default")
	resourceType := c.DefaultQuery("type", "all")
	
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfigId is required"})
		return
	}
	
	switch resourceType {
	case "pods":
		pods, err := model.GetK8sManager().GetPods(id, namespace)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get pods: %v", err)})
		return
	}
	
		c.JSON(http.StatusOK, gin.H{"pods": pods})
		
	case "deployments":
		deployments, err := model.GetK8sManager().GetDeployments(id, namespace)
	if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get deployments: %v", err)})
		return
	}
	
		c.JSON(http.StatusOK, gin.H{"deployments": deployments})
		
	case "services":
		services, err := model.GetK8sManager().GetServices(id, namespace)
	if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get services: %v", err)})
		return
	}
	
		c.JSON(http.StatusOK, gin.H{"services": services})
		
	case "statefulsets":
		statefulsets, err := model.GetK8sManager().GetStatefulSets(id, namespace)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get statefulsets: %v", err)})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{"statefulsets": statefulsets})
	
	case "all":
		// 获取所有资源类型
		var pods, deployments, services, statefulsets interface{}
		var podErr, deployErr, serviceErr, statefulsetErr error
		
		// 并行获取所有资源
		var wg sync.WaitGroup
		wg.Add(4)
		
		go func() {
			defer wg.Done()
			pods, podErr = model.GetK8sManager().GetPods(id, namespace)
		}()
		
		go func() {
			defer wg.Done()
			deployments, deployErr = model.GetK8sManager().GetDeployments(id, namespace)
		}()
		
		go func() {
			defer wg.Done()
			services, serviceErr = model.GetK8sManager().GetServices(id, namespace)
		}()
		
		go func() {
			defer wg.Done()
			statefulsets, statefulsetErr = model.GetK8sManager().GetStatefulSets(id, namespace)
		}()
		
		wg.Wait()
		
		result := gin.H{}
		
		if podErr == nil {
			result["pods"] = pods
		} else {
			result["podsError"] = fmt.Sprintf("Failed to get pods: %v", podErr)
		}
		
		if deployErr == nil {
			result["deployments"] = deployments
		} else {
			result["deploymentsError"] = fmt.Sprintf("Failed to get deployments: %v", deployErr)
		}
		
		if serviceErr == nil {
			result["services"] = services
		} else {
			result["servicesError"] = fmt.Sprintf("Failed to get services: %v", serviceErr)
		}
		
		if statefulsetErr == nil {
			result["statefulsets"] = statefulsets
		} else {
			result["statefulsetsError"] = fmt.Sprintf("Failed to get statefulsets: %v", statefulsetErr)
		}
		
		c.JSON(http.StatusOK, result)
		
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Unsupported resource type: %s", resourceType)})
	}
}

// GetK8sResourcesByType 获取指定类型的Kubernetes资源
func GetK8sResourcesByType(c *gin.Context) {
    id := c.Param("id")
    resourceType := c.Param("resourceType")
    namespace := c.DefaultQuery("namespace", "default")
    
    log.Printf("获取资源列表: kubeConfig=%s, 类型=%s, 命名空间=%s", id, resourceType, namespace)
    
    if id == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfigId is required"})
        return
    }
    
    // 根据资源类型调用相应的方法获取资源列表
    var resources interface{}
    var err error
    
    switch resourceType {
    case "pods":
        resources, err = model.GetK8sManager().GetPods(id, namespace)
	case "deployments":
        resources, err = model.GetK8sManager().GetDeployments(id, namespace)
	case "services":
        resources, err = model.GetK8sManager().GetServices(id, namespace)
	case "statefulsets":
        resources, err = model.GetK8sManager().GetStatefulSets(id, namespace)
	case "daemonsets":
        resources, err = model.GetK8sManager().GetDaemonSets(id, namespace)
	case "jobs":
        resources, err = model.GetK8sManager().GetJobs(id, namespace)
	default:
        c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("不支持的资源类型: %s", resourceType)})
		return
	}
	
    if err != nil {
        log.Printf("获取%s资源失败: %v", resourceType, err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取%s资源失败: %v", resourceType, err)})
		return
	}
	
    c.JSON(http.StatusOK, resources)
}

// GetK8sResourceByName 获取指定名称的Kubernetes资源
func GetK8sResourceByName(c *gin.Context) {
	id := c.Param("id")
    resourceType := c.Param("resourceType")
    resourceName := c.Param("name")
    namespace := c.DefaultQuery("namespace", "default")
    
    log.Printf("获取单个资源: kubeConfig=%s, 类型=%s, 名称=%s, 命名空间=%s", 
        id, resourceType, resourceName, namespace)
    
    if id == "" || resourceName == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfigId和资源名称不能为空"})
		return
	}
	
    // 获取Kubernetes客户端
    client, err := model.GetK8sManager().GetClient(id)
	if err != nil {
        log.Printf("获取Kubernetes客户端失败: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取Kubernetes客户端失败: %v", err)})
		return
	}
	
    // 根据资源类型获取对应的资源
    switch resourceType {
    case "deployments":
        deployment, err := client.AppsV1().Deployments(namespace).Get(c.Request.Context(), resourceName, metav1.GetOptions{})
	if err != nil {
            log.Printf("获取Deployment失败: %v", err)
            c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("获取Deployment失败: %v", err)})
		return
	}
        c.JSON(http.StatusOK, deployment)
        
	case "services":
        service, err := client.CoreV1().Services(namespace).Get(c.Request.Context(), resourceName, metav1.GetOptions{})
        if err != nil {
            log.Printf("获取Service失败: %v", err)
            c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("获取Service失败: %v", err)})
		return
	}
        c.JSON(http.StatusOK, service)
        
    case "pods":
        pod, err := client.CoreV1().Pods(namespace).Get(c.Request.Context(), resourceName, metav1.GetOptions{})
        if err != nil {
            log.Printf("获取Pod失败: %v", err)
            c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("获取Pod失败: %v", err)})
		return
	}
        c.JSON(http.StatusOK, pod)
	
    default:
        c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("不支持的资源类型: %s", resourceType)})
    }
}

// CreateK8sResource 创建Kubernetes资源
func CreateK8sResource(c *gin.Context) {
	id := c.Param("id")
    resourceType := c.Param("resourceType")
    namespace := c.DefaultQuery("namespace", "default")
    
    log.Printf("创建资源: kubeConfig=%s, 类型=%s, 命名空间=%s", id, resourceType, namespace)
    
    if id == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfigId不能为空"})
        return
    }
    
    // 获取请求体中的YAML或JSON
    var requestBody struct {
        YAML string `json:"yaml"`
        JSON map[string]interface{} `json:"json"`
    }
    
    if err := c.ShouldBindJSON(&requestBody); err != nil {
        log.Printf("解析请求体失败: %v", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("解析请求体失败: %v", err)})
		return
	}
	
    // 如果提供了YAML，使用YAML创建资源
    if requestBody.YAML != "" {
        err := model.GetK8sManager().ApplyYAML(id, requestBody.YAML)
	if err != nil {
            log.Printf("应用YAML失败: %v", err)
            c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("应用YAML失败: %v", err)})
		return
	}
	
        c.JSON(http.StatusOK, gin.H{"message": "资源创建成功"})
		return
	}
	
    // 目前仅支持通过YAML创建资源
    c.JSON(http.StatusBadRequest, gin.H{"error": "目前仅支持通过YAML创建资源"})
}

// UpdateK8sResource 更新Kubernetes资源
func UpdateK8sResource(c *gin.Context) {
    id := c.Param("id")
    resourceType := c.Param("resourceType")
    resourceName := c.Param("name")
    namespace := c.DefaultQuery("namespace", "default")
    
    log.Printf("更新资源: kubeConfig=%s, 类型=%s, 名称=%s, 命名空间=%s", 
        id, resourceType, resourceName, namespace)
    
    if id == "" || resourceName == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfigId和资源名称不能为空"})
        return
    }
    
    // 获取请求体中的YAML或JSON
    var requestBody struct {
        YAML string `json:"yaml"`
    }
    
    if err := c.ShouldBindJSON(&requestBody); err != nil {
        log.Printf("解析请求体失败: %v", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("解析请求体失败: %v", err)})
		return
	}
	
    // 目前仅支持通过YAML更新资源
    if requestBody.YAML == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "请提供YAML内容"})
		return
	}
	
    err := model.GetK8sManager().ApplyYAML(id, requestBody.YAML)
    if err != nil {
        log.Printf("应用YAML失败: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("应用YAML失败: %v", err)})
        return
    }
    
    c.JSON(http.StatusOK, gin.H{"message": "资源更新成功"})
}

// DeleteK8sResource 删除Kubernetes资源
func DeleteK8sResource(c *gin.Context) {
	id := c.Param("id")
    resourceType := c.Param("resourceType")
    namespace := c.DefaultQuery("namespace", "default")
    name := c.Query("name")
    
    log.Printf("删除资源: kubeConfig=%s, 类型=%s, 名称=%s, 命名空间=%s", 
        id, resourceType, name, namespace)
    
    if id == "" || name == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfigId和资源名称不能为空"})
		return
	}
	
    // 获取删除选项
    force := c.DefaultQuery("force", "false") == "true"
    gracePeriodSeconds := int64(0)
    if graceStr := c.Query("gracePeriod"); graceStr != "" {
        if grace, err := strconv.ParseInt(graceStr, 10, 64); err == nil {
            gracePeriodSeconds = grace
        }
    }
    
    propagationPolicy := metav1.DeletePropagationForeground
    if policy := c.Query("propagationPolicy"); policy != "" {
        switch strings.ToLower(policy) {
        case "background":
            propagationPolicy = metav1.DeletePropagationBackground
        case "orphan":
            propagationPolicy = metav1.DeletePropagationOrphan
        }
    }
    
    // 获取Kubernetes客户端
	client, err := model.GetK8sManager().GetClient(id)
	if err != nil {
        log.Printf("获取Kubernetes客户端失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取Kubernetes客户端失败: %v", err)})
		return
	}
	
    // 设置删除选项
    deleteOptions := metav1.DeleteOptions{
        PropagationPolicy: &propagationPolicy,
    }
    if force {
        deleteOptions.GracePeriodSeconds = &gracePeriodSeconds
    }
    
    // 根据资源类型删除对应的资源
    var deleteErr error
    
    log.Printf("删除资源 %s/%s 类型=%s，选项: force=%v, gracePeriod=%d", 
        namespace, name, resourceType, force, gracePeriodSeconds)
    
    switch resourceType {
    case "deployments":
        deleteErr = client.AppsV1().Deployments(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "statefulsets":
        deleteErr = client.AppsV1().StatefulSets(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "daemonsets":
        deleteErr = client.AppsV1().DaemonSets(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "services":
        deleteErr = client.CoreV1().Services(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "pods":
        deleteErr = client.CoreV1().Pods(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "configmaps":
        deleteErr = client.CoreV1().ConfigMaps(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "secrets":
        deleteErr = client.CoreV1().Secrets(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "persistentvolumeclaims", "pvcs":
        deleteErr = client.CoreV1().PersistentVolumeClaims(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "ingresses":
        deleteErr = client.NetworkingV1().Ingresses(namespace).Delete(c.Request.Context(), name, deleteOptions)
    case "networkpolicies":
        deleteErr = client.NetworkingV1().NetworkPolicies(namespace).Delete(c.Request.Context(), name, deleteOptions)
    default:
        c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("不支持的资源类型: %s", resourceType)})
        return
    }
    
    if deleteErr != nil {
        log.Printf("删除资源 %s/%s 失败: %v", namespace, name, deleteErr)
        c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("删除资源失败: %v", deleteErr)})
		return
	}
	
    log.Printf("成功删除资源 %s/%s", namespace, name)
    c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("资源 %s/%s 已删除", namespace, name)})
}

// DeleteK8sDeployment 专门用于删除部署
func DeleteK8sDeployment(c *gin.Context) {
	id := c.Param("id")
    namespace := c.DefaultQuery("namespace", "default")
    name := c.Query("name")
    
    log.Printf("删除部署: kubeConfig=%s, 名称=%s, 命名空间=%s", id, name, namespace)
    
    if id == "" || name == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfigId和部署名称不能为空"})
		return
	}

    // 获取删除选项
    force := c.DefaultQuery("force", "false") == "true"
    gracePeriodSeconds := int64(0)
    if graceStr := c.Query("gracePeriod"); graceStr != "" {
        if grace, err := strconv.ParseInt(graceStr, 10, 64); err == nil {
            gracePeriodSeconds = grace
        }
    }
    
    propagationPolicy := metav1.DeletePropagationForeground
    if policy := c.Query("propagationPolicy"); policy != "" {
        switch strings.ToLower(policy) {
        case "background":
            propagationPolicy = metav1.DeletePropagationBackground
        case "orphan":
            propagationPolicy = metav1.DeletePropagationOrphan
        }
    }
    
    // 获取Kubernetes客户端
	client, err := model.GetK8sManager().GetClient(id)
	if err != nil {
        log.Printf("获取Kubernetes客户端失败: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取Kubernetes客户端失败: %v", err)})
		return
	}

    // 设置删除选项
    deleteOptions := metav1.DeleteOptions{
        PropagationPolicy: &propagationPolicy,
    }
    if force {
        deleteOptions.GracePeriodSeconds = &gracePeriodSeconds
    }
    
    // 删除部署
    log.Printf("删除Deployment %s/%s", namespace, name)
    err = client.AppsV1().Deployments(namespace).Delete(c.Request.Context(), name, deleteOptions)
    if err != nil {
        log.Printf("删除Deployment失败: %v", err)
        c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("删除Deployment失败: %v", err)})
		return
	}

    // 尝试删除关联的服务
    log.Printf("尝试删除关联的Service %s/%s", namespace, name)
    _ = client.CoreV1().Services(namespace).Delete(c.Request.Context(), name, deleteOptions)
    
    // 等待一段时间，确保资源已被清理
    time.Sleep(1 * time.Second)
    
    log.Printf("成功删除部署 %s/%s", namespace, name)
    c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("部署 %s/%s 已删除", namespace, name)})
}

// CleanupCaches 清理过期的缓存
func CleanupCaches() {
	now := time.Now()
	cacheTimeout := 10 * time.Minute // 10分钟超时

	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	// 清理命名空间缓存
	for id, timestamp := range namespacesTimestamp {
		if now.Sub(timestamp) > cacheTimeout {
			delete(namespacesCache, id)
			delete(namespacesTimestamp, id)
			log.Printf("清理过期命名空间缓存: %s", id)
		}
	}

	// 清理Pod缓存
	for key, timestamp := range podsTimestamp {
		if now.Sub(timestamp) > cacheTimeout {
			delete(podsCache, key)
			delete(podsTimestamp, key)
			log.Printf("清理过期Pod缓存: %s", key)
		}
	}
}

// 在文件开头添加init函数
func init() {
	// 启动缓存清理协程
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			CleanupCaches()
		}
	}()
} 
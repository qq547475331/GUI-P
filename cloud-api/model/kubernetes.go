package model

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"strings"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/discovery/cached/memory"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/restmapper"
	"k8s.io/client-go/tools/clientcmd"
	
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/util/intstr"
	"encoding/base64"
)

// K8sManager 表示Kubernetes客户端管理器
type K8sManager struct {
	Clients   map[string]*kubernetes.Clientset
	Configs   map[string]*KubeConfig
	sync.RWMutex  // 嵌入 RWMutex
}

// GetK8sManager 获取单例实例
var (
	instance *K8sManager
	once     sync.Once
)

func GetK8sManager() *K8sManager {
	once.Do(func() {
		instance = &K8sManager{
			Clients: make(map[string]*kubernetes.Clientset),
			Configs: make(map[string]*KubeConfig),
		}
	})
	return instance
}

// AddClient 添加Kubernetes客户端
func (km *K8sManager) AddClient(id string, configContent []byte) error {
	km.Lock()
	defer km.Unlock()

	// 根据kubeconfig创建客户端
	config, err := clientcmd.RESTConfigFromKubeConfig(configContent)
	if err != nil {
		return fmt.Errorf("无法从kubeconfig创建REST配置: %v", err)
	}

	// 创建clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("无法创建Kubernetes客户端: %v", err)
	}

	// 存储客户端
	km.Clients[id] = clientset

	// 解析并存储kubeconfig
	kubeConfig, err := clientcmd.Load(configContent)
	if err != nil {
		return fmt.Errorf("无法解析kubeconfig: %v", err)
	}

	// 保存配置信息
	contexts := make([]string, 0, len(kubeConfig.Contexts))
	for name := range kubeConfig.Contexts {
		contexts = append(contexts, name)
	}

	return nil
}

// GetClient 获取指定ID的kubernetes客户端
func (m *K8sManager) GetClient(id string) (kubernetes.Interface, error) {
	m.RLock()
	defer m.RUnlock()

	// 检查客户端是否已存在
	if client, ok := m.Clients[id]; ok {
		// 验证客户端是否有效
		_, err := client.CoreV1().Namespaces().List(context.TODO(), metav1.ListOptions{Limit: 1})
		if err == nil {
			return client, nil // 客户端有效，直接返回
		}
		log.Printf("缓存的Kubernetes客户端无效，将重新创建: %v", err)
		// 客户端无效，从缓存中删除，尝试重新创建
		delete(m.Clients, id)
	}

	// 获取kubeconfig
	config, err := GetKubeConfigByIDFromDB(id)
	if err != nil {
		return nil, fmt.Errorf("找不到ID为%s的kubeconfig配置: %v", id, err)
	}

	// 解码kubeconfig内容
	content, err := DecodeKubeConfig(config.Content)
	if err != nil {
		return nil, fmt.Errorf("解码kubeconfig内容失败: %v", err)
	}

	// 直接从kubeconfig内容创建REST配置
	restConfig, err := clientcmd.RESTConfigFromKubeConfig(content)
	if err != nil {
		return nil, fmt.Errorf("无效的kubeconfig: %v", err)
	}

	// 增加超时设置
	restConfig.Timeout = 10 * time.Second

	// 创建kubernetes客户端
	client, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("创建kubernetes客户端失败: %v", err)
	}

	// 测试连接是否有效
	_, err = client.CoreV1().Namespaces().List(context.TODO(), metav1.ListOptions{Limit: 1})
	if err != nil {
		return nil, fmt.Errorf("Kubernetes集群连接测试失败: %v", err)
	}

	// 保存客户端以供后续使用
	m.Clients[id] = client
	log.Printf("成功创建Kubernetes客户端，已缓存 (ID: %s)", id)

	return client, nil
}

// AddKubeConfig 添加新的KubeConfig
func (km *K8sManager) AddKubeConfig(config *KubeConfig) error {
	km.Lock()
	defer km.Unlock()

	// 验证kubeconfig内容
	content, err := DecodeKubeConfig(config.Content)
	if err != nil {
		return fmt.Errorf("解码KubeConfig内容失败: %v", err)
	}

	// 解析kubeconfig
	kubeConfig, err := clientcmd.Load(content)
	if err != nil {
		return fmt.Errorf("解析KubeConfig失败: %v", err)
	}

	// 获取当前上下文和集群信息
	currentContext := kubeConfig.CurrentContext
	if currentContext == "" {
		return fmt.Errorf("KubeConfig中没有指定当前上下文")
	}

	// 获取服务器URL
	context, exists := kubeConfig.Contexts[currentContext]
	if !exists {
		return fmt.Errorf("找不到当前上下文: %s", currentContext)
	}

	clusterName := context.Cluster
	cluster, exists := kubeConfig.Clusters[clusterName]
	if !exists {
		return fmt.Errorf("找不到集群配置: %s", clusterName)
	}

	// 更新配置信息
	config.CurrentContext = currentContext
	config.ServerURL = cluster.Server

	// 创建客户端
	restConfig, err := clientcmd.RESTConfigFromKubeConfig(content)
	if err != nil {
		return fmt.Errorf("创建REST配置失败: %v", err)
	}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("创建Kubernetes客户端失败: %v", err)
	}

	// 存储客户端
	km.Clients[config.ID] = clientset
	km.Configs[config.ID] = config

	return nil
}

// sanitizeFilename 清理文件名，移除不安全的字符
func sanitizeFilename(filename string) string {
	// 替换不安全的字符为下划线
	unsafe := []string{"/", "\\", "?", "%", "*", ":", "|", "\"", "<", ">", " ", ".", ","}
	result := filename
	for _, char := range unsafe {
		result = strings.ReplaceAll(result, char, "_")
	}
	return result
}

// GetKubeConfig 获取指定ID的kubeconfig
func (m *K8sManager) GetKubeConfig(id string) (*KubeConfig, error) {
	m.RLock()
	defer m.RUnlock()
	
	config, ok := m.Configs[id]
	if !ok {
		return nil, fmt.Errorf("kubeconfig (ID: %s) 不存在", id)
	}
	
	// 返回一个不包含敏感内容的副本
	result := *config
	result.Content = ""
	
	return &result, nil
}

// GetAllKubeConfigs 获取所有的kubeconfig
func (m *K8sManager) GetAllKubeConfigs() []*KubeConfig {
	m.RLock()
	defer m.RUnlock()
	
	result := make([]*KubeConfig, 0, len(m.Configs))
	for _, config := range m.Configs {
		// 返回一个不包含敏感内容的副本
		configCopy := *config
		configCopy.Content = ""
		result = append(result, &configCopy)
	}
	
	return result
}

// DeleteKubeConfig 删除指定ID的kubeconfig
func (m *K8sManager) DeleteKubeConfig(id string) error {
	m.Lock()
	defer m.Unlock()
	
	if _, ok := m.Configs[id]; !ok {
		return fmt.Errorf("kubeconfig (ID: %s) 不存在", id)
	}
	
	// 删除对应的客户端
	if _, ok := m.Clients[id]; ok {
		delete(m.Clients, id)
	}
	
	// 删除配置
	delete(m.Configs, id)
	
	return nil
}

// SetContext 设置指定kubeconfig的当前上下文
func (m *K8sManager) SetContext(id string, context string) error {
	m.Lock()
	defer m.Unlock()
	
	config, ok := m.Configs[id]
	if !ok {
		return fmt.Errorf("kubeconfig (ID: %s) 不存在", id)
	}
	
	// 解析kubeconfig
	kubeConfig, err := clientcmd.Load([]byte(config.Content))
	if err != nil {
		return fmt.Errorf("解析kubeconfig失败: %v", err)
	}
	
	// 检查上下文是否存在
	if _, ok := kubeConfig.Contexts[context]; !ok {
		return fmt.Errorf("上下文 '%s' 不存在", context)
	}
	
	// 设置当前上下文
	kubeConfig.CurrentContext = context
	
	// 更新config对象
	config.CurrentContext = context
	
	// 序列化并更新kubeconfig
	out, err := clientcmd.Write(*kubeConfig)
	if err != nil {
		return fmt.Errorf("序列化kubeconfig失败: %v", err)
	}
	
	config.Content = string(out)
	
	// 删除旧的客户端，下次会使用新的上下文重新创建
	delete(m.Clients, id)
	
	return nil
}

// GetCurrentRestConfig 获取当前的REST配置
func (km *K8sManager) GetCurrentRestConfig(kubeConfigID string) (*rest.Config, error) {
	// 从kubeconfig管理器中获取配置
	kubeConfig, err := GetKubeConfigByIDFromDB(kubeConfigID)
	if err != nil {
		return nil, fmt.Errorf("获取KubeConfig失败: %v", err)
	}
	
	// 解码KubeConfig内容
	content, err := DecodeKubeConfig(kubeConfig.Content)
	if err != nil {
		return nil, fmt.Errorf("解码KubeConfig内容失败: %v", err)
	}
	
	// 从内容中创建REST配置
	config, err := clientcmd.RESTConfigFromKubeConfig(content)
	if err != nil {
		return nil, fmt.Errorf("创建REST配置失败: %v", err)
	}
	
	// 设置超时
	config.Timeout = 30 * time.Second
	
	return config, nil
}

// RemoveClient 从Kubernetes客户端管理器中移除客户端
func (km *K8sManager) RemoveClient(id string) {
	km.Lock()
	defer km.Unlock()
	
	delete(km.Clients, id)
	delete(km.Configs, id)
}

// ValidateKubeConfig 验证kubeconfig是否有效
func (m *K8sManager) ValidateKubeConfig(id string) error {
	_, err := m.GetClient(id)
	return err
}

// GetNamespaces 获取所有命名空间
func (km *K8sManager) GetNamespaces(id string) ([]map[string]interface{}, error) {
	clientset, err := km.GetClient(id)
	if err != nil {
		return nil, fmt.Errorf("获取Kubernetes客户端失败: %v", err)
	}
	
	namespaces, err := clientset.CoreV1().Namespaces().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取命名空间列表失败: %v", err)
	}
	
	result := make([]map[string]interface{}, 0, len(namespaces.Items))
	for _, ns := range namespaces.Items {
		result = append(result, map[string]interface{}{
			"name":      ns.Name,
			"status":    string(ns.Status.Phase),
			"age":       time.Since(ns.CreationTimestamp.Time).Round(time.Second).String(),
			"createdAt": ns.CreationTimestamp.Time,
		})
	}
	
	return result, nil
}

// GetPods 获取指定命名空间的Pod列表
func (km *K8sManager) GetPods(kubeConfigID string, namespace string) ([]map[string]interface{}, error) {
	km.RLock()
	defer km.RUnlock()
	
	// 参数验证
	if kubeConfigID == "" {
		return nil, fmt.Errorf("kubeConfigID不能为空")
	}
	
	// 获取k8s客户端
	client, err := km.GetClient(kubeConfigID)
	if err != nil {
		return nil, fmt.Errorf("获取Kubernetes客户端失败: %v", err)
	}
	
	// 如果未指定命名空间，使用默认命名空间
	if namespace == "" {
		namespace = "default"
	}
	
	// 获取Pod列表
	pods, err := client.CoreV1().Pods(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取Pod列表失败: %v", err)
	}
	
	// 转换为友好的输出格式
	var result []map[string]interface{}
	for _, pod := range pods.Items {
		// 计算Pod状态
		status := string(pod.Status.Phase)
		if pod.DeletionTimestamp != nil {
			status = "Terminating"
		}
		
		// 计算Pod已运行时间
		age := time.Since(pod.CreationTimestamp.Time).Round(time.Second).String()
		
		// 计算就绪状态
		ready := 0
		for _, containerStatus := range pod.Status.ContainerStatuses {
			if containerStatus.Ready {
				ready++
		}
		}
		readyStatus := fmt.Sprintf("%d/%d", ready, len(pod.Spec.Containers))
		
		// 容器列表
		var containers []map[string]interface{}
		for _, container := range pod.Spec.Containers {
			containerInfo := map[string]interface{}{
				"name":  container.Name,
				"image": container.Image,
				"ports": []map[string]interface{}{},
			}
			
			var ports []map[string]interface{}
			for _, port := range container.Ports {
				ports = append(ports, map[string]interface{}{
					"containerPort": port.ContainerPort,
					"protocol":      string(port.Protocol),
				})
			}
			containerInfo["ports"] = ports
			containers = append(containers, containerInfo)
		}
		
		// 构建结果
		podInfo := map[string]interface{}{
			"name":       pod.Name,
			"namespace":  pod.Namespace,
			"status":     status,
			"age":        age,
			"ready":      readyStatus,
			"ip":         pod.Status.PodIP,
			"node":       pod.Spec.NodeName,
			"containers": containers,
			"labels":     pod.Labels,
			"createdAt":  pod.CreationTimestamp.Format("2006-01-02 15:04:05"),
		}
		
		result = append(result, podInfo)
	}
	
	return result, nil
}

// GetDeployments 获取指定命名空间的Deployment列表
func (km *K8sManager) GetDeployments(id string, namespace string) ([]map[string]interface{}, error) {
	clientset, err := km.GetClient(id)
	if err != nil {
		return nil, fmt.Errorf("获取Kubernetes客户端失败: %v", err)
	}
	
	deployments, err := clientset.AppsV1().Deployments(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取Deployment列表失败: %v", err)
	}
	
	result := make([]map[string]interface{}, 0, len(deployments.Items))
	for _, deployment := range deployments.Items {
		result = append(result, map[string]interface{}{
			"name":              deployment.Name,
			"namespace":         deployment.Namespace,
			"replicas":          deployment.Status.Replicas,
			"availableReplicas": deployment.Status.AvailableReplicas,
			"updatedReplicas":   deployment.Status.UpdatedReplicas,
			"age":               time.Since(deployment.CreationTimestamp.Time).Round(time.Second).String(),
			"createdAt":         deployment.CreationTimestamp.Time,
			"image":             getDeploymentImages(deployment),
		})
	}
	
	return result, nil
}

// GetServices 获取指定命名空间的Service列表
func (km *K8sManager) GetServices(id string, namespace string) ([]map[string]interface{}, error) {
	clientset, err := km.GetClient(id)
	if err != nil {
		return nil, fmt.Errorf("获取Kubernetes客户端失败: %v", err)
	}
	
	services, err := clientset.CoreV1().Services(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取Service列表失败: %v", err)
	}
	
	result := make([]map[string]interface{}, 0, len(services.Items))
	for _, service := range services.Items {
		// 提取端口信息
		ports := make([]map[string]interface{}, 0, len(service.Spec.Ports))
		for _, port := range service.Spec.Ports {
			ports = append(ports, map[string]interface{}{
				"name":       port.Name,
				"port":       port.Port,
				"targetPort": port.TargetPort.String(),
				"protocol":   string(port.Protocol),
			})
		}
		
		// 提取外部IP
		externalIP := ""
		if len(service.Status.LoadBalancer.Ingress) > 0 {
			if service.Status.LoadBalancer.Ingress[0].IP != "" {
				externalIP = service.Status.LoadBalancer.Ingress[0].IP
			} else if service.Status.LoadBalancer.Ingress[0].Hostname != "" {
				externalIP = service.Status.LoadBalancer.Ingress[0].Hostname
			}
		}
		
		result = append(result, map[string]interface{}{
			"name":       service.Name,
			"namespace":  service.Namespace,
			"type":       string(service.Spec.Type),
			"clusterIP":  service.Spec.ClusterIP,
			"externalIP": externalIP,
			"ports":      ports,
			"age":        time.Since(service.CreationTimestamp.Time).Round(time.Second).String(),
			"createdAt":  service.CreationTimestamp.Time,
		})
	}
	
	return result, nil
}

// GetStatefulSets 获取指定命名空间的StatefulSet列表
func (km *K8sManager) GetStatefulSets(id string, namespace string) ([]map[string]interface{}, error) {
	clientset, err := km.GetClient(id)
	if err != nil {
		return nil, fmt.Errorf("获取Kubernetes客户端失败: %v", err)
	}
	
	statefulsets, err := clientset.AppsV1().StatefulSets(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取StatefulSet列表失败: %v", err)
	}
	
	result := make([]map[string]interface{}, 0, len(statefulsets.Items))
	for _, statefulset := range statefulsets.Items {
		result = append(result, map[string]interface{}{
			"name":       statefulset.Name,
			"namespace":  statefulset.Namespace,
			"replicas":   statefulset.Status.Replicas,
			"readyReplicas": statefulset.Status.ReadyReplicas,
			"age":        time.Since(statefulset.CreationTimestamp.Time).Round(time.Second).String(),
			"createdAt":  statefulset.CreationTimestamp.Time,
		})
	}
	
	return result, nil
}

// GetDaemonSets 获取指定命名空间的DaemonSet列表
func (km *K8sManager) GetDaemonSets(id string, namespace string) ([]map[string]interface{}, error) {
	clientset, err := km.GetClient(id)
	if err != nil {
		return nil, fmt.Errorf("获取Kubernetes客户端失败: %v", err)
	}
	
	daemonsets, err := clientset.AppsV1().DaemonSets(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取DaemonSet列表失败: %v", err)
	}
	
	result := make([]map[string]interface{}, 0, len(daemonsets.Items))
	for _, daemonset := range daemonsets.Items {
		result = append(result, map[string]interface{}{
			"name":       daemonset.Name,
			"namespace":  daemonset.Namespace,
			"desiredNumberScheduled": daemonset.Status.DesiredNumberScheduled,
			"currentNumberScheduled": daemonset.Status.CurrentNumberScheduled,
			"numberReady": daemonset.Status.NumberReady,
			"age":        time.Since(daemonset.CreationTimestamp.Time).Round(time.Second).String(),
			"createdAt":  daemonset.CreationTimestamp.Time,
		})
	}
	
	return result, nil
}

// GetJobs 获取指定命名空间的Job列表
func (km *K8sManager) GetJobs(id string, namespace string) ([]map[string]interface{}, error) {
	clientset, err := km.GetClient(id)
	if err != nil {
		return nil, fmt.Errorf("获取Kubernetes客户端失败: %v", err)
	}
	
	jobs, err := clientset.BatchV1().Jobs(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("获取Job列表失败: %v", err)
	}
	
	result := make([]map[string]interface{}, 0, len(jobs.Items))
	for _, job := range jobs.Items {
		completions := int32(0)
		if job.Spec.Completions != nil {
			completions = *job.Spec.Completions
		}
		
		result = append(result, map[string]interface{}{
			"name":       job.Name,
			"namespace":  job.Namespace,
			"completions": completions,
			"succeeded":  job.Status.Succeeded,
			"age":        time.Since(job.CreationTimestamp.Time).Round(time.Second).String(),
			"createdAt":  job.CreationTimestamp.Time,
		})
	}
	
	return result, nil
}

// GetPodLogs 获取Pod的日志
func (km *K8sManager) GetPodLogs(kubeConfigID string, namespace string, podName string, containerName string, tailLines int) (string, error) {
	km.RLock()
	defer km.RUnlock()
	
	// 参数验证
	if kubeConfigID == "" || podName == "" {
		return "", fmt.Errorf("kubeConfigID和podName不能为空")
	}
	
	// 获取k8s客户端
	client, err := km.GetClient(kubeConfigID)
	if err != nil {
		return "", fmt.Errorf("获取Kubernetes客户端失败: %v", err)
	}
	
	// 如果未指定命名空间，使用默认命名空间
	if namespace == "" {
		namespace = "default"
	}
	
	// 设置日志获取选项
	podLogOptions := &corev1.PodLogOptions{
		Container:  containerName,
		TailLines:  &[]int64{int64(tailLines)}[0],
		Timestamps: true,
	}
	
	// 获取Pod日志
	logRequest := client.CoreV1().Pods(namespace).GetLogs(podName, podLogOptions)
	logStream, err := logRequest.Stream(context.TODO())
	if err != nil {
		return "", fmt.Errorf("获取Pod日志流失败: %v", err)
	}
	defer logStream.Close()
	
	// 读取日志内容
	buf := new(bytes.Buffer)
	_, err = io.Copy(buf, logStream)
	if err != nil {
		return "", fmt.Errorf("读取Pod日志失败: %v", err)
	}
	
	return buf.String(), nil
}

// ApplyYAML 应用YAML配置到Kubernetes集群
func (km *K8sManager) ApplyYAML(id string, yaml string) error {
	// 该功能暂未实现，或需要额外的依赖
	return fmt.Errorf("ApplyYAML功能暂未实现")
	
	/* 注释掉有问题的代码
	// 获取REST配置
	restConfig, err := km.GetCurrentRestConfig(id)
	if err != nil {
		return fmt.Errorf("获取REST配置失败: %v", err)
	}
	
	// 创建动态客户端
	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return fmt.Errorf("创建动态客户端失败: %v", err)
	}
	
	// 解码YAML
	decoder := yamlutil.NewYAMLOrJSONDecoder(strings.NewReader(yaml), 4096)
	
	// 遍历YAML文档
	for {
		var rawObj runtime.RawExtension
		if err := decoder.Decode(&rawObj); err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("解码YAML失败: %v", err)
		}
		
		if len(rawObj.Raw) == 0 {
			continue
		}
		
		// 解析对象
		decoder := yamlutil.NewYAMLOrJSONDecoder(bytes.NewReader(rawObj.Raw), 100)
		var obj unstructured.Unstructured
		if err := decoder.Decode(&obj); err != nil {
			return fmt.Errorf("解析对象失败: %v", err)
		}
		
		// 获取GVK
		gvk := obj.GroupVersionKind()
		
		// 获取对象的命名空间
		namespace := obj.GetNamespace()
		if namespace == "" {
			namespace = "default"
		}
		
		// 根据GVK获取资源
		mapping, err := km.getRESTMapping(restConfig, &gvk)
		if err != nil {
			return fmt.Errorf("获取REST映射失败: %v", err)
		}
		
		// 获取资源客户端
		resourceClient := dynamicClient.Resource(mapping.Resource).Namespace(namespace)
		
		// 获取对象名称
		name := obj.GetName()
		
		// 检查对象是否存在
		_, err = resourceClient.Get(context.TODO(), name, metav1.GetOptions{})
		if err != nil {
			if k8serrors.IsNotFound(err) {
				// 对象不存在，创建它
				_, err = resourceClient.Create(context.TODO(), &obj, metav1.CreateOptions{})
				if err != nil {
					return fmt.Errorf("创建对象失败: %v", err)
				}
				fmt.Printf("已创建 %s/%s\n", mapping.Resource.Resource, name)
			} else {
				return fmt.Errorf("检查对象是否存在失败: %v", err)
			}
		} else {
			// 对象存在，更新它
			_, err = resourceClient.Update(context.TODO(), &obj, metav1.UpdateOptions{})
			if err != nil {
				return fmt.Errorf("更新对象失败: %v", err)
			}
			fmt.Printf("已更新 %s/%s\n", mapping.Resource.Resource, name)
		}
	}
	
	return nil
	*/
}

// getRESTMapping 获取GVK的REST映射
func (km *K8sManager) getRESTMapping(restConfig *rest.Config, gvk *schema.GroupVersionKind) (*meta.RESTMapping, error) {
	// 创建发现客户端
	discoveryClient, err := discovery.NewDiscoveryClientForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("创建发现客户端失败: %v", err)
	}
	
	// 创建RESTMapper
	mapper := restmapper.NewDeferredDiscoveryRESTMapper(memory.NewMemCacheClient(discoveryClient))
	
	// 获取REST映射
	return mapper.RESTMapping(gvk.GroupKind(), gvk.Version)
}

// getDeploymentImages 获取Deployment的镜像列表
func getDeploymentImages(deployment appsv1.Deployment) []string {
	var images []string
	for _, container := range deployment.Spec.Template.Spec.Containers {
		images = append(images, container.Image)
	}
	return images
}

// DeleteApplication 删除应用程序 (已弃用，请使用DeleteApplicationResources)
func (km *K8sManager) DeleteApplication(id string) error {
	log.Printf("警告: 使用已弃用的DeleteApplication方法")
	// 尝试获取应用程序信息
	app, err := GetApplicationByIDFromDB(id)
	if err != nil {
		return fmt.Errorf("获取应用信息失败: %v", err)
	}
	
	// 调用新方法
	appName := app.Name
	if appName == "" {
		appName = id
	}
	
	namespace := app.Namespace
	if namespace == "" {
		namespace = "default"
	}
	
	return km.DeleteApplicationResources(app.KubeConfigID, namespace, appName)
}

// DeleteApplicationResources 删除应用程序相关的所有Kubernetes资源
func (km *K8sManager) DeleteApplicationResources(kubeConfigId, namespace, name string) error {
	km.Lock()
	defer km.Unlock()
	
	if kubeConfigId == "" {
		return fmt.Errorf("kubeConfigId不能为空")
	}
	
	if namespace == "" {
		namespace = "default"
	}
	
	if name == "" {
		return fmt.Errorf("应用名称不能为空")
	}
	
	log.Printf("删除应用相关资源: kubeConfigId=%s, namespace=%s, name=%s", kubeConfigId, namespace, name)
	
	// 获取客户端
	client, err := km.GetClient(kubeConfigId)
	if err != nil {
		return fmt.Errorf("获取客户端失败: %v", err)
	}
	
	// 使用优雅删除选项
	deleteOptions := metav1.DeleteOptions{
		PropagationPolicy: &[]metav1.DeletionPropagation{metav1.DeletePropagationForeground}[0],
	}
	
	// 删除相关资源，每个资源单独处理错误
	var allErrors []error
	
	// 删除Deployment
	log.Printf("删除Deployment: %s/%s", namespace, name)
	err = client.AppsV1().Deployments(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除Deployment失败: %v", err)
		allErrors = append(allErrors, fmt.Errorf("删除Deployment失败: %v", err))
	}
	
	// 删除StatefulSet
	log.Printf("删除StatefulSet: %s/%s", namespace, name)
	err = client.AppsV1().StatefulSets(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除StatefulSet失败: %v", err)
		allErrors = append(allErrors, fmt.Errorf("删除StatefulSet失败: %v", err))
	}
	
	// 删除DaemonSet
	log.Printf("删除DaemonSet: %s/%s", namespace, name)
	err = client.AppsV1().DaemonSets(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除DaemonSet失败: %v", err)
		allErrors = append(allErrors, fmt.Errorf("删除DaemonSet失败: %v", err))
	}
	
	// 删除Service
	log.Printf("删除Service: %s/%s", namespace, name)
	err = client.CoreV1().Services(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除Service失败: %v", err)
		allErrors = append(allErrors, fmt.Errorf("删除Service失败: %v", err))
	}
	
	// 删除ConfigMap
	log.Printf("删除ConfigMap: %s/%s", namespace, name+"-config")
	err = client.CoreV1().ConfigMaps(namespace).Delete(context.TODO(), name+"-config", deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除ConfigMap失败: %v", err)
		allErrors = append(allErrors, fmt.Errorf("删除ConfigMap失败: %v", err))
	}
	
	// 删除Secret
	log.Printf("删除Secret: %s/%s", namespace, name+"-secret")
	err = client.CoreV1().Secrets(namespace).Delete(context.TODO(), name+"-secret", deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除Secret失败: %v", err)
		allErrors = append(allErrors, fmt.Errorf("删除Secret失败: %v", err))
	}
	
	// 删除PersistentVolumeClaim
	log.Printf("删除PersistentVolumeClaim: %s/%s", namespace, name)
	err = client.CoreV1().PersistentVolumeClaims(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除PersistentVolumeClaim失败: %v", err)
		allErrors = append(allErrors, fmt.Errorf("删除PersistentVolumeClaim失败: %v", err))
	}
	
	// 如果集群支持NetworkPolicy，尝试删除
	log.Printf("删除NetworkPolicy: %s/%s", namespace, name)
	err = client.NetworkingV1().NetworkPolicies(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除NetworkPolicy失败: %v", err)
		// 不计入错误，因为NetworkPolicy是可选的
	}
	
	// 尝试删除Ingress，注意API版本不同
	log.Printf("删除Ingress: %s/%s", namespace, name)
	err = client.NetworkingV1().Ingresses(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除Ingress失败: %v", err)
		// 不计入错误，因为Ingress是可选的
	}
	
	// 使用标签选择器删除相关Pod
	log.Printf("删除Pod (通过标签选择器): app=%s", name)
	err = client.CoreV1().Pods(namespace).DeleteCollection(
		context.TODO(),
		metav1.DeleteOptions{GracePeriodSeconds: &[]int64{0}[0]},
		metav1.ListOptions{LabelSelector: fmt.Sprintf("app=%s", name)},
	)
	if err != nil && !k8serrors.IsNotFound(err) {
		log.Printf("删除Pod失败: %v", err)
		allErrors = append(allErrors, fmt.Errorf("删除Pod失败: %v", err))
	}
	
	// 如果有错误，整合所有错误信息
	if len(allErrors) > 0 {
		errorMsgs := make([]string, len(allErrors))
		for i, err := range allErrors {
			errorMsgs[i] = err.Error()
		}
		
		log.Printf("部分资源删除失败: %s", strings.Join(errorMsgs, "; "))
		return fmt.Errorf("部分资源删除失败: %s", strings.Join(errorMsgs, "; "))
	}
	
	log.Printf("成功删除所有应用相关资源")
	return nil
}

// DeployApplication 部署应用到Kubernetes集群
func (km *K8sManager) DeployApplication(app *Application) error {
	km.Lock()
	defer km.Unlock()
	
	log.Printf("开始部署应用: %s (ID: %s)", app.Name, app.ID)
	
	// 获取应用的原始创建时间
	originalApp, err := GetApplicationByIDFromDB(app.ID)
	if err == nil && originalApp != nil {
		// 确保使用原始的创建时间
		app.CreatedAt = originalApp.CreatedAt
		log.Printf("保留应用的原始创建时间: %v", app.CreatedAt)
	}
	
	// 获取kubeconfig
	log.Printf("获取KubeConfig: %s", app.KubeConfigID)
	config, err := GetKubeConfigByIDFromDB(app.KubeConfigID)
	if err != nil {
		log.Printf("获取KubeConfig失败: %v", err)
		return fmt.Errorf("获取KubeConfig失败: %v", err)
	}
	
	// 测试解析kubeconfig内容
	log.Printf("解析KubeConfig内容...")
	content, err := DecodeKubeConfig(config.Content)
	if err != nil {
		log.Printf("解码KubeConfig内容失败: %v", err)
		return fmt.Errorf("解码KubeConfig内容失败: %v", err)
	}
	log.Printf("成功解析KubeConfig内容，长度: %d字节", len(content))
	
	// 直接使用内容创建客户端
	log.Printf("尝试创建Kubernetes客户端...")
	clientConfig, err := clientcmd.RESTConfigFromKubeConfig(content)
	if err != nil {
		log.Printf("创建REST配置失败: %v", err)
		return fmt.Errorf("创建REST配置失败: %v", err)
	}
	
	// 设置超时
	clientConfig.Timeout = 30 * time.Second
	
	// 创建客户端
	log.Printf("创建Kubernetes客户端...")
	client, err := kubernetes.NewForConfig(clientConfig)
	if err != nil {
		log.Printf("创建Kubernetes客户端失败: %v", err)
		return fmt.Errorf("创建Kubernetes客户端失败: %v", err)
	}
	
	// 测试集群连接
	log.Printf("测试Kubernetes集群连接...")
	_, err = client.CoreV1().Namespaces().List(context.TODO(), metav1.ListOptions{Limit: 1})
	if err != nil {
		log.Printf("Kubernetes集群连接测试失败: %v", err)
		return fmt.Errorf("Kubernetes集群连接测试失败: %v", err)
	}
	log.Printf("Kubernetes集群连接测试成功")
	
	// 确保命名空间存在
	namespace := app.Namespace
	if namespace == "" {
		namespace = "default"
	}
	
	// 设置副本数量，至少为1
	replicas := int32(app.Replicas)
	if replicas <= 0 {
		replicas = 1
	}
	
	// 设置镜像
	image := app.ImageURL
	if image == "" {
		image = "nginx:latest" // 默认镜像
	}
	
	// 设置应用名称
	appName := app.Name
	if appName == "" {
		appName = app.ID
	}
	
	// 设置容器端口
	containerPort := int32(app.Port)
	if containerPort <= 0 {
		containerPort = 80 // 默认端口
	}
	
	// 创建或更新 Deployment
	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      appName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":        appName,
				"managed-by": "cloud-deployment-api",
				"app-id":     app.ID,
			},
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: map[string]string{
					"app": appName,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						"app":        appName,
						"managed-by": "cloud-deployment-api",
						"app-id":     app.ID,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{
						{
							Name:  appName,
							Image: image,
							Ports: []corev1.ContainerPort{
								{
									ContainerPort: containerPort,
								},
							},
							Resources: corev1.ResourceRequirements{
								Requests: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("100m"),
									corev1.ResourceMemory: resource.MustParse("128Mi"),
								},
								Limits: corev1.ResourceList{
									corev1.ResourceCPU:    resource.MustParse("500m"),
									corev1.ResourceMemory: resource.MustParse("512Mi"),
								},
							},
						},
					},
				},
			},
		},
	}
	
	log.Printf("创建Deployment: %s/%s", namespace, appName)
	
	// 尝试创建Deployment
	_, err = client.AppsV1().Deployments(namespace).Create(context.TODO(), deployment, metav1.CreateOptions{})
	if err != nil {
		if k8serrors.IsAlreadyExists(err) {
			// 如果已存在，则更新
			log.Printf("Deployment已存在，尝试更新: %s/%s", namespace, appName)
			_, err = client.AppsV1().Deployments(namespace).Update(context.TODO(), deployment, metav1.UpdateOptions{})
			if err != nil {
				log.Printf("更新Deployment失败: %v", err)
				return fmt.Errorf("更新Deployment失败: %v", err)
			}
			log.Printf("更新Deployment成功: %s/%s", namespace, appName)
		} else {
			log.Printf("创建Deployment失败: %v", err)
			return fmt.Errorf("创建Deployment失败: %v", err)
		}
	} else {
		log.Printf("创建Deployment成功: %s/%s", namespace, appName)
	}
	
	// 创建Service
	serviceType := corev1.ServiceTypeClusterIP
	if app.ServiceType == "NodePort" {
		serviceType = corev1.ServiceTypeNodePort
	} else if app.ServiceType == "LoadBalancer" {
		serviceType = corev1.ServiceTypeLoadBalancer
	}
	
	service := &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:      appName,
			Namespace: namespace,
			Labels: map[string]string{
				"app":        appName,
				"managed-by": "cloud-deployment-api",
				"app-id":     app.ID,
			},
		},
		Spec: corev1.ServiceSpec{
			Type: serviceType,
			Ports: []corev1.ServicePort{
				{
					Port:       containerPort,
					TargetPort: intstr.FromInt(int(containerPort)),
				},
			},
			Selector: map[string]string{
				"app": appName,
			},
		},
	}
	
	log.Printf("创建Service: %s/%s", namespace, appName)
	
	// 尝试创建Service
	_, err = client.CoreV1().Services(namespace).Create(context.TODO(), service, metav1.CreateOptions{})
	if err != nil {
		if k8serrors.IsAlreadyExists(err) {
			// 如果已存在，则更新
			log.Printf("Service已存在，尝试更新: %s/%s", namespace, appName)
			_, err = client.CoreV1().Services(namespace).Update(context.TODO(), service, metav1.UpdateOptions{})
			if err != nil {
				log.Printf("更新Service失败: %v", err)
				// 不返回错误，Deployment已经创建成功
			} else {
				log.Printf("更新Service成功: %s/%s", namespace, appName)
			}
		} else {
			log.Printf("创建Service失败: %v", err)
			// 不返回错误，Deployment已经创建成功
		}
	} else {
		log.Printf("创建Service成功: %s/%s", namespace, appName)
	}
	
	// 更新缓存的客户端
	km.Clients[app.KubeConfigID] = client
	
	log.Printf("应用部署成功: %s (ID: %s)", app.Name, app.ID)
	return nil
}

// GetDeploymentStatus 获取Deployment状态
func (km *K8sManager) GetDeploymentStatus(id string, namespace string, name string) (map[string]interface{}, error) {
	km.RLock()
	defer km.RUnlock()
	
	// 参数验证
	if id == "" {
		log.Println("GetDeploymentStatus: kubeConfigId为空")
		return map[string]interface{}{
			"status": "error",
			"message": "缺少必要的KubeConfigID参数",
		}, nil
	}
	
	// 获取客户端
	client, err := km.GetClient(id)
	if err != nil {
		log.Printf("GetDeploymentStatus: 获取客户端失败 (id: %s): %v", id, err)
		return map[string]interface{}{
			"status": "error",
			"message": fmt.Sprintf("连接Kubernetes集群失败: %v", err),
		}, nil
	}
	
	// 参数检查
	if namespace == "" {
		namespace = "default"
		log.Printf("GetDeploymentStatus: 命名空间为空，使用默认值: %s", namespace)
	}
	
	if name == "" {
		log.Println("GetDeploymentStatus: 部署名称为空")
		return map[string]interface{}{
			"status": "error",
			"message": "缺少必要的部署名称参数",
		}, nil
	}
	
	// 获取应用信息 - 这是从数据库获取的原始信息
	app, err := GetApplicationByIDFromDB(id)
	var createdAt time.Time
	var updatedAt time.Time
	
	// 确保时间格式正确 - 始终使用数据库中的原始时间
	if app != nil {
		// 防止零值时间，但尽量使用数据库记录的时间
		if app.CreatedAt.IsZero() || app.CreatedAt.Year() < 2000 {
			// 只有在数据库记录的时间无效时才使用当前时间
			createdAt = time.Now()
			log.Printf("应用 %s 的创建时间无效，使用当前时间", id)
		} else {
			// 使用数据库中的原始创建时间
			createdAt = app.CreatedAt
		}
		
		// 对于更新时间，同样使用数据库记录的值
		if app.UpdatedAt.IsZero() || app.UpdatedAt.Year() < 2000 {
			updatedAt = createdAt // 首次部署时，更新时间与创建时间相同
		} else {
			updatedAt = app.UpdatedAt
		}
	} else {
		// 应用信息不可用，使用当前时间（这种情况不应该发生，因为上层代码会检查）
		now := time.Now()
		log.Printf("警告: 无法从数据库获取应用信息 (ID: %s)，使用当前时间", id)
		createdAt = now
		updatedAt = now
	}
	
	// 获取Deployment
	deployment, err := client.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			log.Printf("GetDeploymentStatus: 部署不存在 (namespace: %s, name: %s)", namespace, name)
			containerPort := 0
			if app != nil {
				containerPort = app.Port
			}
			return map[string]interface{}{
				"status": "not_deployed",
				"message": "应用尚未部署",
				"replicas": 0,
				"availableReplicas": 0,
				"readyReplicas": 0,
				"updatedReplicas": 0,
				"createdAt": createdAt.Format("2006-01-02 15:04:05"),
				"lastDeployedAt": updatedAt.Format("2006-01-02 15:04:05"),
				"containerName": name,
				"containerPort": containerPort,
			}, nil
		}
		log.Printf("GetDeploymentStatus: 获取部署失败: %v", err)
		containerPort := 0
		if app != nil {
			containerPort = app.Port
		}
		return map[string]interface{}{
			"status": "error",
			"message": fmt.Sprintf("获取部署状态失败: %v", err),
			"replicas": 0,
			"availableReplicas": 0,
			"readyReplicas": 0,
			"updatedReplicas": 0,
			"createdAt": createdAt.Format("2006-01-02 15:04:05"),
			"lastDeployedAt": updatedAt.Format("2006-01-02 15:04:05"),
			"containerName": name,
			"containerPort": containerPort,
		}, nil
	}
	
	// 部署存在，计算当前状态
	log.Printf("GetDeploymentStatus: 成功获取部署状态 (namespace: %s, name: %s)", namespace, name)
	var currentStatus string
	if deployment.Status.AvailableReplicas > 0 && deployment.Status.AvailableReplicas == deployment.Status.Replicas {
		currentStatus = "running"
	} else if deployment.Status.Replicas == 0 {
		currentStatus = "stopped"
	} else {
		currentStatus = "deploying"
	}
	
	// 只有当应用状态发生变化时才更新应用状态和更新时间
	if app != nil && app.Status != currentStatus {
		log.Printf("应用状态发生变化: %s -> %s，更新数据库记录", app.Status, currentStatus)
		// 更新应用状态
		err := UpdateApplicationStatusToDB(id, currentStatus)
		if err != nil {
			log.Printf("更新应用状态失败: %v", err)
		} else {
			// 状态更新成功，获取更新后的应用信息
			updatedApp, err := GetApplicationByIDFromDB(id)
			if err == nil && updatedApp != nil {
				// 使用更新后的更新时间，但保持创建时间不变
				updatedAt = updatedApp.UpdatedAt
				log.Printf("应用更新时间已更新: %v", updatedAt)
			}
		}
	} else if app != nil {
		// 状态未发生变化，使用原始的时间戳，避免频繁更新时间
		log.Printf("应用状态未变化，保持原始时间戳")
	}
	
	// 获取容器端口
	containerPort := 0
	if app != nil {
		containerPort = app.Port
	}
	
	if containerPort == 0 && len(deployment.Spec.Template.Spec.Containers) > 0 {
		if len(deployment.Spec.Template.Spec.Containers[0].Ports) > 0 {
			containerPort = int(deployment.Spec.Template.Spec.Containers[0].Ports[0].ContainerPort)
		}
	}
	
	return map[string]interface{}{
		"status": currentStatus,
		"replicas": deployment.Status.Replicas,
		"availableReplicas": deployment.Status.AvailableReplicas,
		"readyReplicas": deployment.Status.ReadyReplicas,
		"updatedReplicas": deployment.Status.UpdatedReplicas,
		"message": "应用已部署",
		"createdAt": createdAt.Format("2006-01-02 15:04:05"),
		"lastDeployedAt": updatedAt.Format("2006-01-02 15:04:05"),
		"containerName": name,
		"containerPort": containerPort,
	}, nil
}

// 获取应用的容器端口
func getContainerPort(app *Application) int {
	if app == nil {
		return 0
	}
	
	// 直接返回应用的端口
	return app.Port
}

// IsDeployed 检查应用是否已经部署
func (km *K8sManager) IsDeployed(id string, namespace string, name string) (bool, error) {
	km.RLock() // 添加读锁保证线程安全
	defer km.RUnlock()
	
	// 查找应用
	app, err := GetApplicationByIDFromDB(id)
	if err != nil {
		log.Printf("获取应用失败 (ID: %s): %v", id, err)
		return false, nil // 应用不存在视为未部署，但不返回错误
	}
	
	if app.KubeConfigID == "" {
		log.Printf("应用 (ID: %s) 的KubeConfigID为空", id)
		return false, nil
	}
	
	// 获取k8s客户端
	client, err := km.GetClient(app.KubeConfigID)
	if err != nil {
		log.Printf("获取客户端失败 (KubeConfigID: %s): %v", app.KubeConfigID, err)
		return false, nil // 客户端连接错误，视为未部署但不返回错误
	}
	
	// 确保命名空间和名称有值
	if namespace == "" {
		namespace = app.Namespace
		if namespace == "" {
			namespace = "default"
		}
	}
	
	if name == "" {
		name = app.Name
		if name == "" {
			name = id
		}
	}
	
	// 检查Deployment是否存在
	_, err = client.AppsV1().Deployments(namespace).Get(context.TODO(), name, metav1.GetOptions{})
	if err != nil {
		if k8serrors.IsNotFound(err) {
			log.Printf("部署不存在 (namespace: %s, name: %s)", namespace, name)
			return false, nil // Deployment不存在，应用未部署
		}
		log.Printf("获取部署状态失败: %v", err)
		return false, nil // 其他错误也视为未部署，但不返回错误
	}
	
	return true, nil // Deployment存在，应用已部署
}

func init() {
	// 每5分钟清理一次过期的缓存
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			log.Println("执行缓存清理...")
			// 缓存清理放在handler包中处理，避免循环依赖
		}
	}()
}

// DecodeKubeConfig 解码KubeConfig内容
func DecodeKubeConfig(content string) ([]byte, error) {
	// 检查内容是否为空
	if content == "" {
		return nil, fmt.Errorf("KubeConfig内容为空")
	}
	
	// 检查content是否是base64编码
	if strings.HasPrefix(content, "data:") || strings.Contains(content, ";base64,") {
		// 处理data URL格式
		parts := strings.Split(content, ",")
		if len(parts) != 2 {
			return nil, fmt.Errorf("无效的base64编码格式")
		}
		content = parts[1]
	}
	
	// 尝试解码base64
	decodedBytes, err := base64.StdEncoding.DecodeString(content)
	if err == nil && len(decodedBytes) > 0 {
		log.Printf("成功解码base64格式的KubeConfig内容，长度：%d字节", len(decodedBytes))
		return decodedBytes, nil
	}
	
	// 不是base64编码，直接返回原内容
	log.Printf("KubeConfig内容不是base64编码，使用原始内容，长度：%d字节", len(content))
	return []byte(content), nil
}

// DeleteDeployment 删除单个Deployment资源
func (km *K8sManager) DeleteDeployment(kubeConfigId, namespace, name, propagationPolicy string) error {
	if kubeConfigId == "" || name == "" {
		return fmt.Errorf("kubeConfigId和应用名称不能为空")
	}
	
	if namespace == "" {
		namespace = "default"
	}
	
	log.Printf("删除Deployment: kubeConfigId=%s, namespace=%s, name=%s", kubeConfigId, namespace, name)
	
	// 获取客户端
	client, err := km.GetClient(kubeConfigId)
	if err != nil {
		return fmt.Errorf("获取客户端失败: %v", err)
	}
	
	// 设置删除策略
	var deletePropagation metav1.DeletionPropagation
	switch propagationPolicy {
	case "Foreground":
		deletePropagation = metav1.DeletePropagationForeground
	case "Background":
		deletePropagation = metav1.DeletePropagationBackground
	case "Orphan":
		deletePropagation = metav1.DeletePropagationOrphan
	default:
		deletePropagation = metav1.DeletePropagationForeground
	}
	
	// 删除Deployment
	deleteOptions := metav1.DeleteOptions{
		PropagationPolicy: &deletePropagation,
	}
	
	err = client.AppsV1().Deployments(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			log.Printf("Deployment不存在，视为删除成功: %s/%s", namespace, name)
			return nil
		}
		return fmt.Errorf("删除Deployment失败: %v", err)
	}
	
	log.Printf("成功删除Deployment: %s/%s", namespace, name)
	return nil
}

// DeleteService 删除单个Service资源
func (km *K8sManager) DeleteService(kubeConfigId, namespace, name string) error {
	if kubeConfigId == "" || name == "" {
		return fmt.Errorf("kubeConfigId和应用名称不能为空")
	}
	
	if namespace == "" {
		namespace = "default"
	}
	
	log.Printf("删除Service: kubeConfigId=%s, namespace=%s, name=%s", kubeConfigId, namespace, name)
	
	// 获取客户端
	client, err := km.GetClient(kubeConfigId)
	if err != nil {
		return fmt.Errorf("获取客户端失败: %v", err)
	}
	
	// 删除Service
	deleteOptions := metav1.DeleteOptions{}
	
	err = client.CoreV1().Services(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			log.Printf("Service不存在，视为删除成功: %s/%s", namespace, name)
			return nil
		}
		return fmt.Errorf("删除Service失败: %v", err)
	}
	
	log.Printf("成功删除Service: %s/%s", namespace, name)
	return nil
}

// DeleteConfigMap 删除单个ConfigMap资源
func (km *K8sManager) DeleteConfigMap(kubeConfigId, namespace, name string) error {
	if kubeConfigId == "" || name == "" {
		return fmt.Errorf("kubeConfigId和应用名称不能为空")
	}
	
	if namespace == "" {
		namespace = "default"
	}
	
	log.Printf("删除ConfigMap: kubeConfigId=%s, namespace=%s, name=%s", kubeConfigId, namespace, name)
	
	// 获取客户端
	client, err := km.GetClient(kubeConfigId)
	if err != nil {
		return fmt.Errorf("获取客户端失败: %v", err)
	}
	
	// 删除ConfigMap
	deleteOptions := metav1.DeleteOptions{}
	
	err = client.CoreV1().ConfigMaps(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			log.Printf("ConfigMap不存在，视为删除成功: %s/%s", namespace, name)
			return nil
		}
		return fmt.Errorf("删除ConfigMap失败: %v", err)
	}
	
	log.Printf("成功删除ConfigMap: %s/%s", namespace, name)
	return nil
}

// DeleteSecret 删除单个Secret资源
func (km *K8sManager) DeleteSecret(kubeConfigId, namespace, name string) error {
	if kubeConfigId == "" || name == "" {
		return fmt.Errorf("kubeConfigId和应用名称不能为空")
	}
	
	if namespace == "" {
		namespace = "default"
	}
	
	log.Printf("删除Secret: kubeConfigId=%s, namespace=%s, name=%s", kubeConfigId, namespace, name)
	
	// 获取客户端
	client, err := km.GetClient(kubeConfigId)
	if err != nil {
		return fmt.Errorf("获取客户端失败: %v", err)
	}
	
	// 删除Secret
	deleteOptions := metav1.DeleteOptions{}
	
	err = client.CoreV1().Secrets(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			log.Printf("Secret不存在，视为删除成功: %s/%s", namespace, name)
			return nil
		}
		return fmt.Errorf("删除Secret失败: %v", err)
	}
	
	log.Printf("成功删除Secret: %s/%s", namespace, name)
	return nil
}

// DeletePodsForApp 删除与应用相关的所有Pod
func (km *K8sManager) DeletePodsForApp(kubeConfigId, namespace, appName string) error {
	if kubeConfigId == "" || appName == "" {
		return fmt.Errorf("kubeConfigId和应用名称不能为空")
	}
	
	if namespace == "" {
		namespace = "default"
	}
	
	log.Printf("删除应用相关的Pod: kubeConfigId=%s, namespace=%s, appName=%s", kubeConfigId, namespace, appName)
	
	// 获取客户端
	client, err := km.GetClient(kubeConfigId)
	if err != nil {
		return fmt.Errorf("获取客户端失败: %v", err)
	}
	
	// 使用标签选择器删除相关Pod
	gracePeriod := int64(0)
	deleteOptions := metav1.DeleteOptions{
		GracePeriodSeconds: &gracePeriod,
	}
	
	// 使用app标签选择器
	listOptions := metav1.ListOptions{
		LabelSelector: fmt.Sprintf("app=%s", appName),
	}
	
	// 先尝试获取相关Pod列表
	pods, err := client.CoreV1().Pods(namespace).List(context.TODO(), listOptions)
	if err != nil {
		log.Printf("获取Pod列表失败: %v", err)
		return err
	}
	
	log.Printf("找到 %d 个与应用相关的Pod", len(pods.Items))
	
	// 单独删除每个Pod
	for _, pod := range pods.Items {
		log.Printf("删除Pod: %s", pod.Name)
		err := client.CoreV1().Pods(namespace).Delete(context.TODO(), pod.Name, deleteOptions)
		if err != nil && !k8serrors.IsNotFound(err) {
			log.Printf("删除Pod %s 失败: %v", pod.Name, err)
			// 继续删除其他Pod，不中断
		}
	}
	
	// 如果没有找到Pod，或者删除成功，返回nil
	log.Printf("删除应用相关Pod完成")
	return nil
} 
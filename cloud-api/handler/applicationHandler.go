package handler

import (
	"cloud-deployment-api/model"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// GetApplications 获取所有应用列表
func GetApplications(c *gin.Context) {
	applications, err := model.GetApplicationsFromDB()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get applications: " + err.Error()})
		return
	}
	
	// 转换为前端需要的格式
	var result []map[string]interface{}
	for _, app := range applications {
		// 检查应用是否已部署
		isDeployed, _ := model.GetK8sManager().IsDeployed(app.ID, app.Namespace, app.Name)
		
		// 设置状态
		var phase string
		if isDeployed {
			phase = app.Status
		} else {
			phase = "not_deployed"
		}
		
		// 为每个应用创建符合前端期望的数据结构
		appData := map[string]interface{}{
			"id":           app.ID,
			"appName":      app.Name,
			"imageName":    app.ImageURL,
			"instances":    app.Replicas,
			"cpu":          0.5, // 默认值，如果应用中有就用应用中的
			"memory":       512, // 默认值，如果应用中有就用应用中的
			"namespace":    app.Namespace,
			"kubeConfigId": app.KubeConfigID,
			"status": map[string]interface{}{
				"phase": phase,
			},
			"description": app.Description,
		}
		
		result = append(result, appData)
	}
	
	c.JSON(http.StatusOK, result)
}

// GetApplicationByID 获取指定ID的应用
func GetApplicationByID(c *gin.Context) {
	id := c.Param("id")
	
	app, err := model.GetApplicationByIDFromDB(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found: " + err.Error()})
		return
	}
	
	// 检查应用是否已部署
	isDeployed, _ := model.GetK8sManager().IsDeployed(app.ID, app.Namespace, app.Name)
	
	// 设置状态
	var phase string
	if isDeployed {
		phase = app.Status
	} else {
		phase = "not_deployed"
	}
	
	// 创建符合前端期望的数据结构
	result := map[string]interface{}{
		"id":           app.ID,
		"appName":      app.Name,
		"imageName":    app.ImageURL,
		"instances":    app.Replicas,
		"cpu":          0.5, // 默认值，如果应用中有就用应用中的
		"memory":       512, // 默认值，如果应用中有就用应用中的
		"namespace":    app.Namespace,
		"kubeConfigId": app.KubeConfigID,
		"status": map[string]interface{}{
			"phase": phase,
		},
		"description":    app.Description,
		"port":           app.Port,
		"serviceType":    app.ServiceType,
		"deploymentYaml": app.DeploymentYAML,
		"createdAt":      app.CreatedAt,
		"updatedAt":      app.UpdatedAt,
	}
	
	c.JSON(http.StatusOK, result)
}

// CreateApplication 创建新应用
func CreateApplication(c *gin.Context) {
	var app model.Application
	
	if err := c.ShouldBindJSON(&app); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// 生成新ID
	app.ID = uuid.New().String()
	app.Status = "created"
	
	// 确保必要字段存在
	if app.KubeConfigID == "" {
		// 如果请求体中的KubeConfigID为空，尝试从查询参数获取
		kubeConfigID := c.Query("kubeConfigId")
		if kubeConfigID != "" {
			app.KubeConfigID = kubeConfigID
		} else {
			// 尝试获取第一个可用的KubeConfig作为默认值
			configs, err := model.GetKubeConfigsFromDB()
			if err == nil && len(configs) > 0 {
				app.KubeConfigID = configs[0].ID
			} else {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "KubeConfig ID is required and no default could be found",
					"details": "Please provide a valid Kubernetes cluster configuration ID",
				})
				return
			}
		}
	}
	
	// 确保命名空间存在
	if app.Namespace == "" {
		app.Namespace = "default"
	}
	
	// 检查KubeConfig是否存在
	_, err := model.GetKubeConfigByIDFromDB(app.KubeConfigID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "KubeConfig not found: " + err.Error()})
		return
	}
	
	// 检查是否存在同名、同命名空间、同集群的应用
	exists, err := model.CheckApplicationExists(app.Name, app.Namespace, app.KubeConfigID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "检查应用是否存在失败: " + err.Error()})
		return
	}
	
	if exists {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "应用已存在",
			"message": fmt.Sprintf("命名空间 '%s' 中已存在名为 '%s' 的应用", app.Namespace, app.Name),
		})
		return
	}
	
	// 设置默认值
	// 镜像拉取策略默认值
	if app.ImagePullPolicy == "" {
		app.ImagePullPolicy = "IfNotPresent" // 默认为IfNotPresent
	}
	
	// 如果未设置默认的存活探针，但设置了端口，则创建一个HTTP存活探针
	if app.LivenessProbe == nil && app.Port > 0 {
		app.LivenessProbe = &model.ProbeConfig{
			Path:                "/",
			Port:                app.Port,
			InitialDelaySeconds: 0,
			PeriodSeconds:       10,
			TimeoutSeconds:      1,
			FailureThreshold:    3,
			SuccessThreshold:    1,
			ProbeType:           "http",
		}
	}
	
	// 注释掉自动添加就绪检测的逻辑，让前端决定是否启用就绪检测
	// 如果未设置默认的就绪探针，但设置了端口，则创建一个HTTP就绪探针
	// if app.ReadinessProbe == nil && app.Port > 0 {
	// 	app.ReadinessProbe = &model.ProbeConfig{
	// 		Path:                "/ready",
	// 		Port:                app.Port,
	// 		InitialDelaySeconds: 10,
	// 		PeriodSeconds:       5,
	// 		TimeoutSeconds:      1,
	// 		FailureThreshold:    3,
	// 		SuccessThreshold:    1,
	// 		ProbeType:           "http",
	// 	}
	// }
	
	// 确保副本数量至少为1
	if app.Replicas <= 0 {
		app.Replicas = 1
	}
	
	// 确保端口号有效
	if app.Port <= 0 {
		app.Port = 8080
	}
	
	// 设置默认的服务类型
	if app.ServiceType == "" {
		app.ServiceType = "ClusterIP"
	}
	
	// 保存到数据库
	err = model.SaveApplicationToDB(&app)
	if err != nil {
		if strings.Contains(err.Error(), "unique_app_name_namespace_kubeconfig") {
			// 唯一约束冲突，返回友好的错误信息
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "应用已存在",
				"message": fmt.Sprintf("命名空间 '%s' 中已存在名为 '%s' 的应用", app.Namespace, app.Name),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save application: " + err.Error()})
		return
	}
	
	// 创建初始Kubernetes资源记录
	deploymentResource := &model.KubernetesResource{
		ApplicationID: app.ID,
		ResourceType:  "deployments",
		ResourceName:  app.Name,
		Namespace:     app.Namespace,
		ResourceYAML:  "", // 后续补充
		IsActive:      true,
	}
	
	if err := model.SaveK8sResourceToDB(deploymentResource); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create deployment resource record: " + err.Error()})
		return
	}
	
	serviceResource := &model.KubernetesResource{
		ApplicationID: app.ID,
		ResourceType:  "services",
		ResourceName:  app.Name,
		Namespace:     app.Namespace,
		ResourceYAML:  "", // 后续补充
		IsActive:      true,
	}
	
	if err := model.SaveK8sResourceToDB(serviceResource); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create service resource record: " + err.Error()})
		return
	}
	
	// 记录创建成功的日志
	log.Printf("应用 '%s' 创建成功 (ID: %s, 命名空间: %s, KubeConfigID: %s)", app.Name, app.ID, app.Namespace, app.KubeConfigID)
	
	// 创建完应用记录后立即部署到Kubernetes集群
	// 更新状态为部署中
	app.Status = "deploying"
	
	// 保存状态变更
	if err := model.SaveApplicationToDB(&app); err != nil {
		log.Printf("更新应用状态失败: %v", err)
		// 继续部署流程，不要因为状态更新失败而中断
	}
	
	// 异步部署应用
	go func() {
		if err := model.GetK8sManager().DeployApplication(&app); err != nil {
			log.Printf("部署应用失败: %v", err)
			// 部署失败，更新应用状态为错误
			app.Status = "error"
			model.UpdateApplicationStatusToDB(app.ID, app.Status)
		} else {
			log.Printf("部署应用成功 (ID: %s)", app.ID)
			// 部署成功，更新应用状态为运行中
			model.UpdateApplicationStatusToDB(app.ID, "running")
		}
	}()
	
	// 返回成功响应
	c.JSON(http.StatusCreated, gin.H{
		"id": app.ID,
		"name": app.Name,
		"namespace": app.Namespace,
		"status": "deploying",
		"message": "应用创建成功并开始部署",
	})
}

// UpdateApplication 更新应用
func UpdateApplication(c *gin.Context) {
	id := c.Param("id")
	
	var updateData model.Application
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// 获取现有应用
	app, err := model.GetApplicationByIDFromDB(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Application not found: " + err.Error()})
		return
	}
	
	// 更新字段
	app.Name = updateData.Name
	app.Description = updateData.Description
	app.ImageURL = updateData.ImageURL
	app.Replicas = updateData.Replicas
	app.Port = updateData.Port
	app.ServiceType = updateData.ServiceType
	app.DeploymentYAML = updateData.DeploymentYAML
	
	// 保存到数据库
	err = model.SaveApplicationToDB(app)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update application: " + err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, app)
}

// DeleteApplication 删除应用
func DeleteApplication(c *gin.Context) {
	id := c.Param("id")
	
	// 获取是否删除Kubernetes资源的查询参数
	deleteK8sResources := true
	deleteK8sParam := c.Query("deleteK8sResources")
	if deleteK8sParam != "" {
		var err error
		deleteK8sResources, err = strconv.ParseBool(deleteK8sParam)
		if err != nil {
			log.Printf("解析deleteK8sResources参数失败，使用默认值true: %v", err)
		}
	}
	
	// 获取强制删除的参数
	forceDelete := true // 默认使用强制删除模式以确保资源被清理
	forceParam := c.Query("force")
	if forceParam != "" {
		var err error
		forceDelete, err = strconv.ParseBool(forceParam)
		if err != nil {
			log.Printf("解析force参数失败，使用默认值true: %v", err)
		}
	}
	
	log.Printf("删除应用 (ID: %s, 删除K8s资源: %v, 强制删除: %v)", id, deleteK8sResources, forceDelete)
	
	// 获取应用信息，用于日志记录
	app, err := model.GetApplicationByIDFromDB(id)
	if err != nil {
		if strings.Contains(err.Error(), "no rows in result set") {
			// 应用不存在，直接返回成功
			c.JSON(http.StatusOK, gin.H{"message": "应用不存在或已被删除"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取应用信息失败: %v", err)})
		return
	}
	
	// 记录应用信息
	log.Printf("删除应用 (名称: %s, 命名空间: %s, KubeConfigID: %s)", 
		app.Name, app.Namespace, app.KubeConfigID)
	
	// 先从数据库删除应用记录，确保前端查询时不会再找到该应用
	// 这样即使k8s资源删除过程较慢，前端也不会显示这个应用
	log.Printf("从数据库删除应用记录...")
	if err := model.HardDeleteApplicationFromDB(id); err != nil {
		if strings.Contains(err.Error(), "no rows in result set") {
			// 记录已经不存在，继续执行k8s资源删除
			log.Printf("应用记录已不存在，继续删除Kubernetes资源")
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("删除应用记录失败: %v", err)})
			return
		}
	}
	
	// 尝试删除Kubernetes资源（如果需要）
	if deleteK8sResources && app.KubeConfigID != "" {
		log.Printf("开始删除Kubernetes资源...")
		
		// 获取应用信息
		appName := app.Name
		if appName == "" {
			appName = id
		}
		
		namespace := app.Namespace
		if namespace == "" {
			namespace = "default"
		}
		
		// 设置级联删除策略
		propagationPolicy := metav1.DeletePropagationForeground
		if forceDelete {
			propagationPolicy = metav1.DeletePropagationBackground
		}
		
		// 创建错误通道，用于收集删除过程中的错误
		errorChan := make(chan error, 6)
		
		// 并行删除所有相关资源以加快删除速度
		go func() {
			// 删除Deployment
			if err := model.GetK8sManager().DeleteDeployment(app.KubeConfigID, namespace, appName, string(propagationPolicy)); err != nil {
				if !errors.IsNotFound(err) {
					log.Printf("删除Deployment失败: %v", err)
					errorChan <- fmt.Errorf("删除Deployment失败: %v", err)
				} else {
					errorChan <- nil
				}
			} else {
				errorChan <- nil
			}
		}()
		
		go func() {
			// 删除StatefulSet
			if err := model.GetK8sManager().DeleteStatefulSet(app.KubeConfigID, namespace, appName, string(propagationPolicy)); err != nil {
				if !errors.IsNotFound(err) {
					log.Printf("删除StatefulSet失败: %v", err)
					errorChan <- fmt.Errorf("删除StatefulSet失败: %v", err)
				} else {
					errorChan <- nil
				}
			} else {
				errorChan <- nil
			}
		}()
		
		go func() {
			// 删除Service
			if err := model.GetK8sManager().DeleteService(app.KubeConfigID, namespace, appName); err != nil {
				if !errors.IsNotFound(err) {
					log.Printf("删除Service失败: %v", err)
					errorChan <- fmt.Errorf("删除Service失败: %v", err)
				} else {
					errorChan <- nil
				}
			} else {
				errorChan <- nil
			}
		}()
		
		go func() {
			// 删除ConfigMap
			if err := model.GetK8sManager().DeleteConfigMap(app.KubeConfigID, namespace, appName+"-config"); err != nil {
				if !errors.IsNotFound(err) {
					log.Printf("删除ConfigMap失败: %v", err)
					errorChan <- fmt.Errorf("删除ConfigMap失败: %v", err)
				} else {
					errorChan <- nil
				}
			} else {
				errorChan <- nil
			}
		}()
		
		go func() {
			// 删除Secret
			if err := model.GetK8sManager().DeleteSecret(app.KubeConfigID, namespace, appName+"-secret"); err != nil {
				if !errors.IsNotFound(err) {
					log.Printf("删除Secret失败: %v", err)
					errorChan <- fmt.Errorf("删除Secret失败: %v", err)
				} else {
					errorChan <- nil
				}
			} else {
				errorChan <- nil
			}
		}()
		
		go func() {
			// 删除相关的Pod
			if err := model.GetK8sManager().DeletePodsForApp(app.KubeConfigID, namespace, appName); err != nil {
				if !errors.IsNotFound(err) {
					log.Printf("删除Pod失败: %v", err)
					errorChan <- fmt.Errorf("删除Pod失败: %v", err)
				} else {
					errorChan <- nil
				}
			} else {
				errorChan <- nil
			}
		}()
		
		// 收集错误
		var errors []error
		for i := 0; i < 6; i++ {
			if err := <-errorChan; err != nil {
				errors = append(errors, err)
			}
		}
		
		// 检查是否有错误发生
		if len(errors) > 0 {
			log.Printf("删除Kubernetes资源过程中发生%d个错误", len(errors))
			// 即使有资源删除错误，也继续执行并返回成功，仅记录日志
		}
	}
	
	// 返回成功响应
	c.JSON(http.StatusOK, gin.H{"message": "应用删除成功"})
}

// DeployApplication 部署应用到Kubernetes集群
func DeployApplication(c *gin.Context) {
	id := c.Param("id")
	
	// 获取现有应用信息
	app, err := model.GetApplicationByIDFromDB(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("应用不存在: %v", err)})
		return
	}
	
	// 备份原始创建时间
	originalCreatedAt := app.CreatedAt
	
	// 更新状态为部署中
	app.Status = "deploying"
	// 确保创建时间不变，只更新更新时间
	app.UpdatedAt = time.Now()
	app.CreatedAt = originalCreatedAt  // 确保创建时间不变
	
	log.Printf("开始部署应用，保留原始创建时间: %v", app.CreatedAt)
	
	// 保存状态变更
	if err := model.SaveApplicationToDB(app); err != nil {
		log.Printf("更新应用状态失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("更新应用状态失败: %v", err)})
		return
	}
	
	// 异步部署应用
	go func() {
		if err := model.GetK8sManager().DeployApplication(app); err != nil {
			log.Printf("部署应用失败: %v", err)
			// 部署失败，更新应用状态为错误
			app.Status = "error"
			app.CreatedAt = originalCreatedAt  // 确保创建时间不变
			model.UpdateApplicationStatusToDB(app.ID, app.Status)
		} else {
			log.Printf("部署应用成功 (ID: %s)", id)
			// 部署成功，更新应用状态为运行中
			app.CreatedAt = originalCreatedAt  // 确保创建时间不变
			model.UpdateApplicationStatusToDB(app.ID, "running")
		}
	}()
	
	// 立即返回成功响应
	c.JSON(http.StatusOK, gin.H{
		"message": "应用部署请求已发送，正在部署中",
		"appId": id,
		"status": "deploying",
	})
}

// GetDeploymentStatus 获取应用部署状态
func GetDeploymentStatus(c *gin.Context) {
	id := c.Param("id")
	namespace := c.Query("namespace")
	name := c.Query("name")
	
	log.Printf("获取应用部署状态: id=%s, namespace=%s, name=%s", id, namespace, name)
	
	// 获取应用信息
	app, err := model.GetApplicationByIDFromDB(id)
	if err != nil {
		log.Printf("应用不存在 (ID: %s): %v", id, err)
		// 返回应用未找到的状态，而不是404错误
		c.JSON(http.StatusOK, gin.H{
			"status": "notfound",
			"message": fmt.Sprintf("应用不存在: %v", err),
			"replicas": 0,
			"availableReplicas": 0,
			"readyReplicas": 0,
			"updatedReplicas": 0,
		})
		return
	}
	
	// 获取应用的创建时间和更新时间
	var createdAt, updatedAt string
	if !app.CreatedAt.IsZero() && app.CreatedAt.Year() >= 2000 {
		createdAt = app.CreatedAt.Format("2006-01-02 15:04:05")
	} else {
		createdAt = time.Now().Format("2006-01-02 15:04:05")
	}
	
	if !app.UpdatedAt.IsZero() && app.UpdatedAt.Year() >= 2000 {
		updatedAt = app.UpdatedAt.Format("2006-01-02 15:04:05")
	} else {
		updatedAt = createdAt // 首次部署时，更新时间与创建时间相同
	}
	
	// 确保KubeConfigID存在
	kubeConfigId := app.KubeConfigID
	if kubeConfigId == "" {
		log.Printf("应用KubeConfigID为空 (ID: %s)", id)
		c.JSON(http.StatusOK, gin.H{
			"status": "not_configured",
			"message": "Kubernetes配置未设置",
			"replicas": 0,
			"availableReplicas": 0,
			"readyReplicas": 0,
			"updatedReplicas": 0,
			"createdAt": createdAt, // 添加时间字段
			"lastDeployedAt": updatedAt,
		})
		return
	}
	
	// 如果未提供namespace或name，从应用记录中获取
	if namespace == "" {
		namespace = app.Namespace
		// 如果还是为空，使用默认值
		if namespace == "" {
			namespace = "default"
		}
	}
	
	if name == "" {
		name = app.Name
		// 如果还是为空，使用默认值
		if name == "" {
			name = id
		}
	}
	
	log.Printf("使用参数获取部署状态: kubeConfigId=%s, namespace=%s, name=%s", kubeConfigId, namespace, name)
	
	// 检查应用是否已部署
	isDeployed, _ := model.GetK8sManager().IsDeployed(id, namespace, name)
	if !isDeployed {
		// 返回未部署状态，而不是错误
		c.JSON(http.StatusOK, gin.H{
			"status": "not_deployed",
			"message": "应用尚未部署",
			"replicas": 0,
			"availableReplicas": 0,
			"readyReplicas": 0,
			"updatedReplicas": 0,
			"createdAt": createdAt, // 添加时间字段
			"lastDeployedAt": updatedAt,
			"containerName": name,
			"containerPort": app.Port,
		})
		return
	}

	// 尝试获取Deployment状态
	status, err := model.GetK8sManager().GetDeploymentStatus(kubeConfigId, namespace, name)
	if err != nil {
		log.Printf("获取部署状态失败: %v", err)
		// 返回错误状态，但使用200响应码
		c.JSON(http.StatusOK, gin.H{
			"status": "error",
			"message": fmt.Sprintf("获取部署状态失败: %v", err),
			"replicas": 0,
			"availableReplicas": 0,
			"readyReplicas": 0,
			"updatedReplicas": 0,
			"createdAt": createdAt, // 添加时间字段
			"lastDeployedAt": updatedAt,
			"containerName": name,
			"containerPort": app.Port,
		})
		return
	}
	
	// 返回状态信息
	c.JSON(http.StatusOK, status)
}

// ExportApplicationToYaml 导出应用配置为YAML
func ExportApplicationToYaml(c *gin.Context) {
	id := c.Param("id")
	
	// 从数据库获取应用
	app, err := model.GetApplicationByIDFromDB(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("应用不存在: %v", err)})
		return
	}
	
	// 生成YAML
	yaml, err := model.GenerateYAML(app)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("生成YAML失败: %v", err)})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"yaml": yaml})
} 
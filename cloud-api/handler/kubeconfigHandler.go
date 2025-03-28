package handler

import (
	"cloud-deployment-api/model"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

// GetKubeConfigs 获取所有KubeConfig列表
func GetKubeConfigs(c *gin.Context) {
	configs, err := model.GetKubeConfigsFromDB()
	if err != nil {
		log.Printf("获取 KubeConfig 列表失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取 KubeConfig 列表失败: %v", err),
			"code": "DB_ERROR",
		})
		return
	}

	// 记录请求日志
	log.Printf("获取 KubeConfig 列表成功，返回 %d 个配置", len(configs))

	// 如果没有配置，返回空数组而不是null
	if configs == nil {
		configs = []model.KubeConfig{}
	}

	// 过滤敏感信息
	var safeConfigs []gin.H
	for _, config := range configs {
		safeConfigs = append(safeConfigs, gin.H{
			"id":             config.ID,
			"name":          config.Name,
			"description":   config.Description,
			"serverUrl":     config.ServerURL,
			"currentContext": config.CurrentContext,
			"isActive":      config.IsActive,
			"createdAt":     config.CreatedAt,
			"updatedAt":     config.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, safeConfigs)
}

// GetKubeConfigByID 获取指定ID的KubeConfig
func GetKubeConfigByID(c *gin.Context) {
	id := c.Param("id")
	
	config, err := model.GetKubeConfigByIDFromDB(id)
	if err != nil {
		log.Printf("获取KubeConfig失败 (ID: %s): %v", id, err)
		// 返回一个空对象而不是404错误
		c.JSON(http.StatusOK, gin.H{
			"id": id,
			"name": "未找到配置",
			"error": fmt.Sprintf("无法获取配置: %v", err),
			"status": "error",
		})
		return
	}
	
	// 清除敏感信息
	config.Content = ""
	c.JSON(http.StatusOK, config)
}

// UploadKubeConfig 上传新的KubeConfig
func UploadKubeConfig(c *gin.Context) {
	var request struct {
		Name         string `json:"name" binding:"required"`
		Description  string `json:"description"`
		Content      string `json:"content"`
		ConfigContent string `json:"configContent"`
	}
	
	// 从请求体中读取数据
	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "请求参数无效",
			"details": fmt.Sprintf("无法解析请求数据: %v", err),
		})
		return
	}
	
	// 使用configContent或content字段
	content := request.ConfigContent
	if content == "" {
		content = request.Content
	}
	
	// 增加对Content的额外检查
	if content == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "KubeConfig内容不能为空",
			"details": "请确保content或configContent字段包含有效的KubeConfig内容",
		})
		return
	}
	
	// 验证KubeConfig格式
	kubeConfig, err := clientcmd.Load([]byte(content))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "KubeConfig格式无效",
			"details": fmt.Sprintf("无法解析KubeConfig内容: %v", err),
		})
		return
	}
	
	// 创建KubeConfig记录
	config := &model.KubeConfig{
		ID:             uuid.New().String(),
		Name:           request.Name,
		Description:    request.Description,
		Content:        content,
		CurrentContext: kubeConfig.CurrentContext,
		ServerURL:      getServerURL(kubeConfig),
		IsActive:       true,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	
	// 保存到数据库
	if err := model.SaveKubeConfigToDB(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("保存KubeConfig失败: %v", err)})
		return
	}
	
	// 初始化Kubernetes客户端
	if err := model.GetK8sManager().AddKubeConfig(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("初始化Kubernetes客户端失败: %v", err)})
		return
	}
	
	// 返回前移除敏感信息
	config.Content = ""
	c.JSON(http.StatusCreated, gin.H{
		"message": "KubeConfig上传成功",
		"config":  config,
	})
}

// getServerURL 从kubeConfig中提取服务器URL
func getServerURL(kubeConfig *clientcmdapi.Config) string {
	// 获取当前上下文
	currentContext := kubeConfig.CurrentContext
	context, exists := kubeConfig.Contexts[currentContext]
	if !exists {
		return ""
	}
	
	// 获取集群
	clusterName := context.Cluster
	cluster, exists := kubeConfig.Clusters[clusterName]
	if !exists {
		return ""
	}
	
	return cluster.Server
}

// DeleteKubeConfig 删除指定ID的KubeConfig
func DeleteKubeConfig(c *gin.Context) {
	id := c.Param("id")
	
	// 从Kubernetes客户端管理器移除
	model.GetK8sManager().RemoveClient(id)

	// 从数据库删除
	if err := model.DeleteKubeConfigFromDB(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("删除KubeConfig失败: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "KubeConfig已成功删除"})
}

// SetKubeConfigContext 设置KubeConfig的当前上下文
func SetKubeConfigContext(c *gin.Context) {
	id := c.Param("id")
	
	var request struct {
		Context string `json:"context" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("无效的请求数据: %v", err)})
		return
	}
	
	// 设置上下文
	if err := model.GetK8sManager().SetContext(id, request.Context); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("设置上下文失败: %v", err)})
		return
	}

	// 更新数据库中的记录
	config, err := model.GetKubeConfigByIDFromDB(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取KubeConfig失败: %v", err)})
		return
	}

	config.CurrentContext = request.Context
	config.UpdatedAt = time.Now()

	if err := model.SaveKubeConfigToDB(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("更新KubeConfig失败: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "上下文已成功设置"})
}

// AddKubeConfig 添加新的KubeConfig
func AddKubeConfig(c *gin.Context) {
	var config model.KubeConfig
	
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("无效的KubeConfig数据: %v", err)})
		return
	}

	// 验证kubeconfig内容
	if config.Content == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "KubeConfig内容不能为空"})
		return
	}

	content, err := model.DecodeKubeConfig(config.Content)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("无法解码KubeConfig内容: %v", err)})
		return
	}

	// 解析kubeconfig验证格式
	kubeConfig, err := clientcmd.Load(content)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("无效的KubeConfig格式: %v", err)})
		return
	}

	// 获取解析后的上下文和集群信息
	contexts := make([]string, 0, len(kubeConfig.Contexts))
	for name := range kubeConfig.Contexts {
		contexts = append(contexts, name)
	}

	// 设置ID和其他字段
	config.ID = uuid.New().String()
	config.CreatedAt = time.Now()
	config.UpdatedAt = time.Now()
	config.CurrentContext = kubeConfig.CurrentContext
	config.IsActive = true

	// 提取服务器URL
	context := kubeConfig.Contexts[config.CurrentContext]
	if context != nil {
		clusterName := context.Cluster
		cluster := kubeConfig.Clusters[clusterName]
		if cluster != nil {
			config.ServerURL = cluster.Server
		}
	}

	// 保存到数据库
	if err := model.SaveKubeConfigToDB(&config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("保存KubeConfig失败: %v", err)})
		return
	}

	// 添加到Kubernetes客户端管理器
	if err := model.GetK8sManager().AddKubeConfig(&config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("初始化Kubernetes客户端失败: %v", err)})
		return
	}

	// 返回创建的KubeConfig，但不包含配置内容
	config.Content = ""
	c.JSON(http.StatusCreated, config)
} 
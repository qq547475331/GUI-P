package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetImages 获取常用镜像列表
func GetImages(c *gin.Context) {
	// 返回一些常用的镜像，可在创建应用时选择
	images := []map[string]interface{}{
		{
			"name":        "nginx",
			"description": "Nginx 官方镜像",
			"tags":        []string{"latest", "1.25", "1.24", "1.23", "alpine"},
			"type":        "web",
		},
		{
			"name":        "httpd",
			"description": "Apache HTTP 服务器官方镜像",
			"tags":        []string{"latest", "2.4", "alpine"},
			"type":        "web",
		},
		{
			"name":        "mysql",
			"description": "MySQL 数据库镜像",
			"tags":        []string{"latest", "8.0", "5.7"},
			"type":        "database",
		},
		{
			"name":        "postgres",
			"description": "PostgreSQL 数据库镜像",
			"tags":        []string{"latest", "16", "15", "14"},
			"type":        "database",
		},
		{
			"name":        "redis",
			"description": "Redis 内存数据库镜像",
			"tags":        []string{"latest", "7.2", "6.2", "alpine"},
			"type":        "database",
		},
		{
			"name":        "mongo",
			"description": "MongoDB 文档数据库镜像",
			"tags":        []string{"latest", "7.0", "6.0", "5.0"},
			"type":        "database",
		},
		{
			"name":        "node",
			"description": "Node.js 官方镜像",
			"tags":        []string{"latest", "20", "18", "16", "14", "alpine"},
			"type":        "app",
		},
		{
			"name":        "python",
			"description": "Python 官方镜像",
			"tags":        []string{"latest", "3.12", "3.11", "3.10", "alpine"},
			"type":        "app",
		},
		{
			"name":        "php",
			"description": "PHP 官方镜像",
			"tags":        []string{"latest", "8.2", "8.1", "8.0", "apache", "fpm"},
			"type":        "app",
		},
		{
			"name":        "golang",
			"description": "Go 官方镜像",
			"tags":        []string{"latest", "1.21", "1.20", "alpine"},
			"type":        "app",
		},
		{
			"name":        "ruby",
			"description": "Ruby 官方镜像",
			"tags":        []string{"latest", "3.2", "3.1", "3.0", "alpine"},
			"type":        "app",
		},
		{
			"name":        "ubuntu",
			"description": "Ubuntu 官方镜像",
			"tags":        []string{"latest", "22.04", "20.04", "18.04"},
			"type":        "os",
		},
		{
			"name":        "alpine",
			"description": "Alpine Linux 官方镜像",
			"tags":        []string{"latest", "3.19", "3.18", "3.17"},
			"type":        "os",
		},
	}

	c.JSON(http.StatusOK, images)
}

// EstimatePrice 估算资源的价格
func EstimatePrice(c *gin.Context) {
	// 解析请求
	var request struct {
		CPU     float64 `json:"cpu"`
		Memory  int     `json:"memory"` // 单位: MB
		Storage int     `json:"storage"` // 单位: GB
		Count   int     `json:"count"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的资源请求"})
		return
	}

	// 简单的价格模型
	cpuPrice := 0.02 // 每核每小时的价格，美元
	memoryPrice := 0.005 // 每GB每小时的价格，美元
	storagePrice := 0.0001 // 每GB每小时的价格，美元

	// 确保资源数量至少为1
	if request.Count <= 0 {
		request.Count = 1
	}

	// 换算内存单位：MB -> GB
	memoryGB := float64(request.Memory) / 1024.0

	// 计算每小时的价格
	cpuCost := request.CPU * cpuPrice
	memoryCost := memoryGB * memoryPrice
	storageCost := float64(request.Storage) * storagePrice

	hourlyPrice := (cpuCost + memoryCost + storageCost) * float64(request.Count)
	dailyPrice := hourlyPrice * 24
	monthlyPrice := dailyPrice * 30

	// 返回价格估算
	c.JSON(http.StatusOK, gin.H{
		"hourly":   hourlyPrice,
		"daily":    dailyPrice,
		"monthly":  monthlyPrice,
		"currency": "USD",
		"details": gin.H{
			"cpu": gin.H{
				"quantity": request.CPU,
				"price":    cpuPrice,
				"total":    cpuCost * float64(request.Count),
			},
			"memory": gin.H{
				"quantity": memoryGB,
				"unit":     "GB",
				"price":    memoryPrice,
				"total":    memoryCost * float64(request.Count),
			},
			"storage": gin.H{
				"quantity": request.Storage,
				"unit":     "GB",
				"price":    storagePrice,
				"total":    storageCost * float64(request.Count),
			},
			"instances": request.Count,
		},
	})
}

// GetResourceQuota 获取集群资源配额
func GetResourceQuota(c *gin.Context) {
	// 返回集群可用资源配额
	// 实际应用中应该从Kubernetes集群获取配额
	quota := map[string]interface{}{
		"cpu": map[string]interface{}{
			"total":     16,
			"used":      6.5,
			"available": 9.5,
			"unit":      "cores",
		},
		"memory": map[string]interface{}{
			"total":     32768,
			"used":      10240,
			"available": 22528,
			"unit":      "MB",
		},
		"storage": map[string]interface{}{
			"total":     1000,
			"used":      250,
			"available": 750,
			"unit":      "GB",
		},
		"pods": map[string]interface{}{
			"total":     100,
			"used":      35,
			"available": 65,
			"unit":      "pods",
		},
	}

	c.JSON(http.StatusOK, quota)
} 
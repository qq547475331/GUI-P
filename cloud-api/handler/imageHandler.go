package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetImages 获取镜像列表
func GetImages(c *gin.Context) {
	// 返回一个示例镜像列表
	images := []string{
		"nginx:latest",
		"redis:alpine",
		"mysql:8.0",
		"postgres:13",
		"node:14",
		"golang:1.18",
		"python:3.9",
		"ubuntu:20.04",
	}
	
	c.JSON(http.StatusOK, images)
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
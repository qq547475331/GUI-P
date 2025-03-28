package handler

import (
	"cloud-deployment-api/model"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetImageRegistries 获取所有镜像仓库
func GetImageRegistries(c *gin.Context) {
	registries, err := model.GetRegistriesFromDB()
	if err != nil {
		log.Printf("获取镜像仓库列表失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取镜像仓库列表失败: %v", err)})
		return
	}

	// 过滤掉敏感信息
	for i := range registries {
		registries[i].Password = ""
	}

	c.JSON(http.StatusOK, registries)
}

// GetImageRegistryByID 获取指定ID的镜像仓库
func GetImageRegistryByID(c *gin.Context) {
	id := c.Param("id")

	registry, err := model.GetRegistryByIDFromDB(id)
	if err != nil {
		log.Printf("获取镜像仓库失败: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("获取镜像仓库失败: %v", err)})
		return
	}

	// 过滤掉敏感信息
	registry.Password = ""

	c.JSON(http.StatusOK, registry)
}

// CreateImageRegistry 创建新的镜像仓库
func CreateImageRegistry(c *gin.Context) {
	var registry model.Registry

	if err := c.ShouldBindJSON(&registry); err != nil {
		log.Printf("解析请求体失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("解析请求体失败: %v", err)})
		return
	}

	// 生成新ID
	if registry.ID == "" {
		registry.ID = uuid.New().String()
	}

	// 设置创建时间和更新时间
	now := time.Now()
	registry.CreatedAt = now
	registry.UpdatedAt = now

	// 保存到数据库
	if err := model.SaveRegistryToDB(&registry); err != nil {
		log.Printf("保存镜像仓库失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("保存镜像仓库失败: %v", err)})
		return
	}

	// 过滤掉敏感信息
	registry.Password = ""

	c.JSON(http.StatusCreated, registry)
}

// UpdateImageRegistry 更新镜像仓库
func UpdateImageRegistry(c *gin.Context) {
	id := c.Param("id")

	// 检查镜像仓库是否存在
	existingRegistry, err := model.GetRegistryByIDFromDB(id)
	if err != nil {
		log.Printf("镜像仓库不存在: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("镜像仓库不存在: %v", err)})
		return
	}

	var updateData model.Registry
	if err := c.ShouldBindJSON(&updateData); err != nil {
		log.Printf("解析请求体失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("解析请求体失败: %v", err)})
		return
	}

	// 更新字段
	updateData.ID = id
	updateData.CreatedAt = existingRegistry.CreatedAt
	updateData.UpdatedAt = time.Now()

	// 如果密码为空，使用原来的密码
	if updateData.Password == "" {
		updateData.Password = existingRegistry.Password
	}

	// 保存到数据库
	if err := model.SaveRegistryToDB(&updateData); err != nil {
		log.Printf("更新镜像仓库失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("更新镜像仓库失败: %v", err)})
		return
	}

	// 过滤掉敏感信息
	updateData.Password = ""

	c.JSON(http.StatusOK, updateData)
}

// DeleteImageRegistry 删除镜像仓库
func DeleteImageRegistry(c *gin.Context) {
	id := c.Param("id")

	// 删除镜像仓库
	if err := model.DeleteRegistryFromDB(id); err != nil {
		log.Printf("删除镜像仓库失败: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("删除镜像仓库失败: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "镜像仓库删除成功"})
}

// TestImageRegistry 测试镜像仓库连接
func TestImageRegistry(c *gin.Context) {
	var registry model.Registry

	if err := c.ShouldBindJSON(&registry); err != nil {
		log.Printf("解析请求体失败: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("解析请求体失败: %v", err)})
		return
	}

	// 这里只是模拟测试连接，实际环境中应该尝试连接到镜像仓库
	// 并验证凭据是否正确
	if registry.URL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "镜像仓库URL不能为空"})
		return
	}

	// 返回测试结果
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "连接测试成功",
	})
}

// GetRepositories 获取镜像仓库中的仓库列表
func GetRepositories(c *gin.Context) {
	id := c.Param("id")

	// 获取镜像仓库信息
	registry, err := model.GetRegistryByIDFromDB(id)
	if err != nil {
		log.Printf("获取镜像仓库失败: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("获取镜像仓库失败: %v", err)})
		return
	}

	// 如果是公共仓库，返回预设的仓库列表
	if registry.IsPublic {
		c.JSON(http.StatusOK, model.GetPublicRepositories())
		return
	}

	// 如果是私有仓库，这里应该实现实际连接到镜像仓库并获取仓库列表的逻辑
	// 由于示例中没有实际连接，我们返回一个空列表
	c.JSON(http.StatusOK, []map[string]interface{}{})
}

// GetHarborRepositories 获取Harbor仓库中的项目列表
func GetHarborRepositories(c *gin.Context) {
	id := c.Param("id")
	project := c.Param("project")

	// 获取镜像仓库信息
	_, err := model.GetRegistryByIDFromDB(id)
	if err != nil {
		log.Printf("获取镜像仓库失败: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("获取镜像仓库失败: %v", err)})
		return
	}

	// 这里应该实现实际连接到Harbor并获取项目下的仓库列表的逻辑
	// 由于示例中没有实际连接，我们返回一个模拟的仓库列表
	repositories := []map[string]interface{}{
		{"name": project + "/app1", "pullCount": 100, "tagsCount": 5},
		{"name": project + "/app2", "pullCount": 50, "tagsCount": 3},
		{"name": project + "/database", "pullCount": 75, "tagsCount": 2},
	}

	c.JSON(http.StatusOK, repositories)
}

// GetHarborTags 获取Harbor仓库中的标签列表
func GetHarborTags(c *gin.Context) {
	id := c.Param("id")
	project := c.Param("project")
	repository := c.Param("repository")

	log.Printf("获取Harbor标签列表: 仓库ID=%s, 项目=%s, 仓库=%s", id, project, repository)

	// 获取镜像仓库信息
	_, err := model.GetRegistryByIDFromDB(id)
	if err != nil {
		log.Printf("获取镜像仓库失败: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("获取镜像仓库失败: %v", err)})
		return
	}

	// 这里应该实现实际连接到Harbor并获取仓库标签的逻辑
	// 由于示例中没有实际连接，我们返回一个模拟的标签列表
	tags := []map[string]interface{}{
		{"name": "latest", "size": 150000000, "pushTime": "2023-03-20T12:00:00Z"},
		{"name": "v1.0", "size": 145000000, "pushTime": "2023-03-15T10:30:00Z"},
		{"name": "v0.9", "size": 140000000, "pushTime": "2023-03-10T08:15:00Z"},
	}

	c.JSON(http.StatusOK, tags)
}

// GetImageTags 获取镜像仓库中的标签列表
func GetImageTags(c *gin.Context) {
	id := c.Param("id")
	repository := c.Query("repository")

	if repository == "" {
		log.Printf("仓库名称不能为空")
		c.JSON(http.StatusBadRequest, gin.H{"error": "仓库名称不能为空"})
		return
	}

	// 获取镜像仓库信息
	registry, err := model.GetRegistryByIDFromDB(id)
	if err != nil {
		log.Printf("获取镜像仓库失败: %v", err)
		c.JSON(http.StatusNotFound, gin.H{"error": fmt.Sprintf("获取镜像仓库失败: %v", err)})
		return
	}

	// 如果是公共仓库，返回预设的标签列表
	if registry.IsPublic {
		c.JSON(http.StatusOK, model.GetPublicTags(repository))
		return
	}

	// 如果是私有仓库，这里应该实现实际连接到镜像仓库并获取标签列表的逻辑
	// 由于示例中没有实际连接，我们返回一个空列表
	c.JSON(http.StatusOK, []string{})
} 
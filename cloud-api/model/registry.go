package model

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"
)

// 从data.json文件读取数据
func readData() (map[string]interface{}, error) {
	// 如果文件不存在，创建一个空的数据结构
	if _, err := os.Stat("data.json"); os.IsNotExist(err) {
		return map[string]interface{}{}, nil
	}

	// 读取文件
	data, err := os.ReadFile("data.json")
	if err != nil {
		return nil, fmt.Errorf("读取data.json失败: %v", err)
	}

	// 如果文件为空，返回空结构
	if len(data) == 0 {
		return map[string]interface{}{}, nil
	}

	// 解析JSON
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("解析data.json失败: %v", err)
	}

	return result, nil
}

// 保存数据到data.json文件
func saveData(data map[string]interface{}) error {
	// 将数据转换为JSON
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("转换数据为JSON失败: %v", err)
	}

	// 写入文件
	if err := os.WriteFile("data.json", jsonData, 0644); err != nil {
		return fmt.Errorf("写入data.json失败: %v", err)
	}

	return nil
}

// Registry 表示镜像仓库
type Registry struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Type        string    `json:"type"` // 例如: docker, harbor
	URL         string    `json:"url"`
	Username    string    `json:"username,omitempty"`
	Password    string    `json:"password,omitempty"` // 注意: 实际存储时应加密
	Email       string    `json:"email,omitempty"`
	Description string    `json:"description,omitempty"`
	IsPublic    bool      `json:"isPublic"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// GetRegistriesFromDB 从数据库获取所有镜像仓库
func GetRegistriesFromDB() ([]Registry, error) {
	// 从data.json文件中读取
	data, err := readData()
	if err != nil {
		return nil, err
	}

	var registries []Registry
	if regs, ok := data["registries"]; ok {
		bytes, err := json.Marshal(regs)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal(bytes, &registries); err != nil {
			return nil, err
		}
	} else {
		// 如果不存在, 返回空数组
		registries = []Registry{}
		// 初始化数据结构
		data["registries"] = registries
		if err := saveData(data); err != nil {
			return nil, err
		}
	}

	// 如果没有注册表，添加一个默认的Docker Hub公共注册表
	if len(registries) == 0 {
		defaultRegistry := Registry{
			ID:          "docker-hub",
			Name:        "Docker Hub",
			Type:        "docker",
			URL:         "https://registry.hub.docker.com",
			IsPublic:    true,
			Description: "Docker Hub公共镜像仓库",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		registries = append(registries, defaultRegistry)
		
		// 保存到数据库
		data["registries"] = registries
		if err := saveData(data); err != nil {
			log.Printf("保存默认镜像仓库失败: %v", err)
		}
	}

	return registries, nil
}

// GetRegistryByIDFromDB 从数据库获取指定ID的镜像仓库
func GetRegistryByIDFromDB(id string) (*Registry, error) {
	registries, err := GetRegistriesFromDB()
	if err != nil {
		return nil, err
	}

	for _, registry := range registries {
		if registry.ID == id {
			return &registry, nil
		}
	}

	return nil, fmt.Errorf("镜像仓库不存在: %s", id)
}

// SaveRegistryToDB 保存镜像仓库到数据库
func SaveRegistryToDB(registry *Registry) error {
	// 从data.json文件中读取
	data, err := readData()
	if err != nil {
		return err
	}

	var registries []Registry
	if regs, ok := data["registries"]; ok {
		bytes, err := json.Marshal(regs)
		if err != nil {
			return err
		}

		if err := json.Unmarshal(bytes, &registries); err != nil {
			return err
		}
	} else {
		registries = []Registry{}
	}

	// 设置创建时间和更新时间
	now := time.Now()
	if registry.CreatedAt.IsZero() {
		registry.CreatedAt = now
	}
	registry.UpdatedAt = now

	// 检查是否存在相同ID的注册表
	found := false
	for i, r := range registries {
		if r.ID == registry.ID {
			// 更新现有注册表
			registries[i] = *registry
			found = true
			break
		}
	}

	if !found {
		// 添加新注册表
		registries = append(registries, *registry)
	}

	// 保存到数据库
	data["registries"] = registries
	return saveData(data)
}

// DeleteRegistryFromDB 从数据库删除镜像仓库
func DeleteRegistryFromDB(id string) error {
	// 从data.json文件中读取
	data, err := readData()
	if err != nil {
		return err
	}

	var registries []Registry
	if regs, ok := data["registries"]; ok {
		bytes, err := json.Marshal(regs)
		if err != nil {
			return err
		}

		if err := json.Unmarshal(bytes, &registries); err != nil {
			return err
		}
	} else {
		return fmt.Errorf("镜像仓库不存在")
	}

	// 过滤掉要删除的注册表
	newRegistries := []Registry{}
	found := false
	for _, r := range registries {
		if r.ID != id {
			newRegistries = append(newRegistries, r)
		} else {
			found = true
		}
	}

	if !found {
		return fmt.Errorf("镜像仓库不存在: %s", id)
	}

	// 保存到数据库
	data["registries"] = newRegistries
	return saveData(data)
}

// GetPublicRepositories 获取公共镜像仓库内的仓库列表
func GetPublicRepositories() []map[string]interface{} {
	// 返回一些常用的公共镜像，仅用于演示
	return []map[string]interface{}{
		{"name": "nginx", "description": "官方Nginx镜像", "stars": 15000, "officialImage": true},
		{"name": "redis", "description": "官方Redis镜像", "stars": 12000, "officialImage": true},
		{"name": "mysql", "description": "官方MySQL镜像", "stars": 14000, "officialImage": true},
		{"name": "node", "description": "官方Node.js镜像", "stars": 11000, "officialImage": true},
		{"name": "python", "description": "官方Python镜像", "stars": 13000, "officialImage": true},
		{"name": "postgres", "description": "官方PostgreSQL镜像", "stars": 9000, "officialImage": true},
		{"name": "mongo", "description": "官方MongoDB镜像", "stars": 8000, "officialImage": true},
		{"name": "httpd", "description": "官方Apache HTTP服务器镜像", "stars": 5000, "officialImage": true},
		{"name": "ubuntu", "description": "官方Ubuntu镜像", "stars": 10000, "officialImage": true},
		{"name": "alpine", "description": "官方Alpine Linux镜像", "stars": 9500, "officialImage": true},
	}
}

// GetPublicTags 获取公共镜像仓库内的指定仓库的标签列表
func GetPublicTags(repository string) []string {
	// 根据不同的仓库名返回不同的标签列表
	switch repository {
	case "nginx":
		return []string{"latest", "1.25", "1.24", "1.23", "1.22", "1.21", "1.20", "alpine"}
	case "redis":
		return []string{"latest", "7.2", "7.0", "6.2", "6.0", "5.0", "alpine"}
	case "mysql":
		return []string{"latest", "8.0", "5.7", "5.6", "oracle"}
	case "node":
		return []string{"latest", "20", "18", "16", "14", "alpine"}
	case "python":
		return []string{"latest", "3.12", "3.11", "3.10", "3.9", "3.8", "3.7", "alpine"}
	case "postgres":
		return []string{"latest", "16", "15", "14", "13", "12", "alpine"}
	case "mongo":
		return []string{"latest", "7.0", "6.0", "5.0", "4.4"}
	case "httpd":
		return []string{"latest", "2.4", "alpine"}
	case "ubuntu":
		return []string{"latest", "22.04", "20.04", "18.04", "16.04"}
	case "alpine":
		return []string{"latest", "3.19", "3.18", "3.17", "3.16", "3.15"}
	default:
		return []string{"latest"}
	}
} 
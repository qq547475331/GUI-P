package model

import (
	"encoding/base64"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

// KubeConfig 表示Kubernetes配置
type KubeConfig struct {
	ID            string    `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	Description   string    `json:"description" db:"description"`
	Content       string    `json:"content" db:"content"` // base64编码的kubeconfig内容
	CurrentContext string   `json:"currentContext" db:"current_context"`
	ServerURL     string    `json:"serverUrl" db:"server_url"`
	IsActive      bool      `json:"isActive" db:"is_active"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`
}

// SaveKubeConfigToDB 保存KubeConfig到数据库
func SaveKubeConfigToDB(config *KubeConfig) error {
	if config.ID == "" {
		config.ID = uuid.New().String()
		config.CreatedAt = time.Now()
	}
	config.UpdatedAt = time.Now()

	// 检查是否已存在
	var exists bool
	err := DB.Get(&exists, "SELECT EXISTS(SELECT 1 FROM kube_configs WHERE id = $1)", config.ID)
	if err != nil {
		return fmt.Errorf("检查KubeConfig是否存在时出错: %v", err)
	}

	if exists {
		// 更新现有记录
		query := `
            UPDATE kube_configs 
            SET name = $1, description = $2, content = $3, current_context = $4, 
                server_url = $5, is_active = $6, updated_at = $7
            WHERE id = $8
        `
		_, err = DB.Exec(query, 
			config.Name, config.Description, config.Content, config.CurrentContext,
			config.ServerURL, config.IsActive, config.UpdatedAt, config.ID)
		if err != nil {
			return fmt.Errorf("更新KubeConfig失败: %v", err)
		}
	} else {
		// 插入新记录
		query := `
            INSERT INTO kube_configs (id, name, description, content, current_context, 
                server_url, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `
		_, err = DB.Exec(query, 
			config.ID, config.Name, config.Description, config.Content, config.CurrentContext,
			config.ServerURL, config.IsActive, config.CreatedAt, config.UpdatedAt)
		if err != nil {
			return fmt.Errorf("插入KubeConfig失败: %v", err)
		}
	}

	log.Printf("成功保存KubeConfig: %s (%s)", config.Name, config.ID)
	return nil
}

// GetKubeConfigsFromDB 从数据库获取所有KubeConfig
func GetKubeConfigsFromDB() ([]KubeConfig, error) {
	if DB == nil {
		return nil, fmt.Errorf("数据库连接未初始化")
	}

	var configs []KubeConfig
	query := `
        SELECT id, name, description, content, current_context, 
               server_url, is_active, created_at, updated_at
        FROM kube_configs
        WHERE is_active = true
        ORDER BY created_at DESC
    `
	
	err := DB.Select(&configs, query)
	if err != nil {
		log.Printf("查询 KubeConfig 失败: %v", err)
		return nil, fmt.Errorf("查询 KubeConfig 失败: %v", err)
	}

	return configs, nil
}

// GetKubeConfigByIDFromDB 从数据库获取指定ID的KubeConfig配置
func GetKubeConfigByIDFromDB(id string) (*KubeConfig, error) {
	// 输出日志
	log.Printf("从数据库获取KubeConfig配置 (ID: %s)", id)
	
	var config KubeConfig
	query := `
		SELECT 
			id, name, content, current_context, server_url, created_at, updated_at 
		FROM 
			kube_configs 
		WHERE 
			id = $1
	`
	
	err := DB.Get(&config, query, id)
	if err != nil {
		log.Printf("获取KubeConfig配置失败 (ID: %s): %v", id, err)
		return nil, fmt.Errorf("获取KubeConfig配置失败: %v", err)
	}
	
	// 检查content是否为空
	if config.Content == "" {
		return nil, fmt.Errorf("KubeConfig内容为空 (ID: %s)", id)
	}
	
	log.Printf("成功获取KubeConfig配置 (ID: %s, Name: %s)", config.ID, config.Name)
	return &config, nil
}

// DeleteKubeConfigFromDB 从数据库删除KubeConfig
func DeleteKubeConfigFromDB(id string) error {
	// 首先检查是否有应用引用该KubeConfig
	var appCount int
	err := DB.Get(&appCount, "SELECT COUNT(*) FROM applications WHERE kube_config_id = $1", id)
	if err != nil {
		return fmt.Errorf("检查KubeConfig引用时出错: %v", err)
	}

	if appCount > 0 {
		return fmt.Errorf("无法删除KubeConfig，有%d个应用正在使用它", appCount)
	}

	// 删除KubeConfig
	query := "DELETE FROM kube_configs WHERE id = $1"
	result, err := DB.Exec(query, id)
	if err != nil {
		return fmt.Errorf("删除KubeConfig失败: %v", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("获取影响行数时出错: %v", err)
	}

	if rows == 0 {
		return fmt.Errorf("未找到ID为%s的KubeConfig", id)
	}

	log.Printf("成功删除KubeConfig: %s", id)
	return nil
}

// EncodeKubeConfig 将KubeConfig编码为base64字符串
func EncodeKubeConfig(content []byte) string {
	return base64.StdEncoding.EncodeToString(content)
} 
package model

import (
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

// KubernetesResource 表示Kubernetes资源记录
type KubernetesResource struct {
	ID          string    `json:"id" db:"id"`
	ApplicationID string   `json:"applicationId" db:"application_id"`
	ResourceType string    `json:"resourceType" db:"resource_type"`
	ResourceName string    `json:"resourceName" db:"resource_name"`
	Namespace    string    `json:"namespace" db:"namespace"`
	ResourceYAML string    `json:"resourceYaml" db:"resource_yaml"`
	IsActive     bool      `json:"isActive" db:"is_active"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// SaveK8sResourceToDB 保存Kubernetes资源记录到数据库
func SaveK8sResourceToDB(resource *KubernetesResource) error {
	if resource.ID == "" {
		resource.ID = uuid.New().String()
		resource.CreatedAt = time.Now()
	}
	resource.UpdatedAt = time.Now()

	// 检查是否已存在
	var exists bool
	err := DB.Get(&exists, "SELECT EXISTS(SELECT 1 FROM kubernetes_resources WHERE id = $1)", resource.ID)
	if err != nil {
		return fmt.Errorf("检查资源是否存在时出错: %v", err)
	}

	if exists {
		// 更新现有记录
		query := `
            UPDATE kubernetes_resources 
            SET application_id = $1, resource_type = $2, resource_name = $3, 
                namespace = $4, resource_yaml = $5, is_active = $6, updated_at = $7
            WHERE id = $8
        `
		_, err = DB.Exec(query, 
			resource.ApplicationID, resource.ResourceType, resource.ResourceName,
			resource.Namespace, resource.ResourceYAML, resource.IsActive, resource.UpdatedAt,
			resource.ID)
		if err != nil {
			return fmt.Errorf("更新Kubernetes资源失败: %v", err)
		}
	} else {
		// 插入新记录
		query := `
            INSERT INTO kubernetes_resources (id, application_id, resource_type, resource_name, 
                namespace, resource_yaml, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `
		_, err = DB.Exec(query, 
			resource.ID, resource.ApplicationID, resource.ResourceType, resource.ResourceName,
			resource.Namespace, resource.ResourceYAML, resource.IsActive, resource.CreatedAt, 
			resource.UpdatedAt)
		if err != nil {
			return fmt.Errorf("插入Kubernetes资源失败: %v", err)
		}
	}

	log.Printf("成功保存Kubernetes资源: %s/%s (%s)", resource.Namespace, resource.ResourceName, resource.ResourceType)
	return nil
}

// GetK8sResourcesByAppIDFromDB 从数据库获取指定应用的所有Kubernetes资源
func GetK8sResourcesByAppIDFromDB(applicationID string) ([]KubernetesResource, error) {
	var resources []KubernetesResource
	query := `
        SELECT id, application_id, resource_type, resource_name, 
               namespace, resource_yaml, is_active, created_at, updated_at
        FROM kubernetes_resources
        WHERE application_id = $1 AND is_active = true
        ORDER BY created_at
    `
	err := DB.Select(&resources, query, applicationID)
	if err != nil {
		return nil, fmt.Errorf("获取应用的Kubernetes资源列表失败: %v", err)
	}

	return resources, nil
}

// GetK8sResourceByDetailsFromDB 通过详细信息从数据库获取Kubernetes资源
func GetK8sResourceByDetailsFromDB(appID string, resourceType string, name string, namespace string) (*KubernetesResource, error) {
	var resource KubernetesResource
	query := `
        SELECT id, application_id, resource_type, resource_name, 
               namespace, resource_yaml, is_active, created_at, updated_at
        FROM kubernetes_resources
        WHERE application_id = $1 AND resource_type = $2 AND resource_name = $3 AND namespace = $4
    `
	err := DB.Get(&resource, query, appID, resourceType, name, namespace)
	if err != nil {
		return nil, fmt.Errorf("获取Kubernetes资源失败: %v", err)
	}

	return &resource, nil
}

// DeactivateK8sResourceFromDB 在数据库中将Kubernetes资源标记为非活动
func DeactivateK8sResourceFromDB(id string) error {
	query := `
        UPDATE kubernetes_resources 
        SET is_active = false, updated_at = $1
        WHERE id = $2
    `
	now := time.Now()
	result, err := DB.Exec(query, now, id)
	if err != nil {
		return fmt.Errorf("标记Kubernetes资源为非活动状态失败: %v", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("获取影响行数时出错: %v", err)
	}

	if rows == 0 {
		return fmt.Errorf("未找到ID为%s的Kubernetes资源", id)
	}

	log.Printf("成功将Kubernetes资源 %s 标记为非活动", id)
	return nil
}

// DeactivateK8sResourcesByAppIDFromDB 将指定应用的所有Kubernetes资源标记为非活动
func DeactivateK8sResourcesByAppIDFromDB(applicationID string) error {
	query := `
        UPDATE kubernetes_resources 
        SET is_active = false, updated_at = $1
        WHERE application_id = $2 AND is_active = true
    `
	now := time.Now()
	result, err := DB.Exec(query, now, applicationID)
	if err != nil {
		return fmt.Errorf("标记应用的Kubernetes资源为非活动状态失败: %v", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("获取影响行数时出错: %v", err)
	}

	log.Printf("成功将应用 %s 的 %d 个Kubernetes资源标记为非活动", applicationID, rows)
	return nil
}

// DeleteK8sResourceFromDB 从数据库删除Kubernetes资源
func DeleteK8sResourceFromDB(id string) error {
	query := "DELETE FROM kubernetes_resources WHERE id = $1"
	result, err := DB.Exec(query, id)
	if err != nil {
		return fmt.Errorf("删除Kubernetes资源失败: %v", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("获取影响行数时出错: %v", err)
	}

	if rows == 0 {
		return fmt.Errorf("未找到ID为%s的Kubernetes资源", id)
	}

	log.Printf("成功删除Kubernetes资源: %s", id)
	return nil
} 
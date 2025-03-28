package model

import (
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
)

// Application 表示应用程序
type Application struct {
	ID              string            `json:"id" db:"id"`
	Name            string            `json:"name" db:"name"`
	Namespace       string            `json:"namespace" db:"namespace"`
	KubeConfigID    string            `json:"kubeConfigId" db:"kube_config_id"`
	Description     string            `json:"description" db:"description"`
	Status          string            `json:"status" db:"status"` // created, running, error, deleted
	ImageURL        string            `json:"imageUrl" db:"image_url"`
	DeploymentYAML  string            `json:"deploymentYaml" db:"deployment_yaml"`
	Replicas        int               `json:"replicas" db:"replicas"`
	Port            int               `json:"port" db:"port"`
	ServiceType     string            `json:"serviceType" db:"service_type"`
	CreatedAt       time.Time         `json:"createdAt" db:"created_at"`
	UpdatedAt       time.Time         `json:"updatedAt" db:"updated_at"`
	DeletedAt       *time.Time        `json:"deletedAt,omitempty" db:"deleted_at"`
	Image           string            `json:"image" db:"image"`
}

// SaveApplicationToDB 保存应用程序到数据库
func SaveApplicationToDB(app *Application) error {
	if app.ID == "" {
		app.ID = uuid.New().String()
		app.Status = "created"
		// 确保首次创建时正确设置时间
		now := time.Now()
		app.CreatedAt = now
		app.UpdatedAt = now
	} else {
		// 只有更新时才修改更新时间，保留创建时间
		app.UpdatedAt = time.Now()
	}

	// 检查是否已存在
	var exists bool
	err := DB.Get(&exists, "SELECT EXISTS(SELECT 1 FROM applications WHERE id = $1)", app.ID)
	if err != nil {
		return fmt.Errorf("检查应用是否存在时出错: %v", err)
	}

	if exists {
		// 更新现有记录
		query := `
            UPDATE applications 
            SET name = $1, namespace = $2, kube_config_id = $3, description = $4, 
                status = $5, image_url = $6, deployment_yaml = $7, replicas = $8, 
                port = $9, service_type = $10, updated_at = $11
            WHERE id = $12
        `
		_, err = DB.Exec(query, 
			app.Name, app.Namespace, app.KubeConfigID, app.Description,
			app.Status, app.ImageURL, app.DeploymentYAML, app.Replicas,
			app.Port, app.ServiceType, app.UpdatedAt, app.ID)
		if err != nil {
			return fmt.Errorf("更新应用失败: %v", err)
		}
	} else {
		// 插入新记录
		query := `
            INSERT INTO applications (id, name, namespace, kube_config_id, description, 
                status, image_url, deployment_yaml, replicas, port, service_type, 
                created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `
		_, err = DB.Exec(query, 
			app.ID, app.Name, app.Namespace, app.KubeConfigID, app.Description,
			app.Status, app.ImageURL, app.DeploymentYAML, app.Replicas,
			app.Port, app.ServiceType, app.CreatedAt, app.UpdatedAt)
		if err != nil {
			return fmt.Errorf("插入应用失败: %v", err)
		}
	}

	log.Printf("成功保存应用: %s (%s), 创建时间: %v, 更新时间: %v", app.Name, app.ID, app.CreatedAt, app.UpdatedAt)
	return nil
}

// GetApplicationsFromDB 从数据库获取所有应用程序
func GetApplicationsFromDB() ([]Application, error) {
	var apps []Application
	query := `
        SELECT id, name, namespace, kube_config_id, description, 
               status, image_url, deployment_yaml, replicas, port, 
               service_type, created_at, updated_at, deleted_at
        FROM applications
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
    `
	err := DB.Select(&apps, query)
	if err != nil {
		return nil, fmt.Errorf("获取应用列表失败: %v", err)
	}

	return apps, nil
}

// GetApplicationByIDFromDB 从数据库获取指定ID的应用程序
func GetApplicationByIDFromDB(id string) (*Application, error) {
	var app Application
	query := `
        SELECT id, name, namespace, kube_config_id, description, 
               status, image_url, deployment_yaml, replicas, port, 
               service_type, created_at, updated_at, deleted_at
        FROM applications
        WHERE id = $1 AND deleted_at IS NULL
    `
	err := DB.Get(&app, query, id)
	if err != nil {
		return nil, fmt.Errorf("获取应用失败: %v", err)
	}

	return &app, nil
}

// SoftDeleteApplicationFromDB 软删除应用程序
func SoftDeleteApplicationFromDB(id string) error {
	// 标记应用为已删除
	now := time.Now()
	query := `
        UPDATE applications 
        SET status = 'deleted', deleted_at = $1, updated_at = $1
        WHERE id = $2 AND deleted_at IS NULL
    `
	result, err := DB.Exec(query, now, id)
	if err != nil {
		return fmt.Errorf("软删除应用失败: %v", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("获取影响行数时出错: %v", err)
	}

	if rows == 0 {
		return fmt.Errorf("未找到ID为%s的应用", id)
	}

	log.Printf("成功软删除应用: %s", id)
	return nil
}

// HardDeleteApplicationFromDB 从数据库硬删除应用程序
func HardDeleteApplicationFromDB(id string) error {
	// 首先删除所有相关的Kubernetes资源记录
	_, err := DB.Exec("DELETE FROM kubernetes_resources WHERE application_id = $1", id)
	if err != nil {
		return fmt.Errorf("删除应用的Kubernetes资源记录失败: %v", err)
	}

	// 删除应用记录
	query := "DELETE FROM applications WHERE id = $1"
	result, err := DB.Exec(query, id)
	if err != nil {
		return fmt.Errorf("删除应用失败: %v", err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("获取影响行数时出错: %v", err)
	}

	if rows == 0 {
		return fmt.Errorf("未找到ID为%s的应用", id)
	}

	log.Printf("成功硬删除应用: %s", id)
	return nil
}

// UpdateApplicationStatusToDB 更新应用程序状态
func UpdateApplicationStatusToDB(id string, status string) error {
	// 首先获取现有的应用信息，以保留原始的创建时间和更新时间
	_, err := GetApplicationByIDFromDB(id)
	if err != nil {
		return fmt.Errorf("获取应用失败: %v", err)
	}
	
	// 更新状态
	query := `
        UPDATE applications 
        SET status = $1, updated_at = $2
        WHERE id = $3
    `
	now := time.Now()
	_, err = DB.Exec(query, status, now, id)
	if err != nil {
		return fmt.Errorf("更新应用状态失败: %v", err)
	}

	log.Printf("成功更新应用 %s 的状态为 %s", id, status)
	return nil
}

// ApplicationV2 应用配置
type ApplicationV2 struct {
	ID          string    `json:"id"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	AppName     string    `json:"appName"`
	ImageSource string    `json:"imageSource"` // public 或 private
	ImageName   string    `json:"imageName"`
	Username    string    `json:"username,omitempty"`
	Password    string    `json:"password,omitempty"`
	Registry    string    `json:"registry"`
	DeployMode  string    `json:"deployMode"` // fixed 或 elastic
	Instances   int       `json:"instances"`
	CPU         float64   `json:"cpu"`
	Memory      int       `json:"memory"`

	// 网络配置
	ContainerPort string `json:"containerPort"`
	PublicAccess  bool   `json:"publicAccess"`
	Ports         []Port `json:"ports"`

	// 高级配置
	UseCustomCommand string      `json:"useCustomCommand"` // yes 或 no
	Command          string      `json:"command,omitempty"`
	Args             string      `json:"args,omitempty"`
	EnvVars          []EnvVar    `json:"envVars"`
	ConfigFiles      []ConfigFile `json:"configFiles"`
	Volumes          []Volume     `json:"volumes"`

	// Kubernetes配置
	KubeConfigID string `json:"kubeConfigID,omitempty"` // 关联的KubeConfig ID
	Namespace    string `json:"namespace,omitempty"`     // 命名空间

	// 部署状态
	Status DeploymentStatus `json:"status"`
}

// Port 端口配置
type Port struct {
	Port         string `json:"port"`
	PublicAccess bool   `json:"publicAccess"`
}

// EnvVar 环境变量
type EnvVar struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// ConfigFile 配置文件
type ConfigFile struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Content string `json:"content"`
}

// Volume 存储卷
type Volume struct {
	Name      string `json:"name"`
	MountPath string `json:"mountPath"`
	Size      int    `json:"size"` // GB
}

// DeploymentStatus 部署状态
type DeploymentStatus struct {
	Phase      string    `json:"phase"` // Pending, Running, Failed, Succeeded
	Message    string    `json:"message"`
	StartTime  time.Time `json:"startTime"`
	FinishTime time.Time `json:"finishTime,omitempty"`
}

// ResourceQuota 资源配额
type ResourceQuota struct {
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"` // GB
	Storage float64 `json:"storage"` // GB
	Total   float64 `json:"total"`
}

// PriceEstimation 价格预估
type PriceEstimation struct {
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	Storage float64 `json:"storage"`
	Total   float64 `json:"total"`
}

// NewApplication 创建新应用
func NewApplicationV2() *ApplicationV2 {
	return &ApplicationV2{
		ID:        uuid.New().String(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Status: DeploymentStatus{
			Phase: "Pending",
		},
		EnvVars:     []EnvVar{},
		ConfigFiles: []ConfigFile{},
		Volumes:     []Volume{},
		Ports:       []Port{},
		Namespace:   "default", // 默认命名空间
	}
}

// CheckApplicationExists 检查指定名称、命名空间和KubeConfig的应用是否已存在
func CheckApplicationExists(name string, namespace string, kubeConfigID string) (bool, error) {
	var exists bool
	query := `
		SELECT EXISTS(
			SELECT 1 
			FROM applications 
			WHERE name = $1 
			AND namespace = $2 
			AND kube_config_id = $3
			AND deleted_at IS NULL
		)
	`
	err := DB.Get(&exists, query, name, namespace, kubeConfigID)
	if err != nil {
		return false, fmt.Errorf("检查应用是否存在时出错: %v", err)
	}
	
	return exists, nil
}
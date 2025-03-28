package model

import (
	"sync"
	"time"
)

// Data 是存储所有应用程序数据的结构
type Data struct {
	Applications    []Application    `json:"applications"`
	KubeConfigs     []KubeConfigV1   `json:"kubeConfigs"`
	ImageRegistries []ImageRegistry  `json:"imageRegistries"`
	mu              sync.RWMutex     // 用于并发控制
}

// KubeConfig 表示Kubernetes配置
type KubeConfigV1 struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	ConfigContent string    `json:"configContent,omitempty"` // kubeconfig内容，API响应时不返回
	Contexts      []string  `json:"contexts"`
	CurrentContext string   `json:"currentContext"`        // 当前使用的上下文
	ClusterName   string    `json:"clusterName"`          // 集群名称
	CreatedAt     time.Time `json:"createdAt"`
}

// ImageRegistry 表示镜像仓库
type ImageRegistry struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	URL       string    `json:"url"`
	Username  string    `json:"username,omitempty"`
	Password  string    `json:"password,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
} 
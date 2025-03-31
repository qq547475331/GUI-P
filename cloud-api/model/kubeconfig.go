package model

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"sync"
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

// NamespaceCache 表示命名空间缓存
type NamespaceCache struct {
	ID          string    `json:"id" db:"id"`
	KubeConfigID string   `json:"kubeConfigId" db:"kube_config_id"`
	Name        string    `json:"name" db:"name"`
	Status      string    `json:"status" db:"status"`
	Labels      string    `json:"labels" db:"labels"`       // JSON格式存储的标签
	Annotations string    `json:"annotations" db:"annotations"` // JSON格式存储的注解
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`
	LastSyncedAt time.Time `json:"lastSyncedAt" db:"last_synced_at"`
}

// GetNamespacesFromCache 从缓存表中获取命名空间
func GetNamespacesFromCache(kubeConfigID string) ([]NamespaceCache, error) {
	if DB == nil {
		return nil, fmt.Errorf("数据库连接未初始化")
	}

	var namespaces []NamespaceCache
	query := `
		SELECT id, kube_config_id, name, status, labels, annotations, 
		       created_at, updated_at, last_synced_at
		FROM namespace_cache
		WHERE kube_config_id = $1
		ORDER BY name ASC
	`
	
	err := DB.Select(&namespaces, query, kubeConfigID)
	if err != nil {
		log.Printf("从缓存查询命名空间失败 (KubeConfigID: %s): %v", kubeConfigID, err)
		return nil, fmt.Errorf("查询命名空间缓存失败: %v", err)
	}

	// 如果没有缓存数据，返回空数组而不是错误
	if len(namespaces) == 0 {
		log.Printf("命名空间缓存为空，返回空数组 (KubeConfigID: %s)", kubeConfigID)
	} else {
		log.Printf("从缓存获取到%d个命名空间 (KubeConfigID: %s)", len(namespaces), kubeConfigID)
	}

	return namespaces, nil
}

// UpsertNamespaceCache 更新或插入命名空间缓存
func UpsertNamespaceCache(namespace *NamespaceCache) error {
	if namespace.ID == "" {
		namespace.ID = uuid.New().String()
		namespace.CreatedAt = time.Now()
	}
	namespace.UpdatedAt = time.Now()
	namespace.LastSyncedAt = time.Now()

	// 检查是否已存在
	var exists bool
	err := DB.Get(&exists, "SELECT EXISTS(SELECT 1 FROM namespace_cache WHERE kube_config_id = $1 AND name = $2)", 
		namespace.KubeConfigID, namespace.Name)
	if err != nil {
		return fmt.Errorf("检查命名空间缓存是否存在时出错: %v", err)
	}

	if exists {
		// 更新现有记录
		query := `
			UPDATE namespace_cache 
			SET status = $1, labels = $2, annotations = $3, 
				updated_at = $4, last_synced_at = $5
			WHERE kube_config_id = $6 AND name = $7
		`
		_, err = DB.Exec(query, 
			namespace.Status, namespace.Labels, namespace.Annotations,
			namespace.UpdatedAt, namespace.LastSyncedAt, 
			namespace.KubeConfigID, namespace.Name)
		if err != nil {
			return fmt.Errorf("更新命名空间缓存失败: %v", err)
		}
	} else {
		// 插入新记录
		query := `
			INSERT INTO namespace_cache 
			(id, kube_config_id, name, status, labels, annotations, 
			 created_at, updated_at, last_synced_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		`
		_, err = DB.Exec(query, 
			namespace.ID, namespace.KubeConfigID, namespace.Name, 
			namespace.Status, namespace.Labels, namespace.Annotations, 
			namespace.CreatedAt, namespace.UpdatedAt, namespace.LastSyncedAt)
		if err != nil {
			return fmt.Errorf("插入命名空间缓存失败: %v", err)
		}
	}

	return nil
}

// 添加同步状态变量和锁
var (
	namespaceSyncLock    sync.Mutex
	namespaceSyncInProgress = make(map[string]bool)
	namespaceSyncLockMap = &sync.RWMutex{}
)

// SyncNamespacesToCache 同步命名空间到缓存表
func SyncNamespacesToCache(k8sManager *K8sManager) error {
	// 获取所有活跃的kubeconfig
	configs, err := GetKubeConfigsFromDB()
	if err != nil {
		return fmt.Errorf("获取KubeConfig列表失败: %v", err)
	}

	for _, config := range configs {
		if !config.IsActive {
			continue
		}

		// 检查是否已经在同步中
		namespaceSyncLockMap.RLock()
		inProgress := namespaceSyncInProgress[config.ID]
		namespaceSyncLockMap.RUnlock()
		
		if inProgress {
			log.Printf("跳过正在同步中的命名空间 (KubeConfigID: %s)", config.ID)
			continue
		}
		
		// 标记为同步中
		namespaceSyncLockMap.Lock()
		namespaceSyncInProgress[config.ID] = true
		namespaceSyncLockMap.Unlock()
		
		// 完成后清除标记
		defer func(configID string) {
			namespaceSyncLockMap.Lock()
			delete(namespaceSyncInProgress, configID)
			namespaceSyncLockMap.Unlock()
		}(config.ID)
		
		// 从K8s获取命名空间
		namespaces, err := k8sManager.GetNamespaces(config.ID)
		if err != nil {
			log.Printf("同步命名空间失败 (KubeConfigID: %s): %v", config.ID, err)
			continue
		}

		// 更新缓存
		for _, ns := range namespaces {
			// 将map转换为JSON字符串
			var labels, annotations string
			
			if ns["labels"] != nil {
				labelsBytes, _ := json.Marshal(ns["labels"])
				labels = string(labelsBytes)
			} else {
				labels = "{}"
			}
			
			if ns["annotations"] != nil {
				annotationsBytes, _ := json.Marshal(ns["annotations"])
				annotations = string(annotationsBytes)
			} else {
				annotations = "{}"
			}

			// 创建或更新缓存
			namespace := &NamespaceCache{
				KubeConfigID: config.ID,
				Name:         ns["name"].(string),
				Status:       ns["status"].(string),
				Labels:       labels,
				Annotations:  annotations,
			}

			if err := UpsertNamespaceCache(namespace); err != nil {
				log.Printf("缓存命名空间失败 (KubeConfigID: %s, Namespace: %s): %v", 
					config.ID, ns["name"], err)
				continue
			}
		}

		log.Printf("成功同步%d个命名空间到缓存 (KubeConfigID: %s)", len(namespaces), config.ID)
	}

	return nil
}

// SaveNamespacesToCache 直接保存命名空间列表到缓存，不触发循环同步
func SaveNamespacesToCache(kubeConfigID string, namespaces []map[string]interface{}) error {
	// 锁定操作
	namespaceSyncLock.Lock()
	defer namespaceSyncLock.Unlock()
	
	for _, ns := range namespaces {
		// 将map转换为JSON字符串
		var labels, annotations string
		
		if ns["labels"] != nil {
			labelsBytes, _ := json.Marshal(ns["labels"])
			labels = string(labelsBytes)
		} else {
			labels = "{}"
		}
		
		if ns["annotations"] != nil {
			annotationsBytes, _ := json.Marshal(ns["annotations"])
			annotations = string(annotationsBytes)
		} else {
			annotations = "{}"
		}

		// 创建或更新缓存
		namespace := &NamespaceCache{
			KubeConfigID: kubeConfigID,
			Name:         ns["name"].(string),
			Status:       ns["status"].(string),
			Labels:       labels,
			Annotations:  annotations,
		}

		if err := UpsertNamespaceCache(namespace); err != nil {
			log.Printf("缓存命名空间失败 (KubeConfigID: %s, Namespace: %s): %v", 
				kubeConfigID, ns["name"], err)
			continue
		}
	}
	
	log.Printf("成功直接保存%d个命名空间到缓存 (KubeConfigID: %s)", len(namespaces), kubeConfigID)
	return nil
}

// GetNamespacesList 获取命名空间列表字符串，优先使用缓存
func GetNamespacesList(kubeConfigID string, k8sManager *K8sManager) ([]string, error) {
	// 限流检查 - 防止短时间内过多请求
	namespaceSyncLockMap.RLock()
	inProgress := namespaceSyncInProgress[kubeConfigID]
	namespaceSyncLockMap.RUnlock()
	
	if inProgress {
		log.Printf("命名空间同步已在进行中，直接返回默认命名空间 (KubeConfigID: %s)", kubeConfigID)
		return []string{"default", "kube-system", "kube-public"}, nil
	}
	
	// 先尝试从缓存获取
	cachedNamespaces, err := GetNamespacesFromCache(kubeConfigID)
	
	// 如果缓存有数据且不为空，直接返回
	if err == nil && len(cachedNamespaces) > 0 {
		// 检查最后同步时间，如果超过1小时，在后台触发同步但仍返回缓存数据
		if len(cachedNamespaces) > 0 && time.Since(cachedNamespaces[0].LastSyncedAt) > 1*time.Hour {
			// 检查是否已经在同步中
			namespaceSyncLockMap.RLock()
			inProgress := namespaceSyncInProgress[kubeConfigID]
			namespaceSyncLockMap.RUnlock()
			
			if !inProgress {
				go func() {
				// 标记为同步中
				namespaceSyncLockMap.Lock()
				namespaceSyncInProgress[kubeConfigID] = true
				namespaceSyncLockMap.Unlock()
				
				// 单独获取并更新此集群的命名空间，避免全量同步
				log.Printf("后台更新命名空间缓存 (KubeConfigID: %s)", kubeConfigID)
				namespaces, err := k8sManager.GetNamespaces(kubeConfigID)
				if err != nil {
					log.Printf("后台更新命名空间失败: %v", err)
				} else {
					if err := SaveNamespacesToCache(kubeConfigID, namespaces); err != nil {
						log.Printf("保存命名空间到缓存失败: %v", err)
						}
					}
					
					// 完成后清除标记
					namespaceSyncLockMap.Lock()
					delete(namespaceSyncInProgress, kubeConfigID)
					namespaceSyncLockMap.Unlock()
				}()
			}
		}

		// 立即从缓存返回结果
		result := make([]string, len(cachedNamespaces))
		for i, ns := range cachedNamespaces {
			result[i] = ns.Name
		}
		return result, nil
	}
	
	// 检查是否已经在同步中
	namespaceSyncLockMap.RLock()
	inProgress = namespaceSyncInProgress[kubeConfigID]
	namespaceSyncLockMap.RUnlock()
	
	if inProgress {
		log.Printf("命名空间同步正在进行中，返回默认命名空间 (KubeConfigID: %s)", kubeConfigID)
		return []string{"default", "kube-system", "kube-public"}, nil
	}
	
	// 如果缓存没有数据，则从K8s API获取
	log.Printf("命名空间缓存未命中，直接从K8s API获取 (KubeConfigID: %s)", kubeConfigID)
	
	// 标记为同步中
	namespaceSyncLockMap.Lock()
	namespaceSyncInProgress[kubeConfigID] = true
	namespaceSyncLockMap.Unlock()
	
	// 完成后清除标记
	defer func() {
		namespaceSyncLockMap.Lock()
		delete(namespaceSyncInProgress, kubeConfigID)
		namespaceSyncLockMap.Unlock()
	}()
	
	namespacesData, err := k8sManager.GetNamespaces(kubeConfigID)
	if err != nil {
		log.Printf("从K8s API获取命名空间失败 (KubeConfigID: %s): %v", kubeConfigID, err)
		// 返回默认命名空间列表而不是错误
		return []string{"default", "kube-system", "kube-public"}, nil
	}
	
	// 直接保存到缓存，不触发全量同步
	if err := SaveNamespacesToCache(kubeConfigID, namespacesData); err != nil {
		log.Printf("保存命名空间到缓存失败: %v", err)
	}
	
	// 返回从API获取的结果
	result := make([]string, len(namespacesData))
	for i, ns := range namespacesData {
		result[i] = ns["name"].(string)
	}
	return result, nil
}

// RefreshNamespaceCache 刷新指定KubeConfig的命名空间缓存
func RefreshNamespaceCache(kubeConfigID string, k8sManager *K8sManager) error {
	// 首先检查是否正在同步中
	namespaceSyncLockMap.RLock()
	inProgress := namespaceSyncInProgress[kubeConfigID]
	namespaceSyncLockMap.RUnlock()
	
	if inProgress {
		log.Printf("命名空间已在同步中，跳过刷新操作 (KubeConfigID: %s)", kubeConfigID)
		return nil
	}
	
	// 标记为同步中
	namespaceSyncLockMap.Lock()
	namespaceSyncInProgress[kubeConfigID] = true
	namespaceSyncLockMap.Unlock()
	
	// 完成后清除标记
	defer func() {
		namespaceSyncLockMap.Lock()
		delete(namespaceSyncInProgress, kubeConfigID)
		namespaceSyncLockMap.Unlock()
		log.Printf("命名空间缓存刷新完成 (KubeConfigID: %s)", kubeConfigID)
	}()
	
	// 从Kubernetes API获取最新的命名空间
	log.Printf("从Kubernetes API获取命名空间数据 (KubeConfigID: %s)", kubeConfigID)
	namespacesData, err := k8sManager.GetNamespaces(kubeConfigID)
	if err != nil {
		log.Printf("刷新命名空间缓存失败 (KubeConfigID: %s): %v", kubeConfigID, err)
		return fmt.Errorf("获取命名空间数据失败: %v", err)
	}
	
	// 保存到缓存中
	if err := SaveNamespacesToCache(kubeConfigID, namespacesData); err != nil {
		log.Printf("保存命名空间到缓存失败 (KubeConfigID: %s): %v", kubeConfigID, err)
		return fmt.Errorf("保存命名空间缓存失败: %v", err)
	}
	
	log.Printf("成功刷新命名空间缓存，共%d个命名空间 (KubeConfigID: %s)", len(namespacesData), kubeConfigID)
	return nil
} 
package model

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"database/sql"
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
	
	// 新增字段: 镜像拉取策略
	ImagePullPolicy string            `json:"imagePullPolicy" db:"image_pull_policy"`
	
	// 新增字段: 健康检查
	LivenessProbe   *ProbeConfig      `json:"livenessProbe,omitempty" db:"liveness_probe_json"`
	ReadinessProbe  *ProbeConfig      `json:"readinessProbe,omitempty" db:"readiness_probe_json"`
	StartupProbe    *ProbeConfig      `json:"startupProbe,omitempty" db:"startup_probe_json"`
	
	// 新增字段: 生命周期钩子
	Lifecycle       *LifecycleConfig  `json:"lifecycle,omitempty" db:"lifecycle_json"`
	
	// 新增字段: 启动命令和参数
	Command         []string          `json:"command,omitempty" db:"command_json"`
	Args            []string          `json:"args,omitempty" db:"args_json"`
	
	// 新增字段: 环境变量
	EnvVars         []EnvVar          `json:"envVars,omitempty" db:"env_vars_json"`
	
	// 新增字段: 安全上下文
	SecurityContext *SecurityContext  `json:"securityContext,omitempty" db:"security_context_json"`
	
	// 新增字段: 调度规则
	NodeSelector    map[string]string `json:"nodeSelector,omitempty" db:"node_selector_json"`
	Tolerations     []Toleration      `json:"tolerations,omitempty" db:"tolerations_json"`
	Affinity        *Affinity         `json:"affinity,omitempty" db:"affinity_json"`
	
	// 新增字段: 存储设置
	Volumes         []VolumeConfig    `json:"volumes,omitempty" db:"volumes_json"`
	VolumeMounts    []VolumeMount     `json:"volumeMounts,omitempty" db:"volume_mounts_json"`
	
	// 新增字段: 同步主机时区
	SyncHostTimezone bool              `json:"syncHostTimezone,omitempty" db:"sync_host_timezone"`
	
	// 新增字段: 更新策略
	UpdateStrategy  string            `json:"updateStrategy,omitempty" db:"update_strategy"`
	RollingUpdate   *RollingUpdateConfig `json:"rollingUpdate,omitempty" db:"rolling_update_json"`
	
	// 新增字段: 标签和注解
	Labels          map[string]string `json:"labels,omitempty" db:"labels_json"`
	Annotations     map[string]string `json:"annotations,omitempty" db:"annotations_json"`
}

// 健康检查配置
type ProbeConfig struct {
	Path                string `json:"path,omitempty"`
	Port                int    `json:"port,omitempty"`
	InitialDelaySeconds int    `json:"initialDelaySeconds,omitempty"`
	PeriodSeconds       int    `json:"periodSeconds,omitempty"`
	TimeoutSeconds      int    `json:"timeoutSeconds,omitempty"`
	FailureThreshold    int    `json:"failureThreshold,omitempty"`
	SuccessThreshold    int    `json:"successThreshold,omitempty"`
	ProbeType           string `json:"probeType,omitempty"` // http, tcp, command
	Command             string `json:"command,omitempty"`
}

// 生命周期钩子配置
type LifecycleConfig struct {
	PostStart *Handler `json:"postStart,omitempty"`
	PreStop   *Handler `json:"preStop,omitempty"`
}

// 生命周期处理器
type Handler struct {
	Command []string `json:"command,omitempty"`
	Path    string   `json:"path,omitempty"`
	Port    int      `json:"port,omitempty"`
}

// 安全上下文配置
type SecurityContext struct {
	RunAsUser             *int64 `json:"runAsUser,omitempty"`
	RunAsGroup            *int64 `json:"runAsGroup,omitempty"`
	RunAsNonRoot          *bool  `json:"runAsNonRoot,omitempty"`
	ReadOnlyRootFilesystem *bool  `json:"readOnlyRootFilesystem,omitempty"`
	Privileged            *bool  `json:"privileged,omitempty"`
	AllowPrivilegeEscalation *bool `json:"allowPrivilegeEscalation,omitempty"`
}

// 容忍配置
type Toleration struct {
	Key      string `json:"key,omitempty"`
	Operator string `json:"operator,omitempty"`
	Value    string `json:"value,omitempty"`
	Effect   string `json:"effect,omitempty"`
}

// 亲和性配置
type Affinity struct {
	NodeAffinity    *NodeAffinity    `json:"nodeAffinity,omitempty"`
	PodAffinity     *PodAffinity     `json:"podAffinity,omitempty"`
	PodAntiAffinity *PodAntiAffinity `json:"podAntiAffinity,omitempty"`
}

// 节点亲和性
type NodeAffinity struct {
	RequiredDuringSchedulingIgnoredDuringExecution *NodeSelector `json:"requiredDuringSchedulingIgnoredDuringExecution,omitempty"`
}

// 节点选择器
type NodeSelector struct {
	NodeSelectorTerms []NodeSelectorTerm `json:"nodeSelectorTerms,omitempty"`
}

// 节点选择器条件
type NodeSelectorTerm struct {
	MatchExpressions []NodeSelectorRequirement `json:"matchExpressions,omitempty"`
}

// 节点选择器要求
type NodeSelectorRequirement struct {
	Key      string   `json:"key,omitempty"`
	Operator string   `json:"operator,omitempty"`
	Values   []string `json:"values,omitempty"`
}

// Pod亲和性
type PodAffinity struct {
	RequiredDuringSchedulingIgnoredDuringExecution []PodAffinityTerm `json:"requiredDuringSchedulingIgnoredDuringExecution,omitempty"`
}

// Pod反亲和性
type PodAntiAffinity struct {
	RequiredDuringSchedulingIgnoredDuringExecution []PodAffinityTerm `json:"requiredDuringSchedulingIgnoredDuringExecution,omitempty"`
}

// Pod亲和性条件
type PodAffinityTerm struct {
	TopologyKey string              `json:"topologyKey,omitempty"`
	LabelSelector *PodLabelSelector `json:"labelSelector,omitempty"`
}

// Pod标签选择器
type PodLabelSelector struct {
	MatchLabels map[string]string          `json:"matchLabels,omitempty"`
	MatchExpressions []LabelSelectorRequirement `json:"matchExpressions,omitempty"`
}

// 标签选择器要求
type LabelSelectorRequirement struct {
	Key      string   `json:"key,omitempty"`
	Operator string   `json:"operator,omitempty"`
	Values   []string `json:"values,omitempty"`
}

// 卷配置
type VolumeConfig struct {
	Name        string `json:"name,omitempty"`
	Type        string `json:"type,omitempty"` // configMap, secret, emptyDir, pvc, hostPath
	ConfigMap   string `json:"configMap,omitempty"`
	Secret      string `json:"secret,omitempty"`
	ClaimName   string `json:"claimName,omitempty"`
	HostPath    string `json:"hostPath,omitempty"`
	Medium      string `json:"medium,omitempty"` // "" or "Memory"
}

// 卷挂载
type VolumeMount struct {
	Name        string `json:"name,omitempty"`
	MountPath   string `json:"mountPath,omitempty"`
	SubPath     string `json:"subPath,omitempty"`
	ReadOnly    bool   `json:"readOnly,omitempty"`
}

// 环境变量
type EnvVar struct {
	Name        string `json:"name,omitempty"`
	Value       string `json:"value,omitempty"`
	ConfigMapKey string `json:"configMapKey,omitempty"`
	SecretKey   string `json:"secretKey,omitempty"`
}

// SaveApplicationToDB 将应用程序保存到数据库
func SaveApplicationToDB(app *Application) error {
	if app.ID == "" {
		return fmt.Errorf("应用ID不能为空")
	}

	// 验证必要字段
	if app.Name == "" {
		return fmt.Errorf("应用名称不能为空")
	}

	// 检查KubeConfigID是否有效
	if app.KubeConfigID == "" {
		return fmt.Errorf("KubeConfigID不能为空")
	}

	// 默认命名空间
	if app.Namespace == "" {
		app.Namespace = "default"
	}

	// 默认副本数
	if app.Replicas < 1 {
		app.Replicas = 1
	}

	// 序列化健康检查和生命周期钩子JSON字段前进行验证
	
	// 处理存活探针
	if app.LivenessProbe != nil {
		livenessProbeValid := false
		if len(app.LivenessProbe.Command) > 0 || 
			(app.LivenessProbe.Path != "" && app.LivenessProbe.Port > 0) ||
			(app.LivenessProbe.Port > 0) {
			livenessProbeValid = true
		}
		
		if !livenessProbeValid {
			app.LivenessProbe = nil
		}
	}
	
	// 处理就绪探针
	if app.ReadinessProbe != nil {
		readinessProbeValid := false
		if len(app.ReadinessProbe.Command) > 0 || 
			(app.ReadinessProbe.Path != "" && app.ReadinessProbe.Port > 0) ||
			(app.ReadinessProbe.Port > 0) {
			readinessProbeValid = true
		}
		
		if !readinessProbeValid {
			app.ReadinessProbe = nil
		}
	}
	
	// 处理启动探针
	if app.StartupProbe != nil {
		startupProbeValid := false
		if len(app.StartupProbe.Command) > 0 || 
			(app.StartupProbe.Path != "" && app.StartupProbe.Port > 0) ||
			(app.StartupProbe.Port > 0) {
			startupProbeValid = true
		}
		
		if !startupProbeValid {
			app.StartupProbe = nil
		}
	}
	
	// 处理生命周期钩子
	if app.Lifecycle != nil {
		lifecycleValid := false
		
		// 检查PostStart钩子
		if app.Lifecycle.PostStart != nil {
			postStartValid := false
			if len(app.Lifecycle.PostStart.Command) > 0 ||
				(app.Lifecycle.PostStart.Path != "" && app.Lifecycle.PostStart.Port > 0) {
				postStartValid = true
			}
			
			if !postStartValid {
				app.Lifecycle.PostStart = nil
			} else {
				lifecycleValid = true
			}
		}
		
		// 检查PreStop钩子
		if app.Lifecycle.PreStop != nil {
			preStopValid := false
			if len(app.Lifecycle.PreStop.Command) > 0 ||
				(app.Lifecycle.PreStop.Path != "" && app.Lifecycle.PreStop.Port > 0) {
				preStopValid = true
			}
			
			if !preStopValid {
				app.Lifecycle.PreStop = nil
			} else {
				lifecycleValid = true
			}
		}
		
		// 如果没有有效的钩子，则整个生命周期配置无效
		if !lifecycleValid {
			app.Lifecycle = nil
		}
	}
	
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

	// 将JSON字段序列化
	livenessProbeJSON, err := serializeJSONField(app.LivenessProbe)
	if err != nil {
		return fmt.Errorf("序列化存活探针失败: %v", err)
	}

	readinessProbeJSON, err := serializeJSONField(app.ReadinessProbe)
	if err != nil {
		return fmt.Errorf("序列化就绪探针失败: %v", err)
	}

	startupProbeJSON, err := serializeJSONField(app.StartupProbe)
	if err != nil {
		return fmt.Errorf("序列化启动探针失败: %v", err)
	}

	lifecycleJSON, err := serializeJSONField(app.Lifecycle)
	if err != nil {
		return fmt.Errorf("序列化生命周期钩子失败: %v", err)
	}

	commandJSON, err := serializeJSONField(app.Command)
	if err != nil {
		return fmt.Errorf("序列化启动命令失败: %v", err)
	}

	argsJSON, err := serializeJSONField(app.Args)
	if err != nil {
		return fmt.Errorf("序列化启动参数失败: %v", err)
	}

	envVarsJSON, err := serializeJSONField(app.EnvVars)
	if err != nil {
		return fmt.Errorf("序列化环境变量失败: %v", err)
	}

	securityContextJSON, err := serializeJSONField(app.SecurityContext)
	if err != nil {
		return fmt.Errorf("序列化安全上下文失败: %v", err)
	}

	nodeSelectorJSON, err := serializeJSONField(app.NodeSelector)
	if err != nil {
		return fmt.Errorf("序列化节点选择器失败: %v", err)
	}

	tolerationsJSON, err := serializeJSONField(app.Tolerations)
	if err != nil {
		return fmt.Errorf("序列化容忍配置失败: %v", err)
	}

	affinityJSON, err := serializeJSONField(app.Affinity)
	if err != nil {
		return fmt.Errorf("序列化亲和性配置失败: %v", err)
	}

	volumesJSON, err := serializeJSONField(app.Volumes)
	if err != nil {
		return fmt.Errorf("序列化卷配置失败: %v", err)
	}

	volumeMountsJSON, err := serializeJSONField(app.VolumeMounts)
	if err != nil {
		return fmt.Errorf("序列化卷挂载配置失败: %v", err)
	}

	rollingUpdateJSON, err := serializeJSONField(app.RollingUpdate)
	if err != nil {
		return fmt.Errorf("序列化滚动更新配置失败: %v", err)
	}

	labelsJSON, err := serializeJSONField(app.Labels)
	if err != nil {
		return fmt.Errorf("序列化标签失败: %v", err)
	}

	annotationsJSON, err := serializeJSONField(app.Annotations)
	if err != nil {
		return fmt.Errorf("序列化注解失败: %v", err)
	}

	// 检查是否已存在
	var exists bool
	err = DB.Get(&exists, "SELECT EXISTS(SELECT 1 FROM applications WHERE id = $1)", app.ID)
	if err != nil {
		return fmt.Errorf("检查应用是否存在时出错: %v", err)
	}

	if exists {
		// 更新现有记录
		query := `
            UPDATE applications 
            SET name = $1, namespace = $2, kube_config_id = $3, description = $4, 
                status = $5, image_url = $6, deployment_yaml = $7, replicas = $8, 
                port = $9, service_type = $10, updated_at = $11, image_pull_policy = $12,
                liveness_probe_json = $13, readiness_probe_json = $14, startup_probe_json = $15,
                lifecycle_json = $16, command_json = $17, args_json = $18, env_vars_json = $19,
                security_context_json = $20, node_selector_json = $21, tolerations_json = $22,
                affinity_json = $23, volumes_json = $24, volume_mounts_json = $25,
                sync_host_timezone = $26, update_strategy = $27, rolling_update_json = $28,
                labels_json = $29, annotations_json = $30
            WHERE id = $31
        `
		_, err = DB.Exec(query, 
			app.Name, app.Namespace, app.KubeConfigID, app.Description,
			app.Status, app.ImageURL, app.DeploymentYAML, app.Replicas,
			app.Port, app.ServiceType, app.UpdatedAt, app.ImagePullPolicy,
			livenessProbeJSON, readinessProbeJSON, startupProbeJSON,
			lifecycleJSON, commandJSON, argsJSON, envVarsJSON,
			securityContextJSON, nodeSelectorJSON, tolerationsJSON,
			affinityJSON, volumesJSON, volumeMountsJSON, app.SyncHostTimezone,
			app.UpdateStrategy, rollingUpdateJSON, labelsJSON, annotationsJSON, app.ID)
		if err != nil {
			return fmt.Errorf("更新应用失败: %v", err)
		}
	} else {
		// 插入新记录
		query := `
            INSERT INTO applications (id, name, namespace, kube_config_id, description, 
                status, image_url, deployment_yaml, replicas, port, service_type, 
                created_at, updated_at, image_pull_policy, liveness_probe_json,
                readiness_probe_json, startup_probe_json, lifecycle_json, command_json,
                args_json, env_vars_json, security_context_json, node_selector_json,
                tolerations_json, affinity_json, volumes_json, volume_mounts_json,
                sync_host_timezone, update_strategy, rolling_update_json, labels_json, annotations_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
        `
		_, err = DB.Exec(query, 
			app.ID, app.Name, app.Namespace, app.KubeConfigID, app.Description,
			app.Status, app.ImageURL, app.DeploymentYAML, app.Replicas,
			app.Port, app.ServiceType, app.CreatedAt, app.UpdatedAt, app.ImagePullPolicy,
			livenessProbeJSON, readinessProbeJSON, startupProbeJSON,
			lifecycleJSON, commandJSON, argsJSON, envVarsJSON,
			securityContextJSON, nodeSelectorJSON, tolerationsJSON,
			affinityJSON, volumesJSON, volumeMountsJSON, app.SyncHostTimezone,
			app.UpdateStrategy, rollingUpdateJSON, labelsJSON, annotationsJSON)
		if err != nil {
			return fmt.Errorf("插入应用失败: %v", err)
		}
	}

	log.Printf("成功保存应用: %s (%s), 创建时间: %v, 更新时间: %v", app.Name, app.ID, app.CreatedAt, app.UpdatedAt)
	return nil
}

// GetApplicationsFromDB 从数据库获取所有应用程序
func GetApplicationsFromDB() ([]Application, error) {
	query := `
        SELECT id, name, namespace, kube_config_id, description, 
               status, image_url, deployment_yaml, replicas, port, 
               service_type, created_at, updated_at, deleted_at,
               image_pull_policy, liveness_probe_json, readiness_probe_json,
               startup_probe_json, lifecycle_json, command_json, args_json,
               env_vars_json, security_context_json, node_selector_json,
               tolerations_json, affinity_json, volumes_json, volume_mounts_json,
               sync_host_timezone, update_strategy, rolling_update_json, labels_json, annotations_json
        FROM applications
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
    `
	
	rows, err := DB.Query(query)
	if err != nil {
		return nil, fmt.Errorf("获取应用列表失败: %v", err)
	}
	defer rows.Close()
	
	var apps []Application
	
	for rows.Next() {
		var app Application
		var livenessProbeJSON, readinessProbeJSON, startupProbeJSON sql.NullString
		var lifecycleJSON, commandJSON, argsJSON, envVarsJSON sql.NullString
		var securityContextJSON, nodeSelectorJSON, tolerationsJSON, affinityJSON sql.NullString
		var volumesJSON, volumeMountsJSON sql.NullString
		var rollingUpdateJSON sql.NullString
		var labelsJSON, annotationsJSON sql.NullString
		
		err := rows.Scan(
			&app.ID, &app.Name, &app.Namespace, &app.KubeConfigID, &app.Description,
			&app.Status, &app.ImageURL, &app.DeploymentYAML, &app.Replicas, &app.Port,
			&app.ServiceType, &app.CreatedAt, &app.UpdatedAt, &app.DeletedAt,
			&app.ImagePullPolicy, &livenessProbeJSON, &readinessProbeJSON,
			&startupProbeJSON, &lifecycleJSON, &commandJSON, &argsJSON,
			&envVarsJSON, &securityContextJSON, &nodeSelectorJSON,
			&tolerationsJSON, &affinityJSON, &volumesJSON, &volumeMountsJSON,
			&app.SyncHostTimezone, &app.UpdateStrategy, &rollingUpdateJSON,
			&labelsJSON, &annotationsJSON,
		)
		
		if err != nil {
			return nil, fmt.Errorf("扫描应用数据失败: %v", err)
		}
		
		// 反序列化JSON字段
		if livenessProbeJSON.Valid && livenessProbeJSON.String != "" {
			app.LivenessProbe = &ProbeConfig{}
			json.Unmarshal([]byte(livenessProbeJSON.String), app.LivenessProbe)
		}
		
		if readinessProbeJSON.Valid && readinessProbeJSON.String != "" {
			app.ReadinessProbe = &ProbeConfig{}
			json.Unmarshal([]byte(readinessProbeJSON.String), app.ReadinessProbe)
		}
		
		if startupProbeJSON.Valid && startupProbeJSON.String != "" {
			app.StartupProbe = &ProbeConfig{}
			json.Unmarshal([]byte(startupProbeJSON.String), app.StartupProbe)
		}
		
		if lifecycleJSON.Valid && lifecycleJSON.String != "" {
			app.Lifecycle = &LifecycleConfig{}
			json.Unmarshal([]byte(lifecycleJSON.String), app.Lifecycle)
		}
		
		if commandJSON.Valid && commandJSON.String != "" {
			json.Unmarshal([]byte(commandJSON.String), &app.Command)
		}
		
		if argsJSON.Valid && argsJSON.String != "" {
			json.Unmarshal([]byte(argsJSON.String), &app.Args)
		}
		
		if envVarsJSON.Valid && envVarsJSON.String != "" {
			json.Unmarshal([]byte(envVarsJSON.String), &app.EnvVars)
		}
		
		if securityContextJSON.Valid && securityContextJSON.String != "" {
			app.SecurityContext = &SecurityContext{}
			json.Unmarshal([]byte(securityContextJSON.String), app.SecurityContext)
		}
		
		if nodeSelectorJSON.Valid && nodeSelectorJSON.String != "" {
			app.NodeSelector = make(map[string]string)
			json.Unmarshal([]byte(nodeSelectorJSON.String), &app.NodeSelector)
		}
		
		if tolerationsJSON.Valid && tolerationsJSON.String != "" {
			json.Unmarshal([]byte(tolerationsJSON.String), &app.Tolerations)
		}
		
		if affinityJSON.Valid && affinityJSON.String != "" {
			app.Affinity = &Affinity{}
			json.Unmarshal([]byte(affinityJSON.String), app.Affinity)
		}
		
		if volumesJSON.Valid && volumesJSON.String != "" {
			json.Unmarshal([]byte(volumesJSON.String), &app.Volumes)
		}
		
		if volumeMountsJSON.Valid && volumeMountsJSON.String != "" {
			json.Unmarshal([]byte(volumeMountsJSON.String), &app.VolumeMounts)
		}
		
		if rollingUpdateJSON.Valid && rollingUpdateJSON.String != "" {
			app.RollingUpdate = &RollingUpdateConfig{}
			json.Unmarshal([]byte(rollingUpdateJSON.String), app.RollingUpdate)
		}
		
		if labelsJSON.Valid && labelsJSON.String != "" {
			json.Unmarshal([]byte(labelsJSON.String), &app.Labels)
		}
		
		if annotationsJSON.Valid && annotationsJSON.String != "" {
			json.Unmarshal([]byte(annotationsJSON.String), &app.Annotations)
		}
		
		apps = append(apps, app)
	}
	
	return apps, nil
}

// GetApplicationByIDFromDB 从数据库获取指定ID的应用程序
func GetApplicationByIDFromDB(id string) (*Application, error) {
	query := `
        SELECT id, name, namespace, kube_config_id, description, 
               status, image_url, deployment_yaml, replicas, port, 
               service_type, created_at, updated_at, deleted_at,
               image_pull_policy, liveness_probe_json, readiness_probe_json,
               startup_probe_json, lifecycle_json, command_json, args_json,
               env_vars_json, security_context_json, node_selector_json,
               tolerations_json, affinity_json, volumes_json, volume_mounts_json,
               sync_host_timezone, update_strategy, rolling_update_json, labels_json, annotations_json
        FROM applications
        WHERE id = $1 AND deleted_at IS NULL
    `
	
	var app Application
	var livenessProbeJSON, readinessProbeJSON, startupProbeJSON sql.NullString
	var lifecycleJSON, commandJSON, argsJSON, envVarsJSON sql.NullString
	var securityContextJSON, nodeSelectorJSON, tolerationsJSON, affinityJSON sql.NullString
	var volumesJSON, volumeMountsJSON sql.NullString
	var rollingUpdateJSON sql.NullString
	var labelsJSON, annotationsJSON sql.NullString
	
	err := DB.QueryRow(query, id).Scan(
		&app.ID, &app.Name, &app.Namespace, &app.KubeConfigID, &app.Description,
		&app.Status, &app.ImageURL, &app.DeploymentYAML, &app.Replicas, &app.Port,
		&app.ServiceType, &app.CreatedAt, &app.UpdatedAt, &app.DeletedAt,
		&app.ImagePullPolicy, &livenessProbeJSON, &readinessProbeJSON,
		&startupProbeJSON, &lifecycleJSON, &commandJSON, &argsJSON,
		&envVarsJSON, &securityContextJSON, &nodeSelectorJSON,
		&tolerationsJSON, &affinityJSON, &volumesJSON, &volumeMountsJSON,
		&app.SyncHostTimezone, &app.UpdateStrategy, &rollingUpdateJSON,
		&labelsJSON, &annotationsJSON,
	)
	
	if err != nil {
		return nil, fmt.Errorf("获取应用失败: %v", err)
	}
	
	// 反序列化JSON字段
	if livenessProbeJSON.Valid && livenessProbeJSON.String != "" {
		app.LivenessProbe = &ProbeConfig{}
		if err := json.Unmarshal([]byte(livenessProbeJSON.String), app.LivenessProbe); err != nil {
			log.Printf("反序列化存活探针失败: %v", err)
		}
	}
	
	if readinessProbeJSON.Valid && readinessProbeJSON.String != "" {
		app.ReadinessProbe = &ProbeConfig{}
		if err := json.Unmarshal([]byte(readinessProbeJSON.String), app.ReadinessProbe); err != nil {
			log.Printf("反序列化就绪探针失败: %v", err)
		}
	}
	
	if startupProbeJSON.Valid && startupProbeJSON.String != "" {
		app.StartupProbe = &ProbeConfig{}
		if err := json.Unmarshal([]byte(startupProbeJSON.String), app.StartupProbe); err != nil {
			log.Printf("反序列化启动探针失败: %v", err)
		}
	}
	
	if lifecycleJSON.Valid && lifecycleJSON.String != "" {
		app.Lifecycle = &LifecycleConfig{}
		if err := json.Unmarshal([]byte(lifecycleJSON.String), app.Lifecycle); err != nil {
			log.Printf("反序列化生命周期钩子失败: %v", err)
		}
	}
	
	if commandJSON.Valid && commandJSON.String != "" {
		if err := json.Unmarshal([]byte(commandJSON.String), &app.Command); err != nil {
			log.Printf("反序列化启动命令失败: %v", err)
		}
	}
	
	if argsJSON.Valid && argsJSON.String != "" {
		if err := json.Unmarshal([]byte(argsJSON.String), &app.Args); err != nil {
			log.Printf("反序列化启动参数失败: %v", err)
		}
	}
	
	if envVarsJSON.Valid && envVarsJSON.String != "" {
		if err := json.Unmarshal([]byte(envVarsJSON.String), &app.EnvVars); err != nil {
			log.Printf("反序列化环境变量失败: %v", err)
		}
	}
	
	if securityContextJSON.Valid && securityContextJSON.String != "" {
		app.SecurityContext = &SecurityContext{}
		if err := json.Unmarshal([]byte(securityContextJSON.String), app.SecurityContext); err != nil {
			log.Printf("反序列化安全上下文失败: %v", err)
		}
	}
	
	if nodeSelectorJSON.Valid && nodeSelectorJSON.String != "" {
		app.NodeSelector = make(map[string]string)
		if err := json.Unmarshal([]byte(nodeSelectorJSON.String), &app.NodeSelector); err != nil {
			log.Printf("反序列化节点选择器失败: %v", err)
		}
	}
	
	if tolerationsJSON.Valid && tolerationsJSON.String != "" {
		if err := json.Unmarshal([]byte(tolerationsJSON.String), &app.Tolerations); err != nil {
			log.Printf("反序列化容忍配置失败: %v", err)
		}
	}
	
	if affinityJSON.Valid && affinityJSON.String != "" {
		app.Affinity = &Affinity{}
		if err := json.Unmarshal([]byte(affinityJSON.String), app.Affinity); err != nil {
			log.Printf("反序列化亲和性配置失败: %v", err)
		}
	}
	
	if volumesJSON.Valid && volumesJSON.String != "" {
		if err := json.Unmarshal([]byte(volumesJSON.String), &app.Volumes); err != nil {
			log.Printf("反序列化卷配置失败: %v", err)
		}
	}
	
	if volumeMountsJSON.Valid && volumeMountsJSON.String != "" {
		if err := json.Unmarshal([]byte(volumeMountsJSON.String), &app.VolumeMounts); err != nil {
			log.Printf("反序列化卷挂载配置失败: %v", err)
		}
	}
	
	if rollingUpdateJSON.Valid && rollingUpdateJSON.String != "" {
		app.RollingUpdate = &RollingUpdateConfig{}
		if err := json.Unmarshal([]byte(rollingUpdateJSON.String), app.RollingUpdate); err != nil {
			log.Printf("反序列化滚动更新配置失败: %v", err)
		}
	}
	
	if labelsJSON.Valid && labelsJSON.String != "" {
		json.Unmarshal([]byte(labelsJSON.String), &app.Labels)
	}
	
	if annotationsJSON.Valid && annotationsJSON.String != "" {
		json.Unmarshal([]byte(annotationsJSON.String), &app.Annotations)
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

// serializeJSONField 将字段序列化为JSON字符串
func serializeJSONField(field interface{}) (string, error) {
	if field == nil {
		return "", nil
	}
	
	data, err := json.Marshal(field)
	if err != nil {
		return "", err
	}
	
	return string(data), nil
}

// 滚动更新配置
type RollingUpdateConfig struct {
	MaxUnavailable string `json:"maxUnavailable,omitempty"`
	MaxSurge       string `json:"maxSurge,omitempty"`
}
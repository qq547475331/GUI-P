package model

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"sync"
	"time"
)

var (
	store *Store
	// 应用存储
	applications = make(map[string]*Application)
	// 锁，保证并发安全
	mutex = &sync.RWMutex{}
	// 预定义的镜像列表
	preDefinedImages = []string{
		"nginx:latest",
		"redis:alpine",
		"mysql:8.0",
		"postgres:13",
		"node:14-alpine",
		"python:3.9-slim",
		"mongo:4.4",
		"ubuntu:20.04",
		"golang:1.17",
		"httpd:2.4",
	}
)

// Store 表示应用程序数据存储
type Store struct {
	data       Data
	dataFile   string
	saveSignal chan struct{}
	mu         sync.RWMutex
}

// GetStore 返回单例存储实例
func GetStore() *Store {
	once.Do(func() {
		store = &Store{
			data: Data{
				Applications:    []Application{},
				KubeConfigs:     []KubeConfigV1{},
				ImageRegistries: []ImageRegistry{},
			},
			dataFile:   "data.json",
			saveSignal: make(chan struct{}, 1),
		}
		store.loadData()
		go store.saveDataWorker()
	})
	return store
}

// loadData 从文件加载数据
func (s *Store) loadData() {
	s.mu.Lock()
	defer s.mu.Unlock()

	file, err := os.Open(s.dataFile)
	if err != nil {
		if !os.IsNotExist(err) {
			// 日志记录错误但继续使用空数据
			println("Error opening data file:", err.Error())
		}
		return
	}
	defer file.Close()

	bytes, err := ioutil.ReadAll(file)
	if err != nil {
		println("Error reading data file:", err.Error())
		return
	}

	if len(bytes) == 0 {
		return
	}

	var data Data
	if err := json.Unmarshal(bytes, &data); err != nil {
		println("Error unmarshalling data:", err.Error())
		return
	}

	s.data = data
}

// saveDataWorker 在后台保存数据的工作协程
func (s *Store) saveDataWorker() {
	for range s.saveSignal {
		s.doSaveData()
		// 小延迟以避免高频率保存
		time.Sleep(100 * time.Millisecond)
	}
}

// doSaveData 执行实际的数据保存操作
func (s *Store) doSaveData() {
	s.mu.RLock()
	data := s.data
	s.mu.RUnlock()

	// 删除敏感字段时创建数据的副本
	sensitiveData := data

	bytes, err := json.Marshal(sensitiveData)
	if err != nil {
		println("Error marshalling data:", err.Error())
		return
	}

	err = ioutil.WriteFile(s.dataFile, bytes, 0644)
	if err != nil {
		println("Error writing data file:", err.Error())
	}
}

// SaveImageRegistry 保存或更新镜像仓库
func (s *Store) SaveImageRegistry(registry ImageRegistry) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 查找现有的仓库
	for i, r := range s.data.ImageRegistries {
		if r.ID == registry.ID {
			// 更新现有仓库
			s.data.ImageRegistries[i] = registry
			s.signalSave()
			return
		}
	}

	// 添加新仓库
	s.data.ImageRegistries = append(s.data.ImageRegistries, registry)
	s.signalSave()
}

// GetImageRegistries 获取所有镜像仓库（返回副本以避免数据竞争）
func (s *Store) GetImageRegistries() []ImageRegistry {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// 创建副本
	registries := make([]ImageRegistry, len(s.data.ImageRegistries))
	copy(registries, s.data.ImageRegistries)
	return registries
}

// GetImageRegistry 通过ID获取特定的镜像仓库
func (s *Store) GetImageRegistry(id string) (ImageRegistry, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, registry := range s.data.ImageRegistries {
		if registry.ID == id {
			return registry, true
		}
	}
	return ImageRegistry{}, false
}

// DeleteImageRegistry 删除指定ID的镜像仓库
func (s *Store) DeleteImageRegistry(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, registry := range s.data.ImageRegistries {
		if registry.ID == id {
			// 删除仓库
			s.data.ImageRegistries = append(s.data.ImageRegistries[:i], s.data.ImageRegistries[i+1:]...)
			s.signalSave()
			return true
		}
	}
	return false
}

// signalSave 触发数据保存
func (s *Store) signalSave() {
	select {
	case s.saveSignal <- struct{}{}:
		// 信号发送成功
	default:
		// 通道已满，已经有待处理的保存操作
	}
}

// SaveApplication 保存应用程序
func (s *Store) SaveApplication(app Application) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 查找现有应用
	for i, a := range s.data.Applications {
		if a.ID == app.ID {
			s.data.Applications[i] = app
			s.signalSave()
			return
		}
	}

	// 添加新应用
	s.data.Applications = append(s.data.Applications, app)
	s.signalSave()
}

// GetApplications 获取所有应用程序
func (s *Store) GetApplications() []Application {
	s.mu.RLock()
	defer s.mu.RUnlock()

	applications := make([]Application, len(s.data.Applications))
	copy(applications, s.data.Applications)
	return applications
}

// GetApplication 通过ID获取应用程序
func (s *Store) GetApplication(id string) (Application, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, app := range s.data.Applications {
		if app.ID == id {
			return app, true
		}
	}
	return Application{}, false
}

// DeleteApplication 删除应用程序
func (s *Store) DeleteApplication(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, app := range s.data.Applications {
		if app.ID == id {
			s.data.Applications = append(s.data.Applications[:i], s.data.Applications[i+1:]...)
			s.signalSave()
			return true
		}
	}
	return false
}

// SaveKubeConfig 保存KubeConfig
func (s *Store) SaveKubeConfig(config KubeConfigV1) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 查找现有配置
	for i, c := range s.data.KubeConfigs {
		if c.ID == config.ID {
			s.data.KubeConfigs[i] = config
			s.signalSave()
			return
		}
	}

	// 添加新配置
	s.data.KubeConfigs = append(s.data.KubeConfigs, config)
	s.signalSave()
}

// GetKubeConfigs 获取所有KubeConfig
func (s *Store) GetKubeConfigs() []KubeConfigV1 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	configs := make([]KubeConfigV1, len(s.data.KubeConfigs))
	copy(configs, s.data.KubeConfigs)
	return configs
}

// GetKubeConfig 通过ID获取KubeConfig
func (s *Store) GetKubeConfig(id string) (KubeConfigV1, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, config := range s.data.KubeConfigs {
		if config.ID == id {
			return config, true
		}
	}
	return KubeConfigV1{}, false
}

// DeleteKubeConfig 删除KubeConfig
func (s *Store) DeleteKubeConfig(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, config := range s.data.KubeConfigs {
		if config.ID == id {
			s.data.KubeConfigs = append(s.data.KubeConfigs[:i], s.data.KubeConfigs[i+1:]...)
			s.signalSave()
			return true
		}
	}
	return false
}

// InitStore 初始化存储
func InitStore() {
	// 预先添加一些示例应用
	sampleApp := &Application{
		ID:          "sample-app-1",
		Name:        "nginx-demo",
		Namespace:   "default",
		Description: "Nginx示例应用",
		Status:      "running",
		ImageURL:    "docker.io/nginx:latest",
		Replicas:    1,
		Port:        8080,
		ServiceType: "LoadBalancer",
		CreatedAt:   time.Now().Add(-24 * time.Hour),
		UpdatedAt:   time.Now().Add(-12 * time.Hour),
	}
	applications[sampleApp.ID] = sampleApp
}

// GetAllApplications 获取所有应用
func GetAllApplications() []*Application {
	mutex.RLock()
	defer mutex.RUnlock()

	result := make([]*Application, 0, len(applications))
	for _, app := range applications {
		result = append(result, app)
	}
	return result
}

// GetApplicationByID 根据ID获取应用
func GetApplicationByID(id string) (*Application, error) {
	mutex.RLock()
	defer mutex.RUnlock()

	app, ok := applications[id]
	if !ok {
		return nil, fmt.Errorf("application with ID %s not found", id)
	}
	return app, nil
}

// SaveApplication 保存应用
func SaveApplication(app *Application) error {
	mutex.Lock()
	defer mutex.Unlock()

	app.UpdatedAt = time.Now()
	applications[app.ID] = app
	return nil
}

// DeleteApplication 删除应用
func DeleteApplication(id string) error {
	mutex.Lock()
	defer mutex.Unlock()

	if _, ok := applications[id]; !ok {
		return fmt.Errorf("application with ID %s not found", id)
	}
	delete(applications, id)
	return nil
}

// GetImages 获取镜像列表
func GetImages() []string {
	return preDefinedImages
}

// GetResourceQuota 获取资源配额
func GetResourceQuota() ResourceQuota {
	// 返回模拟的资源配额
	return ResourceQuota{
		CPU:     1.0,
		Memory:  1.0,  // 1GB
		Storage: 10.0, // 10GB
		Total:   1.0,  // 模拟的资源配额总量
	}
}

// CalculatePrice 计算价格
func CalculatePrice(cpu float64, memory int, storage int) PriceEstimation {
	// 简单的价格计算公式
	cpuPrice := cpu * 0.5
	memoryPrice := float64(memory) / 1024 * 0.3
	storagePrice := float64(storage) * 0.05

	return PriceEstimation{
		CPU:     cpuPrice,
		Memory:  memoryPrice,
		Storage: storagePrice,
		Total:   cpuPrice + memoryPrice + storagePrice,
	}
}

// GenerateYAML 从应用配置生成Kubernetes YAML
func GenerateYAML(app *Application) (string, error) {
	if app == nil {
		return "", fmt.Errorf("应用不能为空")
	}
	
	// 验证必填字段
	if app.Name == "" {
		return "", fmt.Errorf("应用名称不能为空")
	}
	
	// 确保命名空间
	if app.Namespace == "" {
		app.Namespace = "default"
	}
	
	// 生成Deployment YAML
	deploymentYAML := generateDeploymentYAML(app)
	
	// 生成Service YAML（如果需要）
	var serviceYAML string
	if app.ServiceType != "" {
		serviceYAML = generateServiceYAML(app)
	}
	
	// 合并YAML
	result := deploymentYAML
	if serviceYAML != "" {
		result += "\n---\n" + serviceYAML
	}
	
	return result, nil
}

// generateDeploymentYAML 生成Deployment的YAML配置
func generateDeploymentYAML(app *Application) string {
	// 设置副本数
	replicas := app.Replicas
	if replicas <= 0 {
		replicas = 1 // 默认至少1个副本
	}
	
	// 使用容器端口
	containerPort := app.Port
	if containerPort <= 0 {
		containerPort = 8080 // 默认端口改为8080
	}
	
	// 设置默认资源请求
	cpuRequest := "100m" // 默认CPU请求
	memoryRequest := "128Mi" // 默认内存请求
	
	// 生成Deployment YAML
	yaml := fmt.Sprintf(`apiVersion: apps/v1
kind: Deployment
metadata:
  name: %s
  namespace: %s
spec:
  replicas: %d
  selector:
    matchLabels:
      app: %s
  template:
    metadata:
      labels:
        app: %s
    spec:
      containers:
      - name: %s
        image: %s
        ports:
        - containerPort: %d
        resources:
          requests:
            cpu: "%s"
            memory: "%s"
          limits:
            cpu: "%s"
            memory: "%s"
`, app.Name, app.Namespace, replicas, app.Name, app.Name, app.Name, app.ImageURL, containerPort, cpuRequest, memoryRequest, cpuRequest, memoryRequest)
	
	return yaml
}

// generateServiceYAML 生成Service的YAML配置
func generateServiceYAML(app *Application) string {
	// 使用容器端口
	containerPort := app.Port
	if containerPort <= 0 {
		containerPort = 8080 // 默认端口改为8080
	}
	
	// 确定服务类型
	serviceType := "ClusterIP"
	if app.ServiceType == "LoadBalancer" {
		serviceType = "LoadBalancer"
	} else if app.ServiceType == "NodePort" {
		serviceType = "NodePort"
	}
	
	// 生成Service YAML
	yaml := fmt.Sprintf(`apiVersion: v1
kind: Service
metadata:
  name: %s
  namespace: %s
spec:
  selector:
    app: %s
  ports:
  - port: %d
    targetPort: %d
  type: %s
`, app.Name, app.Namespace, app.Name, containerPort, containerPort, serviceType)
	
	return yaml
} 
package model

import (
	"fmt"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

// InitializeConfig 初始化指定ID的KubeConfig
func (km *K8sManager) InitializeConfig(id string, config string) error {
	km.Lock()
	defer km.Unlock()
	
	// 如果配置已存在且有效，直接返回
	if _, exists := km.Clients[id]; exists {
		return nil
	}
	
	// 初始化新的客户端
	client, err := km.createClient(config)
	if err != nil {
		return fmt.Errorf("创建客户端失败: %v", err)
	}
	
	km.Clients[id] = client.(*kubernetes.Clientset)  // 类型断言
	return nil
}

// createClient 方法
func (km *K8sManager) createClient(kubeconfig string) (kubernetes.Interface, error) {
	// 从字符串加载 kubeconfig
	config, err := clientcmd.RESTConfigFromKubeConfig([]byte(kubeconfig))
	if err != nil {
		return nil, fmt.Errorf("解析 kubeconfig 失败: %v", err)
	}

	// 创建 clientset
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("创建 kubernetes 客户端失败: %v", err)
	}

	return clientset, nil
} 
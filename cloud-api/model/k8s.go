package model

import (
	"context"
	"fmt"
	"log"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
)

// DeleteStatefulSet 删除单个StatefulSet资源
func (km *K8sManager) DeleteStatefulSet(kubeConfigId, namespace, name, propagationPolicy string) error {
	if kubeConfigId == "" || name == "" {
		return fmt.Errorf("kubeConfigId和应用名称不能为空")
	}
	
	if namespace == "" {
		namespace = "default"
	}
	
	log.Printf("删除StatefulSet: kubeConfigId=%s, namespace=%s, name=%s", kubeConfigId, namespace, name)
	
	// 获取客户端
	client, err := km.GetClient(kubeConfigId)
	if err != nil {
		return fmt.Errorf("获取客户端失败: %v", err)
	}
	
	// 设置删除策略
	var deletePropagation metav1.DeletionPropagation
	switch propagationPolicy {
	case "Foreground":
		deletePropagation = metav1.DeletePropagationForeground
	case "Background":
		deletePropagation = metav1.DeletePropagationBackground
	case "Orphan":
		deletePropagation = metav1.DeletePropagationOrphan
	default:
		deletePropagation = metav1.DeletePropagationForeground
	}
	
	// 删除StatefulSet
	deleteOptions := metav1.DeleteOptions{
		PropagationPolicy: &deletePropagation,
	}
	
	err = client.AppsV1().StatefulSets(namespace).Delete(context.TODO(), name, deleteOptions)
	if err != nil {
		if k8serrors.IsNotFound(err) {
			log.Printf("StatefulSet不存在，视为删除成功: %s/%s", namespace, name)
			return nil
		}
		return fmt.Errorf("删除StatefulSet失败: %v", err)
	}
	
	log.Printf("成功删除StatefulSet: %s/%s", namespace, name)
	return nil
} 
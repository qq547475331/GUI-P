import React, { useState, useEffect, useRef } from 'react';
import apiService from '../services/api';

// 使用一个全局变量记录是否已经请求过，避免组件重新挂载时再次请求
let hasGloballyFetched = false;

function KubernetesConfig({ onChange }) {
  const [cluster, setCluster] = useState(null);
  const [namespace, setNamespace] = useState('default');
  const [clusters, setClusters] = useState([]);
  const [namespaces, setNamespaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 单次获取集群信息，使用静态变量防止组件重新挂载时再次请求
  useEffect(() => {
    // 如果全局已请求过，直接退出
    if (hasGloballyFetched) {
      console.log('已全局获取过Kubernetes配置，跳过请求');
      return;
    }
    
    const fetchData = async () => {
      if (!mountedRef.current) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('首次获取Kubernetes配置');
        hasGloballyFetched = true; // 全局标记为已获取
        
        // 获取集群列表
        const clustersData = await apiService.getKubeConfigs();
        
        if (!mountedRef.current) return; // 如果组件已卸载，停止处理
        
        if (Array.isArray(clustersData) && clustersData.length > 0) {
          setClusters(clustersData);
          const defaultClusterId = clustersData[0]?.id;
          setCluster(defaultClusterId);
          
          // 获取该集群的命名空间
          if (defaultClusterId) {
            const namespacesData = await apiService.getKubernetesNamespaces(defaultClusterId);
            
            if (!mountedRef.current) return; // 如果组件已卸载，停止处理
            
            setNamespaces(namespacesData);
            
            // 通知父组件，仅在两个数据都获取后
            if (onChange) {
              onChange({
                cluster: defaultClusterId,
                namespace: namespacesData[0] || 'default'
              });
            }
          }
        }
      } catch (err) {
        console.error('获取Kubernetes配置失败:', err);
        if (mountedRef.current) {
          setError('获取集群信息失败');
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
  }, []); // 空依赖数组确保只运行一次

  // 处理集群切换
  const handleClusterChange = async (e) => {
    const clusterId = e.target.value;
    setCluster(clusterId);
    
    if (clusterId) {
      setIsLoading(true);
      try {
        const namespacesData = await apiService.getKubernetesNamespaces(clusterId);
        setNamespaces(namespacesData);
        // 重置为第一个命名空间或保留当前命名空间
        const newNamespace = namespacesData.includes(namespace) ? namespace : namespacesData[0];
        setNamespace(newNamespace);
        // 通知父组件
        onChange?.({ cluster: clusterId, namespace: newNamespace });
      } catch (err) {
        console.error('获取命名空间失败:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 处理命名空间切换
  const handleNamespaceChange = (e) => {
    const ns = e.target.value;
    setNamespace(ns);
    onChange?.({ cluster, namespace: ns });
  };

  return (
    <div className="kubernetes-config">
      <h3>Kubernetes配置</h3>
      
      <div className="form-group">
        <label>Kubernetes集群</label>
        <div className="d-flex align-items-center">
          <select 
            value={cluster || ''} 
            onChange={handleClusterChange}
            disabled={isLoading}
            className="form-control"
          >
            {clusters.map(c => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
          {isLoading && <span className="ml-2">连接中...</span>}
        </div>
      </div>
      
      <div className="form-group">
        <label>命名空间</label>
        <select 
          value={namespace} 
          onChange={handleNamespaceChange}
          disabled={isLoading}
          className="form-control"
        >
          {namespaces.map(ns => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
      </div>
      
      {error && (
        <div className="alert alert-danger">{error}</div>
      )}
    </div>
  );
}

export default KubernetesConfig; 
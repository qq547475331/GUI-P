import React, { useState, useEffect, useRef } from 'react';
import { Select, Form, Spin, Alert, message } from 'antd';
const { Option } = Select;

// 全局缓存对象
const kubeConfigsCache: Record<string, { data: any[], timestamp: number }> = {};
const namespacesCache: Record<string, { data: string[], timestamp: number }> = {};
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5分钟缓存

interface KubeConfig {
  id: string;
  name: string;
  description?: string;
}

interface KubeConfigSelectorProps {
  onKubeConfigChange?: (configId: string) => void;
  onNamespaceChange?: (namespace: string) => void;
  initialConfigId?: string;
  initialNamespace?: string;
}

const KubeConfigSelector: React.FC<KubeConfigSelectorProps> = ({
  onKubeConfigChange,
  onNamespaceChange,
  initialConfigId,
  initialNamespace
}) => {
  const [kubeConfigs, setKubeConfigs] = useState<KubeConfig[]>([]);
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>(initialConfigId || '');
  const [selectedNamespace, setSelectedNamespace] = useState<string>(initialNamespace || '');
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [loadingNamespaces, setLoadingNamespaces] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const kubeConfigRequestInProgress = useRef(false);
  const namespaceRequestInProgress = useRef(false);

  // 获取 KubeConfigs 列表
  useEffect(() => {
    const fetchKubeConfigs = async () => {
      // 如果请求正在进行中，不重复发送
      if (kubeConfigRequestInProgress.current) return;

      // 检查缓存
      const now = Date.now();
      const cachedData = kubeConfigsCache['all'];
      if (cachedData && now - cachedData.timestamp < CACHE_TIMEOUT) {
        setKubeConfigs(cachedData.data);
        return;
      }

      // 标记请求进行中
      kubeConfigRequestInProgress.current = true;
      setLoadingConfigs(true);
      setErrorMessage('');

      try {
        const response = await fetch('/api/kubeconfig');
        
        if (!response.ok) {
          throw new Error(`获取Kubernetes集群列表失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 检查数据是否为空数组
        if (data.length === 0) {
          setErrorMessage('没有找到可用的Kubernetes集群，请先添加集群配置');
        }
        
        // 更新状态和缓存
        setKubeConfigs(data);
        kubeConfigsCache['all'] = {
          data,
          timestamp: now
        };

      } catch (error) {
        console.error('Failed to fetch KubeConfigs:', error);
        setErrorMessage('获取Kubernetes集群列表失败，请刷新页面重试');
        message.error('获取Kubernetes集群列表失败');
      } finally {
        setLoadingConfigs(false);
        kubeConfigRequestInProgress.current = false;
      }
    };

    fetchKubeConfigs();
  }, []);

  // 获取命名空间列表
  useEffect(() => {
    if (!selectedConfigId) return;

    const fetchNamespaces = async () => {
      // 如果请求正在进行中，不重复发送
      if (namespaceRequestInProgress.current) return;

      // 检查缓存
      const now = Date.now();
      const cachedData = namespacesCache[selectedConfigId];
      if (cachedData && now - cachedData.timestamp < CACHE_TIMEOUT) {
        setNamespaces(cachedData.data);
        return;
      }

      // 标记请求进行中
      namespaceRequestInProgress.current = true;
      setLoadingNamespaces(true);

      try {
        const response = await fetch(`/api/kubeconfig/${selectedConfigId}/namespaces`);
        
        if (!response.ok) {
          throw new Error(`获取命名空间列表失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 更新状态和缓存
        setNamespaces(data);
        namespacesCache[selectedConfigId] = {
          data,
          timestamp: now
        };

      } catch (error) {
        console.error('Failed to fetch namespaces:', error);
        message.error('获取命名空间列表失败');
      } finally {
        setLoadingNamespaces(false);
        namespaceRequestInProgress.current = false;
      }
    };

    fetchNamespaces();
  }, [selectedConfigId]);

  const handleKubeConfigChange = (value: string) => {
    setSelectedConfigId(value);
    setSelectedNamespace(''); // 重置命名空间选择
    if (onKubeConfigChange) {
      onKubeConfigChange(value);
    }
  };

  const handleNamespaceChange = (value: string) => {
    setSelectedNamespace(value);
    if (onNamespaceChange) {
      onNamespaceChange(value);
    }
  };

  // 刷新集群列表
  const refreshKubeConfigs = () => {
    // 清除缓存
    delete kubeConfigsCache['all'];
    
    // 重新加载
    kubeConfigRequestInProgress.current = false;
    const fetchKubeConfigs = async () => {
      if (kubeConfigRequestInProgress.current) return;
      
      kubeConfigRequestInProgress.current = true;
      setLoadingConfigs(true);
      setErrorMessage('');

      try {
        const response = await fetch('/api/kubeconfig');
        if (!response.ok) {
          throw new Error(`获取Kubernetes集群列表失败: ${response.status}`);
        }
        
        const data = await response.json();
        
        setKubeConfigs(data);
        kubeConfigsCache['all'] = {
          data,
          timestamp: Date.now()
        };
        
      } catch (error) {
        console.error('Failed to refresh KubeConfigs:', error);
        setErrorMessage('刷新Kubernetes集群列表失败');
        message.error('刷新Kubernetes集群列表失败');
      } finally {
        setLoadingConfigs(false);
        kubeConfigRequestInProgress.current = false;
      }
    };

    fetchKubeConfigs();
  };

  return (
    <div className="kube-config-selector">
      {errorMessage && (
        <Alert 
          message={errorMessage} 
          type="error" 
          showIcon 
          style={{ marginBottom: 16 }} 
          action={
            <a onClick={refreshKubeConfigs}>刷新</a>
          }
        />
      )}
      
      <Form.Item label="Kubernetes集群" required>
        <Select
          placeholder="选择Kubernetes集群"
          value={selectedConfigId}
          onChange={handleKubeConfigChange}
          loading={loadingConfigs}
          style={{ width: '100%' }}
        >
          {kubeConfigs.map(config => (
            <Option key={config.id} value={config.id}>
              {config.name}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item label="命名空间" required>
        <Select
          placeholder={loadingNamespaces ? "加载中..." : "选择命名空间"}
          value={selectedNamespace}
          onChange={handleNamespaceChange}
          disabled={!selectedConfigId || loadingNamespaces}
          style={{ width: '100%' }}
        >
          {namespaces.map(ns => (
            <Option key={ns} value={ns}>{ns}</Option>
          ))}
        </Select>
      </Form.Item>
    </div>
  );
};

export default KubeConfigSelector; 
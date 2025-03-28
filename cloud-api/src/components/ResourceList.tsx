import React, { useState, useEffect, useRef } from 'react';
import { Table, Space, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';

// 全局缓存对象
const namespacesCache: Record<string, { data: string[], timestamp: number }> = {};
const podsCache: Record<string, { data: any[], timestamp: number }> = {};
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5分钟缓存

interface Pod {
  metadata: {
    name: string;
    namespace: string;
    creationTimestamp: string;
  };
  status: {
    phase: string;
    podIP: string;
    hostIP: string;
    conditions: Array<{
      type: string;
      status: string;
    }>;
  };
}

interface PodListResponse {
  items: Pod[];
}

const ResourceList: React.FC<{ clusterId: string }> = ({ clusterId }) => {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInProgress = useRef(false);

  const fetchPods = async (forceRefresh = false) => {
    // 如果没有集群ID，直接返回
    if (!clusterId) return;

    // 如果请求正在进行中，不重复发送
    if (requestInProgress.current) return;

    // 检查缓存
    const now = Date.now();
    const cachedData = podsCache[clusterId];
    if (!forceRefresh && cachedData && now - cachedData.timestamp < CACHE_TIMEOUT) {
      setPods(cachedData.data);
      return;
    }

    // 标记请求进行中
    requestInProgress.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/kubeconfig/${clusterId}/pods`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: PodListResponse = await response.json();
      
      // 更新状态和缓存
      const podItems = data.items || [];
      setPods(podItems);
      podsCache[clusterId] = {
        data: podItems,
        timestamp: now
      };

    } catch (error) {
      console.error('Failed to fetch pods:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch pods');
    } finally {
      setLoading(false);
      requestInProgress.current = false;
    }
  };

  useEffect(() => {
    fetchPods();
  }, [clusterId]);

  const handleRefresh = () => {
    fetchPods(true);
  };

  const columns: ColumnsType<Pod> = [
    {
      title: '名称',
      dataIndex: ['metadata', 'name'],
      key: 'name',
    },
    {
      title: '命名空间',
      dataIndex: ['metadata', 'namespace'],
      key: 'namespace',
    },
    {
      title: '状态',
      dataIndex: ['status', 'phase'],
      key: 'status',
      render: (phase: string) => (
        <Tag color={phase === 'Running' ? 'green' : 'orange'}>
          {phase}
        </Tag>
      ),
    },
    {
      title: 'Pod IP',
      dataIndex: ['status', 'podIP'],
      key: 'podIP',
    },
    {
      title: '节点 IP',
      dataIndex: ['status', 'hostIP'],
      key: 'hostIP',
    },
    {
      title: '创建时间',
      dataIndex: ['metadata', 'creationTimestamp'],
      key: 'creationTimestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" onClick={handleRefresh} loading={loading}>
          刷新
        </Button>
      </div>
      
      {loading && <div>加载中...</div>}
      
      {error && <div>错误: {error}</div>}
      
      {!loading && !error && !pods.length && (
        <div>没有找到Pod</div>
      )}
      
      {!loading && !error && pods.length > 0 && (
        <Table
          columns={columns}
          dataSource={pods}
          rowKey={(record) => `${record.metadata.namespace}-${record.metadata.name}`}
          pagination={{ pageSize: 10 }}
        />
      )}
    </div>
  );
};

export default ResourceList; 
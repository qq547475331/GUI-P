import React, { useState, useEffect } from 'react';
import { 
  Tabs, 
  Spin, 
  Card, 
  Descriptions, 
  Badge, 
  Typography, 
  Space, 
  Button,
  message,
  Tag,
  Divider,
  Row,
  Col,
  Alert
} from 'antd';
import { 
  ReloadOutlined, 
  ArrowLeftOutlined,
  ExclamationCircleOutlined,
  NodeIndexOutlined,
  FileTextOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import apiService from '../services/api';
import PodLogs from '../components/PodLogs';
import PodTerminal from '../components/PodTerminal';
import './PodDetailPage.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const PodDetailPage = () => {
  const { id, namespace, podName } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [pod, setPod] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState('');

  // 从查询参数或location state获取kubeConfigId
  const kubeConfigId = id || new URLSearchParams(location.search).get('kubeConfigId');
  
  // 加载Pod详情
  const fetchPodDetails = async () => {
    if (!kubeConfigId || !namespace || !podName) {
      setError('缺少必要参数：集群ID、命名空间或Pod名称');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 获取指定命名空间中的所有Pod
      const podsData = await apiService.getPods(kubeConfigId, namespace);
      
      // 查找目标Pod
      const targetPod = podsData.find(p => p.name === podName);
      
      if (!targetPod) {
        throw new Error(`命名空间 ${namespace} 中未找到Pod ${podName}`);
      }
      
      setPod(targetPod);
      
      // 提取容器信息
      if (targetPod.containers && targetPod.containers.length > 0) {
        setContainers(targetPod.containers);
        setSelectedContainer(targetPod.containers[0].name);
      }
    } catch (err) {
      console.error('获取Pod详情失败:', err);
      setError(`获取Pod详情失败: ${err.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 组件挂载时加载Pod详情
  useEffect(() => {
    fetchPodDetails();
    
    // 设置页面标题
    document.title = `Pod详情: ${podName}`;
    
    // 从查询参数中获取标签页
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam && ['details', 'logs', 'terminal'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    
    // 可选：设置自动刷新
    const refreshInterval = setInterval(fetchPodDetails, 30000); // 每30秒刷新一次
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [kubeConfigId, namespace, podName]);

  // 获取Pod状态对应的标签颜色
  const getStatusColor = (status) => {
    if (!status) return 'default';
    
    status = status.toLowerCase();
    
    if (status === 'running') return 'success';
    if (status === 'pending') return 'processing';
    if (status === 'succeeded') return 'success';
    if (status === 'failed') return 'error';
    if (status === 'unknown') return 'warning';
    if (status === 'terminating') return 'error';
    
    return 'default';
  };

  // 渲染Pod详情内容
  const renderPodDetails = () => {
    if (!pod) return null;
    
    return (
      <Card>
        <Descriptions title="基本信息" bordered size="small">
          <Descriptions.Item label="名称">{pod.name}</Descriptions.Item>
          <Descriptions.Item label="命名空间">{pod.namespace}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Badge status={getStatusColor(pod.status)} text={pod.status} />
          </Descriptions.Item>
          <Descriptions.Item label="Pod IP">{pod.ip || '-'}</Descriptions.Item>
          <Descriptions.Item label="节点">{pod.node || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{pod.createdAt || '-'}</Descriptions.Item>
          <Descriptions.Item label="就绪状态" span={3}>{pod.ready || '-'}</Descriptions.Item>
        </Descriptions>
        
        <Divider orientation="left">容器</Divider>
        {containers.length > 0 ? (
          containers.map((container, index) => (
            <Card 
              key={container.name}
              type="inner" 
              title={`容器 ${index + 1}: ${container.name}`}
              style={{ marginBottom: 16 }}
            >
              <Descriptions size="small" bordered>
                <Descriptions.Item label="镜像">{container.image}</Descriptions.Item>
                <Descriptions.Item label="端口" span={2}>
                  {container.ports && container.ports.length > 0 ? (
                    container.ports.map(port => (
                      <Tag key={`${port.containerPort}-${port.protocol}`}>
                        {port.containerPort}/{port.protocol}
                      </Tag>
                    ))
                  ) : '-'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          ))
        ) : (
          <Alert message="未找到容器信息" type="warning" />
        )}
        
        {pod.labels && Object.keys(pod.labels).length > 0 && (
          <>
            <Divider orientation="left">标签</Divider>
            <div className="pod-labels">
              {Object.entries(pod.labels).map(([key, value]) => (
                <Tag key={key} color="blue">{key}: {value}</Tag>
              ))}
            </div>
          </>
        )}
      </Card>
    );
  };

  return (
    <div className="pod-detail-page">
      <div className="page-header">
        <Space>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(-1)}
          >
            返回
          </Button>
          <Title level={3}>
            Pod: {podName}
            {pod && <Tag color={getStatusColor(pod.status)} style={{ marginLeft: 8 }}>{pod.status}</Tag>}
          </Title>
        </Space>
        <Button 
          type="primary" 
          icon={<ReloadOutlined />} 
          onClick={fetchPodDetails}
          loading={loading}
        >
          刷新
        </Button>
      </div>
      
      {error ? (
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
        />
      ) : loading && !pod ? (
        <div className="loading-container">
          <Spin size="large" tip="加载Pod详情..." />
        </div>
      ) : (
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
        >
          <TabPane 
            tab={<span><NodeIndexOutlined />详情</span>} 
            key="details"
          >
            {renderPodDetails()}
          </TabPane>
          
          <TabPane 
            tab={<span><FileTextOutlined />日志</span>} 
            key="logs"
            disabled={!selectedContainer}
          >
            <PodLogs
              kubeConfigId={kubeConfigId}
              namespace={namespace}
              podName={podName}
              containerName={selectedContainer}
            />
          </TabPane>
          
          <TabPane 
            tab={<span><CodeOutlined />终端</span>} 
            key="terminal"
            disabled={!selectedContainer}
          >
            <PodTerminal
              kubeConfigId={kubeConfigId}
              namespace={namespace}
              podName={podName}
              containerName={selectedContainer}
            />
          </TabPane>
        </Tabs>
      )}
    </div>
  );
};

export default PodDetailPage; 
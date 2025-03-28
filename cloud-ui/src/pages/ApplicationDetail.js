import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Descriptions, Badge, Typography, Tabs, Spin, Alert, Space, Tag, Table, Tooltip, Modal, Row, Col, Divider } from 'antd';
import { ReloadOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, CodeOutlined, FileTextOutlined, RocketOutlined } from '@ant-design/icons';
import apiService from '../services/api';
import './ApplicationDetail.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const ApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [yamlModalVisible, setYamlModalVisible] = useState(false);
  const [yamlContent, setYamlContent] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [error, setError] = useState(null);
  const [deployStatus, setDeployStatus] = useState(null);
  const [deployLoading, setDeployLoading] = useState(false);
  const [podList, setPodList] = useState([]);
  const [podLoading, setPodLoading] = useState(false);

  // 加载应用详情
  useEffect(() => {
    fetchApplication();
    fetchDeploymentStatus();
    fetchApplicationPods();
  }, [id]);

  // 获取应用详情
  const fetchApplication = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const data = await apiService.getApplicationById(id);
      setApplication(data);
      document.title = `应用详情: ${data.appName || 'Unknown'}`;
    } catch (err) {
      console.error("获取应用详情失败:", err);
      setError("获取应用详情失败");
    } finally {
      setLoading(false);
    }
  };

  // 获取部署状态
  const fetchDeploymentStatus = async () => {
    if (!id) return;
    
    try {
      const status = await apiService.getDeploymentStatus(id);
      setDeployStatus(status);
    } catch (err) {
      console.error("获取部署状态失败:", err);
    }
  };

  // 获取应用相关的Pod
  const fetchApplicationPods = async () => {
    if (!id) return;
    
    setPodLoading(true);
    try {
      const response = await apiService.getApplicationPods(id);
      setPodList(response || []);
    } catch (err) {
      console.error("获取Pod列表失败:", err);
    } finally {
      setPodLoading(false);
    }
  };

  // 处理部署应用
  const handleDeploy = async () => {
    if (!id) return;
    
    setDeployLoading(true);
    try {
      await apiService.deployApplication(id);
      fetchDeploymentStatus();
    } catch (err) {
      console.error("部署应用失败:", err);
    } finally {
      setDeployLoading(false);
    }
  };

  // 导出YAML
  const handleExportYaml = () => {
    // 实现导出YAML功能
  };

  // 安全获取嵌套对象的值
  const getSafeValue = (obj, path, defaultValue = '') => {
    if (!obj) return defaultValue;
    
    const keys = path.split('.');
    return keys.reduce((o, key) => (o && o[key] !== undefined ? o[key] : defaultValue), obj);
  };

  // 查看Pod详情
  const viewPodDetails = (pod) => {
    navigate(`/cluster/${pod.clusterId}/namespace/${pod.namespace}/pod/${pod.name}`);
  };

  // 查看Pod日志
  const viewPodLogs = (pod) => {
    navigate(`/cluster/${pod.clusterId}/namespace/${pod.namespace}/pod/${pod.name}?tab=logs`);
  };

  // 打开Pod终端
  const openPodTerminal = (pod) => {
    navigate(`/cluster/${pod.clusterId}/namespace/${pod.namespace}/pod/${pod.name}?tab=terminal`);
  };

  // Pod列表列定义
  const podColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <a>{text}</a>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        if (status === 'Running') color = 'success';
        else if (status === 'Pending') color = 'processing';
        else if (status === 'Failed') color = 'error';
        return <Badge status={color} text={status} />;
      },
    },
    {
      title: '就绪',
      dataIndex: 'ready',
      key: 'ready',
    },
    {
      title: '重启次数',
      dataIndex: 'restarts',
      key: 'restarts',
    },
    {
      title: '创建时间',
      dataIndex: 'creationTimestamp',
      key: 'creationTimestamp',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="查看详情">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => viewPodDetails(record)} 
            />
          </Tooltip>
          <Tooltip title="查看日志">
            <Button 
              type="text" 
              icon={<FileTextOutlined />} 
              onClick={() => viewPodLogs(record)} 
            />
          </Tooltip>
          <Tooltip title="打开终端">
            <Button 
              type="text" 
              icon={<CodeOutlined />} 
              onClick={() => openPodTerminal(record)} 
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="loading-container">
        <Spin tip="加载应用详情..." />
      </div>
    );
  }

  if (error || !application) {
    return (
      <Alert
        message="错误"
        description={error || "无法加载应用详情"}
        type="error"
        showIcon
      />
    );
  }

  const status = deployStatus || application.status || {};

  return (
    <div className="application-detail">
      <Card 
        title={`应用详情: ${getSafeValue(application, 'appName')}`}
        extra={
          <div className="detail-actions">
            <Button 
              type="primary" 
              icon={<RocketOutlined />} 
              onClick={handleDeploy}
              loading={deployLoading}
            >
              部署应用
            </Button>
            <Button 
              icon={<CodeOutlined />} 
              onClick={handleExportYaml}
              style={{ marginLeft: 8 }}
            >
              导出YAML
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
                fetchApplication();
                fetchDeploymentStatus();
                fetchApplicationPods();
              }}
              style={{ marginLeft: 8 }}
            >
              刷新
            </Button>
          </div>
        }
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="基本信息" key="info">
        <Row gutter={[16, 16]}>
          <Col span={24}>
                <Descriptions
                  title="基本信息"
                  bordered
                  column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}
                >
                  <Descriptions.Item label="应用名称">{getSafeValue(application, 'appName')}</Descriptions.Item>
                  <Descriptions.Item label="镜像">{getSafeValue(application, 'imageName')}</Descriptions.Item>
                  <Descriptions.Item label="命名空间">{getSafeValue(application, 'namespace')}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">{getSafeValue(application, 'createdAt')}</Descriptions.Item>
                  <Descriptions.Item label="实例数量">{getSafeValue(application, 'instances')}</Descriptions.Item>
                  <Descriptions.Item label="容器端口">{getSafeValue(application, 'containerPort')}</Descriptions.Item>
                  <Descriptions.Item label="服务类型">{getSafeValue(application, 'serviceType')}</Descriptions.Item>
                <Descriptions.Item label="状态">
                    <Badge 
                      status={
                        status.status === 'running' ? 'success' : 
                        status.status === 'pending' ? 'processing' : 
                        status.status === 'failed' ? 'error' : 'default'
                      } 
                      text={status.status || '未知'} 
                    />
                </Descriptions.Item>
                  <Descriptions.Item label="描述" span={2}>{getSafeValue(application, 'description')}</Descriptions.Item>
              </Descriptions>
          </Col>
          
          <Col span={24}>
                <Descriptions
                  title="部署状态"
                  bordered
                  column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}
                >
                  <Descriptions.Item label="状态">
                    <Badge 
                      status={
                        status.status === 'running' ? 'success' : 
                        status.status === 'pending' ? 'processing' : 
                        status.status === 'failed' ? 'error' : 'default'
                      } 
                      text={status.status || '未知'} 
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="消息">{status.message || '-'}</Descriptions.Item>
                  <Descriptions.Item label="副本数">{status.replicas || 0}</Descriptions.Item>
                  <Descriptions.Item label="可用副本数">{status.availableReplicas || 0}</Descriptions.Item>
                  {status.podStatuses && (
                    <Descriptions.Item label="Pod状态" span={2}>
                      {Object.entries(status.podStatuses).map(([status, count]) => (
                        <Tag key={status} color={
                          status === 'Running' ? 'green' : 
                          status === 'Pending' ? 'blue' : 
                          status === 'Failed' ? 'red' : 'default'
                        }>
                          {status}: {count}
                        </Tag>
                      ))}
                      </Descriptions.Item>
                  )}
                </Descriptions>
          </Col>
        </Row>
          </TabPane>
          <TabPane tab="Pod列表" key="pods">
            <div style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<ReloadOutlined />} 
                onClick={fetchApplicationPods}
                loading={podLoading}
              >
                刷新Pod列表
              </Button>
            </div>
            {podList.length > 0 ? (
              <Table 
                columns={podColumns} 
                dataSource={podList} 
                rowKey="name" 
                loading={podLoading}
                pagination={{ pageSize: 10 }}
              />
            ) : (
              <Alert 
                message="未找到相关Pod" 
                description="当前应用没有运行中的Pod或尚未部署" 
                type="info" 
                showIcon 
              />
            )}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default ApplicationDetail; 
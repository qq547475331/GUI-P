import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Card, Tag, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SyncOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import eventBus, { EVENT_TYPES } from '../services/eventBus';
import customMessage from '../services/message';
import './Dashboard.css';

const Dashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState({});
  const navigate = useNavigate();

  // 初始加载和事件监听
  useEffect(() => {
    fetchApplications();
    
    // 添加事件监听
    const unsubscribeCreated = eventBus.on(EVENT_TYPES.APP_CREATED, handleAppCreated);
    const unsubscribeRefresh = eventBus.on(EVENT_TYPES.REFRESH_APPS, fetchApplications);
    
    // 组件卸载时取消监听
    return () => {
      unsubscribeCreated();
      unsubscribeRefresh();
    };
  }, []);
  
  // 处理应用创建事件
  const handleAppCreated = (appData) => {
    console.log('收到应用创建事件:', appData);
    message.success('应用创建成功，刷新应用列表');
    fetchApplications();
  };

  const fetchApplications = async (retryCount = 0) => {
    try {
      setLoading(true);
      const data = await apiService.getApplications();
      setApplications(data);
      
      // 获取应用列表后，立即查询每个应用的实时状态
      if (Array.isArray(data) && data.length > 0) {
        data.forEach(app => {
          updateAppStatus(app.id);
        });
      }
    } catch (error) {
      console.error('获取应用列表失败:', error);
      
      // 尝试从本地存储加载
      const cachedApps = localStorage.getItem('cachedApplications');
      if (cachedApps) {
        try {
          const parsedApps = JSON.parse(cachedApps);
          console.log('从缓存加载应用列表');
          setApplications(parsedApps);
          // 显示更友好的消息
          message.warning('使用缓存的应用列表，可能不是最新数据');
          
          // 尝试更新缓存中应用的状态
          if (Array.isArray(parsedApps) && parsedApps.length > 0) {
            parsedApps.forEach(app => {
              updateAppStatus(app.id);
            });
          }
        } catch (parseError) {
          console.error('解析缓存应用列表失败:', parseError);
          // 如果解析失败，显示错误
          if (retryCount < 2) { // 最多重试2次
            message.info('正在重新获取应用列表...');
            // 延迟1秒后重试
            setTimeout(() => fetchApplications(retryCount + 1), 1000);
            return;
          } else {
            message.error('获取应用列表失败，请稍后刷新页面');
          }
        }
      } else {
        // 没有缓存，尝试重试
        if (retryCount < 2) { // 最多重试2次
          message.info('正在重新获取应用列表...');
          // 延迟1秒后重试
          setTimeout(() => fetchApplications(retryCount + 1), 1000);
          return;
        } else {
          message.error('获取应用列表失败，请稍后刷新页面');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const updateAppStatus = async (appId) => {
    if (!appId) return;
    
    try {
      setRefreshingStatus(prev => ({ ...prev, [appId]: true }));
      
      // 获取应用的实时部署状态
      const statusData = await apiService.getDeploymentStatus(appId);
      
      // 更新应用列表中的状态
      setApplications(prevApps => 
        prevApps.map(app => {
          if (app.id === appId) {
            // 如果statusData包含状态信息，则更新应用状态
            if (statusData) {
              // 确保状态为对象格式，包含phase属性
              const newStatus = typeof statusData === 'object' ? 
                statusData.status ? { phase: statusData.status } : statusData : 
                { phase: statusData };
              
              return { ...app, status: newStatus };
            }
          }
          return app;
        })
      );
    } catch (error) {
      console.error(`更新应用 ${appId} 状态失败:`, error);
    } finally {
      setRefreshingStatus(prev => ({ ...prev, [appId]: false }));
    }
  };

  const refreshAllStatus = async () => {
    if (!applications || applications.length === 0) return;
    
    message.info('正在刷新应用状态...');
    
    try {
      await Promise.all(applications.map(app => updateAppStatus(app.id)));
      message.success('应用状态已更新');
    } catch (error) {
      console.error('刷新应用状态失败:', error);
      message.error('部分应用状态刷新失败');
    }
  };

  const handleDelete = async (record) => {
    // 立即从UI中移除应用，提供更好的用户体验
    setApplications(prevApps => prevApps.filter(app => app.id !== record.id));
    message.loading({ content: '正在删除应用...', key: 'deletingApp', duration: 0 });
    
    try {
      // 尝试删除k8s资源，设置deleteK8sResources=true
      await apiService.deleteApplication(record.id, true);
      console.log('应用记录删除成功');
      
      // 使用无边框居中的删除成功消息
      customMessage.appDeleteSuccess('应用删除成功');
      
      // 广播删除事件，通知其他可能的监听组件
      eventBus.emit(EVENT_TYPES.APP_DELETED, { id: record.id });
    } catch (error) {
      console.error('删除应用失败:', error);
      message.error({ content: '删除应用失败: ' + (error.message || '未知错误'), key: 'deletingApp' });
      
      // 删除失败时，将应用重新添加回列表
      if (error.response && error.response.status !== 404) { // 如果不是404错误(应用不存在)
        // 重新获取应用列表以恢复状态
        fetchApplications();
      }
    }
  };

  const handleDeploy = async (record) => {
    try {
      message.loading({ content: '正在准备部署...', key: 'deployingApp' });
      
      // 确保有kubeConfigId
      if (!record.kubeConfigId) {
        console.error('应用缺少kubeConfigId，尝试获取详情');
        try {
          const details = await apiService.getApplicationById(record.id);
          if (details && details.kubeConfigId) {
            record.kubeConfigId = details.kubeConfigId;
          } else {
            throw new Error('无法获取应用的kubeConfigId');
          }
        } catch (e) {
          console.error('获取应用详情失败:', e);
          message.error({ content: '部署失败: 无法获取应用的集群配置', key: 'deployingApp' });
          return;
        }
      }
      
      // 验证kubeconfig是否有效
      try {
        await apiService.verifyKubeConfig(record.kubeConfigId);
      } catch (e) {
        console.error('验证kubeconfig失败:', e);
        message.error({ content: 'Kubernetes集群配置无效或不存在，无法部署', key: 'deployingApp' });
        return;
      }
      
      // 开始部署
      message.loading({ content: '正在部署应用...', key: 'deployingApp' });
      await apiService.deployApplication(record.id);
      
      // 使用自定义消息服务
      customMessage.deploySuccess('应用已成功部署!', 'deployingApp');
      
      // 部署后延迟几秒再更新状态，等待状态变化
      setTimeout(() => {
        updateAppStatus(record.id);
      }, 3000);
    } catch (error) {
      console.error('部署应用失败:', error);
      message.error({ content: '部署失败: ' + (error.message || '未知错误'), key: 'deployingApp' });
    }
  };

  const getStatusColor = (phase) => {
    const lowerPhase = phase?.toLowerCase?.() || '';
    switch (lowerPhase) {
      case 'running':
        return 'green';
      case 'pending':
        return 'blue';
      case 'failed':
      case 'error':
        return 'red';
      case 'deploying':
        return 'gold';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      title: '应用名称',
      dataIndex: 'appName',
      key: 'appName',
    },
    {
      title: '镜像',
      dataIndex: 'imageName',
      key: 'imageName',
    },
    {
      title: '实例数',
      dataIndex: 'instances',
      key: 'instances',
    },
    {
      title: 'CPU',
      dataIndex: 'cpu',
      key: 'cpu',
      render: (cpu) => `${cpu} Core`,
    },
    {
      title: '内存',
      dataIndex: 'memory',
      key: 'memory',
      render: (memory) => `${memory} MB`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        const phase = typeof status === 'object' ? status.phase : status;
        const displayText = phase?.charAt(0)?.toUpperCase() + phase?.slice(1)?.toLowerCase();
        
        return (
          <Space>
            <Tag color={getStatusColor(phase)}>
              {displayText || '未知'}
            </Tag>
            {refreshingStatus[record.id] && <SyncOutlined spin />}
            <Button 
              type="link" 
              size="small" 
              icon={<SyncOutlined />} 
              onClick={(e) => {
                e.stopPropagation();
                updateAppStatus(record.id);
              }}
              title="刷新状态"
            />
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            icon={<EyeOutlined />} 
            onClick={() => navigate(`/detail/${record.id}`)}
            size="small"
          >
            详情
          </Button>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => navigate(`/edit/${record.id}`)}
            size="small"
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除此应用吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="dashboard">
      <Card 
        title="应用列表" 
        extra={
          <Space>
            <Button 
              icon={<SyncOutlined />} 
              onClick={refreshAllStatus}
              disabled={loading || applications.length === 0}
            >
              刷新状态
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => navigate('/create')}
            >
              新建应用
            </Button>
          </Space>
        }
      >
        <Table 
          dataSource={applications} 
          columns={columns} 
          rowKey="id"
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default Dashboard; 
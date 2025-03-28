import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Card, Tag, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async (retryCount = 0) => {
    try {
      setLoading(true);
      const data = await apiService.getApplications();
      setApplications(data);
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

  // 在删除资源前验证kubeconfig是否存在
  const validateKubeConfig = async (kubeConfigId) => {
    if (!kubeConfigId) return false;
    
    try {
      await apiService.verifyKubeConfig(kubeConfigId);
      return true;
    } catch (e) {
      console.error('验证kubeconfig失败:', e);
      return false;
    }
  };

  const handleDelete = async (record) => {
    try {
      message.loading({ content: '正在删除应用...', key: 'deletingApp' });
      
      // 使用记录本身的信息
      let kubeConfigId = record.kubeConfigId || record.kubeConfigID; // 尝试兼容两种属性名
      let namespace = record.namespace || 'default';  // 默认使用default命名空间
      let appName = record.appName || record.name;
      
      console.log('删除应用初始信息:', { 
        id: record.id,
        原始kubeConfigId: kubeConfigId, 
        namespace, 
        appName 
      });
      
      // 尝试获取更完整的信息
      try {
        const appDetails = await apiService.getApplicationById(record.id);
        console.log('应用详情:', appDetails);
        
        // 尝试从多个可能的位置获取信息
        if (appDetails) {
          // 直接从响应中获取
          if (appDetails.kubeConfigId) {
            kubeConfigId = appDetails.kubeConfigId;
            console.log('从应用详情的kubeConfigId字段获取:', kubeConfigId);
          } else if (appDetails.kubeConfigID) {
            kubeConfigId = appDetails.kubeConfigID;
            console.log('从应用详情的kubeConfigID字段获取:', kubeConfigId);
          }
          
          if (appDetails.namespace) {
            namespace = appDetails.namespace;
            console.log('从应用详情获取namespace:', namespace);
          }
          
          if (appDetails.appName) {
            appName = appDetails.appName;
            console.log('从应用详情获取appName:', appName);
          } else if (appDetails.name) {
            appName = appDetails.name;
            console.log('从应用详情获取name作为appName:', appName);
          }
        }
      } catch (detailError) {
        console.error('获取应用详情失败:', detailError);
        // 继续使用初始信息，不中断流程
      }

      console.log('完整的删除应用信息:', { 
        id: record.id,
        kubeConfigId, 
        namespace, 
        appName 
      });
      
      let k8sResourcesDeleted = false;
      
      // 检查是否有必要的信息来删除Kubernetes资源
      // 只有当以下条件都满足时，才尝试删除K8s资源:
      // 1. 有kubeConfigId
      // 2. 有appName 
      // 3. kubeconfig有效
      let shouldDeleteK8sResources = false;
      
      if (!kubeConfigId) {
        console.warn('应用没有关联的kubeConfigId，将只删除应用记录');
        message.warning('应用没有关联的Kubernetes集群配置，将只删除应用记录');
      } else if (!appName) {
        console.warn('应用名称不存在，将只删除应用记录');
        message.warning('应用名称不存在，无法清理Kubernetes资源，但将删除应用记录');
      } else {
        // 验证kubeconfig是否有效
        try {
          const hasValidKubeConfig = await apiService.verifyKubeConfig(kubeConfigId);
          if (!hasValidKubeConfig) {
            console.warn(`kubeconfig(${kubeConfigId})无效或不存在，将只删除应用记录`);
            message.warning('Kubernetes集群配置无效或不存在，将只删除应用记录');
          } else {
            shouldDeleteK8sResources = true;
          }
        } catch (verifyError) {
          console.error('验证kubeconfig时出错:', verifyError);
          message.warning('验证Kubernetes集群配置时出错，将只删除应用记录');
        }
      }
      
      // 如果有完整信息且kubeconfig有效，尝试删除K8s资源
      if (shouldDeleteK8sResources) {
        try {
          console.log('用于删除的应用信息:', { kubeConfigId, namespace, appName });
          message.loading({ content: '正在删除Kubernetes资源...', key: 'deletingApp', duration: 0 });
          
          // 定义要删除的资源
          const resources = [
            // 首先删除Deployment
            { type: 'deployments', name: appName },
            // 然后删除StatefulSet
            { type: 'statefulsets', name: appName },
            // 然后删除Service
            { type: 'services', name: appName },
            // 然后删除ConfigMap
            { type: 'configmaps', name: `${appName}-config` },
            // 然后删除Secret
            { type: 'secrets', name: `${appName}-secret` },
            // 然后删除PersistentVolumeClaim
            { type: 'persistentvolumeclaims', name: appName },
            // 然后删除Ingress
            { type: 'ingresses', name: appName },
            // 然后删除NetworkPolicy
            { type: 'networkpolicies', name: appName },
            // 最后删除Pod（通常不需要手动删除，但以防万一）
            { type: 'pods', name: appName, labelSelector: `app=${appName}` }
          ];
          
          // 对每个资源执行删除操作，忽略错误继续
          const deletePromises = resources.map(async (resource) => {
            try {
              console.log(`尝试删除${resource.type}资源: ${resource.name}...`);
              
              // 使用较短的超时时间
              await apiService.deleteKubernetesResource(kubeConfigId, resource.type, namespace, resource.name);
              console.log(`${resource.type}资源删除成功`);
              return true;
            } catch (err) {
              console.warn(`删除${resource.type}资源失败:`, err);
              
              // 如果是404错误（资源不存在），认为是成功的
              if (err.response && err.response.status === 404) {
                console.log(`${resource.type}资源不存在，跳过`);
                return true;
              }
              
              // 尝试强制删除
              try {
                await apiService.forceDeleteKubernetesResource(kubeConfigId, resource.type, namespace, resource.name);
                console.log(`强制删除${resource.type}资源成功`);
                return true;
              } catch (forceErr) {
                console.error(`强制删除${resource.type}资源失败:`, forceErr);
                // 继续处理其他资源，不中断流程
                return false;
              }
            }
          });
          
          // 等待所有删除操作完成
          const results = await Promise.allSettled(deletePromises);
          const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
          
          console.log(`删除Kubernetes资源完成，成功: ${successCount}/${resources.length}`);
          k8sResourcesDeleted = successCount > 0;
          
          // 等待一段时间，确保Kubernetes集群有时间处理删除操作
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (k8sError) {
          console.error('删除Kubernetes资源时出错:', k8sError);
          message.warning('删除Kubernetes资源时出错，将继续删除应用记录');
        }
      }
      
      // 无论K8s资源删除是否成功，都尝试删除应用记录
      try {
        console.log('删除应用记录...');
        
        // 如果成功删除了K8s资源，将deleteK8sResources参数设置为false，因为资源已经删除
        // 否则，如果应该删除K8s资源但失败了，仍然传递true，让后端尝试再次删除
        const deleteK8sResources = shouldDeleteK8sResources && !k8sResourcesDeleted;
        
        await apiService.deleteApplication(record.id, deleteK8sResources);
        console.log('应用记录删除成功');
        
        message.success({ content: '应用删除成功', key: 'deletingApp' });
        // 刷新应用列表
        fetchApplications();
      } catch (dbError) {
        console.error('删除应用记录时出错:', dbError);
        message.error({ content: '删除应用记录失败: ' + (dbError.message || '未知错误'), key: 'deletingApp' });
      }
    } catch (error) {
      console.error('删除应用过程中出现未处理的错误:', error);
      message.error({ content: '删除应用失败: ' + (error.message || '未知错误'), key: 'deletingApp' });
    } finally {
      setLoading(false);
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
      message.success({ content: '应用已成功部署!', key: 'deployingApp' });
      
      // 刷新应用列表
      fetchApplications();
    } catch (error) {
      console.error('部署应用失败:', error);
      message.error({ content: '部署失败: ' + (error.message || '未知错误'), key: 'deployingApp' });
    }
  };

  const getStatusColor = (phase) => {
    switch (phase) {
      case 'Running':
        return 'green';
      case 'Pending':
        return 'blue';
      case 'Failed':
        return 'red';
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
      render: (status) => (
        <Tag color={getStatusColor(status.phase)}>
          {status.phase}
        </Tag>
      ),
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
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => navigate('/create')}
          >
            新建应用
          </Button>
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
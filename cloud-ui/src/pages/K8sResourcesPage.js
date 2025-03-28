import React, { useState, useEffect, useCallback } from 'react';
import { 
  Card, 
  Select, 
  Table, 
  Tag, 
  Tabs, 
  Spin, 
  Button, 
  message, 
  Typography,
  Badge,
  Space,
  Tooltip,
  Popconfirm,
  Modal,
  Form,
  InputNumber,
  Alert,
  List
} from 'antd';
import { 
  ReloadOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  WarningOutlined,
  LoadingOutlined,
  DeleteOutlined,
  ScissorOutlined,
  RedoOutlined,
  EyeOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  CodeOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import './K8sResourcesPage.css';

const { Option } = Select;
const { TabPane } = Tabs;
const { Title } = Typography;

const K8sResourcesPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [namespaces, setNamespaces] = useState([]);
  const [selectedNamespace, setSelectedNamespace] = useState('');
  const [showAllNamespaces, setShowAllNamespaces] = useState(true);
  const [pods, setPods] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [services, setServices] = useState([]);
  const [statefulSets, setStatefulSets] = useState([]);
  const [daemonSets, setDaemonSets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [kubeConfig, setKubeConfig] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [scaleModalVisible, setScaleModalVisible] = useState(false);
  const [currentResource, setCurrentResource] = useState(null);
  const [replicasValue, setReplicasValue] = useState(1);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('pods');
  const [scaleResource, setScaleResource] = useState(null);
  const [scaleValue, setScaleValue] = useState(1);
  const [scaleForm] = Form.useForm();
  const [scaleType, setScaleType] = useState('');
  const [error, setError] = useState(null);
  const [podError, setPodError] = useState(false);
  const [deploymentError, setDeploymentError] = useState(false);
  const [serviceError, setServiceError] = useState(false);
  const [statefulSetError, setStatefulSetError] = useState(false);
  const [daemonSetError, setDaemonSetError] = useState(false);
  const [jobError, setJobError] = useState(false);
  const [namespacesLoaded, setNamespacesLoaded] = useState(false);
  // 跟踪删除中的资源
  const [deletingResources, setDeletingResources] = useState({});
  const messageKey = 'deleteResource';
  // 正在重启的资源跟踪
  const [restartingResources, setRestartingResources] = useState({});
  const restartMessageKey = 'restartResource';
  // 记录正在伸缩的资源
  const [scalingResources, setScalingResources] = useState({});
  const scaleMessageKey = 'scaleResource';

  // 资源类型标签映射
  const resourceTypeLabels = {
    pods: 'Pod',
    deployments: '部署',
    services: '服务',
    configmaps: '配置',
    secrets: '密钥',
    persistentvolumeclaims: 'PVC',
    statefulsets: '有状态集',
    ingresses: '入口',
  };

  useEffect(() => {
    fetchKubeConfig();
    if (!namespacesLoaded) {
      fetchNamespaces();
    }
  }, [id]);

  useEffect(() => {
    fetchResources();
  }, [selectedNamespace, showAllNamespaces]);

  const fetchKubeConfig = async () => {
    try {
      const config = await apiService.getKubeConfigById(id);
      setKubeConfig(config);
      document.title = `集群资源: ${config.name}`;
    } catch (error) {
      message.error('获取集群配置失败');
      navigate('/kubeconfig');
    }
  };

  const fetchNamespaces = async () => {
    try {
      const data = await apiService.getKubernetesNamespaces(id);
      setNamespaces(data);
      if (data.length > 0 && !showAllNamespaces) {
        setSelectedNamespace(data[0]);
      }
      setNamespacesLoaded(true);
    } catch (error) {
      message.error('获取命名空间列表失败');
    }
  };

  const fetchResources = async () => {
    setLoading(true);
    // 重置所有错误状态
    setError(null);
    setPodError(false);
    setDeploymentError(false);
    setServiceError(false);
    setStatefulSetError(false);
    setDaemonSetError(false);
    setJobError(false);
    
    try {
      const namespace = showAllNamespaces ? '' : selectedNamespace;
      console.log('获取资源列表，集群ID:', id, '命名空间:', namespace || '所有命名空间');
      
      // 设置取消操作的超时
      let hasTimeout = false;
      let timeoutId = setTimeout(() => {
        hasTimeout = true;
        setLoading(false);
        setRefreshing(false);
        setError('获取集群资源超时(20秒)，请检查集群连接状态');
        message.warning('获取集群资源超时(20秒)，请检查集群连接状态');
      }, 20000);
      
      // 根据当前激活的标签页选择性地获取资源
      let promises = [];
      let resourceTypes = [];
      
      if (activeTab === 'pods' || activeTab === 'all') {
        promises.push(apiService.getKubernetesPods(id, namespace));
        resourceTypes.push('pods');
      } else {
        promises.push(Promise.resolve([]));
        resourceTypes.push(null);
      }
      
      if (activeTab === 'deployments' || activeTab === 'all') {
        promises.push(apiService.getKubernetesDeployments(id, namespace));
        resourceTypes.push('deployments');
      } else {
        promises.push(Promise.resolve([]));
        resourceTypes.push(null);
      }
      
      if (activeTab === 'services' || activeTab === 'all') {
        promises.push(apiService.getKubernetesServices(id, namespace));
        resourceTypes.push('services');
      } else {
        promises.push(Promise.resolve([]));
        resourceTypes.push(null);
      }
      
      if (activeTab === 'statefulsets' || activeTab === 'all') {
        promises.push(apiService.getKubernetesStatefulSets(id, namespace));
        resourceTypes.push('statefulsets');
      } else {
        promises.push(Promise.resolve([]));
        resourceTypes.push(null);
      }
      
      if (activeTab === 'daemonsets' || activeTab === 'all') {
        promises.push(apiService.getKubernetesDaemonSets(id, namespace));
        resourceTypes.push('daemonsets');
      } else {
        promises.push(Promise.resolve([]));
        resourceTypes.push(null);
      }
      
      if (activeTab === 'jobs' || activeTab === 'all') {
        promises.push(apiService.getKubernetesJobs(id, namespace));
        resourceTypes.push('jobs');
      } else {
        promises.push(Promise.resolve([]));
        resourceTypes.push(null);
      }

      // 使用Promise.allSettled确保部分失败不会影响整体执行
      const results = await Promise.allSettled(promises);
      
      // 清除超时计时器
      clearTimeout(timeoutId);
      
      // 如果已经超时，就不再继续处理
      if (hasTimeout) return;
      
      // 处理每个资源类型的结果
      const [podsResult, deploymentsResult, servicesResult, 
             statefulSetsResult, daemonSetsResult, jobsResult] = results;
      
      // 记录失败的资源类型
      const failedResources = [];
      
      // 处理Pods结果
      if (resourceTypes[0] && podsResult.status === 'fulfilled') {
        setPods(podsResult.value);
      } else if (resourceTypes[0]) {
        setPods([]);
        setPodError(true);
        failedResources.push('Pods');
      }
      
      // 处理Deployments结果
      if (resourceTypes[1] && deploymentsResult.status === 'fulfilled') {
        setDeployments(deploymentsResult.value);
      } else if (resourceTypes[1]) {
        setDeployments([]);
        setDeploymentError(true);
        failedResources.push('Deployments');
      }
      
      // 处理Services结果
      if (resourceTypes[2] && servicesResult.status === 'fulfilled') {
        setServices(servicesResult.value);
      } else if (resourceTypes[2]) {
        setServices([]);
        setServiceError(true);
        failedResources.push('Services');
      }
      
      // 处理StatefulSets结果
      if (resourceTypes[3] && statefulSetsResult.status === 'fulfilled') {
        setStatefulSets(statefulSetsResult.value);
      } else if (resourceTypes[3]) {
        setStatefulSets([]);
        setStatefulSetError(true);
        failedResources.push('StatefulSets');
      }
      
      // 处理DaemonSets结果
      if (resourceTypes[4] && daemonSetsResult.status === 'fulfilled') {
        setDaemonSets(daemonSetsResult.value);
      } else if (resourceTypes[4]) {
        setDaemonSets([]);
        setDaemonSetError(true);
        failedResources.push('DaemonSets');
      }
      
      // 处理Jobs结果
      if (resourceTypes[5] && jobsResult.status === 'fulfilled') {
        setJobs(jobsResult.value);
      } else if (resourceTypes[5]) {
        setJobs([]);
        setJobError(true);
        failedResources.push('Jobs');
      }
      
      // 如果有失败的资源，显示警告
      if (failedResources.length > 0) {
        const errorMsg = `获取以下资源失败: ${failedResources.join(', ')}，请检查集群连接状态和权限配置`;
        setError(errorMsg);
        message.warning(errorMsg);
      }
    } catch (error) {
      console.error('获取集群资源失败:', error);
      
      // 提供更详细的错误信息
      let errorMsg = '获取集群资源失败';
      
      if (error.response && error.response.status === 500) {
        errorMsg = '服务器内部错误(500)，请检查集群连接状态和权限配置';
      } else if (error.code === 'ECONNABORTED') {
        errorMsg = '请求超时，请检查网络连接和集群状态';
      } else if (error.message) {
        errorMsg = `获取资源失败: ${error.message}`;
      }
      
      setError(errorMsg);
      message.error(errorMsg);
      
      // 设置所有资源的错误状态
      setPodError(true);
      setDeploymentError(true);
      setServiceError(true);
      setStatefulSetError(true);
      setDaemonSetError(true);
      setJobError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchResources();
  };

  const handleNamespaceChange = (value) => {
    setShowAllNamespaces(value === 'all');
    setSelectedNamespace(value === 'all' ? '' : value);
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    // 立即获取资源数据，不等待状态更新
    const namespace = showAllNamespaces ? '' : selectedNamespace;
    setLoading(true);
    
    // 根据当前激活的标签页选择性地获取资源
    let promises = [];
    
    if (key === 'pods' || key === 'all') {
      promises.push(apiService.getKubernetesPods(id, namespace));
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (key === 'deployments' || key === 'all') {
      promises.push(apiService.getKubernetesDeployments(id, namespace));
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (key === 'services' || key === 'all') {
      promises.push(apiService.getKubernetesServices(id, namespace));
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (key === 'statefulsets' || key === 'all') {
      promises.push(apiService.getKubernetesStatefulSets(id, namespace));
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (key === 'daemonsets' || key === 'all') {
      promises.push(apiService.getKubernetesDaemonSets(id, namespace));
    } else {
      promises.push(Promise.resolve([]));
    }
    
    if (key === 'jobs' || key === 'all') {
      promises.push(apiService.getKubernetesJobs(id, namespace));
    } else {
      promises.push(Promise.resolve([]));
    }

    Promise.all(promises)
      .then(([podsData, deploymentsData, servicesData, statefulSetsData, daemonSetsData, jobsData]) => {
        setPods(podsData);
        setDeployments(deploymentsData);
        setServices(servicesData);
        setStatefulSets(statefulSetsData);
        setDaemonSets(daemonSetsData);
        setJobs(jobsData);
      })
      .catch(error => {
        message.error('获取集群资源失败');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Running':
        return 'success';
      case 'Pending':
        return 'processing';
      case 'Succeeded':
        return 'default';
      case 'Failed':
        return 'error';
      case 'Unknown':
        return 'warning';
      default:
        return 'default';
    }
  };

  // 删除资源
  const handleDelete = async (resourceType, namespace, name) => {
    // 创建唯一的资源标识符
    const resourceKey = `${resourceType}-${namespace}-${name}`;
    
    // 如果资源已经在删除中，则不重复操作
    if (deletingResources[resourceKey]) {
      return;
    }
    
    try {
      // 更新删除中的资源状态
      setDeletingResources(prev => ({
        ...prev,
        [resourceKey]: true
      }));
      
      // 显示正在删除消息
      message.loading({ content: `正在删除${resourceType} ${name}...`, key: messageKey, duration: 0 });
      
      // 发送删除请求
      await apiService.deleteKubernetesResource(id, resourceType, namespace, name);
      
      // 删除成功更新消息
      message.success({ content: `删除${resourceType} ${name}成功`, key: messageKey, duration: 2 });
      
      // 删除成功后刷新资源列表
      fetchResources();
    } catch (error) {
      // 删除失败更新消息
      message.error({ 
        content: `删除失败: ${error.response?.data?.message || error.message}`, 
        key: messageKey, 
        duration: 3 
      });
    } finally {
      // 无论成功失败，都移除删除中状态
      setDeletingResources(prev => {
        const newState = { ...prev };
        delete newState[resourceKey];
        return newState;
      });
    }
  };

  // 打开伸缩对话框
  const showScaleModal = (resourceType, resource) => {
    setCurrentResource({
      type: resourceType,
      namespace: resource.namespace,
      name: resource.name,
      replicas: resource.replicas
    });
    setReplicasValue(resource.replicas);
    setScaleModalVisible(true);
  };

  // 伸缩资源
  const handleScale = async () => {
    if (!currentResource) return;
    
    const resourceKey = `${currentResource.type}-${currentResource.namespace}-${currentResource.name}`;
    
    // 如果资源已经在伸缩中，不重复操作
    if (scalingResources[resourceKey]) {
      return;
    }
    
    try {
      // 更新伸缩中状态
      setScalingResources(prev => ({
        ...prev,
        [resourceKey]: true
      }));
      
      // 显示正在伸缩的消息
      message.loading({ 
        content: `正在伸缩${currentResource.type} ${currentResource.name}...`, 
        key: scaleMessageKey, 
        duration: 0 
      });
      
      await apiService.scaleKubernetesResource(
        id, 
        currentResource.type, 
        currentResource.namespace, 
        currentResource.name, 
        replicasValue
      );
      
      // 伸缩成功
      message.success({ 
        content: `伸缩${currentResource.type} ${currentResource.name}成功`, 
        key: scaleMessageKey, 
        duration: 2 
      });
      setScaleModalVisible(false);
      fetchResources();
    } catch (error) {
      // 伸缩失败
      message.error({ 
        content: `伸缩失败: ${error.response?.data?.message || error.message}`, 
        key: scaleMessageKey, 
        duration: 3 
      });
    } finally {
      // 无论成功失败，都清除伸缩中状态
      setScalingResources(prev => {
        const newState = { ...prev };
        delete newState[resourceKey];
        return newState;
      });
    }
  };

  // 重启Deployment
  const handleRestart = async (namespace, name) => {
    const resourceKey = `deployments-${namespace}-${name}`;
    
    // 如果资源已经在重启中，则不重复操作
    if (restartingResources[resourceKey]) {
      return;
    }
    
    try {
      // 更新重启中状态
      setRestartingResources(prev => ({
        ...prev,
        [resourceKey]: true
      }));
      
      // 显示正在重启的消息
      message.loading({ content: `正在重启Deployment ${name}...`, key: restartMessageKey, duration: 0 });
      
      await apiService.restartKubernetesDeployment(id, namespace, name);
      
      // 重启成功
      message.success({ content: `重启Deployment ${name}成功`, key: restartMessageKey, duration: 2 });
      fetchResources();
    } catch (error) {
      // 重启失败
      message.error({ 
        content: `重启失败: ${error.response?.data?.message || error.message}`, 
        key: restartMessageKey, 
        duration: 3 
      });
    } finally {
      // 无论成功失败，都清除重启中状态
      setRestartingResources(prev => {
        const newState = { ...prev };
        delete newState[resourceKey];
        return newState;
      });
    }
  };

  // 获取资源的操作列定义
  const getActionColumn = (resourceType) => ({
    title: '操作',
    key: 'action',
    width: resourceType === 'pods' ? 300 : 220,
    render: (_, record) => (
      <Space size="small">
        {resourceType === 'pods' && (
          <>
            <Tooltip title="查看详情">
              <Button 
                size="small" 
                type="primary" 
                icon={<EyeOutlined />}
                onClick={() => navigate(`/cluster/${id}/namespace/${record.namespace}/pod/${record.name}`)}
              >
                详情
              </Button>
            </Tooltip>
            
            <Tooltip title="查看日志">
              <Button 
                size="small" 
                icon={<FileTextOutlined />}
                onClick={() => viewPodLogs(record)}
              >
                日志
              </Button>
            </Tooltip>
            
            <Tooltip title="启动终端">
              <Button 
                size="small" 
                icon={<CodeOutlined />}
                onClick={() => openTerminal(record)}
              >
                终端
              </Button>
            </Tooltip>
          </>
        )}
        
        {/* 保留原有功能 */}
        {['deployments', 'statefulsets'].includes(resourceType) && (
          <Button 
            size="small"
            icon={<ScissorOutlined />} 
            onClick={() => showScaleModal(resourceType, record)}
          >
            伸缩
          </Button>
        )}
        
        {resourceType === 'deployments' && (
          <Button 
            size="small"
            icon={<RedoOutlined />} 
            onClick={() => handleRestart(record.namespace, record.name)}
          >
            重启
          </Button>
        )}
        
        {/* 删除功能对所有资源类型都有 */}
        <Popconfirm
          title={`确定要删除${resourceTypeLabels[resourceType]}「${record.name}」吗？`}
          onConfirm={() => handleDelete(resourceType, record.namespace, record.name)}
          okText="确定"
          cancelText="取消"
          icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          okButtonProps={{ danger: true }}
        >
          <Tooltip title="删除">
            <Button 
              danger 
              size="small" 
              icon={<DeleteOutlined />} 
              loading={deletingResources[`${resourceType}-${record.namespace}-${record.name}`]}
            >
              删除
            </Button>
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  });

  // 查看Pod日志
  const viewPodLogs = (pod) => {
    navigate(`/cluster/${id}/namespace/${pod.namespace}/pod/${pod.name}?tab=logs`);
  };
  
  // 打开Pod终端
  const openTerminal = (pod) => {
    navigate(`/cluster/${id}/namespace/${pod.namespace}/pod/${pod.name}?tab=terminal`);
  };

  // Pod表格列定义
  const podColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="resource-name">{text}</span>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (ns) => <Tag>{ns}</Tag>,
      filters: namespaces.map(ns => ({ text: ns, value: ns })),
      onFilter: (value, record) => record.namespace === value,
      filterMultiple: false,
      hidden: !showAllNamespaces,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Badge status={getStatusColor(status)} text={status} />
      ),
    },
    {
      title: 'Pod IP',
      dataIndex: 'podIP',
      key: 'podIP',
    },
    {
      title: '主机 IP',
      dataIndex: 'hostIP',
      key: 'hostIP',
    },
    {
      title: '节点',
      dataIndex: 'nodeName',
      key: 'nodeName',
    },
    {
      title: '容器',
      dataIndex: 'containers',
      key: 'containers',
      render: (containers) => (
        <Space>
          {containers.map(container => (
            <Tooltip 
              key={container.name} 
              title={`重启次数: ${container.restartCount}`}
            >
              <Tag color={container.ready ? 'green' : 'red'}>
                {container.name} {container.ready ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              </Tag>
            </Tooltip>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => new Date(time).toLocaleString(),
    },
    getActionColumn('pods')
  ].filter(column => !column.hidden);

  // Deployment表格列定义
  const deploymentColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="resource-name">{text}</span>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (ns) => <Tag>{ns}</Tag>,
      filters: namespaces.map(ns => ({ text: ns, value: ns })),
      onFilter: (value, record) => record.namespace === value,
      filterMultiple: false,
      hidden: !showAllNamespaces,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const isReady = record.readyReplicas === record.replicas;
        return (
          <Badge 
            status={isReady ? 'success' : 'processing'} 
            text={`${record.readyReplicas || 0}/${record.replicas} 就绪`} 
          />
        );
      },
    },
    {
      title: '标签',
      dataIndex: 'labels',
      key: 'labels',
      render: (labels) => (
        <Space>
          {Object.entries(labels || {}).map(([key, value]) => (
            <Tag key={key}>{key}: {value}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => new Date(time).toLocaleString(),
    },
    getActionColumn('deployments')
  ].filter(column => !column.hidden);

  // Service表格列定义
  const serviceColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="resource-name">{text}</span>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (ns) => <Tag>{ns}</Tag>,
      filters: namespaces.map(ns => ({ text: ns, value: ns })),
      onFilter: (value, record) => record.namespace === value,
      filterMultiple: false,
      hidden: !showAllNamespaces,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        let color;
        switch (type) {
          case 'LoadBalancer':
            color = 'blue';
            break;
          case 'NodePort':
            color = 'green';
            break;
          case 'ClusterIP':
            color = 'geekblue';
            break;
          default:
            color = 'default';
        }
        return <Tag color={color}>{type}</Tag>;
      },
    },
    {
      title: 'Cluster IP',
      dataIndex: 'clusterIP',
      key: 'clusterIP',
    },
    {
      title: '端口',
      dataIndex: 'ports',
      key: 'ports',
      render: (ports) => (
        <Space>
          {ports.map((port, index) => {
            let portText = `${port.port}`;
            if (port.nodePort) {
              portText += `:${port.nodePort}`;
            }
            return <Tag key={index}>{portText} ({port.targetPort})</Tag>;
          })}
        </Space>
      ),
    },
    {
      title: '外部IP',
      dataIndex: 'externalIPs',
      key: 'externalIPs',
      render: (ips) => {
        if (!ips || ips.length === 0) return '无';
        return (
          <Space>
            {ips.map((ip, index) => (
              <Tag key={index} color="blue">{ip}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '选择器',
      dataIndex: 'selector',
      key: 'selector',
      render: (selector) => (
        <Space>
          {Object.entries(selector || {}).map(([key, value]) => (
            <Tag key={key}>{key}: {value}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => new Date(time).toLocaleString(),
    },
    getActionColumn('services')
  ].filter(column => !column.hidden);
  
  // StatefulSet表格列定义
  const statefulSetColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="resource-name">{text}</span>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (ns) => <Tag>{ns}</Tag>,
      filters: namespaces.map(ns => ({ text: ns, value: ns })),
      onFilter: (value, record) => record.namespace === value,
      filterMultiple: false,
      hidden: !showAllNamespaces,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const isReady = record.readyReplicas === record.replicas;
        return (
          <Badge 
            status={isReady ? 'success' : 'processing'} 
            text={`${record.readyReplicas || 0}/${record.replicas} 就绪`} 
          />
        );
      },
    },
    {
      title: '服务名',
      dataIndex: 'serviceName',
      key: 'serviceName',
    },
    {
      title: '标签',
      dataIndex: 'labels',
      key: 'labels',
      render: (labels) => (
        <Space>
          {Object.entries(labels || {}).map(([key, value]) => (
            <Tag key={key}>{key}: {value}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => new Date(time).toLocaleString(),
    },
    getActionColumn('statefulsets')
  ].filter(column => !column.hidden);
  
  // DaemonSet表格列定义
  const daemonSetColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="resource-name">{text}</span>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (ns) => <Tag>{ns}</Tag>,
      filters: namespaces.map(ns => ({ text: ns, value: ns })),
      onFilter: (value, record) => record.namespace === value,
      filterMultiple: false,
      hidden: !showAllNamespaces,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        return (
          <Badge 
            status={record.numberAvailable === record.desiredNumberScheduled ? 'success' : 'processing'} 
            text={`${record.numberAvailable || 0}/${record.desiredNumberScheduled} 就绪`} 
          />
        );
      },
    },
    {
      title: '标签',
      dataIndex: 'labels',
      key: 'labels',
      render: (labels) => (
        <Space>
          {Object.entries(labels || {}).map(([key, value]) => (
            <Tag key={key}>{key}: {value}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => new Date(time).toLocaleString(),
    },
    getActionColumn('daemonsets')
  ].filter(column => !column.hidden);
  
  // Job表格列定义
  const jobColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <span className="resource-name">{text}</span>,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
      render: (ns) => <Tag>{ns}</Tag>,
      filters: namespaces.map(ns => ({ text: ns, value: ns })),
      onFilter: (value, record) => record.namespace === value,
      filterMultiple: false,
      hidden: !showAllNamespaces,
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        let status = '运行中';
        let statusType = 'processing';
        
        if (record.succeeded > 0) {
          status = '已完成';
          statusType = 'success';
        } else if (record.failed > 0) {
          status = '失败';
          statusType = 'error';
        }
        
        return <Badge status={statusType} text={status} />;
      },
    },
    {
      title: '完成信息',
      key: 'completion',
      render: (_, record) => (
        <span>
          成功: {record.succeeded || 0}, 失败: {record.failed || 0}, 并行度: {record.parallelism || 1}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (time) => new Date(time).toLocaleString(),
    },
    getActionColumn('jobs')
  ].filter(column => !column.hidden);
  
  const renderError = (errorText, retryHandler) => (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <Alert
        message="获取资源失败"
        description={errorText || '请检查集群连接状态和权限配置'}
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Button 
        type="primary" 
        icon={<ReloadOutlined />} 
        onClick={retryHandler}
        loading={loading}
      >
        重试
      </Button>
    </div>
  );

  const renderPodList = () => {
    if (podError) {
      return renderError('获取Pod列表失败', handleRefresh);
    }
    
    return (
      <List
        loading={loading && activeTab === 'pods'}
        dataSource={pods}
        renderItem={renderPodItem}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '没有找到Pod' }}
      />
    );
  };

  const renderDeploymentList = () => {
    if (deploymentError) {
      return renderError('获取Deployment列表失败', handleRefresh);
    }
    
    return (
      <List
        loading={loading && activeTab === 'deployments'}
        dataSource={deployments}
        renderItem={renderDeploymentItem}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '没有找到Deployment' }}
      />
    );
  };

  const renderServiceList = () => {
    if (serviceError) {
      return renderError('获取Service列表失败', handleRefresh);
    }
    
    return (
      <List
        loading={loading && activeTab === 'services'}
        dataSource={services}
        renderItem={renderServiceItem}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '没有找到Service' }}
      />
    );
  };

  const renderStatefulSetList = () => {
    if (statefulSetError) {
      return renderError('获取StatefulSet列表失败', handleRefresh);
    }
    
    return (
      <List
        loading={loading && activeTab === 'statefulsets'}
        dataSource={statefulSets}
        renderItem={renderStatefulSetItem}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '没有找到StatefulSet' }}
      />
    );
  };

  const renderDaemonSetList = () => {
    if (daemonSetError) {
      return renderError('获取DaemonSet列表失败', handleRefresh);
    }
    
    return (
      <List
        loading={loading && activeTab === 'daemonsets'}
        dataSource={daemonSets}
        renderItem={renderDaemonSetItem}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '没有找到DaemonSet' }}
      />
    );
  };

  const renderJobList = () => {
    if (jobError) {
      return renderError('获取Job列表失败', handleRefresh);
    }
    
    return (
      <List
        loading={loading && activeTab === 'jobs'}
        dataSource={jobs}
        renderItem={renderJobItem}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '没有找到Job' }}
      />
    );
  };

  const renderPodItem = (item) => {
    // 计算状态信息
    const status = item.status || 'Unknown';
    const statusColor = getStatusColor(status);
    const resourceKey = `pods-${item.namespace}-${item.name}`;
    const isDeleting = !!deletingResources[resourceKey];
    
    return (
      <List.Item
        key={`${item.namespace}-${item.name}`}
        actions={[
          <Button 
            key="view" 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => { /* 查看详情功能 */ }}
          >
            详情
          </Button>,
          <Popconfirm
            key="delete"
            title="确定要删除此资源吗？"
            onConfirm={() => handleDelete('pods', item.namespace, item.name)}
            okText="确定"
            cancelText="取消"
            disabled={isDeleting}
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              loading={isDeleting}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中' : '删除'}
            </Button>
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          title={
            <Space>
              <span>{item.name}</span>
              <Tag color="blue">{item.namespace}</Tag>
              <Tag color={statusColor}>{status}</Tag>
              {isDeleting && <Tag color="red">删除中</Tag>}
            </Space>
          }
          description={
            <Space direction="vertical">
              <div><strong>容器数:</strong> {item.containers?.length || 0}</div>
              <div><strong>IP:</strong> {item.podIP || '-'}</div>
              <div><strong>节点:</strong> {item.nodeName || '-'}</div>
              <div><strong>创建时间:</strong> {new Date(item.creationTimestamp).toLocaleString()}</div>
            </Space>
          }
        />
      </List.Item>
    );
  };
  
  const renderDeploymentItem = (item) => {
    const resourceKey = `deployments-${item.namespace}-${item.name}`;
    const isDeleting = !!deletingResources[resourceKey];
    const isRestarting = !!restartingResources[resourceKey];
    
    return (
      <List.Item
        key={`${item.namespace}-${item.name}`}
        actions={[
          <Button 
            key="scale" 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => showScaleModal('deployments', item)}
            disabled={isDeleting || isRestarting}
          >
            伸缩
          </Button>,
          <Button 
            key="restart" 
            type="link" 
            icon={<RedoOutlined spin={isRestarting} />}
            onClick={() => handleRestart(item.namespace, item.name)}
            loading={isRestarting}
            disabled={isDeleting || isRestarting}
          >
            {isRestarting ? '重启中' : '重启'}
          </Button>,
          <Popconfirm
            key="delete"
            title="确定要删除此资源吗？"
            onConfirm={() => handleDelete('deployments', item.namespace, item.name)}
            okText="确定"
            cancelText="取消"
            disabled={isDeleting || isRestarting}
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              loading={isDeleting}
              disabled={isDeleting || isRestarting}
            >
              {isDeleting ? '删除中' : '删除'}
            </Button>
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          title={
            <Space>
              <span>{item.name}</span>
              <Tag color="blue">{item.namespace}</Tag>
              {isDeleting && <Tag color="red">删除中</Tag>}
              {isRestarting && <Tag color="orange">重启中</Tag>}
            </Space>
          }
          description={
            <Space direction="vertical">
              <div><strong>副本:</strong> {item.readyReplicas || 0}/{item.replicas || 0}</div>
              <div><strong>创建时间:</strong> {new Date(item.creationTimestamp).toLocaleString()}</div>
              <div><strong>镜像:</strong> {item.containers?.[0]?.image || '-'}</div>
            </Space>
          }
        />
      </List.Item>
    );
  };
  
  const renderServiceItem = (item) => {
    const resourceKey = `services-${item.namespace}-${item.name}`;
    const isDeleting = !!deletingResources[resourceKey];
    
    return (
      <List.Item
        key={`${item.namespace}-${item.name}`}
        actions={[
          <Popconfirm
            key="delete"
            title="确定要删除此资源吗？"
            onConfirm={() => handleDelete('services', item.namespace, item.name)}
            okText="确定"
            cancelText="取消"
            disabled={isDeleting}
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              loading={isDeleting}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中' : '删除'}
            </Button>
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          title={
            <Space>
              <span>{item.name}</span>
              <Tag color="blue">{item.namespace}</Tag>
              <Tag color="green">{item.type}</Tag>
              {isDeleting && <Tag color="red">删除中</Tag>}
            </Space>
          }
          description={
            <Space direction="vertical">
              <div><strong>集群IP:</strong> {item.clusterIP || '-'}</div>
              <div><strong>端口:</strong> {
                (item.ports || []).map(port => 
                  `${port.port}/${port.protocol}`
                ).join(', ') || '-'
              }</div>
              <div><strong>创建时间:</strong> {new Date(item.creationTimestamp).toLocaleString()}</div>
            </Space>
          }
        />
      </List.Item>
    );
  };
  
  const renderStatefulSetItem = (item) => {
    const resourceKey = `statefulsets-${item.namespace}-${item.name}`;
    const isDeleting = !!deletingResources[resourceKey];
    
    return (
      <List.Item
        key={`${item.namespace}-${item.name}`}
        actions={[
          <Button 
            key="scale" 
            type="link" 
            icon={<EditOutlined />}
            onClick={() => showScaleModal('statefulsets', item)}
            disabled={isDeleting}
          >
            伸缩
          </Button>,
          <Popconfirm
            key="delete"
            title="确定要删除此资源吗？"
            onConfirm={() => handleDelete('statefulsets', item.namespace, item.name)}
            okText="确定"
            cancelText="取消"
            disabled={isDeleting}
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              loading={isDeleting}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中' : '删除'}
            </Button>
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          title={
            <Space>
              <span>{item.name}</span>
              <Tag color="blue">{item.namespace}</Tag>
              {isDeleting && <Tag color="red">删除中</Tag>}
            </Space>
          }
          description={
            <Space direction="vertical">
              <div><strong>副本:</strong> {item.readyReplicas || 0}/{item.replicas || 0}</div>
              <div><strong>创建时间:</strong> {new Date(item.creationTimestamp).toLocaleString()}</div>
              <div><strong>镜像:</strong> {item.containers?.[0]?.image || '-'}</div>
            </Space>
          }
        />
      </List.Item>
    );
  };
  
  const renderDaemonSetItem = (item) => {
    const resourceKey = `daemonsets-${item.namespace}-${item.name}`;
    const isDeleting = !!deletingResources[resourceKey];
    
    return (
      <List.Item
        key={`${item.namespace}-${item.name}`}
        actions={[
          <Popconfirm
            key="delete"
            title="确定要删除此资源吗？"
            onConfirm={() => handleDelete('daemonsets', item.namespace, item.name)}
            okText="确定"
            cancelText="取消"
            disabled={isDeleting}
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              loading={isDeleting}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中' : '删除'}
            </Button>
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          title={
            <Space>
              <span>{item.name}</span>
              <Tag color="blue">{item.namespace}</Tag>
              {isDeleting && <Tag color="red">删除中</Tag>}
            </Space>
          }
          description={
            <Space direction="vertical">
              <div><strong>节点数:</strong> {item.currentNumberScheduled || 0}/{item.desiredNumberScheduled || 0}</div>
              <div><strong>创建时间:</strong> {new Date(item.creationTimestamp).toLocaleString()}</div>
              <div><strong>镜像:</strong> {item.containers?.[0]?.image || '-'}</div>
            </Space>
          }
        />
      </List.Item>
    );
  };
  
  const renderJobItem = (item) => {
    const resourceKey = `jobs-${item.namespace}-${item.name}`;
    const isDeleting = !!deletingResources[resourceKey];
    
    return (
      <List.Item
        key={`${item.namespace}-${item.name}`}
        actions={[
          <Popconfirm
            key="delete"
            title="确定要删除此资源吗？"
            onConfirm={() => handleDelete('jobs', item.namespace, item.name)}
            okText="确定"
            cancelText="取消"
            disabled={isDeleting}
          >
            <Button 
              type="link" 
              danger 
              icon={<DeleteOutlined />}
              loading={isDeleting}
              disabled={isDeleting}
            >
              {isDeleting ? '删除中' : '删除'}
            </Button>
          </Popconfirm>
        ]}
      >
        <List.Item.Meta
          title={
            <Space>
              <span>{item.name}</span>
              <Tag color="blue">{item.namespace}</Tag>
              <Tag color={item.status?.succeeded ? 'success' : 'processing'}>
                {item.status?.succeeded ? '完成' : '运行中'}
              </Tag>
              {isDeleting && <Tag color="red">删除中</Tag>}
            </Space>
          }
          description={
            <Space direction="vertical">
              <div><strong>完成数:</strong> {item.status?.succeeded || 0}/{item.spec?.completions || 1}</div>
              <div><strong>创建时间:</strong> {new Date(item.creationTimestamp).toLocaleString()}</div>
              <div><strong>镜像:</strong> {item.containers?.[0]?.image || '-'}</div>
            </Space>
          }
        />
      </List.Item>
    );
  };

  return (
    <div className="k8s-resources-page">
      <Card 
        title={
          <Space>
            <span>Kubernetes 集群资源</span>
            {kubeConfig && (
              <Tag color="blue">{kubeConfig.name} ({kubeConfig.currentContext})</Tag>
            )}
          </Space>
        }
        extra={
          <Space>
            <Select 
              value={showAllNamespaces ? 'all' : selectedNamespace} 
              onChange={handleNamespaceChange} 
              style={{ width: 180 }}
              loading={namespaces.length === 0}
            >
              <Option key="all" value="all">所有命名空间</Option>
              {namespaces.map(ns => (
                <Option key={ns} value={ns}>{ns}</Option>
              ))}
            </Select>
            <Button 
              icon={<ReloadOutlined spin={refreshing} />} 
              onClick={handleRefresh}
              loading={refreshing}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Tabs defaultActiveKey="pods" type="card" onChange={handleTabChange}>
          <TabPane 
            tab={
              <span>
                Pods <Badge count={pods.length} style={{ backgroundColor: '#52c41a' }} />
              </span>
            } 
            key="pods"
          >
            {renderPodList()}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                Deployments <Badge count={deployments.length} style={{ backgroundColor: '#1890ff' }} />
              </span>
            } 
            key="deployments"
          >
            {renderDeploymentList()}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                Services <Badge count={services.length} style={{ backgroundColor: '#722ed1' }} />
              </span>
            } 
            key="services"
          >
            {renderServiceList()}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                StatefulSets <Badge count={statefulSets.length} style={{ backgroundColor: '#eb2f96' }} />
              </span>
            } 
            key="statefulsets"
          >
            {renderStatefulSetList()}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                DaemonSets <Badge count={daemonSets.length} style={{ backgroundColor: '#fa8c16' }} />
              </span>
            } 
            key="daemonsets"
          >
            {renderDaemonSetList()}
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                Jobs <Badge count={jobs.length} style={{ backgroundColor: '#13c2c2' }} />
              </span>
            } 
            key="jobs"
          >
            {renderJobList()}
          </TabPane>
        </Tabs>
      </Card>
      
      {/* 伸缩资源的对话框 */}
      <Modal
        title={`伸缩 ${currentResource?.type} ${currentResource?.name}`}
        visible={scaleModalVisible}
        onOk={handleScale}
        onCancel={() => setScaleModalVisible(false)}
        okText="确定"
        cancelText="取消"
        okButtonProps={{ 
          loading: currentResource && scalingResources[`${currentResource.type}-${currentResource.namespace}-${currentResource.name}`],
          disabled: currentResource && scalingResources[`${currentResource.type}-${currentResource.namespace}-${currentResource.name}`]
        }}
      >
        <Form layout="vertical">
          <Form.Item label="副本数量" required>
            <InputNumber 
              min={0} 
              value={replicasValue} 
              onChange={setReplicasValue}
              style={{ width: '100%' }}
              disabled={currentResource && scalingResources[`${currentResource.type}-${currentResource.namespace}-${currentResource.name}`]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default K8sResourcesPage; 
import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Select, 
  InputNumber, 
  Card, 
  Divider, 
  Row, 
  Col,
  message,
  Tag
} from 'antd';
import apiService from '../services/api';

const { Option } = Select;

const BasicConfig = ({ form, initialValues = {} }) => {
  const [kubeconfigs, setKubeconfigs] = useState([]);
  const [namespaces, setNamespaces] = useState([]);
  const [selectedKubeConfigId, setSelectedKubeConfigId] = useState(null);
  const [selectedNamespace, setSelectedNamespace] = useState(null);
  const [loading, setLoading] = useState(true);
  // 添加新状态变量，跟踪是否已经加载过KubeConfig列表
  const [configsLoaded, setConfigsLoaded] = useState(false);

  // 加载KubeConfig列表（只在组件挂载时执行一次）
  useEffect(() => {
    const loadKubeConfigs = async () => {
      // 如果已经加载过且有数据，直接返回，避免重复加载
      if (configsLoaded && kubeconfigs.length > 0) {
        console.log('KubeConfig列表已加载，跳过重复获取');
        
        // 即使跳过加载，也确保使用初始值（如果有）
        if (initialValues?.kubeConfigId && selectedKubeConfigId !== initialValues.kubeConfigId) {
          console.log('使用初始值的KubeConfigId:', initialValues.kubeConfigId);
          setSelectedKubeConfigId(initialValues.kubeConfigId);
          form.setFieldsValue({ kubeConfigId: initialValues.kubeConfigId });
          
          // 如果初始值变更，重新获取对应的命名空间
          fetchNamespaces(initialValues.kubeConfigId);
        }
        
        return;
      }
      
      try {
        setLoading(true);
        console.log('开始获取KubeConfig列表...');
        const configs = await apiService.getKubeConfigs();
        console.log('获取到KubeConfig列表:', configs);
        
        if (Array.isArray(configs) && configs.length > 0) {
          setKubeconfigs(configs);
          setConfigsLoaded(true);  // 标记为已加载
          
          // 保存集群列表到表单，用于后续根据名称查找ID
          form.setFieldsValue({ kubeconfigs: configs });
          
          let kubeConfigIdToUse;
          
          // 使用优先级：1. 初始值 2. localStorage存储的值 3. 第一个可用配置
          if (initialValues?.kubeConfigId) {
            console.log('使用初始值的KubeConfigId:', initialValues.kubeConfigId);
            kubeConfigIdToUse = initialValues.kubeConfigId;
          } else {
            // 尝试从localStorage获取上次使用的配置
            const savedId = localStorage.getItem('lastSelectedKubeConfigId');
            const isValidSavedId = savedId && configs.some(c => c.id === savedId);
            
            if (isValidSavedId) {
              console.log('使用localStorage保存的KubeConfigId:', savedId);
              kubeConfigIdToUse = savedId;
            } else {
              console.log('使用第一个可用的KubeConfigId:', configs[0].id);
              kubeConfigIdToUse = configs[0].id;
            }
          }
          
          // 设置选中的KubeConfigId
          setSelectedKubeConfigId(kubeConfigIdToUse);
          form.setFieldsValue({ kubeConfigId: kubeConfigIdToUse });
          
          // 将选择的集群ID存入localStorage
          try {
            localStorage.setItem('lastSelectedKubeConfigId', kubeConfigIdToUse);
            console.log('已保存kubeConfigId到本地存储:', kubeConfigIdToUse);
          } catch (e) {
            console.warn('保存kubeConfigId到本地存储失败:', e);
          }
          
          // 获取命名空间
          fetchNamespaces(kubeConfigIdToUse);
        } else {
          console.warn('未获取到有效的KubeConfig列表');
          message.error({
            content: '未找到Kubernetes集群配置，请先添加集群配置',
            duration: 8
          });
          setLoading(false);
        }
      } catch (error) {
        console.error('获取KubeConfig列表失败:', error);
        message.error({
          content: '获取Kubernetes集群列表失败，请检查网络连接',
          duration: 8
        });
        setLoading(false);
      }
    };

    loadKubeConfigs();
    
    // 确保组件卸载时取消所有异步操作
    return () => {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依赖数组，确保只在组件挂载时执行一次

  // 获取命名空间列表（优化版）
  const fetchNamespaces = async (kubeConfigId, retryCount = 0) => {
    if (!kubeConfigId) {
      console.warn('fetchNamespaces: 没有提供kubeConfigId');
      setLoading(false);
      message.warning('未选择Kubernetes集群，无法获取命名空间');
      return;
    }
    
    // 检查如果已经有相同kubeConfigId的命名空间列表且长度大于默认值，不再设置loading
    const alreadyHasData = namespaces.length > 3 && selectedKubeConfigId === kubeConfigId;
    
    if (!alreadyHasData) {
      console.log('获取命名空间列表，kubeConfigId:', kubeConfigId);
      setLoading(true);
    } else {
      console.log('已有命名空间数据，在后台刷新，kubeConfigId:', kubeConfigId);
    }
    
    // 为了避免无限加载，设置一个最大超时时间（随重试次数增加）
    const timeoutMs = Math.min(10000 + (retryCount * 5000), 30000); // 最多30秒
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`获取命名空间列表超时(${timeoutMs/1000}秒)`));
      }, timeoutMs);
    });
    
    try {
      // 使用Promise.race确保请求不会无限等待
      const data = await Promise.race([
        apiService.getKubernetesNamespaces(kubeConfigId),
        timeoutPromise
      ]);
      
      console.log('获取到命名空间列表:', data);
      
      if (Array.isArray(data) && data.length > 0) {
        setNamespaces(data);
        
        // 如果有初始命名空间且在列表中，使用它
        if (initialValues?.namespace && data.includes(initialValues.namespace)) {
          console.log('使用初始命名空间:', initialValues.namespace);
          form.setFieldsValue({ namespace: initialValues.namespace });
          setSelectedNamespace(initialValues.namespace);
        } else {
          // 默认选择default或第一个命名空间
          const defaultNs = data.includes('default') ? 'default' : data[0];
          console.log('使用命名空间:', defaultNs);
          form.setFieldsValue({ namespace: defaultNs });
          setSelectedNamespace(defaultNs);
        }
        
        // 异步更新localStorage中的命名空间列表，用于离线备份
        try {
          localStorage.setItem(`namespaces_${kubeConfigId}`, JSON.stringify(data));
          localStorage.setItem(`namespaces_${kubeConfigId}_timestamp`, Date.now().toString());
        } catch (e) {
          console.warn('保存命名空间到localStorage失败:', e);
        }
      } else {
        handleNamespacesFallback(kubeConfigId, '未获取到有效的命名空间列表');
      }
    } catch (error) {
      console.error('获取命名空间失败:', error);
      
      // 尝试重试（最多3次）
      if (retryCount < 2) {
        console.log(`尝试重新获取命名空间（第${retryCount + 1}次重试）`);
        
        // 递归调用但增加重试计数
        setTimeout(() => {
          fetchNamespaces(kubeConfigId, retryCount + 1);
        }, 2000); // 延迟2秒后重试
        return;
      }
      
      // 所有重试都失败，使用备用数据
      handleNamespacesFallback(kubeConfigId, '获取命名空间失败，使用默认值');
    } finally {
      // 确保loading状态结束（即使使用重试）
      if (!alreadyHasData) {
        setLoading(false);
      }
    }
  };

  // 命名空间获取失败时的备用处理
  const handleNamespacesFallback = (kubeConfigId, warningMessage) => {
    console.warn(warningMessage);
    
    // 尝试从localStorage读取历史数据
    try {
      const cachedData = localStorage.getItem(`namespaces_${kubeConfigId}`);
      const cachedTimestamp = localStorage.getItem(`namespaces_${kubeConfigId}_timestamp`);
      
      // 如果有不超过1天的缓存数据
      if (cachedData && cachedTimestamp && 
          (Date.now() - parseInt(cachedTimestamp)) < 86400000) {
        const parsedData = JSON.parse(cachedData);
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          console.log('使用localStorage缓存的命名空间列表');
          setNamespaces(parsedData);
          form.setFieldsValue({ namespace: parsedData.includes('default') ? 'default' : parsedData[0] });
          setSelectedNamespace(parsedData.includes('default') ? 'default' : parsedData[0]);
          message.warning('使用本地缓存的命名空间列表', 3);
          return;
        }
      }
    } catch (e) {
      console.error('读取本地命名空间缓存失败:', e);
    }
    
    // 无缓存或缓存失效，使用默认值
    const defaultNamespaces = ['default', 'kube-system', 'kube-public'];
    setNamespaces(defaultNamespaces);
    form.setFieldsValue({ namespace: 'default' });
    setSelectedNamespace('default');
    
    message.warning({
      content: warningMessage,
      duration: 5
    });
  };

  // 添加自定义命名空间
  const addCustomNamespace = (name) => {
    if (!name || namespaces.includes(name)) return;
    
    const updatedNamespaces = [...namespaces, name];
    setNamespaces(updatedNamespaces);
    form.setFieldsValue({ namespace: name });
    setSelectedNamespace(name);
  };

  // 处理KubeConfig变更
  const handleKubeConfigChange = async (kubeConfigId) => {
    console.log('KubeConfig选择变更:', kubeConfigId);
    
    if (!kubeConfigId) {
      console.error('无效的kubeConfigId');
      message.error('请选择有效的Kubernetes集群');
      return;
    }
    
    setSelectedKubeConfigId(kubeConfigId);
    
    // 清除选择的命名空间
    setSelectedNamespace(undefined);
    // 更新表单值
    form.setFieldsValue({ kubeConfigId: kubeConfigId, namespace: undefined });
    
    // 将kubeConfigId缓存至本地存储，防止表单重置
    try {
      localStorage.setItem('lastSelectedKubeConfigId', kubeConfigId);
      console.log('已保存kubeConfigId到本地存储:', kubeConfigId);
    } catch (e) {
      console.warn('保存kubeConfigId到本地存储失败:', e);
    }
    
    // 获取命名空间
    fetchNamespaces(kubeConfigId);
    
    // 再次确保表单中的kubeConfigId已正确设置
    setTimeout(() => {
      const formKubeConfigId = form.getFieldValue('kubeConfigId');
      if (formKubeConfigId !== kubeConfigId) {
        console.warn('表单中的kubeConfigId与选择不匹配，重新设置', {预期: kubeConfigId, 实际: formKubeConfigId});
        form.setFieldsValue({ kubeConfigId });
      }
    }, 100);
  };
  
  // 处理命名空间变更
  const handleNamespaceChange = (namespace) => {
    console.log('选择的命名空间:', namespace);
    
    // 确保命名空间被正确设置到表单中
    if (namespace) {
      form.setFieldsValue({ namespace: namespace });
      setSelectedNamespace(namespace);
    }
    
    // 手动触发表单验证，确保值被提交
    setTimeout(() => {
      form.validateFields(['namespace'])
        .then(() => {
          console.log('命名空间验证成功:', namespace);
          
          // 再次确认表单值是否正确设置
          const currentValue = form.getFieldValue('namespace');
          if (currentValue !== namespace) {
            console.warn('命名空间值设置后不匹配，重新设置', {预期: namespace, 实际: currentValue});
            form.setFieldsValue({ namespace: namespace });
          }
        })
        .catch(err => {
          console.error('命名空间验证失败:', err);
        });
    }, 100);
  };

  return (
    <div className="basic-config">
      <Card title="应用基本信息" className="basic-config-card">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            appName: initialValues.appName || '',
            deployMode: initialValues.deployMode || 'fixed',
            instances: initialValues.instances || 1,
            cpu: initialValues.cpu || 0.5,
            memory: initialValues.memory || 256,
            kubeConfigId: initialValues.kubeConfigId,
            namespace: initialValues.namespace,
            ...initialValues
          }}
          requiredMark="optional"
        >
          {/* 隐藏的kubeConfigId字段，确保即使UI组件失效也能保留值 */}
          <Form.Item
            name="hiddenKubeConfigId"
            hidden={true}
            initialValue={initialValues?.kubeConfigId || selectedKubeConfigId}
          >
            <Input type="hidden" />
          </Form.Item>
          
          <Form.Item
            name="appName"
            label="应用名称"
            rules={[{ required: true, message: '请输入应用名称' }]}
          >
            <Input 
              placeholder="请输入应用名称" 
              onChange={(e) => {
                const value = e.target.value;
                form.setFieldsValue({ appName: value });
                console.log('应用名称已更新:', value);
              }}
            />
          </Form.Item>

          <Divider orientation="left">部署配置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="deployMode"
                label="部署模式"
                rules={[{ required: true, message: '请选择部署模式' }]}
              >
                <Select placeholder="请选择部署模式">
                  <Option value="fixed">固定副本数</Option>
                  <Option value="autoscaling">自动伸缩</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="instances"
                label="实例数量"
                rules={[{ required: true, message: '请输入实例数量' }]}
              >
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="cpu"
                label="CPU (核)"
                rules={[{ required: true, message: '请输入CPU核数' }]}
              >
                <InputNumber min={0.1} max={8} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="memory"
                label="内存 (MB)"
                rules={[{ required: true, message: '请输入内存大小' }]}
              >
                <InputNumber min={64} max={8192} step={64} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Kubernetes配置</Divider>

          <Form.Item
            name="kubeConfigId"
            label="Kubernetes集群"
            rules={[{ required: true, message: '请选择Kubernetes集群' }]}
            help="选择要部署应用的Kubernetes集群，必须先添加集群配置才能部署应用"
            initialValue={initialValues?.kubeConfigId || selectedKubeConfigId}
            validateTrigger={['onChange', 'onBlur']}
          >
            <Select 
              placeholder="请选择集群" 
              onChange={(value) => {
                console.log('Kubernetes集群选择变更:', value);
                // 1. 更新组件状态
                setSelectedKubeConfigId(value);
                
                // 2. 存储到localStorage
                if (value) {
                  localStorage.setItem('lastSelectedKubeConfigId', value);
                }
                
                // 3. 确保表单值更新 (同时更新显示和隐藏字段)
                form.setFieldsValue({ 
                  kubeConfigId: value,
                  hiddenKubeConfigId: value 
                });
                
                // 4. 加载命名空间
                if (value) {
                  fetchNamespaces(value);
                }
                
                // 5. 在下一个事件循环中确认值已设置
                setTimeout(() => {
                  const currentValue = form.getFieldValue('kubeConfigId');
                  if (currentValue !== value) {
                    console.warn('表单值未正确更新, 强制更新:', {期望值: value, 当前值: currentValue});
                    form.setFieldsValue({ 
                      kubeConfigId: value,
                      hiddenKubeConfigId: value
                    });
                  }
                }, 0);
              }}
              loading={loading}
              notFoundContent={kubeconfigs.length === 0 ? "没有可用的集群配置，请先添加集群" : "无匹配集群"}
            >
              {kubeconfigs.map(config => (
                <Option key={config.id} value={config.id}>
                  {config.name} ({config.currentContext})
                  {selectedKubeConfigId === config.id && loading && !namespaces.length && (
                    <Tag color="processing" style={{ marginLeft: 8 }}>
                      连接中...
                    </Tag>
                  )}
                  {selectedKubeConfigId === config.id && namespaces.length > 0 && (
                    <Tag color="success" style={{ marginLeft: 8 }}>
                      已连接
                    </Tag>
                  )}
                  {selectedKubeConfigId === config.id && !loading && namespaces.length === 0 && (
                    <Tag color="error" style={{ marginLeft: 8 }}>
                      连接失败
                    </Tag>
                  )}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="namespace"
            label="命名空间"
            rules={[{ required: true, message: '请选择命名空间' }]}
            help="选择部署应用的命名空间，如果没有显示命名空间，请检查集群配置是否正确"
          >
            <Select 
              placeholder={loading ? "命名空间加载中..." : "请选择命名空间"} 
              disabled={!selectedKubeConfigId || loading}
              loading={loading}
              onChange={handleNamespaceChange}
              showSearch
              allowClear
              optionFilterProp="children"
              notFoundContent={loading ? "加载中..." : "无可用命名空间"}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="输入自定义命名空间"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target.value) {
                          e.preventDefault();
                          addCustomNamespace(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value) {
                          addCustomNamespace(e.target.value);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </>
              )}
            >
              {namespaces.map(ns => (
                <Option key={ns} value={ns}>{ns}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default BasicConfig; 
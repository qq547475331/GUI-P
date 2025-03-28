import React, { useState, useEffect } from 'react';
import { Form, Select, Spin, message, Button } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import apiService from '../services/api';

const { Option } = Select;

const KubeConfigSelector = ({ formData, setFormData, form }) => {
  const [configs, setConfigs] = useState([]);
  const [namespaces, setNamespaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [namespaceLoading, setNamespaceLoading] = useState(false);

  // 获取所有KubeConfig
  useEffect(() => {
    const fetchKubeConfigs = async () => {
      try {
        setLoading(true);
        const data = await apiService.getKubeConfigs();
        setConfigs(data);
      } catch (error) {
        console.error('获取KubeConfig列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchKubeConfigs();
  }, []);

  // 当KubeConfig ID改变时，获取命名空间列表
  const fetchNamespaces = async (kubeConfigId) => {
    if (!kubeConfigId) {
      setNamespaces([]);
      return;
    }

    try {
      setNamespaceLoading(true);
      const data = await apiService.getKubernetesNamespaces(kubeConfigId);
      setNamespaces(data);
      
      // 自动选择默认命名空间
      if (data.includes('default')) {
        form.setFieldsValue({ namespace: 'default' });
        setFormData({
          ...formData,
          namespace: 'default'
        });
      }
    } catch (error) {
      console.error('获取命名空间列表失败:', error);
      message.error('获取命名空间失败，请检查集群连接');
    } finally {
      setNamespaceLoading(false);
    }
  };

  // 处理KubeConfig选择变更
  const handleKubeConfigChange = (value) => {
    setFormData({
      ...formData,
      kubeConfigID: value,
      namespace: '' // 重置命名空间
    });
    
    form.setFieldsValue({ namespace: '' });
    fetchNamespaces(value);
  };

  // 处理命名空间选择变更
  const handleNamespaceChange = (value) => {
    setFormData({
      ...formData,
      namespace: value
    });
  };

  // 前往KubeConfig管理页面
  const goToKubeConfigManager = () => {
    // 在实际应用中，应该使用路由导航
    // history.push('/kubeconfig');
    window.location.href = '/kubeconfig';
  };

  return (
    <div className="kubeconfig-selector">
      <Form.Item
        label="Kubernetes配置"
        name="kubeConfigID"
        extra="选择用于部署应用的Kubernetes集群配置"
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Select
            placeholder="选择KubeConfig"
            onChange={handleKubeConfigChange}
            style={{ flex: 1 }}
            loading={loading}
            allowClear
          >
            {configs.map(config => (
              <Option key={config.id} value={config.id}>
                {config.name} ({config.currentContext})
              </Option>
            ))}
          </Select>
          <Button 
            type="link" 
            icon={<LinkOutlined />} 
            onClick={goToKubeConfigManager}
            style={{ marginLeft: 8 }}
          >
            管理配置
          </Button>
        </div>
      </Form.Item>

      {formData.kubeConfigID && (
        <Form.Item
          label="命名空间"
          name="namespace"
          rules={[{ required: !!formData.kubeConfigID, message: '请选择命名空间' }]}
        >
          {namespaceLoading ? (
            <Spin size="small" />
          ) : (
            <Select
              placeholder="选择命名空间"
              onChange={handleNamespaceChange}
              allowClear
            >
              {namespaces.map(ns => (
                <Option key={ns} value={ns}>
                  {ns}
                </Option>
              ))}
            </Select>
          )}
        </Form.Item>
      )}
    </div>
  );
};

export default KubeConfigSelector; 
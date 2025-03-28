import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, InputNumber, Select, Alert } from 'antd';
import KubeConfigSelector from './KubeConfigSelector';
const { Option } = Select;

interface CreateAppProps {
  onSuccess?: () => void;
}

const CreateApp: React.FC<CreateAppProps> = ({ onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [kubeConfigId, setKubeConfigId] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // 监控集群和命名空间选择状态，清除相关错误提示
  useEffect(() => {
    if (submitAttempted && kubeConfigId) {
      setFormError('');
    }
  }, [kubeConfigId, submitAttempted]);

  useEffect(() => {
    if (submitAttempted && namespace) {
      setFormError('');
    }
  }, [namespace, submitAttempted]);

  const handleSubmit = async (values: any) => {
    setSubmitAttempted(true);

    // 表单验证
    if (!kubeConfigId) {
      setFormError('请选择Kubernetes集群');
      message.error('请选择Kubernetes集群');
      return;
    }

    if (!namespace) {
      setFormError('请选择命名空间');
      message.error('请选择命名空间');
      return;
    }

    setLoading(true);
    setFormError('');
    
    try {
      const appData = {
        ...values,
        kubeConfigId,
        namespace,
        status: 'created',
        replicas: values.replicas || 1,
        port: values.port || 8080,
        serviceType: values.serviceType || 'ClusterIP'
      };

      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP错误! 状态码: ${response.status}`);
      }

      message.success('应用创建成功');
      form.resetFields();
      
      // 重置状态
      setKubeConfigId('');
      setNamespace('');
      setSubmitAttempted(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to create application:', error);
      const errorMessage = error instanceof Error ? error.message : '创建应用失败';
      setFormError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleKubeConfigChange = (configId: string) => {
    setKubeConfigId(configId);
  };

  const handleNamespaceChange = (ns: string) => {
    setNamespace(ns);
  };

  return (
    <div className="create-app">
      <h2>创建新应用</h2>
      
      {formError && (
        <Alert
          message="表单错误"
          description={formError}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          closable
        />
      )}
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          replicas: 1,
          port: 8080,
          serviceType: 'ClusterIP'
        }}
      >
        <KubeConfigSelector
          onKubeConfigChange={handleKubeConfigChange}
          onNamespaceChange={handleNamespaceChange}
        />

        <Form.Item
          label="应用名称"
          name="name"
          rules={[{ required: true, message: '请输入应用名称' }]}
        >
          <Input placeholder="输入应用名称" />
        </Form.Item>

        <Form.Item
          label="镜像地址"
          name="imageUrl"
          rules={[{ required: true, message: '请输入镜像地址' }]}
        >
          <Input placeholder="例如: nginx:latest" />
        </Form.Item>

        <Form.Item label="描述" name="description">
          <Input.TextArea placeholder="应用描述..." />
        </Form.Item>

        <Form.Item label="副本数" name="replicas">
          <InputNumber min={1} max={10} />
        </Form.Item>

        <Form.Item label="端口" name="port">
          <InputNumber min={1} max={65535} />
        </Form.Item>

        <Form.Item label="服务类型" name="serviceType">
          <Select>
            <Option value="ClusterIP">ClusterIP</Option>
            <Option value="NodePort">NodePort</Option>
            <Option value="LoadBalancer">LoadBalancer</Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            创建应用
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CreateApp; 
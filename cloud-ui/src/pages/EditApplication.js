import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Steps, message, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import BasicConfig from '../components/BasicConfig';
import ContainerConfig from '../components/ContainerConfig';
import ResourceSummary from '../components/ResourceSummary';
import apiService from '../services/api';
import './EditApplication.css';

const { Step } = Steps;

const EditApplication = () => {
  const [current, setCurrent] = useState(0);
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();

  const fetchApplication = async () => {
    try {
      setInitialLoading(true);
      const data = await apiService.getApplicationById(id);
      if (!data.volumes) {
        data.volumes = [];
      }
      if (!data.envVars) {
        data.envVars = [];
      }
      setFormData(data);
      form.setFieldsValue({
        appName: data.appName,
        imageName: data.imageName,
        containerName: data.containerName,
        containerPort: data.containerPort,
        instances: data.instances,
        cpu: data.cpu,
        memory: data.memory,
        kubeConfigId: data.kubeConfigId,
        namespace: data.namespace,
        registryId: data.registryId,
        type: data.type,
        // 其他必要字段
      });
    } catch (error) {
      message.error('获取应用详情失败');
      navigate('/');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchApplication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 定义步骤内容
  const steps = [
    {
      title: '基本配置',
      content: formData && <BasicConfig form={form} initialValues={formData} />,
    },
    {
      title: '容器设置',
      content: formData && <ContainerConfig form={form} initialValues={formData} />,
    },
    {
      title: '确认信息',
      content: formData && (
        <ResourceSummary 
          formData={current === 2 ? {...formData, ...form.getFieldsValue()} : formData} 
        />
      ),
    },
  ];

  const next = async () => {
    try {
      await form.validateFields();
      setCurrent(current + 1);
    } catch (err) {
      message.error('请完成必填项');
    }
  };

  const prev = () => {
    setCurrent(current - 1);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // 整合所有步骤的数据
      const values = form.getFieldsValue(true);
      console.log('表单当前值:', values);
      
      // 确保kubeConfigId存在
      if (!values.kubeConfigId) {
        console.error('编辑保存时缺少kubeConfigId，尝试从initialValues获取');
        if (formData.kubeConfigId) {
          values.kubeConfigId = formData.kubeConfigId;
          console.log('从initialValues获取到kubeConfigId:', values.kubeConfigId);
        } else {
          message.error('更新应用失败：未选择Kubernetes集群');
          setLoading(false);
          return;
        }
      }
      
      // 检查命名空间是否存在
      if (!values.namespace) {
        console.error('缺少namespace字段，尝试从多种来源获取');
        
        // 尝试从表单对象中获取
        const formNamespace = form.getFieldValue('namespace');
        if (formNamespace) {
          console.log('从form对象获取到namespace:', formNamespace);
          values.namespace = formNamespace;
        } else if (formData?.namespace) {
          values.namespace = formData.namespace;
          console.log('从初始数据获取namespace:', values.namespace);
        } else {
          // 检查表单元素中是否有值
          const namespaceSelect = document.querySelector('select[name="namespace"]');
          if (namespaceSelect && namespaceSelect.value) {
            values.namespace = namespaceSelect.value;
            console.log('从DOM元素获取到namespace:', values.namespace);
          } else {
            // 尝试从下拉框选项中获取选中值
            const selectedOption = document.querySelector('.ant-select-selection-item[title]');
            if (selectedOption && selectedOption.getAttribute('title')) {
              values.namespace = selectedOption.getAttribute('title');
              console.log('从选中项获取到namespace:', values.namespace);
            } else {
              // 使用默认命名空间
              values.namespace = 'default';
              console.log('使用默认namespace:', values.namespace);
            }
          }
        }
        
        // 如果还是没有命名空间，显示错误
        if (!values.namespace) {
          message.error('更新应用失败: 未选择命名空间');
          setLoading(false);
          return;
        }
      }
      
      // 处理数值类型字段
      const submitData = {
        ...values,
        instances: parseInt(values.instances || formData.instances || 1, 10),
        cpu: parseFloat(values.cpu || formData.cpu || 0.5),
        memory: parseInt(values.memory || formData.memory || 256, 10),
        containerPort: values.containerPort ? String(values.containerPort) : ""
      };
      
      console.log('提交更新数据:', submitData);
      
      await apiService.updateApplication(id, submitData);
      message.success('应用更新成功');
      
      // 部署更新的应用
      try {
        // 先验证kubeconfig是否存在
        console.log('部署前验证kubeconfig是否存在...');
        try {
          await apiService.verifyKubeConfig(submitData.kubeConfigId);
          console.log('kubeconfig验证成功，可以部署');
        } catch (verifyError) {
          console.error('kubeconfig验证失败:', verifyError);
          message.warning('应用更新成功，但kubeconfig验证失败，可能无法部署应用');
          // 不进行部署，直接返回
          navigate('/');
          return;
        }
        
        // 如果验证通过，开始部署
        message.loading({ content: '正在重新部署应用...', key: 'redeployApp' });
        await apiService.deployApplication(id);
        message.success({ content: '应用已成功更新并重新部署!', key: 'redeployApp' });
      } catch (deployError) {
        console.error('重新部署应用失败:', deployError);
        message.error({ content: '应用更新成功，但重新部署失败! 错误: ' + (deployError.message || '未知错误'), key: 'redeployApp' });
      }
      
      navigate('/');
    } catch (error) {
      console.error('更新应用失败:', error);
      message.error('更新失败: ' + (error.response?.data?.error || error.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="edit-application">
      <Card title="编辑应用">
        <Steps current={current} className="steps">
          {steps.map(item => (
            <Step key={item.title} title={item.title} />
          ))}
        </Steps>
        <div className="steps-content">
          {steps[current].content}
        </div>
        <div className="steps-action">
          {current > 0 && (
            <Button style={{ margin: '0 8px' }} onClick={() => prev()}>
              上一步
            </Button>
          )}
          {current < steps.length - 1 && (
            <Button type="primary" onClick={() => next()}>
              下一步
            </Button>
          )}
          {current === steps.length - 1 && (
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              更新
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default EditApplication; 
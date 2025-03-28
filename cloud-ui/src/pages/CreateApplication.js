import React, { useState } from 'react';
import { 
  Form, 
  Button, 
  message, 
  Steps, 
  Card, 
  Row, 
  Col, 
  Space 
} from 'antd';
import { useNavigate } from 'react-router-dom';
import BasicConfig from '../components/BasicConfig';
import ContainerConfig from '../components/ContainerConfig';
import ResourceSummary from '../components/ResourceSummary';
import apiService from '../services/api';
import './CreateApplication.css';

const { Step } = Steps;

const CreateApplication = () => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState({ 
    volumes: [], 
    envVars: [], 
    appName: '', 
    imageName: '', 
    containerPort: '', 
    instances: '', 
    cpu: '', 
    memory: '', 
    kubeConfigId: '', 
    namespace: '', 
    kubeconfigs: [] 
  });
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // 步骤内容
  const steps = [
    {
      title: '基本信息',
      content: <BasicConfig form={form} />,
    },
    {
      title: '容器设置',
      content: <ContainerConfig form={form} />,
    },
    {
      title: '确认信息',
      content: <ResourceSummary formData={currentStep === 2 ? formValues : form.getFieldsValue(true)} />,
    },
  ];

  // 处理下一步
  const handleNext = async () => {
    try {
      // 验证表单
      const values = await form.validateFields();
      
      // 确保获取了所有需要的值
      console.log("当前步骤表单值:", values);
      
      // 确保关键字段在向下一步移动时已填写
      if (currentStep === 0) {
        // 基本信息步骤
        if (!values.appName) {
          message.error('请填写应用名称');
          return;
        }
        if (!values.kubeConfigId) {
          message.error('请选择Kubernetes集群');
          // 聚焦Kubernetes集群选择框
          const kubeConfigEl = document.querySelector('select[name="kubeConfigId"]');
          if (kubeConfigEl) {
            kubeConfigEl.focus();
          }
          return;
        }
        if (!values.namespace) {
          message.error('请选择命名空间');
          // 聚焦命名空间选择框
          const namespaceEl = document.querySelector('.ant-select-selector input[id="namespace"]');
          if (namespaceEl) {
            namespaceEl.focus();
          }
          return;
        }
      } else if (currentStep === 1) {
        // 容器设置步骤
        if (!values.imageName) {
          message.error('请填写镜像地址');
          return;
        }
        if (!values.containerName) {
          message.error('请填写容器名称');
          return;
        }
      }
      
      // 更新表单值，确保所有字段都被保存
      const currentValues = form.getFieldsValue(true); // 获取所有字段
      const updatedFormValues = {
        ...formValues,
        ...currentValues,
      };
      
      console.log("更新后的表单值:", updatedFormValues);
      setFormValues(updatedFormValues);
      
      // 如果是最后一步之前，先保存表单，再进入下一步
      if (currentStep < steps.length - 1) {
        form.setFieldsValue(updatedFormValues);
      }
      
      // 转到下一步
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error("表单验证错误:", error);
      message.error('请完成所有必填字段');
    }
  };

  // 处理上一步
  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // 获取当前表单值
      const values = form.getFieldsValue(true);
      console.log('表单值:', values);
      
      // 获取kubeConfigId
      let kubeConfigId = values.kubeConfigId;
      
      // 如果没有获取到kubeConfigId，尝试从其他地方获取
      if (!kubeConfigId) {
        kubeConfigId = localStorage.getItem('lastSelectedKubeConfigId');
        console.log('从localStorage获取到kubeConfigId:', kubeConfigId);
      }
      
      if (!kubeConfigId) {
        message.error('创建应用失败: 无法获取Kubernetes集群ID');
        setSubmitting(false);
        return;
      }
      
      // 构建提交数据
      const submitData = {
        appName: values.appName,
        namespace: values.namespace || 'default',
        kubeConfigId: kubeConfigId,
        description: values.description || '',
        imageName: values.imageName || 'nginx:latest', 
        containerPort: values.containerPort || 80,
        instances: values.instances || 1,
        cpu: values.cpu || 0.5,
        memory: values.memory || 512,
        serviceType: values.serviceType || 'ClusterIP'
      };
      
      console.log('最终提交的应用数据:', submitData);
      
      // 调用API创建应用
      const response = await apiService.createApplication(submitData);
      console.log('创建应用响应:', response);
      
      message.success('应用创建成功!');
      setSubmitting(false);
      navigate('/');
      
    } catch (error) {
      console.error('创建应用失败:', error);
      if (error.response?.data?.error) {
        message.error('创建应用失败: ' + error.response.data.error);
      } else if (error.response?.data?.message) {
        message.error('创建应用失败: ' + error.response.data.message);
      } else {
        message.error('创建应用失败: ' + (error.message || '未知错误'));
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="create-application">
      <Card>
        <Steps current={currentStep} style={{ marginBottom: 30 }}>
          {steps.map(item => (
            <Step key={item.title} title={item.title} />
          ))}
        </Steps>
        
        <div className="steps-content">
          {steps[currentStep].content}
        </div>
        
        <div className="steps-action" style={{ marginTop: 24 }}>
          <Row justify="end">
            <Col>
              <Space>
                {currentStep > 0 && (
                  <Button onClick={handlePrev}>
                    上一步
                  </Button>
                )}
                
                {currentStep < steps.length - 1 && (
                  <Button type="primary" onClick={handleNext}>
                    下一步
                  </Button>
                )}
                
                {currentStep === steps.length - 1 && (
                  <Button 
                    type="primary" 
                    onClick={handleSubmit}
                    loading={submitting}
                  >
                    创建应用
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  );
};

export default CreateApplication; 
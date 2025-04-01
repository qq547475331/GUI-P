import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Button, 
  message as antMessage, 
  Steps, 
  Card, 
  Row, 
  Col, 
  Space,
  Alert 
} from 'antd';
import { useNavigate } from 'react-router-dom';
import BasicConfig from '../components/BasicConfig';
import ContainerConfig from '../components/ContainerConfig';
import AdvancedConfig from '../components/AdvancedConfig';
import AdvancedDeployConfig from '../components/AdvancedDeployConfig';
import ResourceSummary from '../components/ResourceSummary';
import apiService from '../services/api';
import eventBus, { EVENT_TYPES } from '../services/eventBus';
import './CreateApplication.css';
import { CheckCircleFilled } from '@ant-design/icons';
import customMessage from '../services/message'; // 导入自定义消息服务

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
    kubeconfigs: [],
    syncHostTimezone: true,
    updateStrategy: 'RollingUpdate',
    rollingUpdate: {
      maxUnavailable: '25%',
      maxSurge: '25%'
    },
    labels: [],
    annotations: []
  });
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState(''); // 添加全局错误状态
  const navigate = useNavigate();

  // 检查表单状态并清除全局错误
  useEffect(() => {
    // 当步骤为1（容器设置）且有镜像地址时，清除全局错误
    if (currentStep === 1) {
      const currentValues = form.getFieldsValue();
      const imageValue = currentValues.imageName || currentValues.image || currentValues.imageURL;
      if (imageValue && imageValue.trim() !== '') {
        // 镜像地址有值，清除全局错误
        setGlobalError('');
      }
    } else {
      // 不在容器设置步骤时，清除全局错误
      setGlobalError('');
    }
  }, [form, currentStep]);

  // 步骤内容
  const steps = [
    {
      title: '基本信息',
      content: <BasicConfig form={form} />,
    },
    {
      title: '容器设置',
      content: (
        <div>
          <div className="container-settings-section">
            <ContainerConfig form={form} initialValues={formValues} />
          </div>
          <div className="section-divider"></div>
          <div className="advanced-deploy-section">
            <AdvancedDeployConfig form={form} />
          </div>
        </div>
      ),
    },
    {
      title: '确认信息',
      content: <ResourceSummary formData={currentStep === 2 ? formValues : form.getFieldsValue(true)} />,
    },
  ];

  // 在页面加载时主动清除所有错误提示
  useEffect(() => {
    // 清除所有全局错误提示
    const clearAllErrors = () => {
      // 移除所有错误提示
      const errorAlerts = document.querySelectorAll('.ant-alert-error');
      errorAlerts.forEach(alert => {
        const closeButton = alert.querySelector('.ant-alert-close-icon');
        if (closeButton) closeButton.click();
        else if (alert.parentNode) {
          try {
            alert.parentNode.removeChild(alert);
          } catch (e) {
            console.error('移除错误提示失败:', e);
          }
        }
      });
      
      // 清除全局错误状态
      setGlobalError('');
    };
    
    // 页面加载时立即清除
    clearAllErrors();
    
    // 每次重新渲染时也检查是否需要清除
    if (currentStep === 1) {
      const values = form.getFieldsValue();
      const imageValue = values.imageName || values.image || values.imageURL;
      if (imageValue && imageValue.trim() !== '') {
        clearAllErrors();
      }
    }
    
    // 添加全局错误清除的DOM事件监听器
    const handleInput = (event) => {
      if (event.target.tagName === 'INPUT' && 
          (event.target.id.includes('imageName') || 
           event.target.id.includes('image'))) {
        if (event.target.value && event.target.value.trim() !== '') {
          clearAllErrors();
        }
      }
    };
    
    // 添加全局事件监听器
    document.addEventListener('input', handleInput);
    
    return () => {
      document.removeEventListener('input', handleInput);
    };
  }, [form, currentStep]);

  // 表单提交处理
  const handleNext = () => {
    // 移除所有错误提示
    const removeAllErrors = () => {
      try {
        // 移除所有错误提示框
        const errorAlerts = document.querySelectorAll('.ant-alert-error');
        errorAlerts.forEach(alert => {
          if (alert.parentNode) {
            const closeBtn = alert.querySelector('.ant-alert-close-icon');
            if (closeBtn) {
              closeBtn.click();
            } else {
              alert.parentNode.removeChild(alert);
            }
          }
        });
        
        // 移除表单项目错误
        const errorTips = document.querySelectorAll('.ant-form-item-explain-error');
        errorTips.forEach(tip => {
          if (tip.parentNode) {
            tip.parentNode.removeChild(tip);
          }
        });
      } catch (e) {
        console.error('移除错误提示时出错:', e);
      }
    };
    
    // 先清除所有错误提示
    removeAllErrors();
    
    // 获取表单数据
    const formData = form.getFieldsValue(true);
    console.log('表单数据:', formData);
    
    // 预先处理表单数据
    if (currentStep === 0) {
      // 检查第一步必填字段
      const { appName, kubeConfigId, namespace } = formData;
      
      if (!appName || !appName.trim()) {
        antMessage.error('请填写应用名称');
        return;
      }
      
      if (!kubeConfigId) {
        antMessage.error('请选择集群');
        return;
      }
      
      if (!namespace) {
        antMessage.error('请选择命名空间');
        return;
      }
    } else if (currentStep === 1) {
      // 在第二步检查镜像地址和容器名
      // 检查表单多个可能位置的镜像地址
      const imageValue = 
        formData.imageName || 
        formData.image || 
        formData.imageURL || 
        (formData.configs && (formData.configs.imageName || formData.configs.image || formData.configs.imageURL));
      
      console.log('检测到的镜像地址:', imageValue);
      
      if (!imageValue || !imageValue.trim()) {
        antMessage.error('请填写镜像地址');
        
        // 尝试聚焦到镜像输入框
        try {
          const imageInput = document.querySelector('#image-input-field');
          if (imageInput) {
            imageInput.focus();
            imageInput.style.borderColor = '#ff4d4f';
          }
        } catch (e) {}
        
        return;
      }
      
      // 检查容器名
      const containerName = formData.configs && formData.configs.containerName;
      if (!containerName || !containerName.trim()) {
        antMessage.error('请填写容器名称');
        return;
      }
      
      // 如果验证通过，确保镜像地址已经正确设置到表单
      form.setFieldsValue({
        imageName: imageValue,
        image: imageValue,
        imageURL: imageValue,
        configs: {
          ...(formData.configs || {}),
          imageName: imageValue,
          image: imageValue,
          imageURL: imageValue
        }
      });
    }
    
    // 保存当前表单值并前进到下一步
    const currentValues = form.getFieldsValue(true);
    setFormValues(prev => ({
      ...prev,
      ...currentValues
    }));
    
    // 进入下一步
    setCurrentStep(currentStep + 1);
  };

  // 处理上一步
  const handlePrev = () => {
    // 保存当前表单值到状态
    const currentValues = form.getFieldsValue(true);
    setFormValues(prev => ({
      ...prev,
      ...currentValues
    }));
    
    // 返回上一步
    setCurrentStep(currentStep - 1);
  };

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      // 先清除所有错误提示
      setGlobalError('');
      
      // 验证表单
      await form.validateFields()
        .catch(errorInfo => {
          console.error('表单验证失败:', errorInfo);
          const errorFields = errorInfo.errorFields || [];
          
          if (errorFields.length > 0) {
            // 如果有错误字段，显示第一个错误
            const firstError = errorFields[0];
            const errorMsg = firstError.errors[0] || '表单填写有误，请检查';
            setGlobalError(errorMsg);
            throw new Error(errorMsg);
          } else {
            setGlobalError('表单验证失败，请检查输入');
            throw new Error('表单验证失败');
          }
        });
      
      setSubmitting(true);
      
      // 获取表单数据
      const values = form.getFieldsValue(true);
      console.log('准备提交的表单数据:', values);
      
      // 确保镜像地址正确设置
      const imageValue = 
        values.imageName || 
        values.image || 
        values.imageURL || 
        (values.configs && (values.configs.imageName || values.configs.image || values.configs.imageURL));
      
      if (!imageValue || imageValue.trim() === '') {
        setGlobalError('镜像地址不能为空');
        antMessage.error('镜像地址不能为空');
        setCurrentStep(1); // 返回到镜像配置步骤
        setSubmitting(false);
        return;
      }
      
      // 确保容器名称正确设置
      const containerName = values.configs && values.configs.containerName;
      if (!containerName || containerName.trim() === '') {
        setGlobalError('容器名称不能为空');
        antMessage.error('容器名称不能为空');
        setCurrentStep(1); // 返回到容器配置步骤
        setSubmitting(false);
        return;
      }
      
      // 移除表单中的错误状态
      form.setFields([
        { name: ['configs', 'containerName'], value: containerName, errors: [] },
        { name: 'imageName', value: imageValue, errors: [] },
        { name: 'image', value: imageValue, errors: [] },
        { name: 'imageURL', value: imageValue, errors: [] },
        { name: ['configs', 'imageName'], value: imageValue, errors: [] },
        { name: ['configs', 'image'], value: imageValue, errors: [] },
        { name: ['configs', 'imageURL'], value: imageValue, errors: [] }
      ]);
      
      // 构建提交数据，确保所有必要字段都正确传递
      const submitData = {
        ...values,
        imageName: imageValue,
        image: imageValue,
        imageURL: imageValue,
        configs: {
          ...(values.configs || {}),
          imageName: imageValue,
          image: imageValue,
          imageURL: imageValue,
          containerName: containerName
        }
      };
      
      try {
        // 调用API创建应用
        const response = await apiService.createApplication(submitData);
        console.log('创建应用响应:', response);
        
        // 先清除所有可能存在的消息
        antMessage.destroy();
        
        // 显示无边框的成功消息
        customMessage.appCreateSuccess('应用创建成功', 2);
        
        // 触发事件总线通知
        eventBus.emit(EVENT_TYPES.APPLICATION_CREATED);
        
        // 使用延时确保消息显示后再跳转
        setTimeout(() => {
          // 跳转到应用列表页
          window.location.href = '/'; 
        }, 1000);
      } catch (apiError) {
        console.error('API调用失败:', apiError);
        setGlobalError('创建应用失败: ' + (apiError.message || '未知错误'));
        antMessage.error('创建应用失败: ' + (apiError.message || '未知错误'));
        setSubmitting(false);
      }
    } catch (error) {
      console.error('提交表单出错:', error);
      const errorMsg = error.message || '创建应用失败，请稍后重试';
      setGlobalError(errorMsg);
      antMessage.error(`创建失败: ${errorMsg}`);
      setSubmitting(false);
    }
  };

  // 确保镜像地址表单字段在步骤切换时保持一致
  useEffect(() => {
    // 检查当前表单是否有镜像地址值
    if (currentStep === 1) {
      const currentValues = form.getFieldsValue(true);
      const imageValue = currentValues.imageName || 
                         currentValues.image || 
                         currentValues.imageURL || 
                         formValues.imageName || 
                         formValues.image || 
                         formValues.imageURL || '';
      
      if (imageValue && imageValue.trim() !== '') {
        // 同步更新所有镜像相关字段
        form.setFieldsValue({
          imageName: imageValue,
          image: imageValue,
          imageURL: imageValue
        });
        
        // 如果有值，清除全局错误
        setGlobalError('');
        
        // 手动触发验证以确保错误状态被清除
        form.validateFields(['imageName']).catch(() => {
          // 如果验证失败但有值，也强制清除错误
          if (imageValue.trim() !== '') {
            setGlobalError('');
          }
        });
      }
    }
  }, [currentStep, form, formValues]);
  
  // 添加一个自动清除全局错误的效果
  useEffect(() => {
    // 添加一个事件监听器，在用户输入时自动清除错误
    const handleInput = () => {
      if (currentStep === 1 && globalError) {
        const values = form.getFieldsValue();
        const imageValue = values.imageName || values.image || values.imageURL;
        if (imageValue && imageValue.trim() !== '') {
          setGlobalError('');
        }
      }
    };
    
    // 监听表单输入事件
    const imageInputs = document.querySelectorAll('.image-input-wrapper input');
    imageInputs.forEach(input => {
      input.addEventListener('input', handleInput);
    });
    
    return () => {
      // 清理事件监听器
      imageInputs.forEach(input => {
        input.removeEventListener('input', handleInput);
      });
    };
  }, [currentStep, globalError, form]);
  
  // 在页面加载后检查一次镜像地址，如果已有值则清除错误
  useEffect(() => {
    if (currentStep === 1) {
      setTimeout(() => {
        const values = form.getFieldsValue();
        const imageValue = values.imageName || values.image || values.imageURL;
        if (imageValue && imageValue.trim() !== '') {
          setGlobalError('');
          console.log('页面加载后检测到镜像地址已存在，已清除错误提示');
        }
      }, 500); // 给表单足够的时间初始化
    }
  }, [currentStep, form]);

  return (
    <div className="create-application">
      <Card>
        <Steps current={currentStep} style={{ marginBottom: 30 }}>
          {steps.map(item => (
            <Step key={item.title} title={item.title} />
          ))}
        </Steps>
        
        {globalError && (
          <Alert
            message="表单错误"
            description={globalError}
            type="error"
            showIcon
            closable
            onClose={() => setGlobalError('')}
            style={{ marginBottom: 16 }}
          />
        )}
        
        <div className="steps-content">
          {steps[currentStep].content}
        </div>
        
        <div className="steps-action" style={{ marginTop: 24 }}>
          <Row justify="end">
            <Col>
              <Space>
                {currentStep > 0 && (
                  <Button onClick={handlePrev} disabled={submitting}>
                    上一步
                  </Button>
                )}
                
                {currentStep < steps.length - 1 && (
                  <Button type="primary" onClick={handleNext} disabled={submitting}>
                    下一步
                  </Button>
                )}
                
                {currentStep === steps.length - 1 && (
                  <Button 
                    type="primary" 
                    onClick={handleSubmit} 
                    loading={submitting}
                    disabled={submitting}
                  >
                    提交
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
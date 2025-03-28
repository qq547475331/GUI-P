import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Steps,
  message,
  Space,
  Divider,
  Row,
  Col
} from 'antd';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import './PrivateRegistryPage.css';

const { Option } = Select;
const { Step } = Steps;
const { Password } = Input;

const PrivateRegistryPage = () => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [formValues, setFormValues] = useState({});
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // 步骤内容
  const steps = [
    {
      title: '基本信息',
      content: (
        <div className="step-content">
          <div className="step-subtitle">类型</div>
          <Form.Item
            name="type"
            rules={[{ required: true, message: '请选择一个保密字典类型' }]}
          >
            <Select placeholder="镜像服务信息">
              <Option value="docker">Docker Hub</Option>
              <Option value="harbor">Harbor</Option>
            </Select>
          </Form.Item>
          
          <div className="step-subtitle">选择一个保密字典类型</div>
          
          <div className="step-subtitle">镜像服务地址 <span className="required">*</span></div>
          <Form.Item
            label="地址"
            name="url"
            rules={[
              {
                required: true,
                message: '请输入镜像服务地址',
              },
            ]}
            extra="支持带前缀(http://或https://)或不带前缀的地址，如: harbor.example.com 或 https://registry.example.com"
          >
            <Input 
              placeholder="请输入镜像服务地址，如: harbor.example.com" 
            />
          </Form.Item>
        </div>
      ),
    },
    {
      title: '凭据设置',
      content: (
        <div className="step-content">
          <div className="step-subtitle">用户名 <span className="required">*</span></div>
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="用户名" />
          </Form.Item>
          
          <div className="step-subtitle">密码 <span className="required">*</span></div>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Password placeholder="密码" />
          </Form.Item>
          
          <div className="step-subtitle">仓库名称 <span className="required">*</span></div>
          <Form.Item
            name="name"
            rules={[{ required: true, message: '请输入仓库名称' }]}
          >
            <Input placeholder="仓库名称" />
          </Form.Item>

          <div className="registry-message">
            创建镜像服务信息字典前，请先验证用户名和密码。
          </div>
        </div>
      ),
    }
  ];

  // 处理测试连接
  const handleTestConnection = async () => {
    try {
      // 首先验证所有必填字段
      await form.validateFields(['type', 'url', 'username', 'password']);
      const values = form.getFieldsValue();
      
      if (!values || !values.url || typeof values.url !== 'string') {
        message.error('请输入有效的URL地址');
        return;
      }
      
      setTesting(true);
      console.log('测试连接，原始数据:', values);
      
      // 创建一个请求数据的副本
      const requestData = {
        type: values.type || '',
        url: values.url || '',
        username: values.username || '',
        password: values.password || ''
      };
      
      console.log('测试连接，处理后的数据:', requestData);
      
      // 调用API进行测试
      await apiService.testImageRegistry(requestData);
      message.success('连接测试成功！');
    } catch (error) {
      console.error('测试连接失败:', error);
      if (error.response && error.response.data && error.response.data.error) {
        message.error(`连接测试失败: ${error.response.data.error}`);
      } else if (error.message) {
        message.error(`验证失败: ${error.message}`);
      } else {
        message.error('连接测试失败');
      }
    } finally {
      setTesting(false);
    }
  };

  // 处理下一步
  const handleNext = async () => {
    try {
      // 根据当前步骤验证表单字段
      if (currentStep === 0) {
        await form.validateFields(['type', 'url']);
      }
      
      const values = form.getFieldsValue();
      setFormValues({
        ...formValues,
        ...values
      });
      
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 处理上一步
  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  // 处理保存
  const handleSave = async () => {
    try {
      // 验证所有字段
      await form.validateFields();
      const values = form.getFieldsValue();
      
      if (!values || !values.url || typeof values.url !== 'string') {
        message.error('请输入有效的URL地址');
        return;
      }
      
      setSubmitting(true);
      console.log('保存仓库，原始数据:', values);
      
      // 创建一个请求数据的副本
      const requestData = {
        name: values.name || '',
        type: values.type || '',
        url: values.url || '',
        username: values.username || '',
        password: values.password || ''
      };
      
      console.log('保存仓库，处理后的数据:', requestData);
      
      // 调用API创建仓库
      await apiService.createImageRegistry(requestData);
      message.success('镜像仓库添加成功');
      navigate('/registry');
    } catch (error) {
      console.error('保存仓库失败:', error);
      if (error.response && error.response.data && error.response.data.error) {
        message.error(`保存失败: ${error.response.data.error}`);
      } else if (error.message) {
        message.error(`验证失败: ${error.message}`);
      } else {
        message.error('保存失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    navigate('/registry');
  };

  return (
    <div className="private-registry-page">
      <Card 
        title="创建Secret"
        extra={
          <Space>
            <Button onClick={handleCancel}>取消</Button>
            <Button 
              type="primary" 
              onClick={currentStep === steps.length - 1 ? handleSave : handleNext}
              loading={submitting}
            >
              {currentStep === steps.length - 1 ? '创建' : '下一步'}
            </Button>
          </Space>
        }
      >
        <Steps current={currentStep}>
          {steps.map(item => (
            <Step key={item.title} title={item.title} />
          ))}
        </Steps>
        
        <div className="steps-content">
          <Form
            form={form}
            layout="vertical"
            initialValues={formValues}
          >
            {steps[currentStep].content}
          </Form>
        </div>
        
        <div className="steps-action">
          <Row justify="space-between">
            <Col>
              {currentStep > 0 && (
                <Button onClick={handlePrev}>
                  上一步
                </Button>
              )}
            </Col>
            <Col>
              <Space>
                {currentStep === steps.length - 1 && (
                  <>
                    <Button onClick={handleTestConnection} loading={testing}>
                      验证
                    </Button>
                    <Button onClick={handleCancel}>
                      取消
                    </Button>
                  </>
                )}
                <Button 
                  type="primary"
                  onClick={currentStep === steps.length - 1 ? handleSave : handleNext}
                  loading={submitting}
                >
                  {currentStep === steps.length - 1 ? '创建' : '下一步'}
                </Button>
              </Space>
            </Col>
          </Row>
        </div>
      </Card>
    </div>
  );
};

export default PrivateRegistryPage; 
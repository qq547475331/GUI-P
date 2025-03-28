import React from 'react';
import { Form, Input, Switch, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import './NetworkConfig.css';

const NetworkConfig = ({ formData, setFormData, form }) => {
  // 处理表单数据变化
  const handleFormChange = (changedValues, allValues) => {
    setFormData({
      ...formData,
      ...allValues
    });
  };

  // 添加端口
  const handleAddPort = () => {
    // 获取当前端口列表
    const ports = form.getFieldValue('ports') || [];
    // 添加新端口
    form.setFieldsValue({
      ports: [...ports, { port: '', publicAccess: false }]
    });
    
    setFormData({
      ...formData,
      ports: [...(formData?.ports || []), { port: '', publicAccess: false }]
    });
  };

  return (
    <div className="network-config">
      <div className="section-header">
        <h2>网络配置</h2>
      </div>
      
      <Form 
        layout="vertical"
        form={form}
        initialValues={{
          containerPort: formData?.containerPort || '80',
          publicAccess: formData?.publicAccess || false,
          ports: formData?.ports || []
        }}
        onValuesChange={handleFormChange}
      >
        <Form.Item
          label="容器暴露端口"
          name="containerPort"
          rules={[{ required: true, message: '请输入容器端口' }]}
        >
          <Input placeholder="80" />
        </Form.Item>
        
        <Form.Item
          label="开启公网访问"
          name="publicAccess"
          valuePropName="checked"
        >
          <Switch size="small" />
        </Form.Item>
        
        <Form.Item>
          <Button 
            type="default" 
            icon={<PlusOutlined />}
            className="add-port-btn"
            onClick={handleAddPort}
          >
            添加端口
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default NetworkConfig; 
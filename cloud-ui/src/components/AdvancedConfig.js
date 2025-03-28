import React, { useState } from 'react';
import { Form, Input, Radio, Button, Tooltip, Modal } from 'antd';
import { PlusOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import './AdvancedConfig.css';

const AdvancedConfig = ({ formData, setFormData, form }) => {
  const [envModalVisible, setEnvModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [storageModalVisible, setStorageModalVisible] = useState(false);

  // 处理表单数据变化
  const handleFormChange = (changedValues, allValues) => {
    setFormData({
      ...formData,
      ...allValues
    });
  };

  // 打开环境变量编辑模态框
  const showEnvModal = () => {
    setEnvModalVisible(true);
  };

  // 打开配置文件编辑模态框
  const showConfigModal = () => {
    setConfigModalVisible(true);
  };

  // 打开存储卷编辑模态框
  const showStorageModal = () => {
    setStorageModalVisible(true);
  };

  // 处理环境变量提交
  const handleEnvSubmit = (values) => {
    setFormData({
      ...formData,
      envVars: values
    });
    setEnvModalVisible(false);
  };

  return (
    <div className="advanced-config">
      <div className="section-header">
        <h2>高级配置</h2>
        <span className="section-tag">选填</span>
      </div>
      
      <Form 
        layout="vertical"
        form={form}
        initialValues={{
          useCustomCommand: formData?.useCustomCommand || 'no',
          command: formData?.command || '',
          args: formData?.args || '',
          envVars: formData?.envVars || [],
          configFiles: formData?.configFiles || [],
          volumes: formData?.volumes || []
        }}
        onValuesChange={handleFormChange}
      >
        <Form.Item 
          label="启动命令" 
          name="useCustomCommand"
          tooltip={{ 
            title: '若不填写，将使用镜像默认命令', 
            icon: <InfoCircleOutlined /> 
          }}
        >
          <Radio.Group>
            <Radio value="no">
              否，不填写，将使用默认认命令
            </Radio>
            <Radio value="yes">
              是，自定义启动命令
            </Radio>
          </Radio.Group>
        </Form.Item>
        
        <Form.Item 
          label="运行命令" 
          name="command"
          style={{
            display: form?.getFieldValue('useCustomCommand') === 'yes' ? 'block' : 'none'
          }}
        >
          <Input placeholder="例如: /bin/bash -c" />
        </Form.Item>
        
        <Form.Item 
          label="命令参数" 
          name="args"
          style={{
            display: form?.getFieldValue('useCustomCommand') === 'yes' ? 'block' : 'none'
          }}
        >
          <Input placeholder="例如: sleep 10 && /entrypoint.sh db createdb" />
        </Form.Item>
        
        <Form.Item 
          label="环境变量"
          tooltip={{ 
            title: '为容器运行设置环境变量', 
            icon: <InfoCircleOutlined /> 
          }}
        >
          <Button 
            icon={<EditOutlined />} 
            className="action-button"
            onClick={showEnvModal}
          >
            编辑环境变量 {formData?.envVars?.length ? `(${formData.envVars.length})` : ''}
          </Button>
        </Form.Item>
        
        <Form.Item 
          label="配置文件"
          tooltip={{ 
            title: '添加配置文件到容器中', 
            icon: <InfoCircleOutlined /> 
          }}
        >
          <Button 
            icon={<PlusOutlined />} 
            className="action-button add-config-btn"
            onClick={showConfigModal}
          >
            新增配置文件 {formData?.configFiles?.length ? `(${formData.configFiles.length})` : ''}
          </Button>
        </Form.Item>
        
        <Form.Item 
          label="本地存储"
        >
          <Button 
            icon={<PlusOutlined />} 
            className="action-button add-storage-btn"
            onClick={showStorageModal}
          >
            新增存储卷 {formData?.volumes?.length ? `(${formData.volumes.length})` : ''}
          </Button>
          <Tooltip title="不同实例之间数据不互通">
            <InfoCircleOutlined className="info-icon" />
          </Tooltip>
        </Form.Item>
      </Form>

      {/* 环境变量编辑模态框 */}
      <Modal
        title="编辑环境变量"
        open={envModalVisible}
        onCancel={() => setEnvModalVisible(false)}
        onOk={() => setEnvModalVisible(false)}
      >
        <p>这里将显示环境变量编辑界面</p>
      </Modal>

      {/* 配置文件编辑模态框 */}
      <Modal
        title="编辑配置文件"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onOk={() => setConfigModalVisible(false)}
      >
        <p>这里将显示配置文件编辑界面</p>
      </Modal>

      {/* 存储卷编辑模态框 */}
      <Modal
        title="编辑存储卷"
        open={storageModalVisible}
        onCancel={() => setStorageModalVisible(false)}
        onOk={() => setStorageModalVisible(false)}
      >
        <p>这里将显示存储卷编辑界面</p>
      </Modal>
    </div>
  );
};

export default AdvancedConfig; 
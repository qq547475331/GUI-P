import React, { useState, useRef, useEffect } from 'react';
import { Button, Form, message } from 'antd';
import SideMenu from './SideMenu';
import BasicConfig from './BasicConfig';
import NetworkConfig from './NetworkConfig';
import AdvancedConfig from './AdvancedConfig';
import ResourceQuota from './ResourceQuota';
import apiService from '../services/api';
import './AppConfig.css';

const AppConfig = () => {
  const [selectedMenu, setSelectedMenu] = useState('basic');
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  
  const basicRef = useRef(null);
  const networkRef = useRef(null);
  const advancedRef = useRef(null);
  const resourceRef = useRef(null);
  
  // 处理菜单选择
  const handleMenuSelect = (key) => {
    setSelectedMenu(key);
    
    // 根据选中的菜单项滚动到对应的配置区域
    switch(key) {
      case 'basic':
        basicRef.current?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'network':
        networkRef.current?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'advanced':
        advancedRef.current?.scrollIntoView({ behavior: 'smooth' });
        break;
      case 'resource':
        resourceRef.current?.scrollIntoView({ behavior: 'smooth' });
        break;
      default:
        break;
    }
  };

  // 导出YAML
  const handleExportYaml = async () => {
    try {
      setLoading(true);
      // 检查必填字段
      await form.validateFields();
      
      // 先创建或更新应用
      let applicationId = formData.id;
      if (!applicationId) {
        // 创建新应用
        const result = await apiService.createApplication(formData);
        applicationId = result.id;
        setFormData(prev => ({ ...prev, id: applicationId }));
      } else {
        // 更新已有应用
        await apiService.updateApplication(applicationId, formData);
      }
      
      // 导出YAML
      await apiService.exportApplicationToYaml(applicationId);
      message.success('YAML导出成功');
    } catch (error) {
      if (error.errorFields) {
        message.error('请填写必要的配置信息');
      } else {
        message.error('导出失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 部署应用
  const handleDeploy = async () => {
    try {
      setLoading(true);
      // 检查必填字段
      await form.validateFields();
      
      // 创建或更新应用
      let applicationId = formData.id;
      if (!applicationId) {
        // 创建新应用
        const result = await apiService.createApplication(formData);
        applicationId = result.id;
        setFormData(prev => ({ ...prev, id: applicationId }));
      } else {
        // 更新已有应用
        await apiService.updateApplication(applicationId, formData);
      }
      
      // 部署应用
      const deployResult = await apiService.deployApplication(applicationId);
      message.success('应用部署请求已提交');
      
      // 定期查询部署状态
      const statusCheckInterval = setInterval(async () => {
        try {
          const status = await apiService.getDeploymentStatus(applicationId);
          if (status.phase === 'Running' || status.phase === 'Succeeded') {
            message.success('应用部署成功');
            clearInterval(statusCheckInterval);
          } else if (status.phase === 'Failed') {
            message.error(`部署失败: ${status.message}`);
            clearInterval(statusCheckInterval);
          }
        } catch (error) {
          console.error('获取部署状态失败:', error);
        }
      }, 5000); // 每5秒检查一次
      
      // 30秒后停止检查
      setTimeout(() => {
        clearInterval(statusCheckInterval);
      }, 30000);
    } catch (error) {
      if (error.errorFields) {
        message.error('请填写必要的配置信息');
      } else {
        message.error('部署失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-config">
      <div className="app-config-container">
        <div className="app-config-sidebar">
          <SideMenu selectedKey={selectedMenu} onSelect={handleMenuSelect} />
        </div>
        
        <div className="app-config-content">
          <div className="app-config-header">
            <h1>应用部署</h1>
            <div className="app-config-actions">
              <Button onClick={handleExportYaml} loading={loading}>导出 Yaml</Button>
              <Button type="primary" onClick={handleDeploy} loading={loading}>部署应用</Button>
            </div>
          </div>
          
          <div className="app-config-body">
            <div className="app-config-main">
              <div ref={basicRef} id="basic-config">
                <BasicConfig formData={formData} setFormData={setFormData} form={form} />
              </div>
              <div className="config-divider"></div>
              <div ref={networkRef} id="network-config">
                <NetworkConfig formData={formData} setFormData={setFormData} form={form} />
              </div>
              <div className="config-divider"></div>
              <div ref={advancedRef} id="advanced-config">
                <AdvancedConfig formData={formData} setFormData={setFormData} form={form} />
              </div>
            </div>
            <div className="app-config-side">
              <div ref={resourceRef} id="resource-quota">
                <ResourceQuota formData={formData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppConfig; 
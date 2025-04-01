import { message as antMessage } from 'antd';
import { CheckCircleFilled, InfoCircleFilled, ExclamationCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import React from 'react';

// 自定义消息配置
const customMessage = {
  success: (content, duration = 2, onClose) => {
    return antMessage.success({
      content,
      duration,
      icon: <CheckCircleFilled style={{ color: '#52c41a' }} />,
      className: 'custom-success-message',
      style: {
        backgroundColor: '#f6ffed', 
        border: '1px solid #b7eb8f',
        borderRadius: '4px',
        color: '#52c41a'
      },
      onClose
    });
  },
  
  error: (content, duration = 3, onClose) => {
    return antMessage.error({
      content,
      duration,
      icon: <CloseCircleFilled style={{ color: '#ff4d4f' }} />,
      className: 'custom-error-message',
      onClose
    });
  },
  
  info: (content, duration = 2, onClose) => {
    return antMessage.info({
      content,
      duration,
      icon: <InfoCircleFilled style={{ color: '#1890ff' }} />,
      className: 'custom-info-message',
      onClose
    });
  },
  
  warning: (content, duration = 3, onClose) => {
    return antMessage.warning({
      content,
      duration,
      icon: <ExclamationCircleFilled style={{ color: '#faad14' }} />,
      className: 'custom-warning-message',
      onClose
    });
  },
  
  loading: (content, key) => {
    return antMessage.loading({
      content,
      duration: 0,
      key,
      className: 'custom-loading-message'
    });
  },
  
  // 应用创建成功消息（特殊定制）
  appCreateSuccess: (content = '应用创建成功', duration = 3) => {
    // 先清除所有现有的消息，避免重复显示
    antMessage.destroy();
    
    // 使用简洁的消息文本
    const simpleContent = '应用创建成功';
    
    return antMessage.success({
      content: simpleContent,
      duration,
      className: 'borderless-success-message',
      style: {
        backgroundColor: 'transparent',
        border: 'none',
        padding: '8px 16px',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'auto',
        textAlign: 'center',
        zIndex: 9999
      }
    });
  },
  
  // 应用删除成功消息（特殊定制）
  appDeleteSuccess: (content = '应用删除成功', duration = 2) => {
    // 先清除所有现有的消息，避免重复显示
    antMessage.destroy();
    
    return antMessage.success({
      content,
      duration,
      className: 'borderless-success-message',
      style: {
        backgroundColor: 'transparent',
        border: 'none',
        padding: '8px 16px',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'auto',
        textAlign: 'center',
        zIndex: 9999
      }
    });
  },
  
  // 应用部署成功消息（特殊定制）
  deploySuccess: (content = '应用已成功部署', key, duration = 2) => {
    // 先清除所有现有的消息
    antMessage.destroy();
    
    return antMessage.success({
      content,
      key,
      duration,
      className: 'borderless-success-message',
      style: {
        backgroundColor: 'transparent',
        border: 'none',
        padding: '8px 16px',
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'auto',
        textAlign: 'center',
        zIndex: 9999
      }
    });
  }
};

export default customMessage; 
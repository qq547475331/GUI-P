import React, { useState } from 'react';
import { Table, Button, Space, Tag, Popconfirm, message, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, SyncOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { eventBus, EVENT_TYPES } from '../services/eventBus';
import customMessage from '../services/message';

const ApplicationList = ({ applications = [], loading = false, onDelete, onRefresh }) => {
  const navigate = useNavigate();
  const [refreshingStatus, setRefreshingStatus] = useState({});
  const [deletingApp, setDeletingApp] = useState(null);

  // 刷新单个应用状态
  const refreshAppStatus = async (appId) => {
    if (!appId) return;
    
    try {
      setRefreshingStatus(prev => ({ ...prev, [appId]: true }));
      console.log('刷新应用状态:', appId);
      
      // 获取应用的实时部署状态
      await apiService.getDeploymentStatus(appId);
      
      // 更新应用列表
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error(`更新应用 ${appId} 状态失败:`, error);
      message.error('获取应用状态失败');
    } finally {
      setRefreshingStatus(prev => ({ ...prev, [appId]: false }));
    }
  };

  // 删除应用
  const handleDelete = async (record) => {
    try {
      setDeletingApp(record.id);
      
      // 如果有父组件提供的onDelete回调，立即调用通知删除开始
      if (onDelete) {
        onDelete(record.id, 'start');
      }
      
      message.loading({ content: '正在删除应用...', key: 'deletingApp', duration: 0 });
      
      // 删除应用，设置deleteK8sResources=true确保同时删除Kubernetes资源
      await apiService.deleteApplication(record.id, true);
      
      // 使用无边框居中的删除成功消息
      customMessage.appDeleteSuccess('应用删除成功');
      
      // 触发删除事件，通知其他组件
      eventBus.publish(EVENT_TYPES.APP_DELETED, { id: record.id });
      
      // 调用父组件的onDelete回调通知删除完成
      if (onDelete) {
        onDelete(record.id, 'success');
      }
    } catch (error) {
      console.error('删除应用失败:', error);
      message.error({ content: '删除应用失败: ' + (error.message || '未知错误'), key: 'deletingApp' });
      
      // 如果有父组件提供的onDelete回调，通知删除失败
      if (onDelete && error.response && error.response.status !== 404) {
        onDelete(record.id, 'error');
      }
    } finally {
      setDeletingApp(null);
    }
  };

  // 获取状态标签颜色
  const getStatusColor = (status) => {
    // 确保状态是字符串
    const statusStr = String(status || '').toLowerCase();
    
    switch (statusStr) {
      case 'running':
        return 'green';
      case 'pending':
      case 'deploying':
        return 'blue';
      case 'failed':
      case 'error':
        return 'red';
      case 'created':
        return 'orange';
      default:
        return 'default';
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '应用名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => text || record.appName,
    },
    {
      title: '命名空间',
      dataIndex: 'namespace',
      key: 'namespace',
    },
    {
      title: '镜像',
      dataIndex: 'imageName',
      key: 'imageName',
      ellipsis: true,
    },
    {
      title: '副本数',
      dataIndex: 'replicas',
      key: 'replicas',
      render: (text, record) => text || record.instances || 1,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        // 确保状态是字符串
        const statusText = typeof status === 'object' ? status.phase : String(status || '');
        // 首字母大写显示
        const displayText = statusText.charAt(0).toUpperCase() + statusText.slice(1).toLowerCase();
        
        return (
          <Space>
            <Tag color={getStatusColor(statusText)}>
              {displayText || '未知'}
            </Tag>
            {refreshingStatus[record.id] && <SyncOutlined spin />}
            <Button 
              type="link" 
              size="small" 
              icon={<SyncOutlined />} 
              onClick={(e) => {
                e.stopPropagation();
                refreshAppStatus(record.id);
              }}
              title="刷新状态"
            />
          </Space>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => navigate(`/detail/${record.id}`)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button 
              icon={<EditOutlined />} 
              onClick={() => navigate(`/edit/${record.id}`)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除此应用吗？"
              description="此操作将永久删除该应用及其所有资源"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                icon={<DeleteOutlined />} 
                danger 
                size="small" 
                loading={deletingApp === record.id}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Table 
      dataSource={applications} 
      columns={columns} 
      rowKey="id"
      loading={loading}
      pagination={{ 
        pageSize: 10, 
        showSizeChanger: true, 
        showTotal: (total) => `共 ${total} 个应用` 
      }}
    />
  );
};

export default ApplicationList; 
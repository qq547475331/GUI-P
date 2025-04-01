import { Table, Button, Space, Tag, Popconfirm, message, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined, SyncOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { eventBus, EVENT_TYPES } from '../services/eventBus';
import customMessage from '../services/message';

// ... existing code ...
      message.loading({ content: '正在删除应用...', key: 'deletingApp', duration: 0 });
      
      // 删除应用，设置deleteK8sResources=true确保同时删除Kubernetes资源
      await apiService.deleteApplication(record.id, true);
      
      customMessage.success('应用删除成功');
// ... existing code ... 
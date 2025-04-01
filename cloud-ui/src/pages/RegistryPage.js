import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Typography,
  Popconfirm,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import './RegistryPage.css';

const { Option } = Select;
const { Title } = Typography;
const { Password } = Input;

const RegistryPage = () => {
  const navigate = useNavigate();
  const [registries, setRegistries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('添加镜像仓库');
  const [currentRegistry, setCurrentRegistry] = useState(null);
  const [form] = Form.useForm();
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchRegistries();

    // 设置定时刷新，每5分钟刷新一次
    const refreshTimer = setInterval(() => {
      fetchRegistries(true); // 静默刷新
    }, 300000); // 5分钟 = 300000毫秒

    return () => {
      clearInterval(refreshTimer); // 组件卸载时清除定时器
    };
  }, []);

  const fetchRegistries = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiService.getImageRegistries();
      setRegistries(data);
    } catch (error) {
      if (!silent) {
        message.error('获取镜像仓库列表失败');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const showAddModal = () => {
    setModalTitle('添加镜像仓库');
    setCurrentRegistry(null);
    form.resetFields();
    setModalVisible(true);
  };

  const showEditModal = (record) => {
    setModalTitle('编辑镜像仓库');
    setCurrentRegistry(record);
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      url: record.url,
      username: record.username,
      password: '' // 出于安全考虑，不回显密码
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await apiService.deleteImageRegistry(id);
      message.success('镜像仓库删除成功');
      fetchRegistries();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleTestConnection = async () => {
    try {
      await form.validateFields(['type', 'url', 'username', 'password']);
      const values = form.getFieldsValue();
      
      setTesting(true);
      await apiService.testImageRegistry(values);
      message.success('连接测试成功！');
    } catch (error) {
      if (error.response) {
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

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (currentRegistry) {
        // 更新
        await apiService.updateImageRegistry(currentRegistry.id, values);
        message.success('镜像仓库更新成功');
      } else {
        // 新增
        await apiService.createImageRegistry(values);
        message.success('镜像仓库添加成功');
      }
      
      setModalVisible(false);
      fetchRegistries();
    } catch (error) {
      if (error.response) {
        message.error(`操作失败: ${error.response.data.error}`);
      } else if (error.message) {
        message.error(`验证失败: ${error.message}`);
      } else {
        message.error('操作失败');
      }
    }
  };

  const navigateToPrivateRegistry = () => {
    navigate('/registry/private');
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        switch (type) {
          case 'docker':
            return 'Docker Hub';
          case 'harbor':
            return 'Harbor';
          default:
            return type;
        }
      }
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="编辑">
            <Button
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              size="small"
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除此镜像仓库吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                icon={<DeleteOutlined />}
                danger
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="registry-page">
      <Card
        title={<Title level={4}>镜像仓库管理</Title>}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={navigateToPrivateRegistry}
            >
              添加私有镜像仓库
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={showAddModal}
            >
              快速添加
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={registries}
          rowKey="id"
          loading={loading}
          pagination={false}
        />
      </Card>

      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="test" onClick={handleTestConnection} loading={testing}>
            测试连接
          </Button>,
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit}>
            保存
          </Button>,
        ]}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="仓库名称"
            rules={[{ required: true, message: '请输入仓库名称' }]}
          >
            <Input placeholder="例如: Harbor生产环境" />
          </Form.Item>

          <Form.Item
            name="type"
            label="仓库类型"
            rules={[{ required: true, message: '请选择仓库类型' }]}
          >
            <Select placeholder="选择仓库类型">
              <Option value="docker">Docker Hub</Option>
              <Option value="harbor">Harbor</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="url"
            label="仓库地址"
            rules={[{ required: true, message: '请输入仓库地址' }]}
          >
            <Input placeholder="例如: harbor.example.com" />
          </Form.Item>

          <Form.Item
            name="username"
            label="用户名"
          >
            <Input placeholder="仓库认证用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
          >
            <Password placeholder="仓库认证密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RegistryPage; 
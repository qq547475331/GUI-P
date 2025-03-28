import React, { useState, useEffect } from 'react';
import {
  Button,
  Table,
  message,
  Modal,
  Form,
  Input,
  Space,
  Typography,
  Popconfirm,
  Select
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  UploadOutlined,
  EditOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';

const { TextArea } = Input;
const { Title } = Typography;

const KubeConfigManager = () => {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [contextModalVisible, setContextModalVisible] = useState(false);
  const [currentConfig, setCurrentConfig] = useState(null);
  const [form] = Form.useForm();
  const [contextForm] = Form.useForm();
  const navigate = useNavigate();

  // 获取所有KubeConfig
  const fetchKubeConfigs = async () => {
    try {
      setLoading(true);
      const data = await apiService.getKubeConfigs();
      setConfigs(data);
    } catch (error) {
      message.error('获取KubeConfig列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKubeConfigs();
  }, []);

  // 上传KubeConfig
  const handleUpload = async (values) => {
    try {
      setLoading(true);
      await apiService.uploadKubeConfig(values);
      message.success('KubeConfig上传成功');
      setModalVisible(false);
      form.resetFields();
      fetchKubeConfigs();
    } catch (error) {
      message.error(`上传失败: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 删除KubeConfig
  const handleDelete = async (id) => {
    try {
      setLoading(true);
      await apiService.deleteKubeConfig(id);
      message.success('KubeConfig删除成功');
      fetchKubeConfigs();
    } catch (error) {
      message.error(`删除失败: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 打开上下文管理模态框
  const showContextModal = (config) => {
    setCurrentConfig(config);
    contextForm.setFieldsValue({
      context: config.currentContext
    });
    setContextModalVisible(true);
  };

  // 更改上下文
  const handleContextChange = async (values) => {
    try {
      setLoading(true);
      await apiService.setKubeConfigContext(currentConfig.id, values.context);
      message.success('切换上下文成功');
      setContextModalVisible(false);
      fetchKubeConfigs();
    } catch (error) {
      message.error(`切换上下文失败: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 导航到资源查看页面
  const viewResources = (configId) => {
    navigate(`/cluster/${configId}/resources`);
  };

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '集群名称',
      dataIndex: 'clusterName',
      key: 'clusterName',
    },
    {
      title: '当前上下文',
      dataIndex: 'currentContext',
      key: 'currentContext',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            icon={<EyeOutlined />} 
            onClick={() => viewResources(record.id)}
            size="small"
          >
            查看资源
          </Button>
          <Button 
            icon={<EditOutlined />} 
            onClick={() => showContextModal(record)}
            size="small"
          >
            切换上下文
          </Button>
          <Popconfirm
            title="确定要删除此配置吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="kubeconfig-manager">
      <div className="kubeconfig-header">
        <Title level={4}>Kubernetes配置管理</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setModalVisible(true)}
        >
          添加KubeConfig
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={configs}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      {/* 上传KubeConfig模态框 */}
      <Modal
        title="添加KubeConfig"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpload}
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="生产环境集群" />
          </Form.Item>

          <Form.Item
            name="configContent"
            label="KubeConfig内容"
            rules={[{ required: true, message: '请粘贴KubeConfig内容' }]}
          >
            <TextArea rows={10} placeholder="粘贴KubeConfig文件内容（YAML格式）" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<UploadOutlined />}>
              上传
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 切换上下文模态框 */}
      <Modal
        title="切换上下文"
        open={contextModalVisible}
        onCancel={() => setContextModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        {currentConfig && (
          <Form
            form={contextForm}
            layout="vertical"
            onFinish={handleContextChange}
          >
            <Form.Item
              name="context"
              label="选择上下文"
              rules={[{ required: true, message: '请选择上下文' }]}
            >
              <Select>
                {currentConfig.contexts.map(context => (
                  <Select.Option key={context} value={context}>
                    {context}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                切换
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default KubeConfigManager; 
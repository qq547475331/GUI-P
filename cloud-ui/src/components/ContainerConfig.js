import React, { useState, useEffect, useRef } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Divider,
  Card,
  Spin,
  Alert,
  message,
  Typography,
  Badge,
  Space,
  Tooltip,
  Tag,
  Radio,
  InputNumber,
  Modal
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  SyncOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { nanoid } from 'nanoid';
import apiService from '../services/api';
import './ContainerConfig.css';

const { Option } = Select;
const { Title, Text } = Typography;

// 容器类型
const CONTAINER_TYPES = {
  WORK: 'work',
  INIT: 'init'
};

const ContainerConfig = ({ form, initialValues = {} }) => {
  const [loading, setLoading] = useState(true);
  const [registries, setRegistries] = useState([]);
  const [selectedRegistry, setSelectedRegistry] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [repositories, setRepositories] = useState([]);
  const [loadingRepositories, setLoadingRepositories] = useState(false);
  const [selectedRepository, setSelectedRepository] = useState('');
  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');
  const [containerType, setContainerType] = useState(CONTAINER_TYPES.WORK);
  const [containerName, setContainerName] = useState('');
  const containerNameInputRef = useRef(null);
  const [ports, setPorts] = useState(initialValues.ports || []);
  const [portModalVisible, setPortModalVisible] = useState(false);
  const [portForm] = Form.useForm();
  const [currentEditingPort, setCurrentEditingPort] = useState({
    protocol: 'TCP',
    name: '',
    containerPort: 8080
  });
  const [imageValue, setImageValue] = useState(initialValues.imageName || initialValues.image || initialValues.imageURL || '');
  const [registryType, setRegistryType] = useState('dockerhub');
  
  // 容器名称生成
  const generateContainerName = () => {
    // 生成包含小写字母和数字的容器名称，确保符合K8s命名规范
    const letters = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const chars = letters + digits;
    let result = 'container-';
    
    // 添加随机字符
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  };

  // 首次加载
  useEffect(() => {
    let isMounted = true; // 组件挂载状态标志
    
    async function loadData() {
      try {
        // 获取注册的镜像仓库
        const registryData = await apiService.getImageRegistries();
        if (!isMounted) return;
        
        setRegistries(registryData);

        // 确保初始端口配置存在
        if (!initialValues.ports || initialValues.ports.length === 0) {
          const defaultPorts = [{
            protocol: 'TCP',
            name: 'tcp-8080',
            containerPort: 8080
          }];
          
          // 设置默认值
          form.setFieldsValue({ ports: defaultPorts });
          
          // 移除频繁打印的日志，仅在开发环境下打印
          if (process.env.NODE_ENV === 'development' && !window._loggedPortInit) {
            console.log('已初始化默认端口配置:', defaultPorts);
            
            // 设置全局标记，避免重复打印
            window._loggedPortInit = true;
            
            // 5分钟后重置标记
            setTimeout(() => {
              window._loggedPortInit = false;
            }, 300000); // 5分钟
          }
        } else {
          // 如果已有端口配置，更新状态
          setPorts(initialValues.ports);
        }

        // 镜像地址初始化
        // 清除可能存在的全局错误 - 添加这一行
        if (document.querySelector('.ant-alert-error')) {
          const closeButtons = document.querySelectorAll('.ant-alert-error .ant-alert-close-icon');
          closeButtons.forEach(button => button.click());
        }
        
        if (imageValue && imageValue.trim() !== '') {
          // 延迟设置，确保表单已完全加载
          setTimeout(() => {
            if (!isMounted) return;
            
            form.setFieldsValue({
              imageName: imageValue,
              image: imageValue,
              imageURL: imageValue
            });
            
            // 清除验证错误，使用setFields而不是validateFields
            form.setFields([
              {
                name: 'imageName',
                value: imageValue,
                errors: [] // 清除错误
              }
            ]);
            
            console.log('已成功初始化镜像地址:', imageValue);
            
            // 清除可能存在的全局错误
            if (document.querySelector('.ant-alert-error')) {
              const closeButtons = document.querySelectorAll('.ant-alert-error .ant-alert-close-icon');
              closeButtons.forEach(button => button.click());
            }
          }, 200);
        }

        // 如果有初始值，尝试设置选中的仓库和项目
        if (initialValues.image && initialValues.registryId) {
          const registry = registryData.find(r => r.id === initialValues.registryId);
          if (registry) {
            setSelectedRegistry(registry);
            
            // 分析镜像格式以设置项目和标签
            if (initialValues.image) {
              const imageParts = initialValues.image.split('/');
              if (imageParts.length > 1) {
                // 有效的项目/仓库格式
                const project = imageParts[0];
                setSelectedProject(project);
                
                // 获取项目列表并处理仓库
                const projects = await fetchProjects(registry.id);
                if (!isMounted) return;
                
                if (Array.isArray(projects) && projects.includes(project)) {
                  // 加载该项目下的仓库
                  const repoAndTag = imageParts[1].split(':');
                  const repo = repoAndTag[0];
                  
                  const repositories = await fetchRepositories(registry.id, project);
                  if (!isMounted) return;
                  
                  if (Array.isArray(repositories) && repositories.includes(repo)) {
                    setSelectedRepository(repo);
                    
                    // 处理标签
                    if (repoAndTag.length > 1) {
                      const tag = repoAndTag[1];
                      fetchTags(registry.id, `${project}/${repo}`);
                      setSelectedTag(tag);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('加载容器配置数据失败:', error);
        if (isMounted) {
          message.error('加载镜像仓库数据失败');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    
    loadData();
    
    // 组件卸载时取消操作
    return () => {
      isMounted = false;
    };
  }, [initialValues, form]);

  // 获取仓库中的项目列表
  const fetchProjects = async (registryId) => {
    // 如果是Docker Hub公共仓库，不获取项目列表
    if (registryId === 'public') {
      setProjects([]);
      return [];
    }

    setLoadingProjects(true);
    try {
      const data = await apiService.getRepositories(registryId);
      setProjects(data);
      return data;
    } catch (error) {
      message.error('获取项目列表失败');
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  // 获取项目中的仓库列表
  const fetchRepositories = async (registryId, project) => {
    // 如果是Docker Hub公共仓库，不获取仓库列表
    if (registryId === 'public') {
      setRepositories([]);
      return [];
    }

    setLoadingRepositories(true);
    try {
      console.log('获取仓库列表，参数:', { registryId, project });
      if (!registryId || !project) {
        console.error('获取仓库列表失败: 缺少必要参数', { registryId, project });
        setRepositories([]);
        return [];
      }
      
      // 对project参数进行编码，避免URL中的特殊字符问题
      const encodedProject = encodeURIComponent(project);
      console.log('编码后的project参数:', encodedProject);
      
      // 根据仓库类型使用不同的API路径
      const registry = registries.find(r => r.id === registryId);
      console.log('选择的镜像仓库:', registry);
      
      let data = [];
      
      try {
        if (registry && registry.type === 'harbor') {
          // Harbor特定API
          console.log('使用Harbor API获取仓库列表');
          console.log('调用Harbor API路径:', `/registry/${registryId}/harborrepo/${encodedProject}`);
          
          data = await apiService.getHarborRepositories(registryId, encodedProject)
            .catch(async error => {
              console.error('Harbor API获取仓库失败, 详细错误:', error);
              console.log('尝试通用仓库API...');
              // 如果Harbor特定API失败，回退到通用方法
              return await apiService.getRepositories(registryId, encodedProject);
            });
          
          console.log('仓库列表API响应:', data);
        } else {
          // 通用方法
          console.log('使用通用API获取仓库列表');
          data = await apiService.getRepositories(registryId, encodedProject);
        }
        
        // 处理结果数据
        console.log('处理返回的仓库数据:', data);
        let processedData = [];
        
        // 如果是数组，处理数据；否则提示错误
        if (Array.isArray(data)) {
          if (registry && registry.type === 'harbor') {
            // Harbor数据处理
            if (data.length > 0) {
              if (data[0] && typeof data[0] === 'object' && data[0].name) {
                // 有name属性的对象数组
                console.log('识别到Harbor结构的数据，提取name字段');
                processedData = data.map(repo => {
                  const name = repo.name || '';
                  console.log('处理仓库名称:', name);
                  return name;
                });
              } else if (data[0] && typeof data[0] === 'string') {
                // 字符串数组
                console.log('Harbor返回了字符串数组');
                processedData = data;
              } else {
                console.warn('未知的Harbor数据结构:', data[0]);
                processedData = [];
              }
            }
          } else {
            // 通用数据处理
            processedData = data;
          }
          
          console.log('处理后的仓库列表:', processedData);
          setRepositories(processedData);
          return processedData;
        } else {
          console.error('获取仓库列表结果格式不正确:', data);
          setRepositories([]);
          return [];
        }
      } catch (error) {
        console.error('获取仓库列表请求失败:', error);
        throw error;
      }
      
    } catch (error) {
      console.error('获取仓库列表失败:', error);
      message.error(`获取仓库列表失败: ${error.response?.data?.error || error.message || '未知错误'}`);
      setRepositories([]);
      return [];
    } finally {
      setLoadingRepositories(false);
    }
  };

  // 获取仓库的标签列表
  const fetchTags = async (registryId, repository) => {
    // 如果是Docker Hub公共仓库，不获取标签列表
    if (registryId === 'public') {
      // 为Docker Hub设置一些常用标签作为默认值
      setTags(['latest', 'stable', 'alpine', 'slim']);
      return ['latest', 'stable', 'alpine', 'slim'];
    }

    console.log('获取标签列表，参数:', { registryId, repository });
    if (!registryId || !repository) {
      console.error('获取标签列表失败: 缺少必要参数', { registryId, repository });
      setTags([]);
      return [];
    }
    
    setLoadingTags(true);
    try {
      // 对repository参数进行编码，避免URL中的特殊字符问题
      const encodedRepository = encodeURIComponent(repository);
      console.log('编码后的repository参数:', encodedRepository);
      
      // 根据仓库类型使用不同的API路径
      const registry = registries.find(r => r.id === registryId);
      console.log('选择的镜像仓库:', registry);
      
      let data = [];
      
      try {
        if (registry && registry.type === 'harbor') {
          // Harbor特定API
          console.log('使用Harbor API获取标签列表');
          
          // 解析仓库路径，提取项目和仓库名
          const pathParts = repository.split('/');
          console.log('解析仓库路径:', pathParts);
          
          if (pathParts.length >= 1) {
            let project, repo;
            
            if (pathParts.length >= 2) {
              project = pathParts[0];
              repo = pathParts.slice(1).join('/'); // 使用剩余部分作为仓库名
            } else {
              project = selectedProject || 'library';
              repo = repository;
            }
            
            console.log('Harbor标签解析:', { project, repo });
            console.log('调用Harbor Tags API路径:', `/registry/${registryId}/harbortags/${project}/${repo}`);
            
            // 使用Harbor特定的API获取标签
            data = await apiService.getHarborTags(registryId, project, repo)
              .catch(async error => {
                console.error('Harbor API获取标签失败, 详细错误:', error);
                console.log('尝试通用标签API...');
                // 如果Harbor特定API失败，回退到通用方法
                return await apiService.getImageTags(registryId, encodedRepository);
              });
            
            console.log('标签列表API响应:', data);
          } else {
            console.error('仓库路径格式不正确，无法解析:', repository);
            throw new Error('仓库路径格式不正确');
          }
        } else {
          // 通用方法
          console.log('使用通用API获取标签列表');
          data = await apiService.getImageTags(registryId, encodedRepository);
        }
        
        // 处理结果数据
        console.log('处理返回的标签数据:', data);
        let processedData = [];
        
        // 如果是数组，处理数据；否则提示错误
        if (Array.isArray(data)) {
          if (registry && registry.type === 'harbor') {
            // Harbor数据处理
            if (data.length > 0) {
              if (data[0] && typeof data[0] === 'object' && data[0].name) {
                // 有name属性的对象数组
                console.log('识别到Harbor结构的数据，提取name字段');
                processedData = data.map(tag => {
                  const name = tag.name || '';
                  console.log('处理标签名称:', name);
                  return name;
                });
              } else if (data[0] && typeof data[0] === 'string') {
                // 字符串数组
                console.log('Harbor返回了字符串数组');
                processedData = data;
              } else {
                console.warn('未知的Harbor数据结构:', data[0]);
                processedData = [];
              }
            }
          } else {
            // 通用数据处理
            processedData = data;
          }
          
          console.log('处理后的标签列表:', processedData);
          setTags(processedData);
          return processedData;
        } else {
          console.error('获取标签列表结果格式不正确:', data);
          setTags([]);
          return [];
        }
      } catch (error) {
        console.error('获取标签列表请求失败:', error);
        throw error;
      }
      
    } catch (error) {
      console.error('获取标签列表失败:', error);
      message.error(`获取标签列表失败: ${error.response?.data?.error || error.message || '未知错误'}`);
      setTags([]);
      return [];
    } finally {
      setLoadingTags(false);
    }
  };

  // 处理仓库选择
  const handleRegistryChange = async (registryId) => {
    // 重置相关状态
    setSelectedProject('');
    setSelectedRepository('');
    setSelectedTag('');
    setProjects([]);
    setRepositories([]);
    setTags([]);
    
    const registry = registries.find(r => r.id === registryId);
    setSelectedRegistry(registry);
    
    // 更新表单值
    form.setFieldsValue({
      registryId,
      project: undefined,
      repository: undefined,
      tag: undefined,
      imageName: ''
    });
    
    // 只有当选择的不是公共仓库时才加载项目列表
    if (registryId !== 'public') {
      await fetchProjects(registryId);
    }
  };

  // 处理项目选择
  const handleProjectChange = async (project) => {
    // 重置相关状态
    setSelectedRepository('');
    setSelectedTag('');
    setRepositories([]);
    setTags([]);
    
    setSelectedProject(project);
    
    // 更新表单值
    form.setFieldsValue({
      project,
      repository: undefined,
      tag: undefined,
      imageName: project // 暂时设置为项目名称，后续会补充
    });
    
    // 加载仓库列表
    if (selectedRegistry && selectedRegistry.id !== 'public') {
      await fetchRepositories(selectedRegistry.id, project);
    }
  };

  // 处理仓库选择
  const handleRepositoryChange = async (repository) => {
    // 重置标签
    setSelectedTag('');
    setTags([]);
    
    setSelectedRepository(repository);
    
    // 更新表单值
    const imageBase = selectedProject ? `${selectedProject}/${repository}` : repository;
    form.setFieldsValue({
      repository,
      tag: undefined,
      imageName: imageBase // 暂时设置为仓库名称，后续会补充标签
    });
    
    // 加载标签列表
    if (selectedRegistry && selectedProject) {
      await fetchTags(selectedRegistry.id, `${selectedProject}/${repository}`);
    }
  };

  // 处理标签选择
  const handleTagChange = (tag) => {
    setSelectedTag(tag);
    
    // 构建完整镜像名称
    let fullImage = '';
    
    try {
      if (selectedRegistry && selectedRegistry.id !== 'public') {
        // 处理私有仓库
        if (selectedRegistry.type === 'harbor') {
          // Harbor私有仓库格式
          const domain = selectedRegistry.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (selectedProject && selectedRepository) {
            fullImage = `${domain}/${selectedProject}/${selectedRepository}:${tag}`;
          } else if (selectedRepository) {
            fullImage = `${domain}/${selectedRepository}:${tag}`;
          }
        } else {
          // 其他私有仓库格式
          const domain = selectedRegistry.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (selectedProject && selectedRepository) {
            fullImage = `${domain}/${selectedProject}/${selectedRepository}:${tag}`;
          } else if (selectedRepository) {
            fullImage = `${domain}/${selectedRepository}:${tag}`;
          }
        }
      } else {
        // Docker Hub公共仓库格式
        if (selectedRepository) {
          fullImage = `${selectedRepository}:${tag}`;
        } else {
          fullImage = `nginx:${tag || 'latest'}`;  // 默认值
        }
      }
      
      console.log('构建的镜像全名:', fullImage);
    } catch (error) {
      console.error('构建镜像全名出错:', error);
      // 出错时使用简单格式
      if (selectedRepository) {
        fullImage = `${selectedRepository}:${tag}`;
      } else {
        fullImage = `nginx:${tag || 'latest'}`;
      }
    }
    
    // 更新表单值
    form.setFieldsValue({
      tag,
      imageName: fullImage
    });
    
    // 手动触发表单验证，确保值被提交
    form.validateFields(['imageName'])
      .then(() => {
        console.log('镜像名称已更新:', fullImage);
      })
      .catch(err => {
        console.error('镜像名称验证失败:', err);
      });
  };

  // 处理容器类型变更
  const handleContainerTypeChange = (type) => {
    setContainerType(type);
    form.setFieldsValue({ type });
  };

  // 在组件挂载时初始化容器名称
  useEffect(() => {
    // 如果没有初始容器名称，则生成一个
    if (!containerName) {
      const generatedName = generateContainerName();
      setContainerName(generatedName);
      
      // 延迟设置表单值，确保表单已初始化
      setTimeout(() => {
        form.setFieldsValue({
          configs: {
            ...(form.getFieldValue('configs') || {}),
            containerName: generatedName
          }
        });
        
        console.log('初始化容器名称:', generatedName);
      }, 100);
    }
  }, []);

  // 修改容器名称输入组件，使用完全受控模式
  const renderContainerNameInput = () => (
    <div className="container-name-section">
      <Form.Item
        label="容器名称"
        required
        help={
          <div style={{ fontSize: '12px', color: '#999' }}>
            容器名称只能包含小写字母、数字和连字符（-），且须以字母或数字开头和结尾
          </div>
        }
      >
        <Input.Group compact className="container-name-wrapper">
          <Input 
            id="container-name-input"
            value={containerName} 
            placeholder="输入容器名称" 
            style={{ width: 'calc(100% - 110px)' }}
            onChange={(e) => {
              const value = e.target.value;
              
              // 更新React状态
              setContainerName(value);
              
              // 更新表单字段
              form.setFieldsValue({
                configs: {
                  ...(form.getFieldValue('configs') || {}),
                  containerName: value
                }
              });
            }}
          />
          <Button
            type="primary"
            onClick={handleGenerateContainerName}
            className="generate-container-name-btn"
            style={{ width: '110px' }}
          >
            随机生成
          </Button>
        </Input.Group>
      </Form.Item>
      
      {/* 隐藏的表单字段，用于提交数据 */}
      <Form.Item 
        name={['configs', 'containerName']}
        rules={[
          { required: true, message: '请填写容器名称' },
          { 
            pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 
            message: '容器名称只能包含小写字母、数字和连字符（-），且须以字母或数字开头和结尾' 
          }
        ]}
        style={{ display: 'none' }}
      >
        <Input />
      </Form.Item>
    </div>
  );

  // 重构随机生成容器名称功能，确保输入框值更新
  const handleGenerateContainerName = () => {
    const newName = generateContainerName();
    console.log('生成新容器名称:', newName);
    
    // 1. 更新组件状态 - 这将导致UI更新
    setContainerName(newName);
    
    // 2. 更新表单字段值 - 这将确保表单提交时包含正确的值
    form.setFieldsValue({
      configs: {
        ...(form.getFieldValue('configs') || {}),
        containerName: newName
      }
    });
    
    // 3. 清除表单验证错误
    form.setFields([
      { name: ['configs', 'containerName'], value: newName, errors: [] }
    ]);
    
    // 显示成功消息
    message.success('已生成容器名称：' + newName);
  };

  // 打开端口配置模态框
  const openPortModal = () => {
    // 生成默认端口名称
    const defaultPortName = `tcp-${(ports?.length || 0) + 1 > 9 ? '' : '0'}${(ports?.length || 0) + 1}`;
    
    // 设置默认值
    setCurrentEditingPort({
      protocol: 'TCP',
      name: defaultPortName,
      containerPort: 8080
    });
    
    // 初始化表单值
    portForm.setFieldsValue({
      protocol: 'TCP',
      name: defaultPortName,
      containerPort: 8080
    });
    
    // 显示模态框
    setPortModalVisible(true);
  };
  
  // 处理端口模态框确认
  const handlePortModalOk = () => {
    portForm.validateFields().then(values => {
      console.log('端口配置确认:', values);
      
      // 使用我们自己的状态管理端口列表
      const newPorts = [...ports, values];
      setPorts(newPorts);
      
      // 直接更新表单值
      form.setFieldsValue({ ports: newPorts });
      
      // 强制重新渲染
      setTimeout(() => {
        // 尝试触发表单重新渲染
        const event = new Event('change', { bubbles: true });
        document.querySelectorAll('input[name^="ports"]').forEach(input => {
          input.dispatchEvent(event);
        });
        
        console.log('已更新端口列表:', newPorts);
      }, 0);
      
      // 关闭模态框
      setPortModalVisible(false);
      
      // 清空表单
      portForm.resetFields();
      
      message.success('端口配置已添加');
    });
  };
  
  // 处理端口模态框取消
  const handlePortModalCancel = () => {
    setPortModalVisible(false);
    portForm.resetFields();
  };
  
  // 渲染端口配置模态框
  const renderPortModal = () => (
    <Modal
      title="配置端口"
      open={portModalVisible}
      onOk={handlePortModalOk}
      onCancel={handlePortModalCancel}
      destroyOnClose={true}
    >
      <Form
        form={portForm}
        layout="vertical"
        initialValues={currentEditingPort}
      >
        <Form.Item
          name="protocol"
          label="协议"
          rules={[{ required: true, message: '请选择协议' }]}
        >
          <Select>
            <Option value="TCP">TCP</Option>
            <Option value="UDP">UDP</Option>
          </Select>
        </Form.Item>
        
        <Form.Item
          name="name"
          label="名称"
          rules={[{ required: true, message: '请输入端口名称' }]}
        >
          <Input placeholder="例如: http-port" />
        </Form.Item>
        
        <Form.Item
          name="containerPort"
          label="容器端口"
          rules={[{ required: true, message: '请输入容器端口' }]}
        >
          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );

  // 渲染仓库选择
  const renderRegistrySelect = () => (
    <Form.Item
      name="registryId"
      label="镜像仓库"
      rules={[{ required: true, message: '请选择镜像仓库' }]}
    >
      <Select
        placeholder="选择镜像仓库"
        onChange={handleRegistryChange}
        loading={loading}
        disabled={loading}
      >
        <Option value="public">Docker Hub公共仓库</Option>
        {registries.map(registry => (
          <Option key={registry.id} value={registry.id}>
            {registry.name} ({registry.url}) {registry.type !== 'docker' && <Tag color="blue">私有</Tag>}
          </Option>
        ))}
      </Select>
    </Form.Item>
  );

  // 渲染项目选择
  const renderProjectSelect = () => (
    <Form.Item
      name="project"
      label="项目/命名空间"
      rules={[{ required: selectedRegistry && selectedRegistry.id !== 'public', message: '请选择项目' }]}
    >
      <Select
        placeholder="选择项目"
        onChange={handleProjectChange}
        loading={loadingProjects}
        disabled={!selectedRegistry || loadingProjects}
        allowClear
        showSearch
      >
        {projects.map(project => (
          <Option key={project} value={project}>
            {project}
          </Option>
        ))}
      </Select>
    </Form.Item>
  );

  // 渲染仓库选择
  const renderRepositorySelect = () => (
    <Form.Item
      name="repository"
      label="镜像名称"
      rules={[{ required: true, message: '请选择镜像' }]}
    >
      <Select
        placeholder="选择镜像"
        onChange={handleRepositoryChange}
        loading={loadingRepositories}
        disabled={(!selectedRegistry && !selectedProject) || loadingRepositories}
        allowClear
        showSearch
        optionLabelProp="label"
      >
        {repositories.map(repo => {
          // 从完整路径中提取镜像名称，通常是最后一部分
          const imageName = repo.includes('/') ? repo.split('/').pop() : repo;
          return (
            <Option 
              key={repo} 
              value={repo} 
              label={imageName}
            >
              <div className="repo-option">
                <span className="repo-name">{imageName}</span>
                {imageName !== repo && (
                  <span className="repo-path" style={{color: '#999', fontSize: '12px'}}>{repo}</span>
                )}
              </div>
            </Option>
          );
        })}
      </Select>
    </Form.Item>
  );

  // 渲染标签选择
  const renderTagSelect = () => (
    <Form.Item
      name="tag"
      label="镜像标签"
      rules={[{ required: true, message: '请选择标签' }]}
    >
      <Select
        placeholder="选择标签"
        onChange={handleTagChange}
        loading={loadingTags}
        disabled={!selectedRepository || loadingTags}
        allowClear
        showSearch
      >
        {tags.map(tag => (
          <Option key={tag} value={tag}>
            {tag}
          </Option>
        ))}
      </Select>
    </Form.Item>
  );

  // 容器类型选择，改为受控模式
  const renderContainerTypeSelect = () => (
    <Form.Item
      label="容器类型"
      required
    >
      <Select
        value={containerType}
        style={{ width: '100%' }}
        onChange={(value) => {
          // 更新状态
          setContainerType(value);
          
          // 更新表单值
          form.setFieldsValue({
            configs: {
              ...(form.getFieldValue('configs') || {}),
              containerType: value
            }
          });
        }}
      >
        <Option value={CONTAINER_TYPES.WORK}>工作容器</Option>
        <Option value={CONTAINER_TYPES.INIT}>初始化容器</Option>
      </Select>
      
      {/* 隐藏字段，用于表单提交 */}
      <Form.Item 
        name={['configs', 'containerType']} 
        initialValue={CONTAINER_TYPES.WORK}
        style={{ display: 'none' }}
      >
        <Input />
      </Form.Item>
    </Form.Item>
  );

  // 修改Select组件，优化镜像拉取策略的显示
  const renderImagePullPolicySelect = () => (
    <Form.Item
      name="imagePullPolicy"
      label="镜像拉取策略"
      initialValue="IfNotPresent"
      tooltip={{ title: '定义Kubernetes如何获取容器镜像', icon: <InfoCircleOutlined /> }}
    >
      <Select 
        className="policy-select"
        style={{ width: '100%' }}
        optionLabelProp="label"
      >
        <Select.Option value="IfNotPresent" label="优先使用本地镜像">
          <div style={{ fontWeight: 'normal' }}>优先使用本地镜像（IfNotPresent）</div>
          <div className="policy-description" style={{ fontSize: 12, color: '#666' }}>
            如果本地存在，则使用本地镜像，否则从仓库拉取
          </div>
        </Select.Option>
        <Select.Option value="Always" label="每次都拉取镜像">
          <div style={{ fontWeight: 'normal' }}>每次都拉取镜像（Always）</div>
          <div className="policy-description" style={{ fontSize: 12, color: '#666' }}>
            始终从仓库获取最新版本的镜像，确保使用最新版本
          </div>
        </Select.Option>
        <Select.Option value="Never" label="仅使用本地镜像">
          <div style={{ fontWeight: 'normal' }}>仅使用本地镜像（Never）</div>
          <div className="policy-description" style={{ fontSize: 12, color: '#666' }}>
            只使用本地镜像，如果本地不存在则部署失败
          </div>
        </Select.Option>
      </Select>
    </Form.Item>
  );

  // 在组件定义中添加状态初始化和检查
  useEffect(() => {
    // 检查和修复镜像地址
    const checkAndFixImage = () => {
      try {
        const formValues = form.getFieldsValue();
        const configs = formValues.configs || {};
        
        // 清除"请填写镜像地址"提示
        const removeImageAddressTips = () => {
          try {
            // 查找并移除所有提示"请填写镜像地址"的元素
            const tips = document.querySelectorAll('.ant-form-item-explain-error');
            tips.forEach(tip => {
              if (tip.textContent.includes('请填写镜像地址') && tip.parentNode) {
                tip.parentNode.removeChild(tip);
              }
            });
            
            // 移除输入框的红色边框
            const inputElements = document.querySelectorAll('#image-input-container input');
            inputElements.forEach(input => {
              input.style.borderColor = '';
            });
          } catch (e) {
            console.error('移除镜像地址提示失败:', e);
          }
        };
        
        // 立即执行一次清除
        removeImageAddressTips();
        
        // 从initialValues或现有值中获取镜像地址
        const initImage = initialValues.imageName || 
                         initialValues.image || 
                         initialValues.imageURL ||
                         configs.imageName ||
                         configs.image ||
                         configs.imageURL ||
                         '';
        
        if (initImage) {
          console.log('设置镜像地址:', initImage);
          setImageValue(initImage);
          
          setTimeout(() => {
            try {
              // 双重保险：既设置顶层字段，也设置configs嵌套字段
              form.setFieldsValue({
                imageName: initImage,
                image: initImage, 
                imageURL: initImage,
                configs: {
                  ...(configs || {}),
                  imageName: initImage,
                  image: initImage,
                  imageURL: initImage,
                  registryType: registryType || 'dockerhub'
                }
              });
              
              // 手动重置表单字段状态，确保没有验证错误
              form.setFields([
                { name: 'imageName', value: initImage, errors: [] },
                { name: 'image', value: initImage, errors: [] },
                { name: 'imageURL', value: initImage, errors: [] },
                { name: ['configs', 'imageName'], value: initImage, errors: [] },
                { name: ['configs', 'image'], value: initImage, errors: [] },
                { name: ['configs', 'imageURL'], value: initImage, errors: [] }
              ]);
              
              console.log('成功初始化镜像地址到表单:', initImage);
            } catch (e) {
              console.error('设置初始镜像时出错:', e);
            }
            
            // 再次执行清除
            removeImageAddressTips();
          }, 100);
        }
        
        // 添加定期检查机制，移除"请填写镜像地址"提示
        const intervalId = setInterval(removeImageAddressTips, 500);
        
        return () => {
          clearInterval(intervalId);
        };
      } catch (e) {
        console.error('检查镜像地址时出错:', e);
      }
    };
    
    // 组件挂载和更新时都检查
    checkAndFixImage();
    
    // 移除有问题的表单回调监听代码
    
  }, [form, initialValues, registryType, imageValue]);

  // 添加一个useEffect用于监听表单值变化
  useEffect(() => {
    // 监听表单值变化，同步镜像字段
    const updateImageFields = () => {
      const values = form.getFieldsValue();
      
      // 从各个可能的字段中获取镜像地址
      const imageName = values.imageName || 
                         values.image || 
                         values.imageURL || 
                         (values.configs && (values.configs.imageName || values.configs.image || values.configs.imageURL)) || 
                         imageValue;
      
      if (imageName && imageName.trim() !== '' && imageName !== imageValue) {
        // 设置状态变量
        setImageValue(imageName);
        
        // 同步到表单的多个字段
        form.setFieldsValue({
          imageName,
          image: imageName,
          imageURL: imageName,
          configs: {
            ...(values.configs || {}),
            imageName,
            image: imageName,
            imageURL: imageName
          }
        });
      }
    };
    
    // 创建一个定时器定期检查和同步表单值
    const timerId = setInterval(updateImageFields, 1000);
    
    // 添加事件监听，在输入时触发同步
    const handleInput = (event) => {
      if (event.target.id.includes('image') || 
          event.target.name?.includes('image') || 
          event.target.className?.includes('image-input-field')) {
        updateImageFields();
      }
    };
    
    document.addEventListener('input', handleInput);
    
    return () => {
      clearInterval(timerId);
      document.removeEventListener('input', handleInput);
    };
  }, [form, imageValue]);

  // 初始化容器配置
  useEffect(() => {
    // 确保容器名称初始化
    const ensureContainerName = () => {
      try {
        const formValues = form.getFieldsValue();
        const configs = formValues.configs || {};
        let containerNameValue = configs.containerName;
        
        // 检查容器名称是否存在，如果不存在则生成一个
        if (!containerNameValue) {
          containerNameValue = initialValues.containerName || 
                               (initialValues.configs && initialValues.configs.containerName) || 
                               generateContainerName();
          
          console.log('初始化容器名称:', containerNameValue);
          setContainerName(containerNameValue);
          
          // 更新表单值
          form.setFieldsValue({
            configs: {
              ...configs,
              containerName: containerNameValue
            }
          });
          
          // 更新表单状态
          form.setFields([
            { name: ['configs', 'containerName'], value: containerNameValue, errors: [] }
          ]);
        }
      } catch (e) {
        console.error('初始化容器名称失败:', e);
      }
    };
    
    // 延迟执行，确保表单已完成初始化
    setTimeout(ensureContainerName, 300);
    
    // 清除所有容器名称相关的错误提示
    const clearContainerNameErrors = () => {
      try {
        const errorTips = document.querySelectorAll('.ant-form-item-explain-error');
        errorTips.forEach(tip => {
          if (tip.textContent.includes('请填写容器名称') && tip.parentNode) {
            tip.parentNode.removeChild(tip);
          }
        });
      } catch (e) {
        console.error('清除容器名称错误提示失败:', e);
      }
    };
    
    // 立即执行一次清除
    clearContainerNameErrors();
    
    // 定期执行清除操作
    const intervalId = setInterval(clearContainerNameErrors, 1000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [form, initialValues]);

  return (
    <Spin spinning={loading} tip="加载中...">
      <Card className="container-config">
        <div className="image-config-section">
          <Title level={4}>镜像配置</Title>
          <Form form={form}>
            <Form.Item
              label="镜像地址"
              className="image-config-section"
              style={{ marginBottom: '24px' }}
              required
              rules={[]}
              validateStatus="success" // 始终保持成功状态
            >
              <Row gutter={8}>
                <Col span={24}>
                  <Form.Item 
                    name={['configs', 'registryType']} 
                    noStyle
                    initialValue="dockerhub"
                  >
                    <Select
                      style={{ width: '100%', marginBottom: '12px' }}
                      placeholder="选择镜像源类型"
                      onChange={(value) => {
                        // 重置并清除可能的错误
                        const imageContainer = document.querySelector('#image-input-container');
                        if (imageContainer) {
                          imageContainer.classList.remove('ant-form-item-has-error');
                          const errorMsg = imageContainer.querySelector('.ant-form-item-explain-error');
                          if (errorMsg && errorMsg.parentNode) {
                            errorMsg.parentNode.removeChild(errorMsg);
                          }
                        }
                        
                        setRegistryType(value);
                        
                        // 清除所有镜像地址错误弹窗
                        const errorAlerts = document.querySelectorAll('.ant-alert-error');
                        errorAlerts.forEach(alert => {
                          if (alert.textContent.includes('镜像地址') && alert.parentNode) {
                            const closeBtn = alert.querySelector('.ant-alert-close-icon');
                            if (closeBtn) {
                              closeBtn.click();
                            } else if (alert.parentNode) {
                              alert.parentNode.removeChild(alert);
                            }
                          }
                        });
                      }}
                    >
                      <Option value="dockerhub">DockerHub官方镜像</Option>
                      <Option value="private">私有仓库镜像</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={24} style={{ marginTop: '8px' }}>
                  {/* 使用更简洁的表单结构，避免嵌套 */}
                  <Input
                    id="image-input-field"
                    className="image-input-field"
                    placeholder={registryType === 'dockerhub' ? 
                      '例如：nginx:latest 或 username/repo:tag' : 
                      '例如：registry.example.com/username/repo:tag'}
                    value={imageValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setImageValue(value);
                      
                      // 同时更新多个字段，确保数据一致性
                      form.setFieldsValue({
                        imageName: value,
                        image: value,
                        imageURL: value,
                        configs: {
                          ...(form.getFieldValue('configs') || {}),
                          imageName: value,
                          image: value,
                          imageURL: value
                        }
                      });
                      
                      // 清除错误提示
                      const errorTips = document.querySelectorAll('.ant-form-item-explain-error');
                      errorTips.forEach(tip => {
                        if (tip.textContent.includes('请填写镜像地址') && tip.parentNode) {
                          tip.parentNode.removeChild(tip);
                        }
                      });
                      
                      // 移除红框
                      e.target.style.borderColor = '';
                      
                      console.log('已设置镜像地址:', value);
                    }}
                    style={{ width: '100%' }}
                  />
                  <div className="form-item-help-text" style={{ marginTop: '4px', color: '#888', fontSize: '12px' }}>
                    {registryType === 'dockerhub' ? 
                      '输入DockerHub上的镜像名称和标签，例如：nginx:latest' : 
                      '输入完整的私有仓库镜像地址，包括域名和标签'}
                  </div>
                  
                  {/* 添加隐藏表单字段，确保数据能正确提交 */}
                  <Form.Item name="imageName" hidden={true} />
                  <Form.Item name="image" hidden={true} />
                  <Form.Item name="imageURL" hidden={true} />
                  <Form.Item name={['configs', 'imageName']} hidden={true} />
                  <Form.Item name={['configs', 'image']} hidden={true} />
                  <Form.Item name={['configs', 'imageURL']} hidden={true} />
                </Col>
              </Row>
            </Form.Item>
            
            {renderImagePullPolicySelect()}
          </Form>
        </div>
        
        <Divider />
        
        <div className="container-settings-section">
          <Title level={4}>容器设置</Title>
          
          {renderContainerNameInput()}
          
          {renderContainerTypeSelect()}
          
          <Form.Item
            label="端口配置"
            required
          >
            <div className="port-config">
              {ports.length > 0 ? (
                ports.map((port, index) => (
                  <div key={`port-${index}`} className="port-item">
                    <Row gutter={8} align="middle" style={{ flexWrap: 'nowrap' }}>
                      <Col style={{ width: 100 }}>
                        <div className="port-field-label">协议</div>
                        <Form.Item
                          name={['ports', index, 'protocol']}
                          initialValue={port.protocol || "TCP"}
                          style={{ marginBottom: 0 }}
                          preserve={true}
                        >
                          <Select 
                            style={{ width: '100%' }}
                            dropdownMatchSelectWidth={false}
                            defaultValue={port.protocol || "TCP"}
                            onChange={(value) => {
                              const updatedPorts = [...ports];
                              updatedPorts[index].protocol = value;
                              setPorts(updatedPorts);
                              form.setFieldsValue({ ports: updatedPorts });
                            }}
                          >
                            <Option value="TCP">TCP</Option>
                            <Option value="UDP">UDP</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col style={{ width: 150 }}>
                        <div className="port-field-label">名称</div>
                        <Form.Item
                          name={['ports', index, 'name']}
                          initialValue={port.name}
                          rules={[{ required: true, message: '请输入端口名称' }]}
                          style={{ marginBottom: 0 }}
                          preserve={true}
                        >
                          <Input 
                            placeholder="tcp-8080"
                            defaultValue={port.name}
                            onChange={(e) => {
                              const updatedPorts = [...ports];
                              updatedPorts[index].name = e.target.value;
                              setPorts(updatedPorts);
                              form.setFieldsValue({ ports: updatedPorts });
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col style={{ width: 150 }}>
                        <div className="port-field-label">容器端口</div>
                        <Form.Item
                          name={['ports', index, 'containerPort']}
                          initialValue={port.containerPort}
                          rules={[{ required: true, message: '请输入容器端口' }]}
                          style={{ marginBottom: 0 }}
                          preserve={true}
                        >
                          <InputNumber 
                            placeholder="8080" 
                            min={1} 
                            max={65535} 
                            defaultValue={port.containerPort}
                            style={{ width: '100%' }}
                            onChange={(value) => {
                              const updatedPorts = [...ports];
                              updatedPorts[index].containerPort = value;
                              setPorts(updatedPorts);
                              form.setFieldsValue({ ports: updatedPorts });
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col flex="auto"></Col>
                      <Col>
                        <Button 
                          type="text" 
                          icon={<DeleteOutlined />} 
                          onClick={() => {
                            // 删除指定索引的端口
                            const updatedPorts = [...ports];
                            updatedPorts.splice(index, 1);
                            setPorts(updatedPorts);
                            
                            // 更新表单值
                            form.setFieldsValue({ ports: updatedPorts });
                          }}
                        />
                      </Col>
                    </Row>
                  </div>
                ))
              ) : (
                <Alert
                  message="未配置端口"
                  description="点击下方按钮添加端口配置"
                  type="info"
                  showIcon
                  style={{ marginBottom: 10 }}
                />
              )}
              <Button
                type="dashed"
                onClick={openPortModal}
                style={{ width: '100%', marginTop: 8 }}
                icon={<PlusOutlined />}
                className="add-port-button"
              >
                添加端口
              </Button>
            </div>
          </Form.Item>
        </div>
      </Card>
      {renderPortModal()}
    </Spin>
  );
};

export default ContainerConfig; 
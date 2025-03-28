import React, { useState, useEffect } from 'react';
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
  Tag
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
    async function loadData() {
      try {
        // 获取注册的镜像仓库
        const registryData = await apiService.getImageRegistries();
        setRegistries(registryData);

        // 如果有初始值，尝试设置选中的仓库和项目
        if (initialValues.image && initialValues.registryId) {
          const registry = registryData.find(r => r.id === initialValues.registryId);
          if (registry) {
            setSelectedRegistry(registry);
            await fetchProjects(registry.id);
            
            // 分析镜像格式以设置项目和标签
            const imageParts = initialValues.image.split('/');
            if (imageParts.length > 1) {
              const project = imageParts[0];
              setSelectedProject(project);
              
              // 加载该项目下的仓库
              await fetchRepositories(registry.id, project);
              
              const repoAndTag = imageParts[1].split(':');
              const repo = repoAndTag[0];
              setSelectedRepository(repo);
              
              // 加载该仓库的标签
              if (repoAndTag.length > 1) {
                await fetchTags(registry.id, `${project}/${repo}`);
                setSelectedTag(repoAndTag[1]);
              }
            }
          }
        }
      } catch (error) {
        message.error('加载镜像仓库数据失败');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [initialValues]);

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

  // 生成新的容器名称
  const handleGenerateContainerName = () => {
    const newName = generateContainerName();
    form.setFieldsValue({ containerName: newName });
    
    // 触发表单值变化，确保表单值被更新
    const formValues = form.getFieldsValue();
    form.setFieldsValue({
      ...formValues,
      containerName: newName
    });
    
    // 手动触发表单验证，确保值被提交
    form.validateFields(['containerName'])
      .then(() => {
        console.log('容器名称已更新:', newName);
      })
      .catch(err => {
        console.error('容器名称验证失败:', err);
      });
  };

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

  // 直接输入镜像
  const renderDirectImageInput = () => {
    const isDockerHub = !selectedRegistry || selectedRegistry.id === 'public';
    
    return (
      <Form.Item
        name="imageName"
        label="镜像地址"
        rules={[{ required: true, message: '请输入镜像地址' }]}
        extra={isDockerHub ? "使用Docker Hub公共仓库时直接输入镜像名称，例如: nginx:latest, ubuntu:20.04" : undefined}
      >
        <Input 
          placeholder={isDockerHub ? "输入Docker Hub镜像，例如: nginx:latest, mysql:8" : "例如: harbor.example.com/project/nginx:1.19"} 
          onChange={(e) => {
            // 更新表单值，确保数据被正确传递
            const value = e.target.value;
            form.setFieldsValue({ imageName: value });
            
            // 手动触发表单验证，确保值被提交
            form.validateFields(['imageName'])
              .then(() => {
                console.log('镜像地址已更新:', value);
              })
              .catch(err => {
                // 只在控制台输出错误，不向用户显示
                console.error('镜像地址验证失败:', err);
              });
          }}
        />
      </Form.Item>
    );
  };

  // 容器名称输入
  const renderContainerNameInput = () => (
    <Form.Item
      name="containerName"
      label="容器名称"
      rules={[{ required: true, message: '请输入容器名称' }]}
      extra="容器名称必须由小写字母、数字和-组成"
    >
      <Input 
        placeholder="容器名称"
        onChange={(e) => {
          // 更新表单值，确保数据被正确传递
          const value = e.target.value;
          form.setFieldsValue({ containerName: value });
          
          // 手动触发表单验证，确保值被提交
          form.validateFields(['containerName'])
            .then(() => {
              console.log('容器名称已更新:', value);
            })
            .catch(err => {
              // 只在控制台输出错误，不向用户显示
              console.error('容器名称验证失败:', err);
            });
        }}
        addonAfter={
          <Button
            type="link"
            onClick={handleGenerateContainerName}
            style={{ padding: 0 }}
          >
            随机生成
          </Button>
        }
      />
    </Form.Item>
  );

  // 容器类型选择
  const renderContainerTypeSelect = () => (
    <Form.Item
      name="type"
      label="容器类型"
      rules={[{ required: true, message: '请选择容器类型' }]}
      initialValue={CONTAINER_TYPES.WORK}
    >
      <Select
        value={containerType}
        onChange={handleContainerTypeChange}
      >
        <Option value={CONTAINER_TYPES.WORK}>工作容器</Option>
        <Option value={CONTAINER_TYPES.INIT}>初始化容器</Option>
      </Select>
    </Form.Item>
  );

  return (
    <div className="container-config">
      <Card title="容器配置" className="container-config-card">
        <Form 
          form={form} 
          layout="vertical" 
          requiredMark="optional"
        >
          {renderContainerNameInput()}
          {renderContainerTypeSelect()}
          
          <Divider orientation="left">镜像选择</Divider>
          
          {renderRegistrySelect()}
          
          {selectedRegistry && selectedRegistry.id !== 'public' && (
            <>
              {renderProjectSelect()}
              {renderRepositorySelect()}
              {renderTagSelect()}
            </>
          )}
          
          {(!selectedRegistry || selectedRegistry.id === 'public') && renderDirectImageInput()}
          
          <Divider orientation="left">端口设置 (可选)</Divider>
          
          <Form.Item
            name="containerPort"
            label="容器端口"
          >
            <Input 
              placeholder="例如: 8080" 
              onChange={(e) => {
                const value = e.target.value;
                // 确保保存为字符串类型的值
                form.setFieldsValue({ containerPort: String(value) });
                console.log('容器端口已更新:', value);
              }}
            />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ContainerConfig; 
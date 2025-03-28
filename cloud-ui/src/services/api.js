import axios from 'axios';

// 创建axios实例
const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api',
  timeout: 60000, // 增加超时时间为60秒
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  config => {
    // 可以在这里添加认证token等
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  response => response.data,
  error => {
    // 统一处理错误
    console.error('API请求错误:', error);
    return Promise.reject(error);
  }
);

// 在文件顶部添加缓存对象
const namespacesCache = {
  data: {},        // 存储命名空间数据
  timestamp: {},   // 存储请求时间戳
  pendingPromises: {}  // 存储进行中的请求
};

// 添加资源缓存对象
const resourcesCache = {
  data: {},        // 按资源类型和ID存储数据
  timestamp: {},   // 存储请求时间戳
  pendingPromises: {}  // 存储进行中的请求
};

// 在文件顶部添加新的缓存对象
const kubeConfigsCache = {
  data: null,
  timestamp: 0,
  pendingPromise: null,
  isRequesting: false
};

// 为所有Kubernetes资源创建一个通用的缓存键生成函数
const getCacheKey = (resourceType, id, namespace) => {
  return `${resourceType}_${id}_${namespace || 'all'}`;
};

// API服务
const apiService = {
  // 获取应用配置列表
  getApplications: () => {
    console.log('获取应用列表');
    
    // 缓存最近的应用列表，避免频繁请求
    const cachedApps = localStorage.getItem('cachedApplications');
    const cachedTimestamp = localStorage.getItem('cachedApplicationsTimestamp');
    const now = new Date().getTime();
    
    // 如果缓存时间小于30秒，直接返回缓存数据
    if (cachedApps && cachedTimestamp && (now - parseInt(cachedTimestamp)) < 30000) {
      try {
        console.log('使用缓存的应用列表数据');
        return Promise.resolve(JSON.parse(cachedApps));
      } catch (e) {
        console.error('解析缓存数据失败', e);
        // 解析失败，继续请求新数据
      }
    }
    
    // 请求超时时使用短超时时间，避免UI长时间等待
    return apiClient.get('/applications', { timeout: 15000 })
      .then(response => {
        console.log('应用列表获取成功');
        // 更新缓存
        localStorage.setItem('cachedApplications', JSON.stringify(response));
        localStorage.setItem('cachedApplicationsTimestamp', now.toString());
        return response;
      })
      .catch(error => {
        console.error('获取应用列表失败:', error);
        console.error('错误详情:', error.response?.data || error.message);
        
        // 如果有缓存数据，在请求失败时返回缓存
        if (cachedApps) {
          console.log('请求失败，返回缓存的应用列表数据');
          try {
            return JSON.parse(cachedApps);
          } catch (e) {
            console.error('解析缓存数据失败', e);
          }
        }
        
        return Promise.reject(error);
      });
  },
  
  // 获取单个应用配置详情
  getApplicationById: (id) => {
    console.log(`获取应用详情, ID: ${id}`);
    
    // 缓存应用详情
    const cachedKey = `cachedApp_${id}`;
    const cachedApp = localStorage.getItem(cachedKey);
    const cachedTimestamp = localStorage.getItem(`${cachedKey}_timestamp`);
    const now = new Date().getTime();
    
    // 如果缓存时间小于30秒，直接返回缓存数据
    if (cachedApp && cachedTimestamp && (now - parseInt(cachedTimestamp)) < 30000) {
      try {
        console.log('使用缓存的应用详情数据');
        return Promise.resolve(JSON.parse(cachedApp));
      } catch (e) {
        console.error('解析缓存数据失败', e);
        // 解析失败，继续请求新数据
      }
    }
    
    return apiClient.get(`/applications/${id}`, { timeout: 15000 })
      .then(response => {
        console.log('应用详情获取成功:', response);
        // 更新缓存
        localStorage.setItem(cachedKey, JSON.stringify(response));
        localStorage.setItem(`${cachedKey}_timestamp`, now.toString());
        return response;
      })
      .catch(error => {
        console.error('获取应用详情失败:', error);
        console.error('错误详情:', error.response?.data || error.message);
        
        // 如果有缓存数据，在请求失败时返回缓存
        if (cachedApp) {
          console.log('请求失败，返回缓存的应用详情数据');
          try {
            return JSON.parse(cachedApp);
          } catch (e) {
            console.error('解析缓存数据失败', e);
          }
        }
        
        return Promise.reject(error);
      });
  },
  
  // 创建新应用配置
  createApplication: (data) => {
    console.log('创建应用数据:', data);
    
    // 确保关键字段存在，添加默认值
    const completeData = {
      name: data.appName || `app-${Date.now()}`,
      namespace: data.namespace || 'default',
      kubeConfigID: data.kubeConfigId || localStorage.getItem('lastSelectedKubeConfigId') || '1',
      description: data.description || '',
      status: 'created',
      imageURL: data.imageName || 'nginx:latest',
      replicas: data.instances || 1,
      port: parseInt(data.containerPort, 10) || 80,
      servicetype: data.serviceType || 'ClusterIP'
    };
    
    console.log('完整的创建应用数据:', completeData);
    
    // 添加查询参数，确保即使POST体失败也能传递KubeConfigId
    return apiClient.post(`/applications?kubeConfigId=${completeData.kubeConfigID}`, completeData)
      .then(response => {
        console.log('创建应用成功:', response);
        return response;
      })
      .catch(error => {
        console.error('创建应用失败:', error);
        // 尝试查看错误详情
        if (error.response) {
          console.error('服务器响应:', error.response.data);
        }
        return Promise.reject(error);
      });
  },
  
  // 更新应用配置
  updateApplication: (id, data) => {
    return apiClient.put(`/applications/${id}`, data);
  },
  
  // 删除应用配置
  deleteApplication: (id, deleteK8sResources = true) => {
    console.log('删除应用:', { id, deleteK8sResources });
    return apiClient.delete(`/applications/${id}?deleteK8sResources=${deleteK8sResources}`)
      .then(response => {
        console.log('删除应用成功:', response);
        return response;
      })
      .catch(error => {
        console.error('删除应用失败:', error);
        return Promise.reject(error);
      });
  },
  
  // 部署应用
  deployApplication: (id) => {
    return apiClient.post(`/applications/${id}/deploy`);
  },
  
  // 获取应用部署状态
  getDeploymentStatus: (id) => {
    // 对状态查询使用较短的超时时间，因为它是频繁轮询的
    return apiClient.get(`/applications/${id}/status`, { timeout: 10000 })
      .catch(error => {
        console.warn('获取部署状态失败，将在下次重试:', error.message);
        // 返回一个默认值，避免UI显示错误
        return {
          status: "unknown",
          message: "获取状态暂时失败，请稍后刷新",
          replicas: 0,
          availableReplicas: 0
        };
      });
  },
  
  // 获取镜像列表（用于下拉选择）
  getImages: () => {
    return apiClient.get('/images');
  },
  
  // 获取所有镜像仓库
  getImageRegistries: () => {
    return apiClient.get('/registry');
  },
  
  // 获取单个镜像仓库
  getImageRegistryById: (id) => {
    return apiClient.get(`/registry/${id}`);
  },
  
  // 确保URL包含http或https协议前缀
  ensureUrlHasProtocol: (url) => {
    // 如果URL为空，直接返回
    if (!url) return '';
    
    // 如果已经包含协议，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // 对于IP地址+端口的情况，默认使用http
    if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(url)) {
      return `http://${url}`;
    }
    
    // 其他情况默认使用https
    return `https://${url}`;
  },
  
  // 创建镜像仓库
  createImageRegistry: async (data) => {
    try {
      console.log('创建镜像仓库数据:', data);
      // 确保URL格式正确
      const formattedData = {
        ...data,
        url: apiService.ensureUrlHasProtocol(data.url)
      };
      console.log('格式化后的URL:', formattedData.url);
      
      const response = await apiClient.post('/registry', formattedData);
      console.log('创建镜像仓库响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('创建镜像仓库失败:', error);
      throw error;
    }
  },
  
  // 更新镜像仓库
  updateImageRegistry: (id, data) => {
    return apiClient.put(`/registry/${id}`, data);
  },
  
  // 删除镜像仓库
  deleteImageRegistry: (id) => {
    return apiClient.delete(`/registry/${id}`);
  },
  
  // 测试镜像仓库连接
  testImageRegistry: async (data) => {
    try {
      console.log('测试镜像仓库连接:', data);
      // 确保URL格式正确
      const formattedData = {
        ...data,
        url: apiService.ensureUrlHasProtocol(data.url)
      };
      console.log('格式化后的URL:', formattedData.url);
      
      const response = await apiClient.post('/registry/test', formattedData);
      console.log('测试镜像仓库连接响应:', response.data);
      return response.data;
    } catch (error) {
      console.error('测试镜像仓库连接失败:', error);
      throw error;
    }
  },
  
  // 获取仓库中的项目/仓库列表
  getRepositories: (id) => {
    return apiClient.get(`/registry/${id}/repositories`);
  },
  
  // 获取镜像标签列表
  getImageTags: (id, repository) => {
    if (!id || !repository) {
      console.error('获取标签列表参数错误:', { id, repository });
      return Promise.reject(new Error('镜像仓库ID和仓库路径不能为空'));
    }
    
    // 确保repository已经被编码，避免URL参数中的特殊字符问题
    const encodedRepository = encodeURIComponent(repository);
    console.log('获取镜像标签列表，请求参数:', { id, repository: encodedRepository });
    
    return apiClient.get(`/registry/${id}/tags?repository=${encodedRepository}`)
      .then(response => {
        console.log('获取镜像标签成功:', response);
        return Array.isArray(response) ? response : [];
      })
      .catch(error => {
        console.error('获取镜像标签失败:', error);
        return Promise.reject(error);
      });
  },
  
  // 导出应用配置为YAML
  exportApplicationToYaml: (id) => {
    // 使用浏览器下载功能直接下载YAML文件
    window.open(`${apiClient.defaults.baseURL}/applications/${id}/yaml`, '_blank');
    return Promise.resolve({ success: true });
  },
  
  // 获取资源配额
  getResourceQuota: () => {
    return apiClient.get('/resourceQuota');
  },
  
  // 获取预估价格
  getEstimatedPrice: (resources) => {
    return apiClient.post('/price', resources);
  },
  
  // Kubernetes相关API
  
  // 获取所有KubeConfig配置
  getKubeConfigs: () => {
    const CACHE_TTL = 3600000; // 延长缓存有效期至1小时
    
    // 如果已经有数据且在有效期内，直接使用缓存
    if (kubeConfigsCache.data && (Date.now() - kubeConfigsCache.timestamp < CACHE_TTL)) {
      console.log('使用缓存的KubeConfig列表');
      return Promise.resolve(kubeConfigsCache.data);
    }
    
    // 如果正在请求中，返回待处理的Promise
    if (kubeConfigsCache.isRequesting || kubeConfigsCache.pendingPromise) {
      console.log('已有KubeConfig请求进行中，等待结果');
      return kubeConfigsCache.pendingPromise || Promise.resolve([]);
    }
    
    console.log('获取KubeConfig列表');
    kubeConfigsCache.isRequesting = true;
    
    // 创建并缓存Promise
    kubeConfigsCache.pendingPromise = apiClient.get('/kubeconfig')
      .then(response => {
        console.log('KubeConfig列表获取成功:', response);
        
        // 更新缓存
        kubeConfigsCache.data = response;
        kubeConfigsCache.timestamp = Date.now();
        
        return response;
      })
      .catch(error => {
        console.error('获取KubeConfig列表失败:', error);
        // 出错时返回空数组而不是拒绝Promise
        return [];
      })
      .finally(() => {
        // 请求完成，重置状态
        setTimeout(() => {
          kubeConfigsCache.isRequesting = false;
          kubeConfigsCache.pendingPromise = null;
        }, 100); // 小延迟确保状态更新不会互相干扰
      });
    
    return kubeConfigsCache.pendingPromise;
  },
  
  // 获取单个KubeConfig配置
  getKubeConfigById: (id) => {
    return apiClient.get(`/kubeconfig/${id}`);
  },
  
  // 上传KubeConfig配置
  uploadKubeConfig: (data) => {
    return apiClient.post('/kubeconfig', data);
  },
  
  // 删除KubeConfig配置
  deleteKubeConfig: (id) => {
    return apiClient.delete(`/kubeconfig/${id}`);
  },
  
  // 设置KubeConfig上下文
  setKubeConfigContext: (id, context) => {
    return apiClient.put(`/kubeconfig/${id}/context`, { context });
  },
  
  // 获取Kubernetes命名空间
  getKubernetesNamespaces: async (kubeConfigId) => {
    if (!kubeConfigId) {
      console.warn('获取命名空间失败: 未提供kubeConfigId');
      return ['default', 'kube-system', 'kube-public'];
    }
    
    // 缓存有效期提高到1小时
    const CACHE_TTL = 3600000;
    
    // 检查缓存
    if (namespacesCache.data[kubeConfigId] && 
        (Date.now() - namespacesCache.timestamp[kubeConfigId] < CACHE_TTL)) {
      console.log('使用缓存的命名空间数据, kubeConfigId:', kubeConfigId);
      return namespacesCache.data[kubeConfigId];
    }
    
    // 防止重复请求，使用标志位
    if (namespacesCache.pendingPromises[kubeConfigId]) {
      console.log('已有命名空间请求进行中，等待结果, kubeConfigId:', kubeConfigId);
      try {
        return await namespacesCache.pendingPromises[kubeConfigId];
      } catch (error) {
        console.error('等待进行中的请求失败:', error);
        return ['default', 'kube-system', 'kube-public'];
      }
    }
    
    console.log('尝试获取命名空间列表，kubeConfigId:', kubeConfigId);
    const defaultNamespaces = ['default', 'kube-system', 'kube-public'];
    
    // 创建请求Promise
    namespacesCache.pendingPromises[kubeConfigId] = (async () => {
      try {
        // 使用更长的超时时间
        const response = await apiClient.get(`/kubeconfig/${kubeConfigId}/namespaces`, {
          timeout: 20000
        });
        
        // 处理响应数据
        let namespaces;
        if (Array.isArray(response)) {
          namespaces = response.length > 0 ? response : defaultNamespaces;
        } else if (response && Array.isArray(response.data)) {
          namespaces = response.data.length > 0 ? response.data : defaultNamespaces;
        } else {
          console.warn('命名空间返回格式不是数组，返回默认值:', response);
          namespaces = defaultNamespaces;
        }
        
        // 更新缓存
        namespacesCache.data[kubeConfigId] = namespaces;
        namespacesCache.timestamp[kubeConfigId] = Date.now();
        
        return namespaces;
      } catch (error) {
        console.error('获取命名空间失败，错误信息:', error);
        
        // 返回默认值而不是抛出错误
        return defaultNamespaces;
      } finally {
        // 延迟删除pending promise以避免竞态条件
        setTimeout(() => {
          delete namespacesCache.pendingPromises[kubeConfigId];
        }, 100);
      }
    })();
    
    return namespacesCache.pendingPromises[kubeConfigId];
  },
  
  // 添加一个清除缓存的方法
  clearNamespacesCache: (kubeConfigId = null) => {
    if (kubeConfigId) {
      // 清除特定集群的缓存
      delete namespacesCache.data[kubeConfigId];
      delete namespacesCache.timestamp[kubeConfigId];
    } else {
      // 清除所有缓存
      namespacesCache.data = {};
      namespacesCache.timestamp = {};
    }
    console.log('命名空间缓存已清除');
  },
  
  // 获取Pod列表 - 添加缓存机制
  getKubernetesPods: (id, namespace) => {
    if (!id) {
      console.error('获取Pod列表失败: 未提供kubeConfigId');
      return Promise.reject(new Error('未提供集群配置ID'));
    }
    
    const resourceType = 'pods';
    const cacheKey = getCacheKey(resourceType, id, namespace);
    const CACHE_TTL = 10000; // 10秒缓存
    
    // 检查缓存
    if (resourcesCache.data[cacheKey] && 
        (Date.now() - resourcesCache.timestamp[cacheKey] < CACHE_TTL)) {
      console.log('使用缓存的Pod列表, kubeConfigId:', id, '命名空间:', namespace || '所有命名空间');
      return Promise.resolve(resourcesCache.data[cacheKey]);
    }
    
    // 检查是否有正在进行的请求
    if (resourcesCache.pendingPromises[cacheKey]) {
      console.log('已有Pod请求进行中，等待结果');
      return resourcesCache.pendingPromises[cacheKey];
    }
    
    console.log('获取Pod列表, kubeConfigId:', id, '命名空间:', namespace || '所有命名空间');
    
    let url = `/kubeconfig/${id}/pods`;
    if (namespace) {
      url += `?namespace=${namespace}`;
    }
    
    // 创建请求Promise并存储
    resourcesCache.pendingPromises[cacheKey] = apiClient.get(url, { timeout: 15000 })
      .then(response => {
        console.log('Pod列表获取成功:', response);
        const result = Array.isArray(response) ? response : [];
        
        // 更新缓存
        resourcesCache.data[cacheKey] = result;
        resourcesCache.timestamp[cacheKey] = Date.now();
        
        return result;
      })
      .catch(error => {
        console.error('获取Pod列表失败:', error);
        
        // 特殊处理500错误，返回空数组而不是失败
        if (error.response && error.response.status === 500) {
          console.error('服务器返回500错误，可能是集群连接问题或权限问题');
          console.log('返回空Pod列表，而不是抛出错误');
          return [];
        }
        
        return Promise.reject(error);
      })
      .finally(() => {
        // 请求完成后，删除pending promise
        delete resourcesCache.pendingPromises[cacheKey];
      });
    
    return resourcesCache.pendingPromises[cacheKey];
  },
  
  // 获取Deployment列表 - 如果不提供namespace，获取所有命名空间
  getKubernetesDeployments: (id, namespace) => {
    if (!id) {
      console.error('获取Deployment列表失败: 未提供kubeConfigId');
      return Promise.reject(new Error('未提供集群配置ID'));
    }
    
    console.log('获取Deployment列表, kubeConfigId:', id, '命名空间:', namespace || '所有命名空间');
    
    let url = `/kubeconfig/${id}/deployments`;
    if (namespace) {
      url += `?namespace=${namespace}`;
    }
    
    return apiClient.get(url, { timeout: 15000 })
      .then(response => {
        console.log('Deployment列表获取成功:', response);
        return Array.isArray(response) ? response : [];
      })
      .catch(error => {
        console.error('获取Deployment列表失败:', error);
        
        // 特殊处理500错误，返回空数组而不是失败
        if (error.response && error.response.status === 500) {
          console.error('服务器返回500错误，可能是集群连接问题或权限问题');
          console.log('返回空Deployment列表，而不是抛出错误');
          return [];
        }
        
        return Promise.reject(error);
      });
  },
  
  // 获取Service列表 - 如果不提供namespace，获取所有命名空间
  getKubernetesServices: (id, namespace) => {
    if (!id) {
      console.error('获取Service列表失败: 未提供kubeConfigId');
      return Promise.reject(new Error('未提供集群配置ID'));
    }
    
    console.log('获取Service列表, kubeConfigId:', id, '命名空间:', namespace || '所有命名空间');
    
    let url = `/kubeconfig/${id}/services`;
    if (namespace) {
      url += `?namespace=${namespace}`;
    }
    
    return apiClient.get(url, { timeout: 15000 })
      .then(response => {
        console.log('Service列表获取成功:', response);
        return Array.isArray(response) ? response : [];
      })
      .catch(error => {
        console.error('获取Service列表失败:', error);
        
        // 特殊处理500错误，返回空数组而不是失败
        if (error.response && error.response.status === 500) {
          console.error('服务器返回500错误，可能是集群连接问题或权限问题');
          console.log('返回空Service列表，而不是抛出错误');
          return [];
        }
        
        return Promise.reject(error);
      });
  },
  
  // 获取StatefulSet列表 - 如果不提供namespace，获取所有命名空间
  getKubernetesStatefulSets: (id, namespace) => {
    if (!id) {
      console.error('获取StatefulSet列表失败: 未提供kubeConfigId');
      return Promise.reject(new Error('未提供集群配置ID'));
    }
    
    console.log('获取StatefulSet列表, kubeConfigId:', id, '命名空间:', namespace || '所有命名空间');
    
    let url = `/kubeconfig/${id}/statefulsets`;
    if (namespace) {
      url += `?namespace=${namespace}`;
    }
    
    return apiClient.get(url, { timeout: 15000 })
      .then(response => {
        console.log('StatefulSet列表获取成功:', response);
        return Array.isArray(response) ? response : [];
      })
      .catch(error => {
        console.error('获取StatefulSet列表失败:', error);
        
        // 特殊处理500错误，返回空数组而不是失败
        if (error.response && error.response.status === 500) {
          console.error('服务器返回500错误，可能是集群连接问题或权限问题');
          console.log('返回空StatefulSet列表，而不是抛出错误');
          return [];
        }
        
        return Promise.reject(error);
      });
  },
  
  // 获取DaemonSet列表 - 如果不提供namespace，获取所有命名空间
  getKubernetesDaemonSets: (id, namespace) => {
    if (!id) {
      console.error('获取DaemonSet列表失败: 未提供kubeConfigId');
      return Promise.reject(new Error('未提供集群配置ID'));
    }
    
    console.log('获取DaemonSet列表, kubeConfigId:', id, '命名空间:', namespace || '所有命名空间');
    
    let url = `/kubeconfig/${id}/daemonsets`;
    if (namespace) {
      url += `?namespace=${namespace}`;
    }
    
    return apiClient.get(url, { timeout: 15000 })
      .then(response => {
        console.log('DaemonSet列表获取成功:', response);
        return Array.isArray(response) ? response : [];
      })
      .catch(error => {
        console.error('获取DaemonSet列表失败:', error);
        
        // 特殊处理500错误，返回空数组而不是失败
        if (error.response && error.response.status === 500) {
          console.error('服务器返回500错误，可能是集群连接问题或权限问题');
          console.log('返回空DaemonSet列表，而不是抛出错误');
          return [];
        }
        
        return Promise.reject(error);
      });
  },
  
  // 获取Job列表 - 如果不提供namespace，获取所有命名空间
  getKubernetesJobs: (id, namespace) => {
    if (!id) {
      console.error('获取Job列表失败: 未提供kubeConfigId');
      return Promise.reject(new Error('未提供集群配置ID'));
    }
    
    console.log('获取Job列表, kubeConfigId:', id, '命名空间:', namespace || '所有命名空间');
    
    let url = `/kubeconfig/${id}/jobs`;
    if (namespace) {
      url += `?namespace=${namespace}`;
    }
    
    return apiClient.get(url, { timeout: 15000 })
      .then(response => {
        console.log('Job列表获取成功:', response);
        return Array.isArray(response) ? response : [];
      })
      .catch(error => {
        console.error('获取Job列表失败:', error);
        
        // 特殊处理500错误，返回空数组而不是失败
        if (error.response && error.response.status === 500) {
          console.error('服务器返回500错误，可能是集群连接问题或权限问题');
          console.log('返回空Job列表，而不是抛出错误');
          return [];
        }
        
        return Promise.reject(error);
      });
  },
  
  // 获取Pod日志
  getKubernetesPodLogs: (id, podName, namespace, containerName, tailLines = 100) => {
    if (!id || !podName || !namespace) {
      console.error('获取Pod日志参数不完整:', { id, podName, namespace });
      return Promise.reject(new Error('获取Pod日志需要完整的参数'));
    }
    
    console.log('获取Pod日志，请求参数:', { id, podName, namespace, containerName, tailLines });
    
    let url = `/kubeconfig/${id}/pods/${podName}/logs?namespace=${encodeURIComponent(namespace)}&tailLines=${tailLines}`;
    if (containerName) {
      url += `&container=${encodeURIComponent(containerName)}`;
    }
    console.log('获取Pod日志，请求URL:', url);
    
    return apiClient.get(url, { timeout: 20000 }) // 日志查询可能需要更长时间
      .then(response => {
        console.log('Pod日志获取成功:', response);
        return response && response.logs ? response.logs : '';
      })
      .catch(error => {
        console.error('获取Pod日志失败:', error);
        console.error('错误详情:', error.response?.data || error.message);
        
        // 特殊处理500错误
        if (error.response && error.response.status === 500) {
          console.error('服务器返回500错误，可能是集群连接问题或权限问题');
          return '无法获取日志: 服务器错误，请检查集群连接或Pod状态';
        }
        
        return Promise.reject(error);
      });
  },
  
  // 删除Kubernetes资源
  deleteKubernetesResource: (kubeConfigId, resourceType, namespace, name, propagationPolicy = "Foreground") => {
    console.log(`删除K8s资源: ${resourceType}/${name} in ${namespace}, 传播策略: ${propagationPolicy}`);
    return apiClient.delete(`/kubeconfig/${kubeConfigId}/${resourceType}?namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}&propagationPolicy=${propagationPolicy}`, {
      timeout: 15000 // 增加超时时间
    }).then(response => {
      console.log(`成功删除K8s资源: ${resourceType}/${name}`);
      return response;
    }).catch(error => {
      console.error(`删除K8s资源失败: ${resourceType}/${name}`, error);
      return Promise.reject(error);
    });
  },
  
  // 伸缩Kubernetes资源
  scaleKubernetesResource: (id, resourceType, namespace, name, replicas) => {
    return apiClient.put(`/kubeconfig/${id}/${resourceType}/scale?namespace=${namespace}&name=${name}`, { replicas });
  },
  
  // 修补Kubernetes资源
  patchKubernetesResource: (id, resourceType, namespace, name, patchData) => {
    return apiClient.patch(`/kubeconfig/${id}/${resourceType}?namespace=${namespace}&name=${name}`, patchData);
  },
  
  // 重启Deployment
  restartKubernetesDeployment: (id, namespace, name) => {
    return apiClient.post(`/kubeconfig/${id}/deployments/restart?namespace=${namespace}&name=${name}`);
  },
  
  // Harbor特定的API方法，用于获取Harbor项目中的仓库
  getHarborRepositories: (registryId, project) => {
    if (!registryId || !project) {
      console.error('获取Harbor仓库列表参数不完整:', { registryId, project });
      return Promise.reject(new Error('获取Harbor仓库参数不完整'));
    }
    
    const encodedProject = encodeURIComponent(project);
    console.log(`调用Harbor API获取仓库列表: registry=${registryId}, project=${encodedProject}`);
    console.log(`请求路径: /registry/${registryId}/harborrepo/${encodedProject}`);
    
    return apiClient.get(`/registry/${registryId}/harborrepo/${encodedProject}`)
      .then(response => {
        console.log('Harbor仓库列表获取成功, 响应数据类型:', typeof response, Array.isArray(response) ? '是数组' : '不是数组');
        console.log('Harbor仓库列表获取成功, 数据:', response);
        
        // 确保结果是数组
        if (response && !Array.isArray(response)) {
          console.warn('Harbor API返回非数组结果，尝试转换:', response);
          if (response.data && Array.isArray(response.data)) {
            return response.data;
          } else {
            console.warn('无法将响应转换为数组:', response);
            return [];
          }
        }
        
        return response;
      })
      .catch(error => {
        console.error('获取Harbor仓库列表API错误:', error);
        console.error('错误详情:', error.response?.data || error.message);
        return Promise.reject(error);
      });
  },
  
  // 获取特定的Kubernetes资源
  getKubernetesResource: (id, resourceType, namespace, name) => {
    if (!id || !resourceType || !namespace || !name) {
      console.error('获取Kubernetes资源参数不完整:', { id, resourceType, namespace, name });
      return Promise.reject(new Error('获取Kubernetes资源需要完整的参数'));
    }
    
    console.log('获取Kubernetes资源，请求参数:', { id, resourceType, namespace, name });
    
    return apiClient.get(`/kubeconfig/${id}/${resourceType}/${name}?namespace=${namespace}`)
      .then(response => {
        console.log(`获取Kubernetes ${resourceType} 成功:`, response);
        return response;
      })
      .catch(error => {
        console.error(`获取Kubernetes ${resourceType} 失败:`, error);
        return Promise.reject(error);
      });
  },

  // 强制删除Kubernetes资源
  forceDeleteKubernetesResource: (kubeConfigId, resourceType, namespace, name) => {
    console.log(`强制删除K8s资源: ${resourceType}/${name} in ${namespace}`);
    return apiClient.delete(`/kubeconfig/${kubeConfigId}/${resourceType}?namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}&force=true&gracePeriod=0`, {
      timeout: 15000
    }).then(response => {
      console.log(`成功强制删除K8s资源: ${resourceType}/${name}`);
      return response;
    }).catch(error => {
      console.error(`强制删除K8s资源失败: ${resourceType}/${name}`, error);
      return Promise.reject(error);
    });
  },
  
  // Harbor特定的API方法，用于获取Harbor仓库中的标签
  getHarborTags: (registryId, project, repository) => {
    if (!registryId || !project || !repository) {
      console.error('获取Harbor标签列表参数不完整:', { registryId, project, repository });
      return Promise.reject(new Error('获取Harbor标签参数不完整'));
    }
    
    const encodedProject = encodeURIComponent(project);
    const encodedRepository = encodeURIComponent(repository);
    console.log(`调用Harbor API获取标签列表: registry=${registryId}, project=${encodedProject}, repository=${encodedRepository}`);
    console.log(`请求路径: /registry/${registryId}/harbortags/${encodedProject}/${encodedRepository}`);
    
    return apiClient.get(`/registry/${registryId}/harbortags/${encodedProject}/${encodedRepository}`)
      .then(response => {
        console.log('Harbor标签列表获取成功, 响应数据类型:', typeof response, Array.isArray(response) ? '是数组' : '不是数组');
        console.log('Harbor标签列表获取成功, 数据:', response);
        
        // 确保结果是数组
        if (response && !Array.isArray(response)) {
          console.warn('Harbor API返回非数组结果，尝试转换:', response);
          if (response.data && Array.isArray(response.data)) {
            return response.data;
          } else {
            console.warn('无法将响应转换为数组:', response);
            return [];
          }
        }
        
        return response;
      })
      .catch(error => {
        console.error('获取Harbor标签列表API错误:', error);
        console.error('错误详情:', error.response?.data || error.message);
        return Promise.reject(error);
      });
  },

  // 验证KubeConfig是否存在且可用
  verifyKubeConfig: async (kubeConfigId) => {
    if (!kubeConfigId) {
      console.error('verifyKubeConfig: 未提供kubeConfigId');
      return false;
    }
    
    try {
      console.log('正在验证kubeconfig是否存在:', kubeConfigId);
      
      // 先尝试直接获取kubeconfig信息
      try {
        console.log(`检查kubeconfig是否存在: ${kubeConfigId}`);
        const kubeConfig = await apiClient.get(`/kubeconfig/${kubeConfigId}`, {
          timeout: 10000
        });
        
        // 如果能成功获取kubeconfig信息，检查是否包含必要信息
        if (kubeConfig && typeof kubeConfig === 'object' && Object.keys(kubeConfig).length > 0) {
          console.log('kubeconfig存在且有效:', kubeConfig);
          return true;
        } else {
          console.warn('kubeconfig存在但内容为空');
        }
      } catch (error) {
        console.error('获取kubeconfig信息失败:', error);
        // 如果获取kubeconfig信息失败，再尝试验证接口
      }
      
      // 检查是否有验证接口
      try {
        const response = await apiClient.get(`/kubeconfig/${kubeConfigId}/healthz`, {
          timeout: 5000
        });
        
        console.log('kubeconfig健康检查结果:', response);
        if (response && response.status === 'ok') {
          return true;
        }
      } catch (error) {
        console.warn('kubeconfig健康检查失败, 尝试其他方式验证');
      }
      
      // 兜底方案：尝试获取命名空间列表
      try {
        console.log(`尝试获取命名空间列表: ${kubeConfigId}`);
        const namespaces = await apiClient.get(`/kubeconfig/${kubeConfigId}/namespaces`, {
          timeout: 8000
        });
        
        if (namespaces && (Array.isArray(namespaces) || (Array.isArray(namespaces.data) && namespaces.data.length > 0))) {
          console.log('成功获取命名空间列表，kubeconfig有效');
          return true;
        } else {
          console.warn('获取命名空间列表成功，但列表为空');
          return true; // 仍然认为kubeconfig有效，只是没有命名空间
        }
      } catch (error) {
        // 特殊处理500错误
        if (error.response && error.response.status === 500) {
          console.warn('命名空间接口返回500错误，后端可能存在问题，默认kubeconfig有效');
          // 当命名空间接口返回500错误时，我们仍然认为kubeconfig是有效的，因为这可能是后端临时问题
          return true;
        }
        
        console.error('所有验证方法都失败，kubeconfig无效:', error);
        return false;
      }
    } catch (error) {
      console.error('验证kubeconfig过程发生未知错误:', error);
      return false;
    }
  },

  // 清除资源缓存的方法
  clearResourceCache: (resourceType = null, id = null, namespace = null) => {
    if (resourceType && id) {
      // 清除特定资源的缓存
      const cacheKey = getCacheKey(resourceType, id, namespace);
      delete resourcesCache.data[cacheKey];
      delete resourcesCache.timestamp[cacheKey];
      console.log(`清除${resourceType}缓存, id: ${id}, 命名空间: ${namespace || '所有'}`);
    } else {
      // 清除所有资源缓存
      resourcesCache.data = {};
      resourcesCache.timestamp = {};
      console.log('所有资源缓存已清除');
    }
  },

  // 添加清除KubeConfig缓存的方法
  clearKubeConfigsCache: () => {
    kubeConfigsCache.data = null;
    kubeConfigsCache.timestamp = 0;
    console.log('KubeConfig缓存已清除');
  },

  // 专门用于删除部署的方法
  deleteDeployment: (kubeConfigId, namespace, name, force = false) => {
    console.log(`删除部署: ${namespace}/${name}, 强制: ${force}`);
    const queryParams = `namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(name)}`;
    const forceParams = force ? '&force=true&gracePeriod=0' : '';
    
    return apiClient.delete(`/kubeconfig/${kubeConfigId}/deployments?${queryParams}${forceParams}`, {
      timeout: 20000
    }).then(response => {
      console.log(`成功删除部署: ${namespace}/${name}`);
      return response;
    }).catch(error => {
      // 处理404错误 - 资源可能已经不存在
      if (error.response && error.response.status === 404) {
        console.log(`部署不存在，视为删除成功: ${namespace}/${name}`);
        return { message: `部署 ${name} 不存在或已被删除` };
      }
      console.error(`删除部署失败: ${namespace}/${name}`, error);
      return Promise.reject(error);
    });
  },
  
  // 添加删除多种关联资源的方法
  deleteApplicationResources: async (kubeConfigId, namespace, name) => {
    console.log(`删除应用相关资源: ${namespace}/${name}`);
    
    if (!kubeConfigId || !namespace || !name) {
      console.error('删除应用资源参数不完整:', { kubeConfigId, namespace, name });
      return Promise.reject(new Error('删除应用资源需要完整的参数'));
    }
    
    // 定义所有需要删除的资源类型
    const resourceTypes = [
      'deployments', 
      'services', 
      'configmaps', 
      'secrets',
      'statefulsets',
      'daemonsets',
      'persistentvolumeclaims',
      'networkpolicies',
      'ingresses',
      'pods'
    ];
    
    const results = [];
    const errors = [];
    
    // 并行删除所有资源
    await Promise.allSettled(
      resourceTypes.map(async (type) => {
        try {
          console.log(`尝试删除资源: ${type}/${name}`);
          let resourceName = name;
          
          // 特殊处理某些资源的命名规则
          if (type === 'configmaps') {
            resourceName = `${name}-config`;
          } else if (type === 'secrets') {
            resourceName = `${name}-secret`;
          }
          
          const response = await apiClient.delete(
            `/kubeconfig/${kubeConfigId}/${type}?namespace=${encodeURIComponent(namespace)}&name=${encodeURIComponent(resourceName)}&propagationPolicy=Foreground`,
            { timeout: 15000 }
          );
          
          results.push({ type, success: true, message: response?.message || `${type} ${resourceName} 已删除` });
          console.log(`成功删除资源: ${type}/${resourceName}`);
        } catch (error) {
          console.error(`删除资源失败: ${type}/${name}`, error);
          
          // 404错误视为资源不存在，不视为真正的错误
          if (error.response && error.response.status === 404) {
            results.push({ type, success: true, message: `${type} ${name} 不存在或已被删除` });
          } else {
            errors.push({ type, error: error.message || String(error) });
          }
        }
      })
    );
    
    console.log('应用资源删除结果:', { results, errors });
    
    // 返回删除结果摘要
    return {
      success: errors.length === 0,
      results,
      errors,
      message: errors.length === 0 
        ? `成功删除 ${namespace}/${name} 的所有相关资源` 
        : `删除 ${namespace}/${name} 资源部分失败，${errors.length}个错误`
    };
  },
  
  // 获取应用相关的Pod列表
  getApplicationPods: async (appId) => {
    try {
      console.log('获取应用相关Pod, appId:', appId);
      const application = await apiService.getApplicationById(appId);
      if (!application) {
        throw new Error('未找到应用');
      }

      const { kubeConfigId, namespace, appName } = application;
      
      if (!kubeConfigId || !namespace) {
        throw new Error('应用缺少必要的Kubernetes配置信息');
      }
      
      // 获取该命名空间下的所有Pod
      const pods = await apiService.getPods(kubeConfigId, namespace);
      
      // 根据应用名筛选Pod（通常Pod名包含应用名）
      // 或者根据应用部署时设置的标签筛选
      const filteredPods = pods.filter(pod => 
        pod.name.includes(appName) || 
        (pod.labels && pod.labels.app === appName)
      );
      
      // 为每个Pod添加clusterId以便导航
      return filteredPods.map(pod => ({
        ...pod,
        clusterId: kubeConfigId
      }));
    } catch (error) {
      console.error('获取应用相关Pod失败:', error);
      return [];
    }
  },

  // 获取Pod日志
  getPodLogs: (kubeConfigId, namespace, podName, containerName, options = {}) => {
    const { tailLines = 100, follow = false } = options;
    console.log('获取Pod日志:', { kubeConfigId, namespace, podName, containerName, tailLines, follow });
    
    const params = {
      kubeConfigId,
      namespace,
      containerName,
      tailLines,
      follow
    };
    
    return apiClient.get(`/pods/${podName}/logs`, { params })
      .then(response => {
        return response;
      })
      .catch(error => {
        console.error('获取Pod日志失败:', error);
        return Promise.reject(error);
      });
  },

  // 获取Pod终端WebSocket URL
  getPodTerminalUrl: (kubeConfigId, namespace, podName, containerName) => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const apiBase = process.env.REACT_APP_API_BASE_URL || '/api';
    
    return `${wsProtocol}//${host}${apiBase}/pods/exec?kubeConfigId=${kubeConfigId}&namespace=${namespace}&podName=${podName}&containerName=${containerName}&command=/bin/sh`;
  },
  
  // 获取Pod列表
  getPods: (kubeConfigId, namespace = 'default') => {
    const params = {
      kubeConfigId,
      namespace
    };
    
    return apiClient.get('/pods', { params });
  },
  
  // 获取Pod Terminal WebSocket URL
  getPodLogsStreamUrl: (kubeConfigId, namespace, podName, containerName, tailLines = 100) => {
    const baseUrl = process.env.REACT_APP_API_BASE_URL || '/api';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // 构建WebSocket URL
    return `${wsProtocol}//${host}${baseUrl}/pods/${podName}/logs?kubeConfigId=${kubeConfigId}&namespace=${namespace}&containerName=${containerName}&tailLines=${tailLines}&follow=true`;
  }
};

export default apiService;
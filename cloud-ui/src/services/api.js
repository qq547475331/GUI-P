import axios from 'axios';
import eventBus, { EVENT_TYPES } from './eventBus';

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

// 为镜像仓库创建缓存对象
const registriesCache = {
  data: null,
  timestamp: 0,
  isRequesting: false,
  pendingPromise: null,
  _loggedCache: false  // 添加日志追踪标记
};

// 初始化缓存，从localStorage恢复数据
(() => {
  try {
    // 恢复KubeConfig缓存
    const cachedKubeConfigs = localStorage.getItem('kubeConfigsCache');
    const kubeConfigsTimestamp = localStorage.getItem('kubeConfigsCacheTimestamp');
    if (cachedKubeConfigs && kubeConfigsTimestamp) {
      kubeConfigsCache.data = JSON.parse(cachedKubeConfigs);
      kubeConfigsCache.timestamp = parseInt(kubeConfigsTimestamp, 10);
      console.log('已从localStorage恢复KubeConfig缓存');
    }
    
    // 恢复镜像仓库缓存
    const cachedRegistries = localStorage.getItem('registriesCache');
    const registriesTimestamp = localStorage.getItem('registriesCacheTimestamp');
    if (cachedRegistries && registriesTimestamp) {
      registriesCache.data = JSON.parse(cachedRegistries);
      registriesCache.timestamp = parseInt(registriesTimestamp, 10);
      console.log('已从localStorage恢复镜像仓库缓存');
    }
  } catch (e) {
    console.warn('从localStorage恢复缓存失败:', e);
  }
})();

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
        const parsedData = JSON.parse(cachedApps);
        return Promise.resolve(apiService.normalizeApplicationsData(parsedData));
      } catch (e) {
        console.error('解析缓存数据失败', e);
        // 解析失败，继续请求新数据
      }
    }
    
    // 请求超时时使用短超时时间，避免UI长时间等待
    return apiClient.get('/applications', { timeout: 15000 })
      .then(response => {
        console.log('应用列表获取成功');
        const normalizedData = apiService.normalizeApplicationsData(response);
        // 更新缓存
        localStorage.setItem('cachedApplications', JSON.stringify(normalizedData));
        localStorage.setItem('cachedApplicationsTimestamp', now.toString());
        return normalizedData;
      })
      .catch(error => {
        console.error('获取应用列表失败:', error);
        console.error('错误详情:', error.response?.data || error.message);
        
        // 如果有缓存数据，在请求失败时返回缓存
        if (cachedApps) {
          console.log('请求失败，返回缓存的应用列表数据');
          try {
            const parsedData = JSON.parse(cachedApps);
            return apiService.normalizeApplicationsData(parsedData);
          } catch (e) {
            console.error('解析缓存数据失败', e);
          }
        }
        
        return Promise.reject(error);
      });
  },
  
  // 确保应用状态的一致性格式
  normalizeApplicationsData: (applications = []) => {
    if (!Array.isArray(applications)) return [];
    
    return applications.map(app => {
      // 确保每个应用都有一个一致的状态格式
      if (!app) return app;
      
      // 如果状态已经是对象格式，确保它有phase属性
      if (typeof app.status === 'object') {
        if (!app.status.phase) {
          app.status.phase = app.status.status || 'Unknown';
        }
      } else {
        // 如果状态是字符串，将其转换为对象格式
        app.status = { 
          phase: app.status || 'Unknown'
        };
      }
      
      return app;
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
    
    // 检查镜像参数，确保不为空
    if ((!data.imageUrl && !data.imageName && !data.image) || 
        (data.imageUrl === '') || (data.imageName === '') || (data.image === '')) {
      console.error('创建应用失败: 缺少镜像参数');
      return Promise.reject(new Error('创建应用失败: 请提供有效的镜像地址'));
    }
    
    // 检查应用名称，确保不为空
    if ((!data.name && !data.appName) || 
        (data.name === '') || (data.appName === '')) {
      console.error('创建应用失败: 应用名称为空');
      return Promise.reject(new Error('创建应用失败: 请提供有效的应用名称'));
    }
    
    // 预处理nodeSelector，将数组转换为map格式
    let nodeSelectorMap = {};
    if (data.nodeSelector && Array.isArray(data.nodeSelector)) {
      data.nodeSelector.forEach(item => {
        if (item && item.key && item.value) {
          nodeSelectorMap[item.key] = item.value;
        }
      });
    }
    
    // 构建完整的请求数据
    const completeData = {
      // 基本信息
      name: data.name || data.appName, // 兼容appName和name两种字段名
      namespace: data.namespace,
      kubeConfigID: data.kubeConfigId,
      description: data.description || '',
      status: 'created',
      
      // 容器配置 - 统一处理镜像参数
      imageName: data.imageName || data.image || data.imageUrl || 'nginx:latest', // 确保有默认值
      imageURL: data.imageUrl || data.imageName || data.image || 'nginx:latest', // 确保有默认值
      image: data.image || data.imageName || data.imageUrl || 'nginx:latest', // 确保有默认值
      imagePullPolicy: data.imagePullPolicy || 'IfNotPresent',
      replicas: data.replicas || data.instances || 1, // 兼容instances和replicas两种字段名
      port: parseInt(data.port || data.containerPort) || 80, // 兼容containerPort和port两种字段名
      servicetype: data.serviceType || 'ClusterIP',
      
      // 添加健康检查
      livenessProbe: data.livenessProbe,
      readinessProbe: data.readinessProbe,
      startupProbe: data.startupProbe,
      
      // 添加生命周期管理
      lifecycle: data.lifecycle,
      
      // 添加自定义命令
      command: data.command,
      args: data.args,
      
      // 添加环境变量
      envVars: data.envVars || [],
      
      // 添加存储卷
      volumes: data.volumes || [],
      volumeMounts: data.volumeMounts || [],
      
      // 添加安全上下文
      securityContext: data.securityContext,
      
      // 添加调度规则 - 使用转换后的map格式
      nodeSelector: nodeSelectorMap,
      tolerations: data.tolerations,
      affinity: data.affinity
    };
    
    console.log('完整的创建应用数据:', completeData);
    
    // 添加查询参数，确保即使POST体失败也能传递KubeConfigId
    return apiClient.post(`/applications?kubeConfigId=${completeData.kubeConfigID}`, completeData)
      .then(response => {
        console.log('创建应用成功:', response);
        
        // 触发应用创建事件，通知Dashboard组件刷新列表
        eventBus.emit(EVENT_TYPES.APP_CREATED, response);
        
        // 清除应用列表缓存，确保下次获取到最新数据
        try {
          localStorage.removeItem('cachedApplications');
          localStorage.removeItem('cachedApplicationsTimestamp');
        } catch (e) {
          console.warn('清除应用列表缓存失败:', e);
        }
        
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
    console.log('更新应用数据:', data);
    
    // 预处理nodeSelector，将数组转换为map格式
    let nodeSelectorMap = {};
    if (data.nodeSelector && Array.isArray(data.nodeSelector)) {
      data.nodeSelector.forEach(item => {
        if (item && item.key && item.value) {
          nodeSelectorMap[item.key] = item.value;
        }
      });
    }
    
    // 创建更新数据对象，确保nodeSelector是map格式
    const updateData = {
      ...data,
      nodeSelector: nodeSelectorMap
    };
    
    return apiClient.put(`/applications/${id}`, updateData)
      .then(response => {
        console.log('更新应用成功:', response);
        return response;
      })
      .catch(error => {
        console.error('更新应用失败:', error);
        // 尝试查看错误详情
        if (error.response) {
          console.error('服务器响应:', error.response.data);
        }
        return Promise.reject(error);
      });
  },
  
  // 删除应用
  deleteApplication: async (id, deleteK8sResources = true, force = true) => {
    if (!id) {
      console.error('删除应用失败: 未提供应用ID');
      return Promise.reject(new Error('删除应用失败: 未提供应用ID'));
    }

    console.log('删除应用:', { id, deleteK8sResources, force });
    
    // 创建一个可以取消的请求
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();
    
    try {
      const response = await apiClient.delete(
        `/applications/${id}?deleteK8sResources=${deleteK8sResources}&force=${force}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 20000, // 设置20秒超时
          cancelToken: source.token
        }
      );

      console.log('删除应用响应:', response);
      
      // 清除相关缓存
      try {
        // 使用try/catch包装可能失败的缓存清理操作
        if (typeof apiService.clearResourceCache === 'function') {
          apiService.clearResourceCache();
        }
        
        if (typeof apiService.clearNamespacesCache === 'function') {
          apiService.clearNamespacesCache();
        }
      } catch (cacheError) {
        console.warn('清除缓存时发生错误，但不影响删除操作:', cacheError);
      }
      
      // 处理不同的响应状态
      if (response.status === 204 || response.status === 200) {
        return { success: true, message: '应用删除成功' };
      }
      
      return response;
    } catch (error) {
      console.error('删除应用失败:', error);
      
      // 检查是否是取消请求导致的错误
      if (axios.isCancel(error)) {
        console.log('请求已取消:', error.message);
        return { success: false, message: '请求已取消' };
      }
      
      if (error.response) {
        // 如果是404，表示应用不存在，视为删除成功
        if (error.response.status === 404) {
          return { success: true, message: '应用已删除' };
        }
        
        // 如果是OPTIONS预检请求被拒绝，可能是CORS问题
        if (error.response.status === 0 || error.response.status === 'OPTIONS') {
          // 尝试通过刷新页面解决CORS问题
          console.warn('可能存在CORS问题，建议检查跨域配置');
        }
        
        throw new Error(error.response.data?.error || '删除应用失败');
      }
      
      throw error;
    }
  },
  
  // 获取应用对应的 Pods
  getApplicationPods: (id) => {
    if (!id) {
      console.error('获取应用Pods失败: 未提供应用ID');
      return Promise.reject(new Error('获取应用Pods失败: 未提供应用ID'));
    }

    console.log('获取应用Pods, 应用ID:', id);
    
    // 首先获取应用信息，以获取kubeConfigID
    return apiClient.get(`/applications/${id}`, { timeout: 10000 })
      .then(appData => {
        if (!appData || !appData.kubeConfigId) {
          console.error('获取应用Pods失败: 无法获取应用的kubeConfigId');
          return [];
        }
        
        const kubeConfigId = appData.kubeConfigId;
        const namespace = appData.namespace || 'default';
        const appName = appData.appName || appData.name;
        
        console.log('获取特定应用Pods，参数:', { kubeConfigId, namespace, appName });
        
        // 尝试从API获取Pod列表
        return apiClient.get(`/pods?kubeConfigId=${kubeConfigId}&namespace=${namespace}`, 
          { timeout: 15000 })
          .then(response => {
            console.log('获取到的Pods总数:', response?.length || 0);
            
            // 确保response是数组
            const podsList = Array.isArray(response) ? response : [];
            
            // 在前端手动过滤出属于当前应用的Pod
            const filteredPods = podsList.filter(pod => {
              // 检查pod是否有labels
              if (!pod.labels) return false;
              
              // 检查多种可能的标签组合
              return (
                // 检查常见的标签组合
                (pod.labels.app === appName) || 
                (pod.labels.application === appName) ||
                (pod.labels.component === appName) ||
                (pod.labels.name === appName) ||
                (pod.labels['app.kubernetes.io/name'] === appName) ||
                (pod.labels['k8s-app'] === appName) ||
                // 如果Pod名称包含应用名称（模糊匹配，不太精确但能捕获一些情况）
                (pod.name && pod.name.includes(appName))
              );
            });
            
            // 为每个Pod添加clusterId属性，确保导航到详情页时能正确传递kubeConfigId
            const podsWithClusterId = filteredPods.map(pod => ({
              ...pod,
              clusterId: kubeConfigId, // 添加clusterId以便在UI中使用
              kubeConfigId: kubeConfigId // 保留原始的kubeConfigId字段
            }));
            
            console.log(`过滤后的Pod数量: ${podsWithClusterId.length}/${podsList.length}，应用名称: ${appName}`);
            return podsWithClusterId;
          })
          .catch(error => {
            console.error('获取应用Pods失败:', error);
            // 失败时返回空数组，避免界面崩溃
            return [];
          });
      })
      .catch(error => {
        console.error('获取应用信息失败:', error);
        return [];
      });
  },
  
  // 部署应用
  deployApplication: (id) => {
    return apiClient.post(`/applications/${id}/deploy`)
      .then(response => {
        console.log('部署应用成功:', response);
        return response;
      })
      .catch(error => {
        console.error('部署应用失败:', error);
        return Promise.reject(error);
      });
  },
  
  // 获取应用部署状态
  getDeploymentStatus: (id) => {
    // 对状态查询使用较短的超时时间，因为它是频繁轮询的
    return apiClient.get(`/applications/${id}/status`, { timeout: 10000 })
      .then(response => {
        console.log('获取应用状态成功:', response);
        
        // 标准化状态格式
        let standardizedStatus;
        
        if (typeof response === 'object') {
          // 如果已经是对象格式，确保有status属性
          if (response.status) {
            standardizedStatus = {
              ...response,
              phase: response.status
            };
          } else if (response.phase) {
            standardizedStatus = response;
          } else {
            // 对象但没有status或phase属性，使用默认值
            standardizedStatus = {
              ...response,
              status: "unknown",
              phase: "unknown"
            };
          }
        } else if (typeof response === 'string') {
          // 如果是字符串，转换为对象格式
          standardizedStatus = {
            status: response,
            phase: response,
            message: "应用状态",
            replicas: 0,
            availableReplicas: 0
          };
        } else {
          // 无效格式，返回默认值
          standardizedStatus = {
            status: "unknown",
            phase: "unknown",
            message: "无法获取应用状态",
            replicas: 0,
            availableReplicas: 0
          };
        }
        
        return standardizedStatus;
      })
      .catch(error => {
        console.warn('获取部署状态失败，将在下次重试:', error.message);
        // 返回一个默认值，避免UI显示错误
        return {
          status: "unknown",
          phase: "unknown",
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
    const CACHE_TTL = 1800000; // 30分钟缓存
    
    // 如果已经有数据且在有效期内，直接使用缓存
    if (registriesCache.data && (Date.now() - registriesCache.timestamp < CACHE_TTL)) {
      // 移除频繁打印的缓存命中日志
      // 仅在开发环境下打印缓存命中日志
      if (process.env.NODE_ENV === 'development' && !registriesCache._loggedCache) {
        console.log('使用缓存的镜像仓库列表，有效期内无需重新请求');
        // 标记已经打印过日志，避免重复输出
        registriesCache._loggedCache = true;
        // 5分钟后重置标记，允许再次打印
        setTimeout(() => {
          registriesCache._loggedCache = false;
        }, 300000);
      }
      return Promise.resolve(registriesCache.data);
    }
    
    // 如果正在请求中，返回待处理的Promise
    if (registriesCache.isRequesting || registriesCache.pendingPromise) {
      console.log('已有镜像仓库请求进行中，等待结果');
      return registriesCache.pendingPromise || Promise.resolve(registriesCache.data || []);
    }
    
    console.log('缓存过期或不存在，重新获取镜像仓库列表');
    registriesCache.isRequesting = true;
    
    // 创建并缓存Promise
    registriesCache.pendingPromise = apiClient.get('/registry', { timeout: 10000 })
      .then(response => {
        console.log('镜像仓库列表获取成功:', response);
        
        // 更新缓存
        registriesCache.data = response;
        registriesCache.timestamp = Date.now();
        // 重置日志标记
        registriesCache._loggedCache = false;
        
        // 同时保存到localStorage作为备份缓存
        try {
          localStorage.setItem('registriesCache', JSON.stringify(response));
          localStorage.setItem('registriesCacheTimestamp', Date.now().toString());
        } catch (e) {
          console.warn('无法保存镜像仓库缓存到localStorage:', e);
        }
        
        return response;
      })
      .catch(error => {
        console.error('获取镜像仓库列表失败:', error);
        
        // 尝试从localStorage恢复缓存数据
        try {
          const cachedData = localStorage.getItem('registriesCache');
          if (cachedData) {
            console.log('从localStorage恢复镜像仓库缓存');
            return JSON.parse(cachedData);
          }
        } catch (e) {
          console.error('从localStorage恢复缓存失败:', e);
        }
        
        // 无缓存可用时返回空数组
        return registriesCache.data || [];
      })
      .finally(() => {
        // 请求完成，重置状态
        setTimeout(() => {
          registriesCache.isRequesting = false;
          registriesCache.pendingPromise = null;
        }, 100);
      });
    
    return registriesCache.pendingPromise;
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
      
      // 清除缓存，确保下次获取到最新数据
      apiService.clearRegistriesCache();
      
      return response.data;
    } catch (error) {
      console.error('创建镜像仓库失败:', error);
      throw error;
    }
  },
  
  // 更新镜像仓库
  updateImageRegistry: (id, data) => {
    return apiClient.put(`/registry/${id}`, data)
      .then(response => {
        // 清除缓存，确保下次获取到最新数据
        apiService.clearRegistriesCache();
        return response;
      });
  },
  
  // 删除镜像仓库
  deleteImageRegistry: (id) => {
    return apiClient.delete(`/registry/${id}`)
      .then(response => {
        // 清除缓存，确保下次获取到最新数据
        apiService.clearRegistriesCache();
        return response;
      });
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
  
  // Kubernetes相关API
  
  // 获取所有KubeConfig配置
  getKubeConfigs: () => {
    const CACHE_TTL = 7200000; // 延长缓存有效期至2小时
    
    // 如果已经有数据且在有效期内，直接使用缓存
    if (kubeConfigsCache.data && (Date.now() - kubeConfigsCache.timestamp < CACHE_TTL)) {
      console.log('使用缓存的KubeConfig列表，有效期内无需重新请求');
      return Promise.resolve(kubeConfigsCache.data);
    }
    
    // 如果正在请求中，返回待处理的Promise
    if (kubeConfigsCache.isRequesting || kubeConfigsCache.pendingPromise) {
      console.log('已有KubeConfig请求进行中，等待结果');
      return kubeConfigsCache.pendingPromise || Promise.resolve(kubeConfigsCache.data || []);
    }
    
    console.log('缓存过期或不存在，重新获取KubeConfig列表');
    kubeConfigsCache.isRequesting = true;
    
    // 创建并缓存Promise
    kubeConfigsCache.pendingPromise = apiClient.get('/kubeconfig', { timeout: 15000 })
      .then(response => {
        console.log('KubeConfig列表获取成功:', response);
        
        // 更新缓存
        kubeConfigsCache.data = response;
        kubeConfigsCache.timestamp = Date.now();
        
        // 同时保存到localStorage作为备份缓存
        try {
          localStorage.setItem('kubeConfigsCache', JSON.stringify(response));
          localStorage.setItem('kubeConfigsCacheTimestamp', Date.now().toString());
        } catch (e) {
          console.warn('无法保存KubeConfig缓存到localStorage:', e);
        }
        
        return response;
      })
      .catch(error => {
        console.error('获取KubeConfig列表失败:', error);
        
        // 尝试从localStorage恢复缓存数据
        try {
          const cachedData = localStorage.getItem('kubeConfigsCache');
          if (cachedData) {
            console.log('从localStorage恢复KubeConfig缓存');
            return JSON.parse(cachedData);
          }
        } catch (e) {
          console.error('从localStorage恢复缓存失败:', e);
        }
        
        // 无缓存可用时返回空数组
        return kubeConfigsCache.data || [];
      })
      .finally(() => {
        // 请求完成，重置状态
        setTimeout(() => {
          kubeConfigsCache.isRequesting = false;
          kubeConfigsCache.pendingPromise = null;
        }, 100);
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
  
  // 验证KubeConfig是否有效
  verifyKubeConfig: (kubeConfigId) => {
    if (!kubeConfigId) {
      console.error('验证Kubernetes配置失败: 未提供kubeConfigId');
      return Promise.resolve(false);
    }

    console.log(`验证KubeConfig配置, ID: ${kubeConfigId}`);
    
    // 调用健康检查接口验证kubeconfig是否有效
    return apiClient.get(`/kubeconfig/${kubeConfigId}/health`, { 
      timeout: 10000 // 设置短超时，避免长时间等待
    })
      .then(response => {
        console.log('KubeConfig验证成功:', response);
        return true;
      })
      .catch(error => {
        console.error('KubeConfig验证失败:', error);
        // 返回false而不是抛出异常，便于调用者处理
        return false;
      });
  },
  
  // 获取指定命名空间的Pod列表
  getPods: (kubeConfigId, namespace, labelSelector) => {
    if (!kubeConfigId) {
      console.error('获取Pod列表失败: 未提供kubeConfigId');
      return Promise.reject(new Error('未提供集群配置ID'));
    }
    
    console.log('获取Pod列表，参数:', { kubeConfigId, namespace, labelSelector });
    
    // 构建请求URL
    let url = `/pods?kubeConfigId=${encodeURIComponent(kubeConfigId)}`;
    if (namespace) {
      url += `&namespace=${encodeURIComponent(namespace)}`;
    }
    if (labelSelector) {
      url += `&labelSelector=${encodeURIComponent(labelSelector)}`;
    }
    
    return apiClient.get(url, { timeout: 15000 })
      .then(response => {
        console.log('Pod列表获取成功:', response?.length || 0);
        return Array.isArray(response) ? response : [];
      })
      .catch(error => {
        console.error('获取Pod列表失败:', error);
        
        // 特殊处理500错误，返回空数组而不是失败
        if (error.response && (error.response.status === 500 || error.response.status === 404)) {
          console.error('服务器返回错误，可能是集群连接问题或权限问题:', error.response.status);
          console.log('返回空Pod列表，而不是抛出错误');
          return [];
        }
        
      return Promise.reject(error);
    });
  },
  
  // 获取Pod日志
  getPodLogs: (kubeConfigId, namespace, podName, containerName, options = {}) => {
    if (!kubeConfigId || !namespace || !podName) {
      console.error('获取Pod日志参数不完整:', { kubeConfigId, namespace, podName });
      return Promise.reject(new Error('获取Pod日志需要完整的参数'));
    }
    
    const { tailLines = 100, follow = false } = options;
    
    console.log('获取Pod日志，参数:', { kubeConfigId, namespace, podName, containerName, tailLines, follow });
    
    // 构建请求URL
    let url = `/pods/${encodeURIComponent(podName)}/logs?kubeConfigId=${encodeURIComponent(kubeConfigId)}&namespace=${encodeURIComponent(namespace)}&tailLines=${tailLines}`;
    if (containerName) {
      url += `&container=${encodeURIComponent(containerName)}`;
    }
    if (follow) {
      url += '&follow=true';
    }
    
    return apiClient.get(url, { timeout: 30000 }) // 日志查询给更长的超时时间
      .then(response => {
        console.log('Pod日志获取成功');
        // 处理返回数据，确保兼容不同格式
        if (typeof response === 'string') {
        return response;
        } else if (response && response.logs) {
          return response.logs;
        } else if (response && typeof response.data === 'string') {
          return response.data;
        } else if (response && response.data && response.data.logs) {
          return response.data.logs;
        }
        return '';
      })
      .catch(error => {
        console.error('获取Pod日志失败:', error);
        return Promise.reject(error);
      });
  },

  // 获取Pod日志流的WebSocket URL
  getPodLogsStreamUrl: (kubeConfigId, namespace, podName, containerName, tailLines = 100) => {
    if (!kubeConfigId || !namespace || !podName) {
      console.error('获取Pod日志流URL参数不完整:', { kubeConfigId, namespace, podName });
      throw new Error('获取Pod日志流URL需要完整的参数');
    }
    
    // 正确构建WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 使用固定的端口8080，因为后端API服务运行在8080端口
    const host = 'localhost:8080';
    const apiBase = '/api'; // 使用固定的API基础路径
    
    // 构建完整的WebSocket URL，确保不重复协议和主机
    let wsUrl = `${protocol}//${host}${apiBase}/ws/logs?kubeConfigId=${encodeURIComponent(kubeConfigId)}&namespace=${encodeURIComponent(namespace)}&podName=${encodeURIComponent(podName)}&tailLines=${tailLines}`;
    if (containerName) {
      wsUrl += `&container=${encodeURIComponent(containerName)}`;
    }
    
    console.log('Pod日志流WebSocket URL:', wsUrl);
    return wsUrl;
  },
  
  // 获取Pod终端的WebSocket URL
  getPodTerminalUrl: (kubeConfigId, namespace, podName, containerName) => {
    if (!kubeConfigId || !namespace || !podName || !containerName) {
      console.error('获取Pod终端URL参数不完整:', { kubeConfigId, namespace, podName, containerName });
      throw new Error('获取Pod终端URL需要完整的参数');
    }
    
    // 正确构建WebSocket URL - 使用后端实际支持的格式
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // 使用固定的端口8080，因为后端API服务运行在8080端口
    const host = 'localhost:8080';
    const apiBase = '/api'; // 使用固定的API基础路径
    
    // 构建完整的WebSocket URL，使用正确的pods/exec格式
    // 注意: 参数名从container改为containerName，添加默认命令
    const wsUrl = `${protocol}//${host}${apiBase}/pods/exec?kubeConfigId=${encodeURIComponent(kubeConfigId)}&namespace=${encodeURIComponent(namespace)}&podName=${encodeURIComponent(podName)}&containerName=${encodeURIComponent(containerName)}&command=/bin/sh`;
    
    console.log('Pod终端WebSocket URL:', wsUrl);
    return wsUrl;
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
    console.log(`获取Harbor仓库列表, 参数: { registryId: ${registryId}, project: ${project} }`);
    
    return apiClient.get(`/registry/${registryId}/repositories?project=${encodedProject}`);
  },
  
  // 添加一个清除缓存的方法
  clearRegistriesCache: () => {
    registriesCache.data = null;
    registriesCache.timestamp = 0;
    registriesCache.isRequesting = false;
    registriesCache.pendingPromise = null;
    console.log('镜像仓库缓存已清除');
  },

  // 添加一个清除资源缓存的方法
  clearResourceCache: (resourceType = null, id = null) => {
    if (resourceType && id) {
      // 清除特定类型和ID的资源缓存
      Object.keys(resourcesCache.data).forEach(key => {
        if (key.startsWith(`${resourceType}_${id}`)) {
          delete resourcesCache.data[key];
          delete resourcesCache.timestamp[key];
        }
      });
          } else {
      // 清除所有资源缓存
      resourcesCache.data = {};
      resourcesCache.timestamp = {};
    }
    console.log('资源缓存已清除');
  },
};

export default apiService;
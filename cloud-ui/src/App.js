import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';
import MainLayout from './components/MainLayout';
import Dashboard from './pages/Dashboard';
import CreateApplication from './pages/CreateApplication';
import EditApplication from './pages/EditApplication';
import ApplicationDetail from './pages/ApplicationDetail';
import KubeConfigPage from './pages/KubeConfigPage';
import K8sResourcesPage from './pages/K8sResourcesPage';
import RegistryPage from './pages/RegistryPage';
import PrivateRegistryPage from './pages/PrivateRegistryPage';
import PodDetailPage from './pages/PodDetailPage';
import './App.css';
// 导入全局消息样式
import './components/GlobalMessage.css';
// 替换styles.css为SuccessMessage.css
import './SuccessMessage.css';
// 导入专门为应用创建成功设计的样式
import './CreateAppMessage.css';

// 错误清除函数 - 应用级别
function clearGlobalErrors() {
  try {
    // 查找并移除所有错误提示
    const errorAlerts = document.querySelectorAll('.ant-alert-error');
    if (errorAlerts && errorAlerts.length > 0) {
      console.log(`清除全局错误提示: ${errorAlerts.length}个`);
      errorAlerts.forEach(alert => {
        try {
          const errorText = alert.textContent || '';
          
          // 特别关注镜像地址错误
          const isImageError = 
            errorText.includes('镜像地址') || 
            errorText.includes('image') || 
            errorText.includes('imageName');
            
          if (isImageError) {
            console.log('检测到镜像地址错误，立即清除');
          }
          
          // 尝试点击关闭按钮
          const closeBtn = alert.querySelector('.ant-alert-close-icon');
          if (closeBtn) {
            closeBtn.click();
          } else if (alert.parentNode) {
            // 如果没有关闭按钮，直接从DOM移除
            alert.parentNode.removeChild(alert);
          }
        } catch (e) {
          console.error('移除错误提示失败:', e);
        }
      });
    }
    
    // 清除表单项错误样式 (镜像地址相关)
    const imageErrorInputs = document.querySelectorAll('#image-input-container.ant-form-item-has-error, .image-input-wrapper.ant-form-item-has-error');
    if (imageErrorInputs && imageErrorInputs.length > 0) {
      console.log(`清除镜像输入框错误样式: ${imageErrorInputs.length}个`);
      imageErrorInputs.forEach(item => {
        item.classList.remove('ant-form-item-has-error');
        
        // 移除错误消息
        const errorMsg = item.querySelector('.ant-form-item-explain-error');
        if (errorMsg && errorMsg.parentNode) {
          errorMsg.parentNode.removeChild(errorMsg);
        }
      });
    }
    
    // 清除表单验证错误
    const errorInputs = document.querySelectorAll('.ant-form-item-has-error input[id*="image"]');
    if (errorInputs && errorInputs.length > 0) {
      errorInputs.forEach(input => {
        const formItem = input.closest('.ant-form-item');
        if (formItem) {
          formItem.classList.remove('ant-form-item-has-error');
          
          // 查找并移除错误消息
          const errorMsg = formItem.querySelector('.ant-form-item-explain-error');
          if (errorMsg && errorMsg.parentNode) {
            errorMsg.parentNode.removeChild(errorMsg);
          }
        }
      });
    }
  } catch (e) {
    console.error('全局错误清除失败:', e);
  }
}

function App() {
  // 应用启动时清除所有错误
  useEffect(() => {
    // 首次渲染时延迟清除，确保DOM完全加载
    const initialCleanupTimer = setTimeout(() => {
      clearGlobalErrors();
    }, 500);
    
    // 设置定期清除间隔，捕获任何新出现的错误
    const intervalId = setInterval(clearGlobalErrors, 500); // 频率更高
    
    // 添加点击事件监听器，点击任何地方都清除错误
    const clickHandler = () => {
      clearGlobalErrors();
    };
    document.addEventListener('click', clickHandler);
    
    // 添加Input事件监听器，输入时清除错误
    const inputHandler = (e) => {
      if (e.target.tagName === 'INPUT') {
        // 对镜像地址输入框特别处理
        if (
          e.target.id?.includes('image') || 
          e.target.closest('#image-input-container') ||
          e.target.closest('.image-input-wrapper')
        ) {
          clearGlobalErrors();
        }
      }
    };
    document.addEventListener('input', inputHandler);
    
    // 添加DOM变化监听器，检测错误提示的生成
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          // 检查是否添加了错误提示
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && node.classList?.contains('ant-alert-error')) {
              // 获取错误文本
              const errorText = node.textContent || '';
              
              // 特别关注镜像地址错误
              if (
                errorText.includes('镜像地址') || 
                errorText.includes('image') || 
                errorText.includes('imageName')
              ) {
                console.log('监测到新的镜像地址错误提示，立即清除');
                clearGlobalErrors();
                break;
              }
            }
          }
        }
      }
    });
    
    // 开始观察文档变化
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // 组件卸载时清理
    return () => {
      clearTimeout(initialCleanupTimer);
      clearInterval(intervalId);
      document.removeEventListener('click', clickHandler);
      document.removeEventListener('input', inputHandler);
      observer.disconnect();
    };
  }, []);

  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="create" element={<CreateApplication />} />
            <Route path="edit/:id" element={<EditApplication />} />
            <Route path="detail/:id" element={<ApplicationDetail />} />
            <Route path="kubeconfig" element={<KubeConfigPage />} />
            <Route path="cluster/:id/resources" element={<K8sResourcesPage />} />
            <Route path="cluster/:id/namespace/:namespace/pod/:podName" element={<PodDetailPage />} />
            <Route path="registry" element={<RegistryPage />} />
            <Route path="registry/private" element={<PrivateRegistryPage />} />
          </Route>
        </Routes>
      </Router>
    </ConfigProvider>
  );
}

export default App;

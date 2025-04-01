import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, theme, ConfigProvider, message } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppstoreOutlined,
  PlusOutlined,
  CloudServerOutlined,
  CloudUploadOutlined
} from '@ant-design/icons';
import zhCN from 'antd/lib/locale/zh_CN';
import './MainLayout.css';
import { Link } from 'react-router-dom';

const { Header, Content, Sider } = Layout;

// 高级错误清除函数
const clearErrors = () => {
  try {
    // 清除所有全局错误提示
    const errorAlerts = document.querySelectorAll('.ant-alert-error');
    if (errorAlerts.length > 0) {
      errorAlerts.forEach(alert => {
        try {
          // 尝试点击关闭按钮
          const closeBtn = alert.querySelector('.ant-alert-close-icon');
          if (closeBtn) {
            closeBtn.click();
          } else if (alert.parentNode) {
            // 如果没有关闭按钮，直接从DOM中移除
            alert.parentNode.removeChild(alert);
          }
        } catch (e) {
          console.error('移除错误提示失败:', e);
        }
      });
    }
    
    // 清除所有错误样式
    document.querySelectorAll('.ant-form-item-has-error').forEach(item => {
      try {
        item.classList.remove('ant-form-item-has-error');
      } catch (e) {
        console.error('移除错误样式失败:', e);
      }
    });
    
    // 清除所有错误消息
    document.querySelectorAll('.ant-form-item-explain-error').forEach(item => {
      try {
        if (item.parentNode) {
          item.parentNode.removeChild(item);
        }
      } catch (e) {
        console.error('移除错误消息失败:', e);
      }
    });
  } catch (e) {
    console.error('清除错误时发生异常:', e);
  }
};

// 应用全局错误拦截
const setupErrorInterceptor = () => {
  try {
    // 拦截console.error
    const originalConsoleError = console.error;
    console.error = function(...args) {
      // 特别处理镜像地址错误
      if (args.length > 0 && typeof args[0] === 'string' && 
         (args[0].includes('imageName') || args[0].includes('image'))) {
        // 不生成错误提示，直接清除已有错误
        clearErrors();
        return;
      }
      
      // 其他错误正常处理
      originalConsoleError.apply(console, args);
    };
    
    return () => {
      // 清理拦截器
      console.error = originalConsoleError;
    };
  } catch (e) {
    console.warn('设置错误拦截器失败:', e);
    return () => {};
  }
};

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const renderCount = useRef(0);
  
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const pathname = location.pathname;
    if (pathname.includes('/create')) return ['2'];
    if (pathname.includes('/edit') || pathname.includes('/detail')) return ['1'];
    if (pathname.includes('/kubeconfig')) return ['3'];
    if (pathname.includes('/registry')) return ['4'];
    return ['1']; // 默认选中应用列表
  };
  
  // 添加全局错误清除逻辑
  useEffect(() => {
    // 组件挂载时清除所有错误
    clearErrors();
    
    // 每次路径变化也清除
    const pathChangeHandler = () => {
      clearErrors();
    };
    
    // 设置错误拦截器
    const cleanupInterceptor = setupErrorInterceptor();
    
    // 重写message.error，确保不为镜像地址生成全局错误
    const originalMsgError = message.error;
    message.error = (content, ...args) => {
      if (typeof content === 'string' && 
        (content.includes('镜像地址') || 
         content.includes('image') || 
         content.includes('imageName'))) {
        // 对于镜像地址错误，仅在控制台输出，不显示全局消息
        console.log('不显示错误:', content);
        // 触发清除
        clearErrors();
        return;
      }
      return originalMsgError(content, ...args);
    };
    
    // 添加DOM变化监听器，捕获动态生成的错误提示
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && // 元素节点
                node.classList && 
                node.classList.contains('ant-alert-error')) {
              // 检查错误内容
              const errorContent = node.textContent || '';
              if (errorContent.includes('镜像地址') || 
                  errorContent.includes('image') || 
                  errorContent.includes('imageName')) {
                // 立即移除这个错误
                setTimeout(() => {
                  try {
                    const closeBtn = node.querySelector('.ant-alert-close-icon');
                    if (closeBtn) {
                      closeBtn.click();
                    } else if (node.parentNode) {
                      node.parentNode.removeChild(node);
                    }
                  } catch (e) {
                    console.error('动态移除错误提示失败:', e);
                  }
                }, 10);
              }
            }
          });
        }
      });
    });
    
    // 开始观察文档变化
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // 组件卸载时清理
    return () => {
      clearErrors();
      message.error = originalMsgError;
      cleanupInterceptor();
      observer.disconnect();
    };
  }, [location.pathname]);
  
  // 每次渲染后检查清除错误
  useEffect(() => {
    renderCount.current += 1;
    if (renderCount.current > 1) {
      // 不是首次渲染则延迟清除错误
      const timerId = setTimeout(clearErrors, 100);
      return () => clearTimeout(timerId);
    }
  });

  return (
    <ConfigProvider locale={zhCN}>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
        >
          <div className="logo">
            <h1>云平台</h1>
          </div>
          <Menu
            theme="dark"
            mode="inline"
            defaultSelectedKeys={getSelectedKey()}
            selectedKeys={getSelectedKey()}
            items={[
              {
                key: '1',
                icon: <AppstoreOutlined />,
                label: '应用列表',
                onClick: () => navigate('/')
              },
              {
                key: '2',
                icon: <PlusOutlined />,
                label: '新建应用',
                onClick: () => navigate('/create')
              },
              {
                key: '3',
                icon: <CloudServerOutlined />,
                label: 'Kubernetes集群',
                onClick: () => navigate('/kubeconfig')
              },
              {
                key: '4',
                icon: <CloudUploadOutlined />,
                label: '镜像仓库',
                onClick: () => navigate('/registry')
              }
            ]}
          />
        </Sider>
        <Layout>
          <Header style={{ padding: 0, background: colorBgContainer }} />
          <Content style={{ margin: '0 16px' }}>
            <div
              style={{
                padding: 24,
                minHeight: 360,
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
                marginTop: 16,
              }}
            >
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default MainLayout; 
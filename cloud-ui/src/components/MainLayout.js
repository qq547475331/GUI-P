import React, { useState } from 'react';
import { Layout, Menu, theme, ConfigProvider } from 'antd';
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

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
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
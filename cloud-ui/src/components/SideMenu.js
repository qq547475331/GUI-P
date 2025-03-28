import React from 'react';
import { Menu } from 'antd';
import { SettingOutlined, GlobalOutlined, SlidersFilled, DatabaseOutlined, DollarOutlined } from '@ant-design/icons';
import './SideMenu.css';

const SideMenu = ({ selectedKey, onSelect }) => {
  const handleMenuClick = (e) => {
    if (onSelect) {
      onSelect(e.key);
    }
  };

  return (
    <div className="side-menu">
      <div className="menu-header">
        <span className="back-button">&#x02C2; 应用部署</span>
      </div>
      <div className="menu-tabs">
        <span className="active-tab">配置表单</span>
        <span className="tab">YAML 文件</span>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        onClick={handleMenuClick}
        items={[
          {
            key: 'basic',
            icon: <SettingOutlined />,
            label: '基础配置',
          },
          {
            key: 'network',
            icon: <GlobalOutlined />,
            label: '网络配置',
          },
          {
            key: 'advanced',
            icon: <SlidersFilled />,
            label: '高级配置',
          },
          {
            type: 'divider',
          },
          {
            key: 'resource',
            icon: <DatabaseOutlined />,
            label: '资源配额',
          },
          {
            key: 'price',
            icon: <DollarOutlined />,
            label: '预估价格（每日）',
          },
        ]}
      />
    </div>
  );
};

export default SideMenu; 
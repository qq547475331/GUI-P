import React from 'react';
import { Card } from 'antd';
import KubeConfigManager from '../components/KubeConfigManager';
import './KubeConfigPage.css';

const KubeConfigPage = () => {
  return (
    <div className="kubeconfig-page">
      <Card title="Kubernetes集群配置管理" bordered={false}>
        <KubeConfigManager />
      </Card>
    </div>
  );
};

export default KubeConfigPage; 
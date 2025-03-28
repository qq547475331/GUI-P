import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Statistic, Row, Col, Divider, Alert } from 'antd';
import { DashboardOutlined, DatabaseOutlined, DollarOutlined } from '@ant-design/icons';
import apiService from '../services/api';
import './ResourceSummary.css';

const ResourceSummary = ({ formData }) => {
  const [resources, setResources] = useState({
    cpu: 0,
    memory: 0,
    storage: 0,
    total: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("ResourceSummary formData:", formData);
    if (formData) {
      estimateResources();
    }
  }, [formData]);

  const estimateResources = async () => {
    try {
      setLoading(true);
      // 计算存储卷总大小
      const storageSize = formData && formData.volumes ? formData.volumes.reduce((total, vol) => total + (vol.size || 0), 0) : 0;
      
      // 准备资源数据
      const resourceData = {
        cpu: formData ? formData.cpu || 0 : 0,
        memory: formData ? (formData.memory || 0) / 1024 : 0, // MB to GB
        storage: storageSize,
        instances: formData ? formData.instances || 1 : 1
      };
      
      // 获取价格估算
      const priceData = await apiService.getEstimatedPrice(resourceData);
      setResources(priceData);
    } catch (error) {
      console.error('计算资源估算失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 安全地访问formData属性
  const getFormValue = (key, defaultValue = '') => {
    if (!formData) return defaultValue;
    if (formData[key] === undefined || formData[key] === null) return defaultValue;
    return formData[key];
  };

  if (!formData) {
    return (
      <Alert
        message="数据加载中"
        description="请等待应用数据加载完成..."
        type="info"
        showIcon
      />
    );
  }

  return (
    <div className="resource-summary">
      <Alert
        message="配置概览"
        description="请确认您的应用配置信息，并查看资源使用估算。"
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />
      
      <Card title="基本信息" className="summary-card">
        <Descriptions bordered>
          <Descriptions.Item label="应用名称">{getFormValue('appName')}</Descriptions.Item>
          <Descriptions.Item label="镜像">{getFormValue('imageName')}</Descriptions.Item>
          <Descriptions.Item label="容器名称">{getFormValue('containerName')}</Descriptions.Item>
          <Descriptions.Item label="容器端口">{getFormValue('containerPort')}</Descriptions.Item>
          <Descriptions.Item label="实例数">{getFormValue('instances', 1)}</Descriptions.Item>
          <Descriptions.Item label="CPU">{getFormValue('cpu', 0.5)} Core</Descriptions.Item>
          <Descriptions.Item label="内存">{getFormValue('memory', 256)} MB</Descriptions.Item>
          <Descriptions.Item label="公网访问">{getFormValue('publicAccess') ? '是' : '否'}</Descriptions.Item>
          {getFormValue('kubeConfigId') && (
            <Descriptions.Item label="Kubernetes部署" span={2}>
              已配置 (命名空间: {getFormValue('namespace', 'default')})
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>
      
      <Divider />
      
      <Card title="资源消耗预估" className="summary-card">
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="CPU资源"
                value={getFormValue('cpu', 0.5) * getFormValue('instances', 1)}
                precision={2}
                suffix="Core"
                prefix={<DashboardOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="内存资源"
                value={(getFormValue('memory', 256) * getFormValue('instances', 1)) / 1024}
                precision={2}
                suffix="GB"
                prefix={<DatabaseOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="存储资源"
                value={(formData.volumes || []).reduce((total, vol) => total + (vol.size || 0), 0)}
                precision={0}
                suffix="GB"
                prefix={<DatabaseOutlined />}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>
      </Card>
      
      <Divider />
      
      <Card title="价格预估" className="summary-card">
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="CPU费用"
                value={resources.cpu}
                precision={2}
                prefix={<DollarOutlined />}
                suffix="/月"
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="内存费用"
                value={resources.memory}
                precision={2}
                prefix={<DollarOutlined />}
                suffix="/月"
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="存储费用"
                value={resources.storage}
                precision={2}
                prefix={<DollarOutlined />}
                suffix="/月"
                loading={loading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="总费用"
                value={resources.total}
                precision={2}
                prefix={<DollarOutlined />}
                suffix="/月"
                valueStyle={{ color: '#cf1322' }}
                loading={loading}
              />
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ResourceSummary; 
import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Statistic, Row, Col, Divider, Alert, Tag, Collapse, List, Typography } from 'antd';
import { DashboardOutlined, DatabaseOutlined } from '@ant-design/icons';
import apiService from '../services/api';
import './ResourceSummary.css';

const { Panel } = Collapse;
const { Text } = Typography;

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
      
      // 设置资源数据
      setResources({
        cpu: formData ? formData.cpu || 0 : 0,
        memory: formData ? (formData.memory || 0) / 1024 : 0, // MB to GB
        storage: storageSize,
        instances: formData ? formData.instances || 1 : 1
      });
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

  // 格式化容器资源为可读形式
  const formatResource = (value, unit) => {
    if (!value) return '不限制';
    return `${value} ${unit}`;
  };

  // 获取健康检查配置描述
  const getProbeDescription = (probe) => {
    if (!probe || !probe.probeType) return '未配置';
    
    let description = '';
    
    switch (probe.probeType) {
      case 'http':
        description = `HTTP GET ${probe.path || '/'} 端口:${probe.port || 80}`;
        break;
      case 'tcp':
        description = `TCP 端口:${probe.port || 80}`;
        break;
      case 'command':
        description = `执行命令: ${probe.command || '(空)'}`;
        break;
      default:
        description = '未知类型';
    }
    
    // 添加高级参数信息
    const advanced = [];
    if (probe.initialDelaySeconds) advanced.push(`初始延迟:${probe.initialDelaySeconds}秒`);
    if (probe.periodSeconds) advanced.push(`周期:${probe.periodSeconds}秒`);
    if (probe.timeoutSeconds) advanced.push(`超时:${probe.timeoutSeconds}秒`);
    if (probe.failureThreshold) advanced.push(`失败阈值:${probe.failureThreshold}`);
    
    if (advanced.length > 0) {
      description += ` (${advanced.join(', ')})`;
    }
    
    return description;
  };

  // 生命周期钩子描述
  const getLifecycleDescription = (hook, type) => {
    if (!hook || !hook.type) return '未配置';
    
    let description = '';
    
    switch (hook.type) {
      case 'exec':
        description = `执行命令: ${hook.command || '(空)'}`;
        break;
      case 'httpGet':
        description = `HTTP GET ${hook.path || '/'} 端口:${hook.port || 80}`;
        break;
      case 'tcpSocket':
        description = `TCP 端口:${hook.port || 80}`;
        break;
      default:
        description = '未知类型';
    }
    
    return description;
  };

  // 获取拉取策略描述
  const getImagePullPolicyDescription = (policy) => {
    switch (policy) {
      case 'Always':
        return '每次都拉取镜像';
      case 'Never':
        return '仅使用本地镜像';
      case 'IfNotPresent':
      default:
        return '优先使用本地镜像';
    }
  };

  // 获取安全上下文描述
  const getSecurityContextDescription = (context) => {
    if (!context) return '使用默认配置';
    
    const settings = [];
    
    if (context.privileged === true) settings.push('特权模式');
    if (context.runAsNonRoot === true) settings.push('以非root用户运行');
    if (context.runAsUser) settings.push(`用户ID: ${context.runAsUser}`);
    if (context.runAsGroup) settings.push(`组ID: ${context.runAsGroup}`);
    
    return settings.length > 0 ? settings.join(', ') : '使用默认配置';
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
      
      <Card title="应用概要" className="summary-card" style={{ marginTop: 16 }}>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="应用名称" span={2}>{formData.appName || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="命名空间">{formData.namespace || 'default'}</Descriptions.Item>
          <Descriptions.Item label="描述">{formData.description || '无描述'}</Descriptions.Item>
          <Descriptions.Item label="副本数">{formData.instances || 1}</Descriptions.Item>
          <Descriptions.Item label="服务类型">{formData.serviceType || 'ClusterIP'}</Descriptions.Item>
        </Descriptions>
      </Card>
      
      <Card title="容器配置" className="summary-card" style={{ marginTop: 16 }}>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="镜像" span={2}>{formData.imageName || 'nginx:latest'}</Descriptions.Item>
          <Descriptions.Item label="容器端口">{formData.containerPort || 80}</Descriptions.Item>
          <Descriptions.Item label="镜像拉取策略">{getImagePullPolicyDescription(formData.imagePullPolicy)}</Descriptions.Item>
          <Descriptions.Item label="CPU限制">{formatResource(formData.cpu, 'Core')}</Descriptions.Item>
          <Descriptions.Item label="内存限制">{formatResource(formData.memory, 'Mi')}</Descriptions.Item>
        </Descriptions>
      </Card>
      
      <Collapse style={{ marginTop: 16 }}>
        <Panel header="健康检查配置" key="healthCheck">
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="存活检查">{getProbeDescription(formData.livenessProbe)}</Descriptions.Item>
            <Descriptions.Item label="就绪检查">{getProbeDescription(formData.readinessProbe)}</Descriptions.Item>
            <Descriptions.Item label="启动检查">{getProbeDescription(formData.startupProbe)}</Descriptions.Item>
          </Descriptions>
        </Panel>

        <Panel header="生命周期管理" key="lifecycle">
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="启动后操作">
              {formData.lifecycle && formData.lifecycle.postStart ? 
                getLifecycleDescription(formData.lifecycle.postStart) : '未配置'}
            </Descriptions.Item>
            <Descriptions.Item label="终止前操作">
              {formData.lifecycle && formData.lifecycle.preStop ? 
                getLifecycleDescription(formData.lifecycle.preStop) : '未配置'}
            </Descriptions.Item>
          </Descriptions>
        </Panel>

        <Panel header="启动命令" key="command">
          {formData.useCustomCommand === 'yes' ? (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="命令">{formData.command || '未设置'}</Descriptions.Item>
              <Descriptions.Item label="参数">{formData.args || '未设置'}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Text>使用镜像默认命令</Text>
          )}
        </Panel>
        
        <Panel header="环境变量" key="envVars">
          {formData.envVars && formData.envVars.length > 0 ? (
            <List
              size="small"
              bordered
              dataSource={formData.envVars}
              renderItem={item => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <Text strong>{item.name}</Text>: 
                    {item.type === 'value' && <Text> {item.value}</Text>}
                    {item.type === 'configMap' && <Text> 来自ConfigMap "{item.configMapName}" 的键 "{item.configMapKey}"</Text>}
                    {item.type === 'secret' && <Text> 来自Secret "{item.secretName}" 的键 "{item.secretKey}"</Text>}
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Text>未配置环境变量</Text>
          )}
        </Panel>
        
        <Panel header="存储卷" key="storage">
          {formData.volumes && formData.volumes.length > 0 ? (
            <List
              size="small"
              bordered
              dataSource={formData.volumes}
              renderItem={item => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <Text strong>{item.name}</Text>: 
                    {item.type === 'emptyDir' && <Text> 临时存储卷{item.medium === 'Memory' ? '（内存）' : '（磁盘）'}</Text>}
                    {item.type === 'persistentVolumeClaim' && <Text> 持久存储卷 (PVC: {item.claimName})</Text>}
                    {item.type === 'configMap' && <Text> 配置卷 (ConfigMap: {item.configMapName})</Text>}
                    {item.type === 'secret' && <Text> 密钥卷 (Secret: {item.secretName})</Text>}
                    
                    {formData.volumeMounts && formData.volumeMounts.some(mount => mount.volumeName === item.name) && (
                      <div style={{ marginTop: 4 }}>
                        挂载路径: {formData.volumeMounts.find(mount => mount.volumeName === item.name)?.mountPath}
                        {formData.volumeMounts.find(mount => mount.volumeName === item.name)?.readOnly && ' (只读)'}
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <Text>未配置存储卷</Text>
          )}
        </Panel>
        
        <Panel header="安全上下文" key="security">
          <Text>{getSecurityContextDescription(formData.securityContext)}</Text>
        </Panel>
        
        <Panel header="调度规则" key="scheduling">
          {((formData.nodeSelector && formData.nodeSelector.length > 0) || 
           (formData.tolerations && formData.tolerations.length > 0) || 
           formData.affinity) ? (
            <div>
              {formData.nodeSelector && formData.nodeSelector.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>节点选择器:</Text>
                  <div style={{ marginTop: 8 }}>
                    {formData.nodeSelector.map((selector, index) => (
                      <Tag key={index} color="blue">{selector.key}: {selector.value}</Tag>
                    ))}
                  </div>
                </div>
              )}
              
              {formData.tolerations && formData.tolerations.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>容忍:</Text>
                  <List
                    size="small"
                    bordered
                    style={{ marginTop: 8 }}
                    dataSource={formData.tolerations}
                    renderItem={item => (
                      <List.Item>
                        {item.key}: {item.value} ({item.effect})
                      </List.Item>
                    )}
                  />
                </div>
              )}
              
              {formData.affinity && (
                <div>
                  <Text strong>亲和性规则:</Text>
                  <div style={{ marginTop: 8 }}>
                    已配置亲和性规则
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Text>使用默认调度规则</Text>
          )}
        </Panel>
      </Collapse>
    </div>
  );
};

export default ResourceSummary; 
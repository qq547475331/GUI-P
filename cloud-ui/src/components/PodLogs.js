import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Spin, Alert, Switch, Space, Typography, Tooltip } from 'antd';
import { DownloadOutlined, ClearOutlined, ReloadOutlined, DownOutlined } from '@ant-design/icons';
import apiService from '../services/api';

const { TextArea } = Input;
const { Text } = Typography;

const PodLogs = ({ kubeConfigId, namespace, podName, containerName }) => {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [followLogs, setFollowLogs] = useState(false);
  const [tailLines, setTailLines] = useState(100);
  const logsRef = useRef(null);
  const pollingRef = useRef(null);

  // 获取Pod日志
  const fetchLogs = async () => {
    if (!kubeConfigId || !namespace || !podName || !containerName) {
      setError('缺少必要参数');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const logsData = await apiService.getPodLogs(kubeConfigId, namespace, podName, containerName, {
        tailLines,
        follow: false // 不使用follow参数，而是通过前端轮询实现
      });
      
      // 处理日志数据，确保获取正确的日志文本
      let logText = '';
      if (typeof logsData === 'string') {
        logText = logsData;
      } else if (logsData && logsData.logs) {
        logText = logsData.logs;
      } else if (logsData && typeof logsData.data === 'string') {
        logText = logsData.data;
      } else if (logsData && logsData.data && logsData.data.logs) {
        logText = logsData.data.logs;
      }
      
      setLogs(logText || '');
      
      if (autoScroll && logsRef.current) {
        setTimeout(() => {
          logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }, 100);
      }
    } catch (err) {
      console.error('获取日志失败:', err);
      setError(`获取日志失败: ${err.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  // 下载日志
  const downloadLogs = () => {
    if (!logs) return;
    
    const element = document.createElement('a');
    const file = new Blob([logs], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${podName}-${containerName}-logs.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // 清空日志
  const clearLogs = () => {
    setLogs('');
  };

  // 滚动到底部
  const scrollToBottom = () => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  };

  // 开始日志轮询
  const startLogPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    
    pollingRef.current = setInterval(fetchLogs, 2000); // 每2秒刷新一次
  };

  // 停止日志轮询
  const stopLogPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // 组件挂载时获取日志
  useEffect(() => {
    fetchLogs();
    
    // 如果启用了日志跟踪，开始轮询
    if (followLogs) {
      startLogPolling();
    }
    
    return () => {
      stopLogPolling();
    };
  }, [kubeConfigId, namespace, podName, containerName, tailLines]);

  // 当followLogs状态改变时，启动或停止轮询
  useEffect(() => {
    if (followLogs) {
      startLogPolling();
    } else {
      stopLogPolling();
    }
    
    return () => {
      stopLogPolling();
    };
  }, [followLogs]);

  return (
    <div className="pod-logs-container">
      <Card
        title={`${podName} / ${containerName} 的日志`}
        extra={
          <Space>
            <Tooltip title="自动滚动到底部">
              <Switch
                checkedChildren="自动滚动"
                unCheckedChildren="手动滚动"
                checked={autoScroll}
                onChange={setAutoScroll}
              />
            </Tooltip>
            <Tooltip title="实时获取日志">
              <Switch
                checkedChildren="实时日志"
                unCheckedChildren="静态日志"
                checked={followLogs}
                onChange={setFollowLogs}
              />
            </Tooltip>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchLogs}
              loading={loading}
            >
              刷新
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={downloadLogs}
              disabled={!logs}
            >
              下载
            </Button>
            <Button
              icon={<ClearOutlined />}
              onClick={clearLogs}
              disabled={!logs}
            >
              清空
            </Button>
            <Button
              icon={<DownOutlined />}
              onClick={scrollToBottom}
              disabled={!logs}
            >
              底部
            </Button>
          </Space>
        }
      >
        {error ? (
          <Alert
            message="错误"
            description={error}
            type="error"
            showIcon
          />
        ) : (
          <div style={{ position: 'relative', minHeight: '400px' }}>
            {loading && !logs && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                <Spin tip="获取日志中..." />
              </div>
            )}
            
            <TextArea
              ref={logsRef}
              value={logs || '暂无日志数据'}
              readOnly
              style={{
                width: '100%',
                height: '500px',
                fontFamily: 'monospace',
                fontSize: '12px',
                backgroundColor: '#000',
                color: '#f1f1f1',
                overflowY: 'auto'
              }}
            />
            
            {!logs && !loading && (
              <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
                暂无日志数据
              </Text>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default PodLogs; 
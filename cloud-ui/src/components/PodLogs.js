import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Input, Spin, Alert, Switch, Space, Typography, Tooltip, Tag } from 'antd';
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
  const [usingWebSocket, setUsingWebSocket] = useState(false);
  const logsRef = useRef(null);
  const pollingRef = useRef(null);
  const wsRef = useRef(null);

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

  // 通过WebSocket获取实时日志
  const connectWebSocketLogs = () => {
    // 检查终端WebSocket是否正在使用中
    const checkTerminalWebSocket = () => {
      if (window._podTerminalWebSocket) {
        try {
          // 如果终端WebSocket连接正在建立或已打开，可能需要在终端页面先连接
          if (window._podTerminalWebSocket.readyState === WebSocket.CONNECTING ||
              window._podTerminalWebSocket.readyState === WebSocket.OPEN) {
            console.log('检测到终端WebSocket正在使用中，可能需要先断开终端连接');
            return true;
          }
        } catch (e) {
          console.warn('检查终端WebSocket状态出错:', e);
        }
      }
      return false;
    };
    
    // 如果终端连接正在使用中，切换到轮询模式以避免冲突
    if (checkTerminalWebSocket()) {
      console.log('检测到终端WebSocket活跃，切换到日志轮询模式');
      setUsingWebSocket(false);
      startLogPolling();
      return;
    }

    // 关闭现有WebSocket连接
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || 
            wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      } catch (err) {
        console.warn('关闭WebSocket连接出错:', err);
      }
      wsRef.current = null;
      window._podLogsWebSocket = null;
    }

    // 停止轮询
    stopLogPolling();

    try {
      // 构建WebSocket URL
      const wsUrl = apiService.getPodLogsStreamUrl(
        kubeConfigId, 
        namespace, 
        podName, 
        containerName, 
        tailLines
      );
      
      console.log('连接日志WebSocket:', wsUrl);
      
      // 创建WebSocket连接
      wsRef.current = new WebSocket(wsUrl);
      // 存储到全局变量
      window._podLogsWebSocket = wsRef.current;
      
      // 连接成功
      wsRef.current.onopen = () => {
        console.log('日志WebSocket连接已建立');
        setLoading(false);
        setError(null);
        setUsingWebSocket(true);
      };
      
      // 接收消息
      wsRef.current.onmessage = (event) => {
        if (event.data) {
          setLogs(prevLogs => {
            // 避免日志过长导致性能问题，限制为最新的10000行
            const maxLines = 10000;
            let newLogs = prevLogs + event.data;
            
            // 如果日志行数过多，保留最新的部分
            const lines = newLogs.split('\n');
            if (lines.length > maxLines) {
              newLogs = lines.slice(lines.length - maxLines).join('\n');
            }
            
            return newLogs;
          });
          
          // 自动滚动到底部
          if (autoScroll && logsRef.current) {
            logsRef.current.scrollTop = logsRef.current.scrollHeight;
          }
        }
      };
      
      // 错误处理
      wsRef.current.onerror = (err) => {
        console.error('日志WebSocket错误:', err);
        // 不立即显示错误，等待onclose处理
      };
      
      // 连接关闭
      wsRef.current.onclose = (event) => {
        console.log('日志WebSocket连接关闭:', event.code, event.reason);
        
        // 清理引用
        if (window._podLogsWebSocket === wsRef.current) {
          window._podLogsWebSocket = null;
        }
        
        // 如果仍在跟踪模式，切换到轮询
        if (followLogs) {
          setUsingWebSocket(false);
          startLogPolling();
        }
      };
    } catch (err) {
      console.error('创建日志WebSocket连接失败:', err);
      setError(`创建日志WebSocket连接失败: ${err.message || '未知错误'}`);
      setUsingWebSocket(false);
      
      // 回退到轮询模式
      if (followLogs) {
        startLogPolling();
      }
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
    
    // 立即执行一次
    fetchLogs();
    
    pollingRef.current = setInterval(fetchLogs, 2000); // 每2秒刷新一次
  };

  // 停止日志轮询
  const stopLogPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // 关闭WebSocket连接
  const closeWebSocket = () => {
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN || 
            wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
        }
      } catch (err) {
        console.warn('关闭WebSocket连接出错:', err);
      }
      wsRef.current = null;
      
      // 清理全局引用
      if (window._podLogsWebSocket) {
        window._podLogsWebSocket = null;
      }
    }
    
    setUsingWebSocket(false);
  };

  // 处理日志跟踪模式变化
  const handleFollowLogsChange = (newValue) => {
    setFollowLogs(newValue);
    
    if (newValue) {
      // 优先尝试WebSocket连接，除非终端正在使用WebSocket
      if (!window._podTerminalWebSocket || 
          window._podTerminalWebSocket.readyState !== WebSocket.OPEN) {
        connectWebSocketLogs();
      } else {
        // 终端正在使用，使用轮询模式
        setUsingWebSocket(false);
        startLogPolling();
      }
    } else {
      // 关闭所有实时更新
      stopLogPolling();
      closeWebSocket();
    }
  };

  // 组件挂载时获取日志
  useEffect(() => {
    fetchLogs();
    
    return () => {
      stopLogPolling();
      closeWebSocket();
    };
  }, [kubeConfigId, namespace, podName, containerName, tailLines]);

  // 当followLogs状态改变时
  useEffect(() => {
    return () => {
      stopLogPolling();
      closeWebSocket();
    };
  }, []);

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
            <Tooltip title={usingWebSocket ? "正在使用WebSocket实时获取" : "实时获取日志"}>
              <Switch
                checkedChildren={usingWebSocket ? "WebSocket实时" : "实时日志"}
                unCheckedChildren="静态日志"
                checked={followLogs}
                onChange={handleFollowLogsChange}
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
            
            {usingWebSocket && followLogs && (
              <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                <Tag color="blue">WebSocket实时连接</Tag>
              </div>
            )}
            
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
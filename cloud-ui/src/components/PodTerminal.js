import React, { useState, useEffect, useRef } from 'react';
import { Card, Alert, Spin, Select, Button, Space, Divider, Typography } from 'antd';
import { ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import apiService from '../services/api';
import '@xterm/xterm/css/xterm.css';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

const { Option } = Select;
const { Text } = Typography;

const PodTerminal = ({ kubeConfigId, namespace, podName, containerName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [availableContainers, setAvailableContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState(containerName || '');
  
  const terminalRef = useRef(null);
  const terminalDivRef = useRef(null);
  const socketRef = useRef(null);
  const fitAddonRef = useRef(null);

  // 初始化终端
  const initTerminal = () => {
    if (!terminalDivRef.current) return;
    
    // 如果已经有终端实例，先销毁
    if (terminalRef.current) {
      terminalRef.current.dispose();
    }
    
    // 创建新的fit插件
    fitAddonRef.current = new FitAddon();
    
    // 创建新的终端实例
    terminalRef.current = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#202124',
        foreground: '#f1f1f1',
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    });
    
    // 加载fit插件
    terminalRef.current.loadAddon(fitAddonRef.current);
    
    // 将终端附加到DOM元素
    terminalRef.current.open(terminalDivRef.current);
    
    // 调整终端大小以适应容器
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);
  };

  // 连接WebSocket
  const connectToTerminal = async () => {
    if (!kubeConfigId || !namespace || !podName || !selectedContainer) {
      setError('缺少必要参数');
      setLoading(false);
      return;
    }
    
    // 关闭之前的连接
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // 初始化终端
      initTerminal();
      
      // 构建WebSocket URL
      const wsUrl = apiService.getPodTerminalUrl(
        kubeConfigId,
        namespace,
        podName,
        selectedContainer
      );
      
      console.log('连接终端的WebSocket URL:', wsUrl);
      
      // 创建WebSocket连接
      socketRef.current = new WebSocket(wsUrl);
      
      // WebSocket打开后的处理
      socketRef.current.onopen = () => {
        setLoading(false);
        setConnected(true);
        
        if (terminalRef.current) {
          // 监听终端输入并发送到WebSocket
          terminalRef.current.onData(data => {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({ type: 'stdin', data }));
            }
          });
          
          // 发送终端大小信息
          const { cols, rows } = terminalRef.current;
          socketRef.current.send(JSON.stringify({
            type: 'resize',
            cols,
            rows
          }));
        }
      };
      
      // 接收WebSocket消息
      socketRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'stdout' || message.type === 'stderr') {
            terminalRef.current && terminalRef.current.write(message.data);
          }
        } catch (err) {
          console.error('解析WebSocket消息失败:', err);
          // 尝试直接写入
          terminalRef.current && terminalRef.current.write(event.data);
        }
      };
      
      // WebSocket错误处理
      socketRef.current.onerror = (err) => {
        console.error('WebSocket错误:', err);
        setError(`连接错误: ${err.message || '未知错误'}`);
        setConnected(false);
        setLoading(false);
      };
      
      // WebSocket关闭处理
      socketRef.current.onclose = () => {
        setConnected(false);
        
        // 添加关闭信息到终端
        if (terminalRef.current) {
          terminalRef.current.write('\r\n\x1b[1;31m连接已关闭。请点击"连接"按钮重新连接。\x1b[0m\r\n');
        }
      };
      
      // 监听窗口大小变化，调整终端大小
      const handleResize = () => {
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
          
          // 发送新的终端大小到服务器
          if (socketRef.current && 
              socketRef.current.readyState === WebSocket.OPEN && 
              terminalRef.current) {
            const { cols, rows } = terminalRef.current;
            socketRef.current.send(JSON.stringify({
              type: 'resize',
              cols,
              rows
            }));
          }
        }
      };
      
      window.addEventListener('resize', handleResize);
      
      // 返回清理函数
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    } catch (err) {
      console.error('连接终端失败:', err);
      setError(`连接终端失败: ${err.message || '未知错误'}`);
      setLoading(false);
    }
  };

  // 断开连接
  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setConnected(false);
  };

  // 重新连接
  const reconnect = () => {
    disconnect();
    connectToTerminal();
  };

  // 获取Pod可用容器
  const fetchPodContainers = async () => {
    if (!kubeConfigId || !namespace || !podName) {
      return;
    }
    
    try {
      // 假设有API获取Pod详情，如果API不存在，可以从上层组件接收完整的容器列表
      const podsData = await apiService.getPods(kubeConfigId, namespace);
      const targetPod = podsData.find(p => p.name === podName);
      
      if (targetPod && targetPod.containers) {
        setAvailableContainers(targetPod.containers.map(c => c.name));
        
        // 如果没有预先选择容器或容器不在列表中，选择第一个
        if (!selectedContainer || !targetPod.containers.find(c => c.name === selectedContainer)) {
          setSelectedContainer(targetPod.containers[0].name);
        }
      }
    } catch (err) {
      console.error('获取Pod容器列表失败:', err);
      setError(`获取容器列表失败: ${err.message || '未知错误'}`);
    }
  };

  // 切换全屏模式
  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
    
    // 调整大小以适应新的容器尺寸
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        
        // 发送新的终端大小到服务器
        if (socketRef.current && 
            socketRef.current.readyState === WebSocket.OPEN && 
            terminalRef.current) {
          const { cols, rows } = terminalRef.current;
          socketRef.current.send(JSON.stringify({
            type: 'resize',
            cols,
            rows
          }));
        }
      }
    }, 100);
  };

  // 组件挂载后获取容器列表
  useEffect(() => {
    fetchPodContainers();
    
    // 组件卸载时清理
    return () => {
      disconnect();
      
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
  }, [kubeConfigId, namespace, podName]);

  // 当容器变化时重新连接
  useEffect(() => {
    if (selectedContainer) {
      reconnect();
    }
  }, [selectedContainer]);

  return (
    <div className={`pod-terminal-container ${fullscreen ? 'fullscreen' : ''}`}>
      <Card
        title={
          <Space>
            <Text strong>终端: {podName} / {selectedContainer}</Text>
            {availableContainers.length > 1 && (
              <>
                <Divider type="vertical" />
                <Space>
                  <Text>容器:</Text>
                  <Select
                    value={selectedContainer}
                    onChange={setSelectedContainer}
                    style={{ width: 150 }}
                    disabled={loading}
                  >
                    {availableContainers.map(container => (
                      <Option key={container} value={container}>{container}</Option>
                    ))}
                  </Select>
                </Space>
              </>
            )}
            <Divider type="vertical" />
            <Text type={connected ? 'success' : 'danger'}>
              {connected ? '已连接' : '未连接'}
            </Text>
          </Space>
        }
        extra={
          <Space>
            <Button
              type={connected ? 'default' : 'primary'}
              onClick={connected ? disconnect : connectToTerminal}
              loading={loading}
            >
              {connected ? '断开' : '连接'}
            </Button>
            <Button
              icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
            >
              {fullscreen ? '退出全屏' : '全屏'}
            </Button>
            {connected && (
              <Button
                icon={<ReloadOutlined />}
                onClick={reconnect}
              >
                重新连接
              </Button>
            )}
          </Space>
        }
        bodyStyle={{ 
          padding: fullscreen ? '20px' : '12px', 
          height: fullscreen ? 'calc(100vh - 120px)' : '500px',
          backgroundColor: '#202124'
        }}
        style={{ 
          width: '100%', 
          position: fullscreen ? 'fixed' : 'relative',
          top: fullscreen ? 0 : 'auto',
          left: fullscreen ? 0 : 'auto',
          right: fullscreen ? 0 : 'auto',
          bottom: fullscreen ? 0 : 'auto',
          zIndex: fullscreen ? 1000 : 'auto',
          margin: 0,
          borderRadius: fullscreen ? 0 : '8px'
        }}
      >
        {error ? (
          <Alert
            message="错误"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : loading && !connected ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            backgroundColor: '#202124' 
          }}>
            <Spin tip="连接中..." />
          </div>
        ) : (
          <div 
            ref={terminalDivRef}
            style={{ 
              height: '100%', 
              width: '100%', 
              backgroundColor: '#202124',
              borderRadius: '4px',
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default PodTerminal; 
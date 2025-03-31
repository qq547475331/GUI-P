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
  const [isVisibleInTab, setIsVisibleInTab] = useState(false); // 标记终端是否在当前活动标签页中
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false); // 添加手动断开标记
  
  const terminalRef = useRef(null);
  const terminalDivRef = useRef(null);
  const socketRef = useRef(null);
  const fitAddonRef = useRef(null);
  const connectionAttempted = useRef(false); // 标记是否已经尝试过连接

  // 添加全局连接池，保存断开的WebSocket连接以便重用
  if (!window._websocketConnections) {
    window._websocketConnections = {};
  }

  // 添加全局连接器状态
  if (!window._podTerminalConnectionStatus) {
    window._podTerminalConnectionStatus = {
      connecting: false,
      lastUrl: '',
      lastAttemptTime: 0
    };
  }

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
        cursor: '#FFFFFF',  // 光标颜色设为纯白色增强可见性
        cursorAccent: '#000000' // 光标下方文本颜色
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      rendererType: 'canvas',  // 使用canvas渲染器提高性能
      convertEol: true,        // 确保行尾换行符正确转换
      scrollback: 1000,        // 增加回滚历史
      disableStdin: false,     // 确保可以输入
      cursorStyle: 'block',    // 使用块状光标，更容易看到
      cursorWidth: 2,          // 增加光标宽度
    });
    
    // 标记为新实例，确保不会重复绑定事件
    terminalRef.current._eventsBound = false;
    
    // 加载fit插件
    terminalRef.current.loadAddon(fitAddonRef.current);
    
    // 将终端附加到DOM元素
    terminalRef.current.open(terminalDivRef.current);
    
    // 立即聚焦终端，确保光标可见
    terminalRef.current.focus();
    
    // 调整终端大小以适应容器
    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
      
      // 再次聚焦终端
      if (terminalRef.current) {
        terminalRef.current.focus();
      }
    }, 100);
    
    // 确保光标可见 - 添加测试字符然后清空
    if (terminalRef.current) {
      // 写入并清除一个测试字符，这可以触发终端更新光标
      terminalRef.current.write('_');
      setTimeout(() => {
        terminalRef.current.clear();
      }, 50);
    }
  };

  // 连接WebSocket
  const connectToTerminal = async () => {
    console.log('开始连接终端...');
    
    // 强制重置连接状态的函数
    const forceResetConnection = () => {
      console.log('强制重置连接状态，跳过等待时间');
      
      // 立即关闭所有现有连接
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
        socketRef.current = null;
      }
      
      // 清理全局引用
      if (window._podTerminalWebSocket) {
        window._podTerminalWebSocket = null;
      }
      
      // 立即重置loading状态
      setLoading(false);
      
      // 立即初始化终端
      initTerminal();
      if (terminalRef.current) {
        terminalRef.current.clear();
        terminalRef.current.write('\x1b[1;34m正在快速连接到容器，请稍候...\x1b[0m\r\n');
      }
      
      // 准备WebSocket URL
      const wsUrl = apiService.getPodTerminalUrl(
        kubeConfigId,
        namespace,
        podName,
        selectedContainer
      );
      
      // 轻微延迟后创建新连接
      setTimeout(() => {
        try {
          console.log('直接创建新WebSocket连接:', wsUrl);
          socketRef.current = new WebSocket(wsUrl);
          window._podTerminalWebSocket = socketRef.current;
          
          // 设置更短的超时时间
          setupWebSocketHandlers(socketRef.current, 1500);
          
          // 记录状态
          window._podTerminalConnectionStatus.lastUrl = wsUrl;
          window._podTerminalConnectionStatus.lastAttemptTime = Date.now();
        } catch (err) {
          console.error('创建连接失败:', err);
          setError(`连接失败: ${err.message || '未知错误'}`);
        }
      }, 50);
      
      return true; // 表示已执行重置
    };
    
    if (!kubeConfigId || !namespace || !podName || !selectedContainer) {
      setError('缺少必要参数');
      setLoading(false);
      return;
    }
    
    // 清除之前的错误信息，设置连接中状态
    setError(null);
    setLoading(true);
    
    // 直接使用强制重置功能，跳过标准连接流程
    return forceResetConnection();
  };

  // 设置WebSocket事件处理程序
  const setupWebSocketHandlers = (socket, timeoutMs = 3000) => {
    if (!socket) return;
    
    // 设置超时以防连接无响应
    const connectionTimeout = setTimeout(() => {
      console.log('连接超时检查, 当前状态:', socket ? socket.readyState : 'null');
      
      if (socket && socket.readyState !== WebSocket.OPEN) {
        console.warn('连接超时，正在中断连接');
        setError('连接超时，请检查网络后重试');
        setLoading(false);
        
        try {
          if (socket) {
            socket.close();
            if (socketRef.current === socket) {
              socketRef.current = null;
            }
            cleanupGlobalSocketRef();
          }
        } catch (err) {
          console.log('关闭超时连接出错:', err);
        }
      }
    }, timeoutMs);
    
    // WebSocket打开后的处理
    socket.onopen = () => {
      console.log('WebSocket连接已打开');
      clearTimeout(connectionTimeout);
      setLoading(false);
      setConnected(true);
      setError(null); // 清除所有错误信息
      
      console.log('终端WebSocket连接已建立成功');
      
      if (terminalRef.current) {
        // 清除之前的消息
        terminalRef.current.clear();
        
        // 确保终端获得焦点
        terminalRef.current.focus();
        
        // 添加连接成功消息
        terminalRef.current.write('\x1b[1;32m连接已建立成功，可以开始输入命令...\x1b[0m\r\n');
        
        // 完全重构输入处理逻辑，确保没有重复监听
        if (!terminalRef.current._eventsBound) {
          console.log('绑定终端数据事件处理器...');
          
          // 保存原始的onData方法，如果存在的话先移除
          if (terminalRef.current._originalDataHandler) {
            try {
              // 尝试解绑现有的处理函数
              const terminal = terminalRef.current;
              // 移除所有现有的onData处理函数
              terminal._core._coreService.onData.clear();
            } catch (e) {
              console.log('移除旧事件处理器失败，但不影响使用:', e);
            }
          }
          
          // 定义新的数据处理函数
          const handleTerminalInput = (inputData) => {
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              try {
                // 直接发送数据，不做任何转换，避免重复字符问题
                socketRef.current.send(inputData);
              } catch (err) {
                console.error('发送终端数据失败:', err);
                
                // 如果发送失败且连接已关闭，尝试重新连接
                if (socketRef.current.readyState !== WebSocket.OPEN) {
                  setConnected(false);
                  setError('连接已断开，正在尝试重新连接...');
                  reconnect();
                }
              }
            }
          };
          
          // 保存处理函数引用
          terminalRef.current._originalDataHandler = handleTerminalInput;
          
          // 绑定新的处理函数
          terminalRef.current.onData(handleTerminalInput);
          
          // 标记为已绑定事件
          terminalRef.current._eventsBound = true;
          
          console.log('终端数据事件处理器绑定完成');
        } else {
          console.log('终端数据事件已绑定，跳过重复绑定');
        }
        
        try {
          // 发送终端大小信息（使用二进制格式，这是Kubernetes终端协议要求的）
          if (terminalRef.current.cols && terminalRef.current.rows) {
            const { cols, rows } = terminalRef.current;
            // 使用二进制数据发送终端大小
            const sizeMessage = new Uint8Array(5);
            sizeMessage[0] = 1; // 终端大小命令的标识符
            sizeMessage[1] = cols >> 8;
            sizeMessage[2] = cols & 0xFF;
            sizeMessage[3] = rows >> 8;
            sizeMessage[4] = rows & 0xFF;
            socket.send(sizeMessage);
            
            // 发送命令序列 - 立即发送所有命令
            const sendCommands = () => {
              if (socket && socket.readyState === WebSocket.OPEN) {
                // 发送回车和bash切换命令一次性处理
                socket.send("\r\n\rif [ -x /bin/bash ]; then /bin/bash; elif [ -x /usr/bin/bash ]; then /usr/bin/bash; fi\r");
                
                // 稍后发送清屏命令
                setTimeout(() => {
                  if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send("clear && pwd\r");
                  }
                }, 50); // 使用更短的延迟
              }
            };
            
            // 立即启动命令序列
            sendCommands();
          }
        } catch (err) {
          console.error('发送终端大小信息失败:', err);
        }
      }
    };
    
    // 接收WebSocket消息
    socket.onmessage = (event) => {
      // 收到消息意味着连接已成功，清除超时
      clearTimeout(connectionTimeout);
      
      // 如果收到消息但状态为未连接，更新状态
      if (!connected) {
        console.log('收到WebSocket消息，更新连接状态为已连接');
        setConnected(true);
        setLoading(false);
        setError(null); // 确保清除错误信息
      }
      
      try {
        // 直接将收到的消息写入终端，不尝试解析JSON
        if (terminalRef.current && event.data) {
          terminalRef.current.write(event.data);
          
          // 确保终端持续聚焦
          terminalRef.current.focus();
        }
      } catch (err) {
        console.error('处理终端消息失败:', err);
      }
    };
    
    // WebSocket错误处理
    socket.onerror = (err) => {
      console.warn('WebSocket错误:', err);
      
      // 如果既没有消息也未连接，则清理超时并显示错误
      if (!connected && loading) {
        clearTimeout(connectionTimeout);
        
        if (!error) { // 避免重复设置错误
          setError('连接出错，请点击重新连接按钮重试');
        }
        setLoading(false);
      }
    };
    
    // WebSocket关闭处理
    socket.onclose = (event) => {
      clearTimeout(connectionTimeout);
      console.log('WebSocket连接关闭, 状态码:', event.code, '原因:', event.reason);
      
      // 确保清理全局引用
      cleanupGlobalSocketRef();
      
      // 已经接收到消息但连接关闭 - 说明终端运行过，但后来断开
      if (connected) {
        setConnected(false);
        
        // 添加关闭信息到终端
        if (terminalRef.current) {
          terminalRef.current.write('\r\n\x1b[1;31m连接已关闭。请点击"重新连接"按钮重新连接。\x1b[0m\r\n');
        }
      } 
      // 未收到消息且连接关闭 - 连接失败
      else if (loading) {
        setLoading(false);
        if (!error) { // 避免覆盖之前的更具体错误
          if (event.code === 1006) {
            setError('无法建立终端连接，请点击"连接"按钮手动连接');
          } else {
            setError(`连接关闭(代码: ${event.code})，请点击"连接"按钮重试`);
          }
        }
      }
    };
    
    // 监听窗口大小变化，调整终端大小
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
        
        // 发送新的终端大小到服务器
        if (socket && 
            socket.readyState === WebSocket.OPEN && 
            terminalRef.current && 
            terminalRef.current.cols && 
            terminalRef.current.rows) {
          
          try {
            const { cols, rows } = terminalRef.current;
            // 使用二进制数据发送终端大小
            const sizeMessage = new Uint8Array(5);
            sizeMessage[0] = 1; // 终端大小命令的标识符
            sizeMessage[1] = cols >> 8;
            sizeMessage[2] = cols & 0xFF;
            sizeMessage[3] = rows >> 8;
            sizeMessage[4] = rows & 0xFF;
            socket.send(sizeMessage);
          } catch (err) {
            console.error('发送终端大小信息失败:', err);
          }
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // 添加网络状态变化监听器
    const handleNetworkChange = () => {
      if (!navigator.onLine && connected) {
        setError('网络连接已断开，请检查您的网络连接');
        if (terminalRef.current) {
          terminalRef.current.write('\r\n\x1b[1;31m网络连接已断开，请检查您的网络连接后重新连接。\x1b[0m\r\n');
        }
      } else if (navigator.onLine && !connected && !loading) {
        // 网络恢复时尝试重连
        setError('网络连接已恢复，正在尝试重新连接...');
        reconnect();
      }
    };
    
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    
    // 返回清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
      clearTimeout(connectionTimeout);
      if (socketRef.current === socket) {
        cleanupGlobalSocketRef();
      }
    };
  };

  // 清理全局WebSocket引用
  const cleanupGlobalSocketRef = () => {
    if (window._podTerminalWebSocket === socketRef.current) {
      window._podTerminalWebSocket = null;
    }
  };

  // 关闭所有WebSocket连接
  const closeAllWebSockets = async () => {
    // 关闭日志WebSocket (这里是关闭pod日志的websocket)
    if (window._podLogsWebSocket) {
      try {
        if (window._podLogsWebSocket.readyState === WebSocket.OPEN || 
            window._podLogsWebSocket.readyState === WebSocket.CONNECTING) {
          console.log('正在关闭Pod日志WebSocket以避免资源冲突');
          window._podLogsWebSocket.close();
        }
      } catch (e) {
        console.warn('关闭Pod日志WebSocket时出错:', e);
      }
      window._podLogsWebSocket = null;
    }
    
    // 关闭终端WebSocket
    if (window._podTerminalWebSocket) {
      try {
        if (window._podTerminalWebSocket.readyState === WebSocket.OPEN || 
            window._podTerminalWebSocket.readyState === WebSocket.CONNECTING) {
          window._podTerminalWebSocket.close();
        }
      } catch (e) {
        console.warn('关闭已存在的终端WebSocket时出错:', e);
      }
      window._podTerminalWebSocket = null;
    }
    
    // 减少等待时间，从300ms降至50ms，大幅减少连接延迟
    console.log('等待50ms确保WebSocket资源释放');
    return new Promise(resolve => setTimeout(resolve, 50));
  };

  // 断开连接
  const disconnect = () => {
    // 设置手动断开标记
    setManuallyDisconnected(true);
    
    // 清理WebSocket连接
    if (socketRef.current) {
      try {
        // 检查WebSocket连接状态
        if (socketRef.current.readyState === WebSocket.OPEN || 
            socketRef.current.readyState === WebSocket.CONNECTING) {
          // 发送关闭命令 - 通知服务器我们要主动关闭
          try {
            socketRef.current.send("\x04"); // 发送EOF信号
            // 给服务器一点时间处理关闭请求
            setTimeout(() => {
              try {
                socketRef.current.close(1000, "用户手动断开连接");
              } catch (e) {
                console.warn('关闭WebSocket时出错:', e);
              }
            }, 100);
          } catch (e) {
            // 如果发送关闭命令失败，直接关闭
            try {
              socketRef.current.close();
            } catch (err) {
              console.log('关闭WebSocket连接出错:', err);
            }
          }
        }
      } catch (err) {
        console.log('关闭WebSocket连接出错:', err);
      }
      
      socketRef.current = null;
      cleanupGlobalSocketRef();
    }
    
    // 重置状态
    setConnected(false);
  };

  // 重新连接
  const reconnect = () => {
    console.log('执行重新连接...');
    
    // 清除手动断开标记，允许自动连接
    setManuallyDisconnected(false);
    
    // 先清除错误提示，显示正在连接中
    setError(null);
    
    // 如果没有连接中，才执行重连操作
    if (!loading) {
      // 断开当前连接
      if (socketRef.current) {
        try {
          // 只在连接打开或正在建立中时才需要关闭
          if (socketRef.current.readyState === WebSocket.OPEN || 
              socketRef.current.readyState === WebSocket.CONNECTING) {
            socketRef.current.close();
          }
        } catch (err) {
          console.log('关闭之前的连接出错:', err);
        }
        socketRef.current = null;
        cleanupGlobalSocketRef();
      }
      
      // 立即连接，不使用延迟
      connectToTerminal();
    }
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
            terminalRef.current && 
            terminalRef.current.cols && 
            terminalRef.current.rows) {
            
          try {
            const { cols, rows } = terminalRef.current;
            // 使用二进制数据发送终端大小
            const sizeMessage = new Uint8Array(5);
            sizeMessage[0] = 1; // 终端大小命令的标识符
            sizeMessage[1] = cols >> 8;
            sizeMessage[2] = cols & 0xFF;
            sizeMessage[3] = rows >> 8;
            sizeMessage[4] = rows & 0xFF;
            socketRef.current.send(sizeMessage);
          } catch (err) {
            console.error('发送终端大小信息失败:', err);
          }
        }
      }
    }, 100);
  };

  // 组件挂载后获取容器列表
  useEffect(() => {
    fetchPodContainers();
    
    // 检测当前是否在终端标签页
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'terminal') {
      setIsVisibleInTab(true);
    }
    
    // 组件卸载时清理
    return () => {
      disconnect();
      
      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }
    };
  }, [kubeConfigId, namespace, podName]);

  // 监听URL变化，检测是否在终端标签页
  useEffect(() => {
    const handleUrlChange = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get('tab');
      const wasVisible = isVisibleInTab;
      const nowVisible = tabParam === 'terminal';
      
      setIsVisibleInTab(nowVisible);
      
      // 如果终端从不可见变为可见，尝试连接
      if (!wasVisible && nowVisible) {
        console.log('终端标签页变为可见，重置连接状态');
        connectionAttempted.current = false;
        // 重置手动断开状态，使得标签页变为可见时可以自动连接
        setManuallyDisconnected(false);
      }
    };
    
    // 监听popstate事件，捕获浏览器前进/后退导致的URL变化
    window.addEventListener('popstate', handleUrlChange);
    
    // 初始检查
    handleUrlChange();
    
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, [isVisibleInTab]);

  // 当容器列表首次加载或变化时进行连接
  useEffect(() => {
    // 只有在有容器可选且未手动断开的情况下才考虑连接
    if (selectedContainer && isVisibleInTab && !manuallyDisconnected) {
      console.log('终端组件可见且有容器，检查连接状态:', {connected, loading, connectionAttempted: connectionAttempted.current, manuallyDisconnected});
      
      // 如果未连接且不在加载中，则尝试连接
      if (!connected && !loading) {
        console.log('终端需要连接，立即启动连接...');
        
        // 立即连接，不要使用延迟
        connectToTerminal();
        connectionAttempted.current = true;
      }
    }
  }, [selectedContainer, isVisibleInTab, connected, loading, manuallyDisconnected]);

  // 当终端标签页变为可见时，进行连接或确保正常显示
  useEffect(() => {
    if (isVisibleInTab && !manuallyDisconnected) {
      console.log('终端标签页变为可见，当前状态:', { connected, loading, connectionAttempted: connectionAttempted.current, manuallyDisconnected });
      
      // 如果未连接且不在加载中，则尝试连接
      if (!connected && !loading) {
        console.log('终端标签页变为可见，立即连接');
        
        // 立即连接，不使用重新连接的逻辑，避免不必要的延迟
        connectToTerminal();
        connectionAttempted.current = true;
      }
    }
  }, [isVisibleInTab, connected, loading, manuallyDisconnected]);
  
  // 确保终端尺寸正确且在显示后获得焦点
  useEffect(() => {
    const handleDelayedFit = () => {
      if (connected && terminalRef.current && fitAddonRef.current) {
        setTimeout(() => {
          fitAddonRef.current.fit();
          terminalRef.current.focus();
        }, 200);
      }
    };
    
    handleDelayedFit();
    
    // 添加点击终端区域自动聚焦功能
    const handleTerminalClick = () => {
      if (terminalRef.current) {
        terminalRef.current.focus();
      }
    };
    
    const terminalElement = terminalDivRef.current;
    if (terminalElement) {
      terminalElement.addEventListener('click', handleTerminalClick);
    }
    
    return () => {
      if (terminalElement) {
        terminalElement.removeEventListener('click', handleTerminalClick);
      }
    };
  }, [connected]);

  // 添加状态监控，确保UI状态与WebSocket状态一致
  useEffect(() => {
    // 定期检查WebSocket连接状态并同步UI状态
    const checkConnectionStatus = () => {
      // 检查loading状态是否卡住
      if (loading && !socketRef.current) {
        // 立即重置loading状态，无需等待
        console.warn('检测到loading状态但无活跃连接，立即重置状态');
        setLoading(false);
        setError('连接未建立，请点击"连接"按钮重试');
        window._loadingStartTime = null;
      } else {
        window._loadingStartTime = null;
      }
      
      // 检查连接状态与UI状态是否一致
      if (!socketRef.current && connected) {
        // WebSocket不存在但UI显示已连接，更正状态
        console.log('检测到状态不一致: WebSocket不存在但UI显示已连接，更正状态');
        setConnected(false);
      } else if (socketRef.current && 
                socketRef.current.readyState !== WebSocket.OPEN &&
                socketRef.current.readyState !== WebSocket.CONNECTING && 
                connected) {
        // WebSocket已关闭但UI显示已连接，更正状态
        console.log('检测到状态不一致: WebSocket已关闭但UI显示已连接，更正状态');
        setConnected(false);
      }
    };
    
    const statusMonitor = setInterval(checkConnectionStatus, 1000);
    
    return () => {
      clearInterval(statusMonitor);
    };
  }, [connected, loading]);

  // 当显示错误信息后，添加自动清除
  useEffect(() => {
    if (error && connected) {
      // 如果显示错误但实际已连接，清除错误
      setError(null);
    }
  }, [error, connected]);

  // 取消连接按钮处理函数
  const handleCancelConnection = () => {
    setLoading(false);
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (err) {
        console.log('关闭连接出错:', err);
      }
      socketRef.current = null;
      cleanupGlobalSocketRef();
    }
    
    // 不设置manuallyDisconnected标记，允许自动重连
    // 这与断开连接按钮的行为不同，断开会设置manuallyDisconnected为true
  };

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
            <Text type={connected ? 'success' : loading ? 'warning' : 'danger'}>
              {connected ? '已连接' : loading ? '连接中...' : '未连接'}
            </Text>
          </Space>
        }
        extra={
          <Space>
            <Button
              type={connected ? 'default' : 'primary'}
              onClick={connected ? disconnect : () => {
                // 点击连接按钮时，清除手动断开标记
                setManuallyDisconnected(false);
                connectToTerminal();
              }}
              loading={loading}
              disabled={loading}
            >
              {connected ? '断开' : '连接'}
            </Button>
            <Button
              icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
            >
              {fullscreen ? '退出全屏' : '全屏'}
            </Button>
            {!connected && (
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={() => {
                  // 点击重新连接按钮时，清除手动断开标记
                  setManuallyDisconnected(false);
                  reconnect();
                }}
                disabled={loading}
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
            action={
              <Button size="small" type="primary" onClick={connectToTerminal} disabled={loading}>
                重试连接
              </Button>
            }
          />
        ) : null}
        
        {loading && !connected ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '100%',
            backgroundColor: '#202124' 
          }}>
            <Spin tip="连接中..." />
            <Button 
              style={{ marginTop: 16 }} 
              type="primary" 
              danger 
              onClick={handleCancelConnection} // 使用专门的处理函数
            >
              取消连接
            </Button>
          </div>
        ) : (
          <div 
            ref={terminalDivRef}
            style={{ 
              height: error ? 'calc(100% - 85px)' : '100%', 
              width: '100%', 
              backgroundColor: '#202124',
              borderRadius: '4px',
              opacity: connected ? 1 : 0.7,
            }}
            onClick={() => {
              // 点击终端区域时，如果尚未连接则自动触发连接
              if (!connected && !loading && !manuallyDisconnected) {
                connectToTerminal();
              }
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default PodTerminal; 
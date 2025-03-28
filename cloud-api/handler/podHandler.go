package handler

import (
	"cloud-deployment-api/model"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // 允许所有来源的WebSocket连接
	},
}

// TerminalSession 维护WebSocket连接与Pod中的terminal连接
type TerminalSession struct {
	wsConn               *websocket.Conn
	sizeChan             chan remotecommand.TerminalSize
	doneChan             chan struct{}
	tty                  bool
	lastTerminalSize     *remotecommand.TerminalSize
	lastTerminalSizeTime time.Time
}

// 实现remotecommand.TerminalSizeQueue接口
func (t *TerminalSession) Next() *remotecommand.TerminalSize {
	select {
	case size := <-t.sizeChan:
		t.lastTerminalSize = &size
		t.lastTerminalSizeTime = time.Now()
		return &size
	case <-t.doneChan:
		return nil
	}
}

// 写入数据到WebSocket
func (t *TerminalSession) Write(p []byte) (int, error) {
	// 发送到WebSocket
	msg := string(p)
	err := t.wsConn.WriteMessage(websocket.TextMessage, []byte(msg))
	if err != nil {
		log.Printf("向WebSocket写入数据失败: %v", err)
		return 0, err
	}
	return len(p), nil
}

// 从WebSocket读取数据
func (t *TerminalSession) Read(p []byte) (int, error) {
	_, message, err := t.wsConn.ReadMessage()
	if err != nil {
		log.Printf("从WebSocket读取数据失败: %v", err)
		return 0, err
	}

	// 特殊的调整terminal大小的消息处理
	if len(message) > 1 && message[0] == 0x01 {
		width, height := 0, 0
		if len(message) >= 5 {
			width = int(message[1])<<8 + int(message[2])
			height = int(message[3])<<8 + int(message[4])
			if width > 0 && height > 0 {
				t.sizeChan <- remotecommand.TerminalSize{
					Width:  uint16(width),
					Height: uint16(height),
				}
			}
		}
		return 0, nil
	}

	copy(p, message)
	return len(message), nil
}

func (t *TerminalSession) Close() error {
	close(t.doneChan)
	return t.wsConn.Close()
}

// 检查请求是否为WebSocket连接
func isWebsocket(c *gin.Context) bool {
	connection := c.GetHeader("Connection")
	upgrade := c.GetHeader("Upgrade")
	
	return strings.ToLower(connection) == "upgrade" && strings.ToLower(upgrade) == "websocket"
}

// ExecPodTerminal 处理与Pod terminal交互的WebSocket连接
func ExecPodTerminal(c *gin.Context) {
	kubeConfigID := c.Query("kubeConfigId")
	podName := c.Query("podName")
	namespace := c.Query("namespace")
	containerName := c.Query("containerName")
	command := c.DefaultQuery("command", "/bin/sh")

	if kubeConfigID == "" || podName == "" || namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "必须提供kubeConfigId、podName和namespace"})
		return
	}

	// 如果未指定容器，获取Pod的第一个容器
	if containerName == "" {
		log.Printf("未指定容器名称，尝试获取Pod的第一个容器...")
		client, err := model.GetK8sManager().GetClient(kubeConfigID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取Kubernetes客户端失败: %v", err)})
			return
		}

		pod, err := client.CoreV1().Pods(namespace).Get(context.Background(), podName, metav1.GetOptions{})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("获取Pod信息失败: %v", err)})
			return
		}

		if len(pod.Spec.Containers) == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Pod中没有容器"})
			return
		}

		containerName = pod.Spec.Containers[0].Name
		log.Printf("使用Pod的第一个容器: %s", containerName)
	}

	// 升级HTTP连接为WebSocket
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("升级WebSocket连接失败: %v", err)
		return
	}
	defer wsConn.Close()

	// 创建terminal session
	session := &TerminalSession{
		wsConn:   wsConn,
		sizeChan: make(chan remotecommand.TerminalSize),
		doneChan: make(chan struct{}),
		tty:      true,
	}

	// 获取Kubernetes客户端配置
	client, err := model.GetK8sManager().GetClient(kubeConfigID)
	if err != nil {
		log.Printf("获取Kubernetes客户端失败: %v", err)
		wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("获取Kubernetes客户端失败: %v\n", err)))
		return
	}

	// 准备执行命令
	req := client.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec")

	// 设置命令参数
	req.VersionedParams(&v1.PodExecOptions{
		Container: containerName,
		Command:   []string{command},
		Stdin:     true,
		Stdout:    true,
		Stderr:    true,
		TTY:       true,
	}, scheme.ParameterCodec)

	// 获取REST配置
	restConfig, err := model.GetK8sManager().GetCurrentRestConfig(kubeConfigID)
	if err != nil {
		log.Printf("获取REST配置失败: %v", err)
		wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("获取REST配置失败: %v\n", err)))
		return
	}

	// 创建SPDY执行器
	exec, err := remotecommand.NewSPDYExecutor(restConfig, "POST", req.URL())
	if err != nil {
		log.Printf("创建SPDY执行器失败: %v", err)
		wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("创建SPDY执行器失败: %v\n", err)))
		return
	}

	// 启动Terminal会话
	err = exec.Stream(remotecommand.StreamOptions{
		Stdin:             session,
		Stdout:            session,
		Stderr:            session,
		Tty:               session.tty,
		TerminalSizeQueue: session,
	})

	if err != nil {
		log.Printf("执行Terminal命令失败: %v", err)
		wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("执行Terminal命令失败: %v\n", err)))
	}
}

// GetPodLogs 获取Pod的日志
func GetPodLogs(c *gin.Context) {
	kubeConfigID := c.Query("kubeConfigId")
	podName := c.Param("name")
	namespace := c.Query("namespace")
	containerName := c.Query("containerName")
	tailLines := c.DefaultQuery("tailLines", "100")
	follow := c.DefaultQuery("follow", "false")
	
	if kubeConfigID == "" || podName == "" || namespace == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "必须提供kubeConfigId、podName和namespace"})
		return
	}
	
	// 转换tailLines为整数
	tailLinesInt, err := strconv.Atoi(tailLines)
	if err != nil {
		tailLinesInt = 100 // 默认获取100行
	}
	
	// 转换follow为布尔值
	followBool, err := strconv.ParseBool(follow)
	if err != nil {
		followBool = false // 默认不跟踪
	}
	
	// 如果是跟踪模式且支持WebSocket，则使用WebSocket连接
	if followBool && isWebsocket(c) {
		getStreamingPodLogs(c, kubeConfigID, namespace, podName, containerName, tailLinesInt)
		return
	}
	
	// 正常模式，直接获取日志
	logs, err := model.GetK8sManager().GetPodLogs(kubeConfigID, namespace, podName, containerName, tailLinesInt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取Pod日志失败: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"logs": logs,
	})
}

// getStreamingPodLogs 通过WebSocket流式传输Pod日志
func getStreamingPodLogs(c *gin.Context, kubeConfigID, namespace, podName, containerName string, tailLines int) {
	// 升级HTTP连接为WebSocket
	wsConn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("升级WebSocket连接失败: %v", err)
		return
	}
	defer wsConn.Close()
	
	// 获取Kubernetes客户端
	client, err := model.GetK8sManager().GetClient(kubeConfigID)
	if err != nil {
		log.Printf("获取Kubernetes客户端失败: %v", err)
		wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("获取Kubernetes客户端失败: %v\n", err)))
		return
	}
	
	// 设置日志获取选项
	podLogOptions := &v1.PodLogOptions{
		Container:  containerName,
		Follow:     true,
		TailLines:  &[]int64{int64(tailLines)}[0],
		Timestamps: true,
	}
	
	// 创建日志请求
	req := client.CoreV1().Pods(namespace).GetLogs(podName, podLogOptions)
	podLogs, err := req.Stream(context.Background())
	if err != nil {
		log.Printf("获取Pod日志流失败: %v", err)
		wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("获取Pod日志流失败: %v\n", err)))
		return
	}
	defer podLogs.Close()
	
	// 读取日志并通过WebSocket发送
	for {
		buf := make([]byte, 4096)
		n, err := podLogs.Read(buf)
		if err != nil {
			if err != io.EOF {
				log.Printf("读取Pod日志失败: %v", err)
				wsConn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("读取Pod日志失败: %v\n", err)))
			}
			break
		}
		
		if n > 0 {
			err = wsConn.WriteMessage(websocket.TextMessage, buf[:n])
			if err != nil {
				log.Printf("向WebSocket写入数据失败: %v", err)
				break
			}
		}
	}
}

// GetPods 获取指定命名空间的Pod列表
func GetPods(c *gin.Context) {
	kubeConfigID := c.Query("kubeConfigId")
	namespace := c.DefaultQuery("namespace", "default")
	
	if kubeConfigID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "必须提供kubeConfigId参数"})
		return
	}
	
	pods, err := model.GetK8sManager().GetPods(kubeConfigID, namespace)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": fmt.Sprintf("获取Pod列表失败: %v", err),
		})
		return
	}
	
	c.JSON(http.StatusOK, pods)
} 
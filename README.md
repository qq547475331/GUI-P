
# Kubernetes PaaS平台

## 项目简介

这是一个基于Kubernetes的轻量级PaaS平台，提供了友好的Web界面来管理Kubernetes集群资源。该平台支持多集群管理、应用部署、容器管理、日志查看、终端访问等功能，旨在简化Kubernetes的日常运维和管理工作。

## 主要功能

### 集群管理
- 支持多集群管理，通过上传kubeconfig文件添加集群
- 命名空间创建与管理
- 集群资源监控与查看

### 应用管理
- 创建和部署应用（支持Deployment、StatefulSet、DaemonSet等工作负载类型）
- 应用配置管理（环境变量、配置文件等）
- 应用资源伸缩和更新
- 一键导出应用YAML配置

### 容器管理
- Pod详情查看（状态、容器信息、标签等）
- 实时日志查看（支持自动刷新和下载）
- 容器终端访问（支持全屏模式和容器切换）

### 镜像仓库
- 私有镜像仓库集成管理
- 支持Harbor等主流镜像仓库
- 镜像版本查询和选择

## 技术栈

### 前端 (cloud-ui)
- React.js
- Ant Design 组件库
- Axios用于API请求
- WebSocket用于终端和日志实时数据
- xterm.js用于终端模拟

### 后端 (cloud-api)
- Go语言
- Gin Web框架
- 客户端-go与Kubernetes API交互
- WebSocket支持实时数据传输

## 截图展示

### 应用管理界面
![应用管理界面](https://picture-base.oss-cn-hangzhou.aliyuncs.com/picture/202503280201970.png)

### 工作负载管理
![工作负载管理](https://picture-base.oss-cn-hangzhou.aliyuncs.com/picture/202503280202017.png)

### 应用创建界面
![应用创建界面](https://picture-base.oss-cn-hangzhou.aliyuncs.com/picture/202503280202760.png)

## 快速开始

### 安装依赖

#### 前端依赖

```bash
cd cloud-ui
npm install
```

#### 后端依赖

```bash
cd cloud-api
go mod download
```

### 启动服务

#### 前端开发服务

```bash
cd cloud-ui
npm start
```

#### 后端服务

```bash
cd cloud-api
go run main.go
# 或者使用预编译的二进制文件
./start.bat  # Windows
./cloud-deployment-api  # Linux/MacOS
```

## 环境要求

- Node.js 14.x+
- Go 1.19+
- 可访问的Kubernetes集群
- 现代浏览器（Chrome、Firefox、Edge等）

## 配置文件

### 前端配置 (.env)

```
REACT_APP_API_BASE_URL=/api  # 后端API的基础URL
```

### 后端配置

后端配置通过命令行参数或环境变量提供，详见`cloud-api/README.md`。

## 部署指南

### 前端部署

```bash
cd cloud-ui
npm run build
# 将build目录下的文件部署到Web服务器
```

### 后端部署

```bash
cd cloud-api
go build -o cloud-deployment-api main.go
# 将编译后的二进制文件部署到服务器
```

## 特性与优势

- 简洁直观的用户界面，降低Kubernetes使用门槛
- 集成日志查看和终端访问，无需额外工具
- 应用部署流程简化，支持多种工作负载类型
- 支持实时资源监控和状态更新
- 响应式设计，适配不同设备屏幕

## 贡献指南

欢迎贡献代码或提出问题！请遵循以下步骤：

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

[MIT License](LICENSE)

## 联系方式

如有问题或建议，请通过GitHub Issues提交。

---

**注意：** 本项目为演示用途，生产环境使用前请进行安全评估和适当配置。

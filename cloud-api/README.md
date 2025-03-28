# 云平台应用部署API

这是一个基于Go和Gin框架的云平台应用部署API服务，提供了应用的创建、部署、管理等功能。

## 功能特性

- 应用管理：创建、查询、更新、删除应用
- 应用部署：将应用部署到云平台
- 资源管理：获取资源配额、估算应用价格
- YAML导出：将应用配置导出为Kubernetes YAML格式

## 快速开始

### 环境要求

- Go 1.14+

### 安装与运行

1. 克隆仓库

```bash
git clone https://github.com/yourusername/cloud-deployment-api.git
cd cloud-deployment-api
```

2. 安装依赖

```bash
go mod download
```

3. 运行服务

```bash
go run main.go
```

服务会在 `http://localhost:8080` 启动。

## API 文档

### 应用管理

#### 获取应用列表

```
GET /api/applications
```

响应示例:

```json
[
  {
    "id": "sample-app-1",
    "createdAt": "2023-03-22T12:00:00Z",
    "updatedAt": "2023-03-22T18:00:00Z",
    "appName": "nginx-demo",
    "imageSource": "public",
    "imageName": "nginx",
    "registry": "docker.io",
    "deployMode": "fixed",
    "instances": 1,
    "cpu": 0.5,
    "memory": 512,
    "containerPort": "80",
    "publicAccess": true,
    "status": {
      "phase": "Running",
      "message": "应用运行中",
      "startTime": "2023-03-22T18:00:00Z"
    }
  }
]
```

#### 获取应用详情

```
GET /api/applications/:id
```

响应示例:

```json
{
  "id": "sample-app-1",
  "createdAt": "2023-03-22T12:00:00Z",
  "updatedAt": "2023-03-22T18:00:00Z",
  "appName": "nginx-demo",
  "imageSource": "public",
  "imageName": "nginx",
  "registry": "docker.io",
  "deployMode": "fixed",
  "instances": 1,
  "cpu": 0.5,
  "memory": 512,
  "containerPort": "80",
  "publicAccess": true,
  "status": {
    "phase": "Running",
    "message": "应用运行中",
    "startTime": "2023-03-22T18:00:00Z"
  }
}
```

#### 创建应用

```
POST /api/applications
```

请求示例:

```json
{
  "appName": "my-app",
  "imageSource": "public",
  "imageName": "nginx",
  "registry": "docker.io",
  "deployMode": "fixed",
  "instances": 1,
  "cpu": 0.2,
  "memory": 256,
  "containerPort": "80",
  "publicAccess": true
}
```

#### 更新应用

```
PUT /api/applications/:id
```

请求格式与创建应用相同。

#### 删除应用

```
DELETE /api/applications/:id
```

### 应用部署

#### 部署应用

```
POST /api/applications/:id/deploy
```

响应示例:

```json
{
  "message": "应用部署已开始",
  "status": {
    "phase": "Pending",
    "message": "应用部署中",
    "startTime": "2023-03-22T20:00:00Z"
  }
}
```

#### 获取部署状态

```
GET /api/applications/:id/status
```

响应示例:

```json
{
  "phase": "Running",
  "message": "应用已部署成功",
  "startTime": "2023-03-22T20:00:00Z"
}
```

#### 导出YAML配置

```
GET /api/applications/:id/yaml
```

返回Kubernetes YAML格式的配置文件。

### 资源管理

#### 获取镜像列表

```
GET /api/images
```

响应示例:

```json
[
  "nginx:latest",
  "redis:alpine",
  "mysql:8.0",
  "postgres:13",
  "node:14-alpine",
  "python:3.9-slim"
]
```

#### 获取资源配额

```
GET /api/resourceQuota
```

响应示例:

```json
{
  "cpu": 1.0,
  "memory": 1.0,
  "storage": 10.0,
  "total": 1.0
}
```

#### 预估价格

```
POST /api/estimatePrice
```

请求示例:

```json
{
  "cpu": 0.5,
  "memory": 512,
  "instances": 2,
  "volumes": [
    {"size": 1},
    {"size": 2}
  ]
}
```

响应示例:

```json
{
  "cpu": 0.5,
  "memory": 0.3,
  "storage": 0.15,
  "total": 0.95
}
```

## 扩展开发

### 项目结构

```
cloud-deployment-api/
  ├── handler/           # 请求处理程序
  │   ├── application_handler.go
  │   └── resource_handler.go
  ├── model/             # 数据模型
  │   ├── application.go
  │   └── store.go
  ├── main.go            # 主程序
  └── README.md          # 文档
```

## 许可证

MIT 
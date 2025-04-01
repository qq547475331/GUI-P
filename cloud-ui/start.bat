@echo off
echo 正在启动Cloud Deployment UI服务...
start cmd /c "cd /d %~dp0 && npm run dev"
echo 正在启动Cloud Deployment API服务...
start cmd /c "cd /d %~dp0\..\cloud-api && cloud-deployment-api.exe"
echo 服务已启动，请不要关闭此窗口。
echo 前端服务地址: http://localhost:3000
echo 后端API地址: http://localhost:8080 
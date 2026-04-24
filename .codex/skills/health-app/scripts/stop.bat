@echo off
chcp 65001 >nul
echo 正在停止健康档案服务...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo 已停止 PID %%a
)
echo 服务已停止。

@echo off
chcp 65001 >nul
title 家庭健康档案

set "PROJECT_ROOT=%~dp0..\..\..\.."
for %%I in ("%PROJECT_ROOT%") do set "PROJECT_ROOT=%%~fI"

echo 正在启动家庭健康档案服务...
cd /d "%PROJECT_ROOT%\backend"

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause

@echo off

title 宇宙万能影视终极版 - 本机影视网站
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18 或更高版本: https://nodejs.org/
    pause
    exit /b 1
)

if not exist node_modules (
    echo 首次运行，正在安装依赖，请稍候...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo [错误] 依赖安装失败，请检查网络后重试。
        pause
        exit /b 1
    )
)

echo.
echo  正在启动服务，访问地址以下方输出为准...
echo  关闭本窗口即可停止服务。
echo.
node --env-file-if-exists=.env server.js

pause

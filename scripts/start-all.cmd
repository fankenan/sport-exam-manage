@echo off
REM ============================================================
REM  体育成绩管理系统 - 一键启动
REM
REM  1. 启动 MySQL 8.0（若未运行）
REM  2. 启动后端（同时托管已构建的前端）
REM  3. 打开浏览器
REM
REM  访问地址：http://127.0.0.1:4000
REM
REM  本机的 MySQL root 口令写在 scripts\local.env.cmd（已在 .gitignore 里，
REM  不会被提交）。第一次使用请参照 local.env.cmd.example 自行创建。
REM ============================================================
setlocal
chcp 65001 >nul 2>&1
title 体育成绩管理系统

set "ROOT=%~dp0.."
set "MYSQL_HOME=D:\mysql-8.0.43"
set "MYSQL_CNF=%ROOT%\server\scripts\my.ini"
set "PORT=4000"

REM ---------- 本机私有配置 ----------
if exist "%~dp0local.env.cmd" call "%~dp0local.env.cmd"
if not defined MYSQL_ROOT_PWD (
  echo [!] 未找到 scripts\local.env.cmd，或其中未设置 MYSQL_ROOT_PWD
  echo     请复制 local.env.cmd.example 为 local.env.cmd 并填写本机 MySQL root 口令
  pause
  exit /b 1
)

echo.
echo   ==============================================
echo     体育成绩管理系统  启动程序
echo   ==============================================
echo.

REM ---------- 1. MySQL ----------
echo [1/3] 检查 MySQL ...
"%MYSQL_HOME%\bin\mysqladmin" -u root -p%MYSQL_ROOT_PWD% ping >nul 2>&1
if %ERRORLEVEL%==0 goto mysql_ok
echo       MySQL 未运行，正在启动（首次启动需要约 10 秒）...
start "MySQL80" /min "%MYSQL_HOME%\bin\mysqld.exe" --defaults-file="%MYSQL_CNF%" --console
set /a RETRIES=0
:wait_mysql
"%MYSQL_HOME%\bin\mysqladmin" -u root -p%MYSQL_ROOT_PWD% ping >nul 2>&1
if %ERRORLEVEL%==0 goto mysql_ok
set /a RETRIES+=1
if %RETRIES% GEQ 30 (
  echo       [!] MySQL 启动超时，请检查 %MYSQL_HOME%\data 目录权限
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto wait_mysql

:mysql_ok
echo       MySQL 已就绪

REM ---------- 2. 前端构建产物 ----------
if not exist "%ROOT%\dist\index.html" (
  echo [2/3] 未找到前端构建产物，正在构建 ...
  pushd "%ROOT%"
  call npx vite build
  popd
) else (
  echo [2/3] 前端构建产物已存在
)

REM ---------- 3. 后端 ----------
echo [3/3] 启动后端服务 (端口 %PORT%) ...
echo.
echo   ------------------------------------------------
echo     地址:  http://127.0.0.1:%PORT%
echo     管理员: admin / admin123
echo     学校账号: school1 .. school8 / school123
echo   ------------------------------------------------
echo.
echo   按 Ctrl+C 停止服务
echo.

pushd "%ROOT%\server"
node index.js
popd

endlocal

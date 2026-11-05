@echo off
REM ============================================================
REM  体育成绩管理系统 - 停止服务
REM ============================================================
setlocal
chcp 65001 >nul 2>&1

REM ---------- 本机私有配置 ----------
if exist "%~dp0local.env.cmd" call "%~dp0local.env.cmd"

echo [1/2] 停止后端服务 (端口 4000) ...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4000" ^| findstr LISTENING') do (
  taskkill /PID %%p /F >nul 2>&1 && echo       已停止后端 PID %%p
)

echo [2/2] 停止 MySQL ...
if not defined MYSQL_ROOT_PWD (
  echo       [!] 未配置 MYSQL_ROOT_PWD，跳过 MySQL 停止
) else (
  "D:\mysql-8.0.43\bin\mysqladmin" -u root -p%MYSQL_ROOT_PWD% shutdown >nul 2>&1
  if %ERRORLEVEL%==0 (echo       MySQL 已停止) else (echo       MySQL 未在运行)
)

echo 完成。
endlocal

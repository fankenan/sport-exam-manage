-- ============================================================
-- 本机 MySQL 初始化（Windows 版）
--
-- 使用前请先把下面的 <ROOT_PASSWORD> / <APP_PASSWORD> 换成你自己的口令，
-- 否则会把 root 口令改成字面量「<ROOT_PASSWORD>」。
--
--   "D:\mysql-8.0.43\bin\mysql" -u root -p < server\scripts\setup-mysql-win.sql
--
-- 注意：应用账号只授予本库权限，不要用 GRANT ALL ON *.* —— 那等于给应用
-- 一个可以删库、可以建新用户的超级权限。
-- 应用连接用的口令要同步写进 server\.env 的 DB_PASSWORD。
-- ============================================================

CREATE DATABASE IF NOT EXISTS sport_manage
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

ALTER USER 'root'@'localhost'
  IDENTIFIED WITH caching_sha2_password BY '<ROOT_PASSWORD>';

CREATE USER IF NOT EXISTS 'sport_app'@'localhost'
  IDENTIFIED WITH caching_sha2_password BY '<APP_PASSWORD>';

GRANT ALL PRIVILEGES ON sport_manage.* TO 'sport_app'@'localhost';

FLUSH PRIVILEGES;

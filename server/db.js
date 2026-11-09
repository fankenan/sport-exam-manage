/**
 * 数据库连接池 + 初始化
 */
require('dotenv').config()
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

let pool

async function initPool() {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sport_manage',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    charset: 'utf8mb4_unicode_ci',
    // 批量写入时把单次批量参数上限调高，避免 max_allowed_packet 报错
    maxPreparedStatements: 10000,
    // DATETIME/TIMESTAMP 直接按字符串返回，不做时区换算。
    // 库里的值就是业务本地时间（北京时间），换算成 UTC 会凭空少 8 小时。
    dateStrings: true,
    timezone: 'local',
  })
  console.log('[MySQL] 连接池创建成功')
}

/**
 * 执行一条 DDL，忽略「已存在」类错误
 * MySQL 的 DDL 没有 IF NOT EXISTS 的通用写法，这里统一吞掉重复错误
 */
/**
 * 执行一条「可重复执行」的语句（建表 / 加列 / 建索引 / 数据回填）。
 * 「已存在」类错误直接忽略，其他错误打印出来但不中断启动。
 */
async function safeExec(conn, sql) {
  try {
    await conn.query(sql)
    return true
  } catch (err) {
    // ER_DUP_KEYNAME(1061) 索引重复 / ER_DUP_FIELDNAME(1060) 字段重复 / ER_TABLE_EXISTS_ERROR(1050)
    if ([1050, 1060, 1061, 1826].includes(err.errno)) return false
    console.warn('[SQL 跳过]', err.sqlMessage || err.message)
    return false
  }
}

async function initDatabase() {
  const initConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false,
  })

  const dbName = process.env.DB_NAME || 'sport_manage'
  await initConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await initConn.query(`USE \`${dbName}\``)

  // ========== 建表 ==========
  const scoreColumns = `
      id VARCHAR(64) PRIMARY KEY,
      school VARCHAR(200) DEFAULT '',
      name VARCHAR(100) NOT NULL,
      id_card VARCHAR(50) DEFAULT '',
      identity_id VARCHAR(50) DEFAULT '',
      student_number VARCHAR(50) DEFAULT '',
      graduation_year VARCHAR(20) DEFAULT '',
      grade VARCHAR(20) DEFAULT '',
      remark TEXT,
      review_status VARCHAR(20) DEFAULT NULL,
      review_remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'admin',
      school_id INT DEFAULT NULL,
      status TINYINT DEFAULT 1,
      token_version INT DEFAULT 0,
      last_login_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS schools (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS grade_seven (
      ${scoreColumns}
      attendance_score DECIMAL(10,1) DEFAULT NULL,
      exam_score DECIMAL(10,1) DEFAULT NULL,
      fitness_score DECIMAL(10,1) DEFAULT NULL,
      total DECIMAL(10,1) DEFAULT NULL,
      total_verify DECIMAL(10,1) DEFAULT NULL,
      verify_result TINYINT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS grade_eight (
      ${scoreColumns}
      attendance_score DECIMAL(10,1) DEFAULT NULL,
      exam_score DECIMAL(10,1) DEFAULT NULL,
      fitness_score DECIMAL(10,1) DEFAULT NULL,
      total DECIMAL(10,1) DEFAULT NULL,
      total_verify DECIMAL(10,1) DEFAULT NULL,
      verify_result TINYINT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS grade_nine (
      ${scoreColumns}
      gender VARCHAR(10) DEFAULT '',
      long_run DECIMAL(10,1) DEFAULT NULL,
      rope_skipping DECIMAL(10,1) DEFAULT NULL,
      long_jump DECIMAL(10,1) DEFAULT NULL,
      ball_sports DECIMAL(10,1) DEFAULT NULL,
      martial_arts DECIMAL(10,1) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS admission (
      ${scoreColumns}
      gender VARCHAR(10) DEFAULT '',
      registration_number VARCHAR(50) DEFAULT '',
      grade_seven DECIMAL(10,1) DEFAULT NULL,
      grade_eight DECIMAL(10,1) DEFAULT NULL,
      long_run DECIMAL(10,1) DEFAULT NULL,
      rope_skipping DECIMAL(10,1) DEFAULT NULL,
      long_jump DECIMAL(10,1) DEFAULT NULL,
      ball_sports DECIMAL(10,1) DEFAULT NULL,
      martial_arts DECIMAL(10,1) DEFAULT NULL,
      total_score DECIMAL(10,1) DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school VARCHAR(200) NOT NULL,
      graduation_year VARCHAR(20) NOT NULL,
      file_name VARCHAR(500) NOT NULL,
      file_path VARCHAR(1000) NOT NULL,
      file_size BIGINT DEFAULT 0,
      uploaded_by VARCHAR(50) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_school_year (school, graduation_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS grade_credentials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      grade_level VARCHAR(10) NOT NULL,
      student_record_id VARCHAR(64) NOT NULL,
      file_name VARCHAR(500) NOT NULL,
      file_path VARCHAR(1000) NOT NULL,
      file_size BIGINT DEFAULT 0,
      uploaded_by VARCHAR(50) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_credential_record (grade_level, student_record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      operator VARCHAR(50) NOT NULL,
      operation_type VARCHAR(20) NOT NULL,
      target_table VARCHAR(50) NOT NULL,
      target_id VARCHAR(100) DEFAULT NULL,
      details JSON,
      ip_address VARCHAR(45) DEFAULT NULL,
      user_agent VARCHAR(500) DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_logs_operator (operator),
      INDEX idx_logs_type (operation_type),
      INDEX idx_logs_table (target_table),
      INDEX idx_logs_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // 重复数据暂存表
  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS grade_duplicates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school VARCHAR(200), name VARCHAR(100), id_card VARCHAR(50),
      identity_id VARCHAR(50), graduation_year VARCHAR(20),
      grade VARCHAR(20), grade_level VARCHAR(10),
      attendance_score DECIMAL(10,1), exam_score DECIMAL(10,1),
      fitness_score DECIMAL(10,1), total DECIMAL(10,1),
      total_verify DECIMAL(10,1), verify_result TINYINT,
      long_run DECIMAL(10,1), rope_skipping DECIMAL(10,1),
      long_jump DECIMAL(10,1), ball_sports DECIMAL(10,1),
      martial_arts DECIMAL(10,1), remark TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      processed_by VARCHAR(50), processed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dup_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // 成绩复核申请表
  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS grade_reconsiderations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school VARCHAR(200) NOT NULL,
      student_name VARCHAR(100) NOT NULL,
      id_card VARCHAR(50) NOT NULL,
      grade_level VARCHAR(10) NOT NULL,
      attendance_score DECIMAL(10,1) DEFAULT NULL,
      exam_score DECIMAL(10,1) DEFAULT NULL,
      fitness_score DECIMAL(10,1) DEFAULT NULL,
      total DECIMAL(10,1) DEFAULT NULL,
      long_run DECIMAL(10,1) DEFAULT NULL,
      rope_skipping DECIMAL(10,1) DEFAULT NULL,
      long_jump DECIMAL(10,1) DEFAULT NULL,
      ball_sports DECIMAL(10,1) DEFAULT NULL,
      martial_arts DECIMAL(10,1) DEFAULT NULL,
      total_verify DECIMAL(10,1) DEFAULT NULL,
      verify_result TINYINT DEFAULT NULL,
      credential_id INT DEFAULT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      reviewed_by VARCHAR(50) DEFAULT NULL,
      reviewed_at DATETIME DEFAULT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_recon_status (status),
      INDEX idx_recon_school (school),
      INDEX idx_recon_idcard (id_card)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // 学校成绩上报表（新增：学校上报 → 管理员审核 → 发布）
  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS grade_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school_id INT DEFAULT NULL,
      school VARCHAR(200) NOT NULL,
      graduation_year VARCHAR(20) NOT NULL,
      grade_level VARCHAR(20) NOT NULL,
      file_name VARCHAR(500) DEFAULT '',
      file_path VARCHAR(1000) DEFAULT '',
      file_size BIGINT DEFAULT 0,
      row_count INT DEFAULT 0,
      new_count INT DEFAULT 0,
      update_count INT DEFAULT 0,
      conflict_count INT DEFAULT 0,
      status VARCHAR(20) DEFAULT 'draft',
      payload JSON,
      diff JSON,
      reject_reason VARCHAR(500) DEFAULT '',
      uploaded_by VARCHAR(50) DEFAULT '',
      reviewed_by VARCHAR(50) DEFAULT '',
      reviewed_at DATETIME DEFAULT NULL,
      published_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sub_school (school_id),
      INDEX idx_sub_status (status),
      INDEX idx_sub_created (created_at),
      INDEX idx_sub_school_year (school, graduation_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // ========== 迁移 ==========
  // 历史库补列
  const migrations = [
    ['admins', 'school_id INT DEFAULT NULL'],
    ['admins', 'status TINYINT DEFAULT 1'],
    ['admins', 'token_version INT DEFAULT 0'],
    ['admins', 'last_login_at DATETIME DEFAULT NULL'],
    ['grade_nine', 'remark TEXT'],
    ['admission', 'remark TEXT'],
    ['grade_seven', 'review_status VARCHAR(20) DEFAULT NULL'],
    ['grade_seven', 'review_remark TEXT'],
    ['grade_eight', 'review_status VARCHAR(20) DEFAULT NULL'],
    ['grade_eight', 'review_remark TEXT'],
    ['grade_nine', 'review_status VARCHAR(20) DEFAULT NULL'],
    ['grade_nine', 'review_remark TEXT'],
    ['admission', 'review_status VARCHAR(20) DEFAULT NULL'],
    ['admission', 'review_remark TEXT'],
    // 九年级报名审核通过后要把性别一起带到两张成绩表
    ['grade_nine', "gender VARCHAR(10) DEFAULT ''"],
    ['admission', "gender VARCHAR(10) DEFAULT ''"],
  ]
  for (const [table, column] of migrations) {
    await safeExec(initConn, `ALTER TABLE ${table} ADD COLUMN ${column}`)
  }

  // ========== 索引 ==========
  // 复合索引覆盖最常用的过滤组合：学校 + 年份
  const indexDefs = [
    ['grade_seven', 'idx_gs_school_year', '(school, graduation_year)'],
    ['grade_seven', 'idx_gs_school_name', '(school, name)'],
    ['grade_seven', 'idx_gs_identity', '(identity_id)'],
    ['grade_seven', 'idx_gs_review', '(review_status)'],
    ['grade_eight', 'idx_ge_school_year', '(school, graduation_year)'],
    ['grade_eight', 'idx_ge_school_name', '(school, name)'],
    ['grade_eight', 'idx_ge_identity', '(identity_id)'],
    ['grade_eight', 'idx_ge_review', '(review_status)'],
    ['grade_nine', 'idx_gn_school_year', '(school, graduation_year)'],
    ['grade_nine', 'idx_gn_school_name', '(school, name)'],
    ['grade_nine', 'idx_gn_identity', '(identity_id)'],
    ['grade_nine', 'idx_gn_review', '(review_status)'],
    ['admission', 'idx_ad_school_year', '(school, graduation_year)'],
    ['admission', 'idx_ad_school_name', '(school, name)'],
    ['admission', 'idx_ad_identity', '(identity_id)'],
    ['admission', 'idx_ad_review', '(review_status)'],
    ['admission', 'idx_ad_reg', '(registration_number)'],
    ['materials', 'idx_mat_school_year', '(school, graduation_year)'],
    ['grade_reconsiderations', 'idx_recon_pending', '(status, school)'],
  ]
  for (const [table, name, cols] of indexDefs) {
    await safeExec(initConn, `CREATE INDEX ${name} ON ${table} ${cols}`)
  }

  // ========== 九年级报名名单 ==========
  // 学校上传的是「参加考试的学生信息」，不是成绩。
  // 管理员审核通过后，才把基本信息写入 grade_nine 与 admission，
  // 之后再按身份证号导入各项成绩。
  // raw 保存学校上报的原始整行，后续「考务编排」模块要用。
  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS grade_nine_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school_id INT DEFAULT NULL,
      school VARCHAR(200) NOT NULL,
      name VARCHAR(100) NOT NULL,
      gender VARCHAR(10) DEFAULT '',
      id_card VARCHAR(50) NOT NULL,
      identity_id VARCHAR(50) NOT NULL,
      registration_number VARCHAR(50) DEFAULT '',
      graduation_year VARCHAR(20) DEFAULT '',
      grade VARCHAR(20) DEFAULT '九年级',
      long_run_event VARCHAR(20) DEFAULT '',
      rope_skipping_event VARCHAR(20) DEFAULT '',
      long_jump_event VARCHAR(20) DEFAULT '',
      ball_event VARCHAR(20) DEFAULT '',
      martial_arts_event VARCHAR(20) DEFAULT '',
      remark TEXT,
      raw JSON,
      status VARCHAR(20) DEFAULT 'pending',
      reject_reason VARCHAR(500) DEFAULT '',
      uploaded_by VARCHAR(50) DEFAULT '',
      reviewed_by VARCHAR(50) DEFAULT '',
      reviewed_at DATETIME DEFAULT NULL,
      scored_at DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reg_school (school),
      INDEX idx_reg_status (status),
      INDEX idx_reg_identity (identity_id),
      INDEX idx_reg_year (graduation_year),
      INDEX idx_reg_regno (registration_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // ========== 系统设置（导出授权等） ==========
  await safeExec(initConn, `
    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value TEXT,
      updated_by VARCHAR(50) DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)

  // 默认：允许学校导出九年级成绩与中招成绩
  await safeExec(initConn, `
    INSERT IGNORE INTO app_settings (setting_key, setting_value, updated_by)
    VALUES ('school_export_tables', 'grade_nine,admission', 'system')`)

  // ========== 数据回填 ==========
  // 历史数据（早期版本由前端计算合计校对）可能存在 total_verify / verify_result 为空的行，
  // 这里统一用服务端规则补齐，保证「导入后自动校对」对存量数据同样成立。
  for (const table of ['grade_seven', 'grade_eight']) {
    const sum = 'ROUND(COALESCE(attendance_score,0) + COALESCE(exam_score,0) + COALESCE(fitness_score,0), 1)'
    await safeExec(initConn, `
      UPDATE ${table} SET
        total_verify = ${sum},
        verify_result = CASE WHEN ABS(${sum} - COALESCE(total,0)) < 0.1 THEN 1 ELSE 0 END
      WHERE total_verify IS NULL
        AND attendance_score IS NOT NULL AND exam_score IS NOT NULL AND fitness_score IS NOT NULL
    `)
  }

  // 九年级/中招的「性别」来自报名名单：老数据补一次
  for (const table of ['grade_nine', 'admission']) {
    await safeExec(initConn, `
      UPDATE ${table} t
      JOIN grade_nine_registrations r ON r.identity_id = t.identity_id
      SET t.gender = r.gender
      WHERE (t.gender IS NULL OR t.gender = '') AND r.gender <> ''
    `)
  }

  // ========== 初始管理员 ==========
  const isProd = process.env.NODE_ENV === 'production'
  const [rows] = await initConn.query('SELECT id FROM admins WHERE username = ?', ['admin'])
  if (rows.length === 0) {
    if (isProd) {
      // 生产环境不写死弱口令：生成一次性随机口令写入服务器本地文件
      const tempPassword = crypto.randomBytes(12).toString('base64url')
      const hash = await bcrypt.hash(tempPassword, 10)
      await initConn.query(
        'INSERT INTO admins (username, password, role, school_id) VALUES (?, ?, ?, ?)',
        ['admin', hash, 'admin', null],
      )
      const pwdFile = path.join(__dirname, '..', '.initial-admin-password')
      fs.writeFileSync(pwdFile, `初始管理员口令: ${tempPassword}\n生成时间: ${new Date().toISOString()}\n`, { mode: 0o600 })
      console.log('[INIT] 生产环境已创建管理员 admin，一次性口令写入 ' + pwdFile)
      console.log('[INIT] 请立即登录修改密码并删除该文件')
    } else {
      const hash = await bcrypt.hash('admin123', 10)
      await initConn.query(
        'INSERT INTO admins (username, password, role, school_id) VALUES (?, ?, ?, ?)',
        ['admin', hash, 'admin', null],
      )
      console.log('[INIT] 默认管理员已创建: admin / admin123 （仅开发环境）')
    }
  } else {
    console.log('[INIT] 管理员账号已存在')
  }

  await initConn.end()

  // ========== 启动自检 ==========
  // 关键表缺失时直接失败，避免"带着坏结构跑起来"这种更难排查的问题
  const verify = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
  })
  const REQUIRED_TABLES = [
    'admins', 'schools', 'grade_seven', 'grade_eight', 'grade_nine',
    'admission', 'materials', 'grade_credentials', 'operation_logs',
    'grade_duplicates', 'grade_reconsiderations', 'grade_submissions',
  ]
  const [tableRows] = await verify.query(
    `SELECT table_name AS tbl FROM information_schema.tables WHERE table_schema = ?`,
    [dbName],
  )
  const existing = new Set(tableRows.map(r => String(r.tbl).toLowerCase()))
  const missing = REQUIRED_TABLES.filter(t => !existing.has(t.toLowerCase()))
  if (missing.length > 0) {
    await verify.end()
    throw new Error(`数据库表缺失: ${missing.join(', ')}（请检查建表权限与 .env 配置）`)
  }
  await verify.end()

  console.log('[MySQL] 数据库初始化完成')
}

function getPool() {
  return pool
}

module.exports = { initPool, initDatabase, getPool }

/**
 * 数据库连接池 + 初始化
 */
const mysql = require('mysql2/promise')
const bcrypt = require('bcryptjs')

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
  })
  console.log('[MySQL] 连接池创建成功')
}

async function initDatabase() {
  const initConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  })

  const dbName = process.env.DB_NAME || 'sport_manage'
  await initConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await initConn.query(`USE \`${dbName}\``)

  // 学校表（由管理员维护）
  await initConn.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 建表
  const tables = `
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'admin',
      school_id INT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS grade_seven (
      id VARCHAR(50) PRIMARY KEY,
      school VARCHAR(200) DEFAULT '',
      name VARCHAR(100) NOT NULL,
      id_card VARCHAR(50) DEFAULT '',
      identity_id VARCHAR(50) DEFAULT '',
      student_number VARCHAR(50) DEFAULT '',
      graduation_year VARCHAR(20) DEFAULT '',
      grade VARCHAR(20) DEFAULT '',
      attendance_score DECIMAL(10,1) DEFAULT NULL,
      exam_score DECIMAL(10,1) DEFAULT NULL,
      fitness_score DECIMAL(10,1) DEFAULT NULL,
      total DECIMAL(10,1) DEFAULT NULL,
      total_verify DECIMAL(10,1) DEFAULT NULL,
      verify_result TINYINT DEFAULT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS grade_eight (
      id VARCHAR(50) PRIMARY KEY,
      school VARCHAR(200) DEFAULT '',
      name VARCHAR(100) NOT NULL,
      id_card VARCHAR(50) DEFAULT '',
      identity_id VARCHAR(50) DEFAULT '',
      student_number VARCHAR(50) DEFAULT '',
      graduation_year VARCHAR(20) DEFAULT '',
      grade VARCHAR(20) DEFAULT '',
      attendance_score DECIMAL(10,1) DEFAULT NULL,
      exam_score DECIMAL(10,1) DEFAULT NULL,
      fitness_score DECIMAL(10,1) DEFAULT NULL,
      total DECIMAL(10,1) DEFAULT NULL,
      total_verify DECIMAL(10,1) DEFAULT NULL,
      verify_result TINYINT DEFAULT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS grade_nine (
      id VARCHAR(50) PRIMARY KEY,
      school VARCHAR(200) DEFAULT '',
      name VARCHAR(100) NOT NULL,
      id_card VARCHAR(50) DEFAULT '',
      identity_id VARCHAR(50) DEFAULT '',
      student_number VARCHAR(50) DEFAULT '',
      graduation_year VARCHAR(20) DEFAULT '',
      grade VARCHAR(20) DEFAULT '',
      long_run DECIMAL(10,1) DEFAULT NULL,
      rope_skipping DECIMAL(10,1) DEFAULT NULL,
      long_jump DECIMAL(10,1) DEFAULT NULL,
      ball_sports DECIMAL(10,1) DEFAULT NULL,
      martial_arts DECIMAL(10,1) DEFAULT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS admission (
      id VARCHAR(50) PRIMARY KEY,
      identity_id VARCHAR(50) DEFAULT '',
      school VARCHAR(200) DEFAULT '',
      name VARCHAR(100) NOT NULL,
      registration_number VARCHAR(50) DEFAULT '',
      graduation_year VARCHAR(20) DEFAULT '',
      grade_seven DECIMAL(10,1) DEFAULT NULL,
      grade_eight DECIMAL(10,1) DEFAULT NULL,
      long_run DECIMAL(10,1) DEFAULT NULL,
      rope_skipping DECIMAL(10,1) DEFAULT NULL,
      long_jump DECIMAL(10,1) DEFAULT NULL,
      ball_sports DECIMAL(10,1) DEFAULT NULL,
      martial_arts DECIMAL(10,1) DEFAULT NULL,
      remark TEXT,
      total_score DECIMAL(10,1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    CREATE TABLE IF NOT EXISTS grade_credentials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      grade_level VARCHAR(10) NOT NULL,
      student_record_id VARCHAR(50) NOT NULL,
      file_name VARCHAR(500) NOT NULL,
      file_path VARCHAR(1000) NOT NULL,
      file_size BIGINT DEFAULT 0,
      uploaded_by VARCHAR(50) DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_credential_record (grade_level, student_record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `

  const tableNames = [
    'admins', 'schools', 'grade_seven', 'grade_eight', 'grade_nine',
    'admission', 'materials', 'grade_credentials', 'operation_logs'
  ]
  for (const name of tableNames) {
    const createSQL = tables.split(';').find(s => s.trim().startsWith(`CREATE TABLE IF NOT EXISTS ${name}`))
    if (createSQL) {
      await initConn.query(createSQL.trim())
    }
  }

  // 迁移：admins 表添加 school_id 列（兼容已有数据库）
  try {
    await initConn.query(`ALTER TABLE admins ADD COLUMN school_id INT DEFAULT NULL`)
  } catch { /* 列已存在则忽略 */ }

  // 迁移：grade_nine 表添加 remark 列
  try {
    await initConn.query(`ALTER TABLE grade_nine ADD COLUMN remark TEXT`)
  } catch { /* 列已存在则忽略 */ }

  // 迁移：admission 表添加 remark 列
  try {
    await initConn.query(`ALTER TABLE admission ADD COLUMN remark TEXT`)
  } catch { /* 列已存在则忽略 */ }

  // 成绩复核申请表
  await initConn.query(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)

  // 迁移：admins 表添加 status 列（1=启用, 0=停用）
  try {
    await initConn.query(`ALTER TABLE admins ADD COLUMN status TINYINT DEFAULT 1`)
  } catch { /* 列已存在则忽略 */ }

  // 创建默认管理员（仅当不存在时）
  const [rows] = await initConn.query('SELECT id FROM admins WHERE username = ?', ['admin'])
  if (rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10)
    await initConn.query(
      'INSERT INTO admins (username, password, role, school_id) VALUES (?, ?, ?, ?)',
      ['admin', hash, 'admin', null]
    )
    console.log('[INIT] 默认管理员已创建: admin / admin123')
  } else {
    console.log('[INIT] 管理员账号已存在')
  }

  // 为年级表添加审核状态列（兼容已有数据库）
  for (const table of ['grade_seven', 'grade_eight', 'grade_nine']) {
    try { await initConn.query(`ALTER TABLE ${table} ADD COLUMN review_status VARCHAR(20) DEFAULT NULL`) } catch { /* 已存在 */ }
    try { await initConn.query(`ALTER TABLE ${table} ADD COLUMN review_remark TEXT`) } catch { /* 已存在 */ }
  }

  // 添加索引
  const indexes = [
    { table: 'grade_seven', cols: ['identity_id', 'graduation_year', 'school'] },
    { table: 'grade_eight', cols: ['identity_id', 'graduation_year', 'school'] },
    { table: 'grade_nine', cols: ['identity_id', 'graduation_year', 'school'] },
    { table: 'admission', cols: ['identity_id', 'graduation_year', 'school'] },
  ]
  for (const { table, cols } of indexes) {
    for (const col of cols) {
      try {
        await initConn.query(`CREATE INDEX idx_${table.substring(0, 3)}_${col} ON ${table}(${col})`)
      } catch { /* 索引已存在 */ }
    }
  }

  await initConn.end()
  console.log('[MySQL] 数据库初始化完成')
}

function getPool() {
  return pool
}

module.exports = { initPool, initDatabase, getPool }

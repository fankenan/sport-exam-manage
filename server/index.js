/**
 * 体育成绩管理系统后端 - MySQL版
 * 修复内容：
 *  1. SQLite → MySQL（解决登录一次后无法登录的 SQLite 单进程锁问题）
 *  2. 移除嵌套 transaction（SQLite 嵌套 bug）
 *  3. 添加完整错误处理
 *  4. 使用 MySQL 连接池 + async/await
 *  5. 修复 initDefaultAdmin 多次重复创建问题
 *  6. 修复全量覆盖为增量更新或事务安全删除
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { auditMiddleware } = require('./auditMiddleware');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 环境变量未设置，请检查 .env 文件');
  process.exit(1);
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ========== MySQL 连接池 ==========
let pool;

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
    // 解决 MySQL 8.x 认证问题
    authPlugins: undefined,
  });
  console.log('[MySQL] 连接池创建成功');
}

// ========== 数据库初始化（建库建表）============
async function initDatabase() {
  // 先用不带 database 的连接创建库
  const initConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  const dbName = process.env.DB_NAME || 'sport_manage';
  await initConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await initConn.query(`USE \`${dbName}\``);

  // 建表
  const tables = `
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'admin',
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
  `;

  // 分条执行建表
  const tableNames = ['admins', 'grade_seven', 'grade_eight', 'grade_nine', 'admission', 'materials', 'grade_credentials', 'operation_logs'];
  for (const name of tableNames) {
    const createSQL = tables.split(';').find(s => s.trim().startsWith(`CREATE TABLE IF NOT EXISTS ${name}`));
    if (createSQL) {
      await initConn.query(createSQL.trim());
    }
  }

  // 创建默认管理员（仅当不存在时）
  const [rows] = await initConn.query('SELECT id FROM admins WHERE username = ?', ['admin']);
  if (rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await initConn.query('INSERT INTO admins (username, password, role) VALUES (?, ?, ?)', ['admin', hash, 'admin']);
    console.log('[INIT] 默认管理员已创建: admin / admin123');
  } else {
    console.log('[INIT] 管理员账号已存在');
  }

  // 为年级表添加审核状态列（兼容已有数据库）
  for (const table of ['grade_seven', 'grade_eight', 'grade_nine']) {
    try {
      await initConn.query(`ALTER TABLE ${table} ADD COLUMN review_status VARCHAR(20) DEFAULT NULL`);
    } catch { /* 列已存在则忽略 */ }
    try {
      await initConn.query(`ALTER TABLE ${table} ADD COLUMN review_remark TEXT`);
    } catch { /* 列已存在则忽略 */ }
    try {
      await initConn.query(`ALTER TABLE ${table} DROP COLUMN student_number`);
    } catch { /* 列已删除或不存在则忽略 */ }
  }

  // 添加索引（忽略已存在的索引）
  const indexes = [
    { table: 'grade_seven', cols: ['identity_id', 'graduation_year', 'school'] },
    { table: 'grade_eight', cols: ['identity_id', 'graduation_year', 'school'] },
    { table: 'grade_nine', cols: ['identity_id', 'graduation_year', 'school'] },
    { table: 'admission', cols: ['identity_id', 'graduation_year', 'school'] },
  ];
  for (const { table, cols } of indexes) {
    for (const col of cols) {
      try {
        await initConn.query(`CREATE INDEX idx_${table.substring(0, 3)}_${col} ON ${table}(${col})`);
      } catch { /* 索引已存在则忽略 */ }
    }
  }

  await initConn.end();
  console.log('[MySQL] 数据库初始化完成');
}

// ========== 中间件 ==========
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// CSP 头防护（减轻 XSS 风险）
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;");
  next();
});

// 登录限流器
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { code: 429, message: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 磁盘存储，避免内存溢出
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB 上限
});

// ========== JWT 中间件 ==========
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
  }
}

// ========== 工具函数 ==========
function ok(res, data = {}, message = 'success') {
  res.json({ code: 200, data, message });
}

function fail(res, message = '操作失败', code = 500) {
  res.json({ code, message });
}

// snake_case 转 camelCase
function snakeToCamel(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;
  // 跳过 Date 对象，直接返回 ISO 字符串
  if (obj instanceof Date) return obj.toISOString().replace('T', ' ').substring(0, 19);
  const result = {};
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = snakeToCamel(obj[key]);
  }
  return result;
}

// camelCase 转 snake_case
function camelToSnake(obj) {
  if (!obj) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString().replace('T', ' ').substring(0, 19);
  const result = {};
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
    let val = obj[key];
    if (typeof val === 'boolean') val = val ? 1 : 0;
    result[snakeKey] = val;
  }
  return result;
}

// ========== 认证路由 ==========

// 登录
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return fail(res, '用户名和密码不能为空', 400);

    const [users] = await pool.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (users.length === 0) return fail(res, '用户名或密码错误', 400);

    const user = users[0];
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return fail(res, '用户名或密码错误', 400);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    ok(res, {
      token,
      user: { id: user.id, username: user.username, role: user.role, createdAt: user.created_at }
    });
  } catch (err) {
    console.error('[登录错误]', err);
    fail(res, '服务器内部错误');
  }
});

// 验证 token
app.get('/api/auth/verify', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, username, role, created_at FROM admins WHERE id = ?', [req.user.id]);
    if (users.length === 0) return fail(res, '用户不存在', 404);
    ok(res, snakeToCamel(users[0]));
  } catch (err) {
    console.error('[验证错误]', err);
    fail(res, '服务器内部错误');
  }
});

// ========== 管理员路由 ==========

// 获取管理员列表
app.get('/api/admins', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role, created_at FROM admins ORDER BY id ASC');
    ok(res, snakeToCamel(rows));
  } catch (err) {
    console.error('[获取管理员列表错误]', err);
    fail(res, '获取列表失败');
  }
});

// 新增管理员
app.post('/api/admins', authMiddleware, auditMiddleware({ operationType: 'create', targetTable: 'admins' }), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return fail(res, '用户名和密码不能为空', 400);

    const [existing] = await pool.query('SELECT id FROM admins WHERE username = ?', [username]);
    if (existing.length > 0) return fail(res, '用户名已存在', 400);

    const hash = bcrypt.hashSync(password, 10);
    const [result] = await pool.query(
      'INSERT INTO admins (username, password, role) VALUES (?, ?, ?)',
      [username, hash, role || 'admin']
    );

    ok(res, { id: result.insertId, username, role: role || 'admin' });
  } catch (err) {
    console.error('[新增管理员错误]', err);
    fail(res, '新增管理员失败');
  }
});

// 更新管理员
app.put('/api/admins/:id', authMiddleware, auditMiddleware({ operationType: 'update', targetTable: 'admins' }), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, role } = req.body;

    const [existing] = await pool.query('SELECT id FROM admins WHERE id = ?', [id]);
    if (existing.length === 0) return fail(res, '管理员不存在', 404);

    if (username) {
      const [dup] = await pool.query('SELECT id FROM admins WHERE username = ? AND id != ?', [username, id]);
      if (dup.length > 0) return fail(res, '用户名已存在', 400);
    }

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query(
        'UPDATE admins SET username = COALESCE(?, username), password = ?, role = COALESCE(?, role) WHERE id = ?',
        [username || null, hash, role || null, id]
      );
    } else {
      await pool.query(
        'UPDATE admins SET username = COALESCE(?, username), role = COALESCE(?, role) WHERE id = ?',
        [username || null, role || null, id]
      );
    }

    ok(res, {}, '更新成功');
  } catch (err) {
    console.error('[更新管理员错误]', err);
    fail(res, '更新失败');
  }
});

// 删除管理员
app.delete('/api/admins/:id', authMiddleware, auditMiddleware({ operationType: 'delete', targetTable: 'admins' }), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT id, username FROM admins WHERE id = ?', [id]);
    if (existing.length === 0) return fail(res, '管理员不存在', 404);
    const username = existing[0].username;
    await pool.query('DELETE FROM admins WHERE id = ?', [id]);
    ok(res, { _audit: { summary: `删除管理员【${username}】` } }, '删除成功');
  } catch (err) {
    console.error('[删除管理员错误]', err);
    fail(res, '删除失败');
  }
});

// ========== 成绩数据路由 ==========

// 获取所有成绩数据（保留，用于数据同步）
app.get('/api/data/sync', authMiddleware, async (req, res) => {
  try {
    const [gradeSevenList] = await pool.query('SELECT * FROM grade_seven ORDER BY name ASC');
    const [gradeEightList] = await pool.query('SELECT * FROM grade_eight ORDER BY name ASC');
    const [gradeNineList] = await pool.query('SELECT * FROM grade_nine ORDER BY name ASC');
    const [admissionList] = await pool.query('SELECT * FROM admission ORDER BY name ASC');

    ok(res, {
      gradeSevenList: snakeToCamel(gradeSevenList),
      gradeEightList: snakeToCamel(gradeEightList),
      gradeNineList: snakeToCamel(gradeNineList),
      admissionList: snakeToCamel(admissionList),
    });
  } catch (err) {
    console.error('[获取数据错误]', err);
    fail(res, '获取数据失败');
  }
});

// ========== 分页查询 API ==========

// 获取年份列表
app.get('/api/data/years', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT graduation_year as year FROM admission WHERE graduation_year IS NOT NULL AND graduation_year != \'\' ORDER BY graduation_year DESC'
    );
    ok(res, rows.map(r => r.year));
  } catch (err) {
    console.error('[获取年份列表错误]', err);
    fail(res, '获取年份列表失败');
  }
});

// 获取学校列表（可按年份筛选）
app.get('/api/data/schools', authMiddleware, async (req, res) => {
  try {
    const { year } = req.query;
    let sql = 'SELECT DISTINCT school FROM admission WHERE school IS NOT NULL AND school != \'\'';
    const params = [];
    if (year) {
      sql += ' AND graduation_year = ?';
      params.push(year);
    }
    sql += ' ORDER BY school ASC';
    const [rows] = await pool.query(sql, params);
    ok(res, rows.map(r => r.school));
  } catch (err) {
    console.error('[获取学校列表错误]', err);
    fail(res, '获取学校列表失败');
  }
});

// 通用分页查询
app.get('/api/data/page/:table', authMiddleware, async (req, res) => {
  try {
    const { table } = req.params;
    const allowedTables = ['grade_seven', 'grade_eight', 'grade_nine', 'admission'];
    if (!allowedTables.includes(table)) return fail(res, '无效的表名', 400);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(10000, Math.max(1, parseInt(req.query.pageSize) || 50));
    const keyword = (req.query.keyword || '').trim();
    const graduationYear = (req.query.graduationYear || '').trim();
    const school = (req.query.school || '').trim();

    let where = 'WHERE 1=1';
    const params = [];

    // 根据不同表设置搜索条件和排序
    let searchFields = 'name, identity_id, school';
    let orderBy = 'ORDER BY name ASC';
    if (table === 'grade_nine') {
      orderBy = 'ORDER BY school ASC, name ASC';
    } else if (table === 'admission') {
      searchFields = 'name, identity_id, registration_number, school';
      orderBy = `ORDER BY school ASC,
        CASE WHEN SUBSTRING(identity_id, 17, 1) IN ('1','3','5','7','9') THEN 1 ELSE 2 END ASC,
        registration_number ASC`;
    }

    if (keyword) {
      const fieldList = searchFields.split(', ');
      where += ' AND (' + fieldList.map(f => `${f} LIKE ?`).join(' OR ') + ')';
      const kw = `%${keyword}%`;
      params.push(...Array(fieldList.length).fill(kw));
    }
    if (graduationYear) {
      where += ' AND graduation_year = ?';
      params.push(graduationYear);
    }
    if (school) {
      where += ' AND school = ?';
      params.push(school);
    }

    // 查总数
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM ${table} ${where}`, params);
    const total = countResult[0].total;

    if (table === 'admission') {
      // 中招页面：按学校 → 性别（从身份证号提取）→ 报名序号
      orderBy = `ORDER BY school ASC,
        CASE WHEN SUBSTRING(identity_id, 17, 1) IN ('1','3','5','7','9') THEN 1 ELSE 2 END ASC,
        registration_number ASC`;
    }

    // 查分页数据
    const offset = (page - 1) * pageSize;
    const [rows] = await pool.query(
      `SELECT * FROM ${table} ${where} ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    ok(res, {
      list: snakeToCamel(rows),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (err) {
    console.error('[分页查询错误] table=', table, 'params=', req.query, err);
    fail(res, '查询失败');
  }
});

// 增量导入（仅导入新数据，不删除已有数据）
app.post('/api/data/import', authMiddleware, auditMiddleware({ operationType: 'create', targetTable: (req) => req.body.table || 'unknown' }), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { table, rows } = req.body;
    const allowedTables = ['grade_seven', 'grade_eight', 'grade_nine', 'admission'];
    if (!allowedTables.includes(table)) return fail(res, '无效的表名', 400);
    if (!rows || !Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400);

    await connection.beginTransaction();

    let importCount = 0, updateCount = 0;
    const BATCH = 500;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      for (const r of batch) {
        const snakeRow = camelToSnake(r);
        const cols = Object.keys(snakeRow);
        const idField = 'id';
        const idVal = snakeRow[idField];

        if (!idVal) continue;

        // 检查是否已存在
        const [existing] = await connection.query(`SELECT id FROM ${table} WHERE id = ?`, [idVal]);
        if (existing.length > 0) {
          // 更新
          const setClause = cols.filter(c => c !== idField).map(c => `${c}=?`).join(',');
          const values = cols.filter(c => c !== idField).map(c => snakeRow[c]);
          if (setClause) {
            await connection.query(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, idVal]);
            updateCount++;
          }
        } else {
          // 插入
          const placeholders = cols.map(() => '?').join(',');
          await connection.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, cols.map(c => snakeRow[c]));
          importCount++;
        }
      }
    }

    await connection.commit();

    // 收集学校汇总信息用于审计
    const schools = [...new Set(rows.map(r => (camelToSnake(r)).school || r.school || '').filter(Boolean))];
    const tableLabels = { grade_seven: '七年级成绩', grade_eight: '八年级成绩', grade_nine: '九年级成绩', admission: '中招成绩' };
    const tableLabel = tableLabels[table] || table;
    const auditSummary = `导入${tableLabel}：新增 ${importCount} 条，更新 ${updateCount} 条` + (schools.length > 0 ? `，涉及学校：${schools.join('、')}` : '');

    ok(res, { importCount, updateCount, total: importCount + updateCount, _audit: { summary: auditSummary, importCount, updateCount, schools } }, '导入成功');
  } catch (err) {
    await connection.rollback();
    console.error('[增量导入错误]', err);
    fail(res, '导入失败：' + err.message);
  } finally {
    connection.release();
  }
});

// 全量覆盖保存成绩数据（MySQL 事务保证原子性）
app.post('/api/data/sync', authMiddleware, auditMiddleware({ operationType: 'update', targetTable: 'grade_seven' }), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { gradeSevenList = [], gradeEightList = [], gradeNineList = [], admissionList = [] } = req.body;

    await connection.beginTransaction(); // 开启事务

    // 批量插入（每批 500 条，防止单次 SQL 过长）
    const batchUpsert = async (conn, table, rows, idField = 'id') => {
      if (!rows || rows.length === 0) return 0;
      const BATCH = 500;
      let total = 0;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const cols = Object.keys(camelToSnake(batch[0]));
        const placeholders = batch.map(() => '(' + cols.map(() => '?').join(',') + ')').join(',');
        const values = batch.flatMap(r => {
          const snakeRow = camelToSnake(r);
          return cols.map(c => {
            let val = snakeRow[c];
            // 特殊处理 created_at / updated_at：确保是有效日期或 null，避免 [object Object]
            if ((c === 'created_at' || c === 'updated_at') && val !== null && val !== undefined) {
              if (typeof val === 'object') {
                val = null;
              } else if (typeof val === 'string' && val.length > 0) {
                val = val.substring(0, 19);
                if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) val = null;
              } else {
                val = null;
              }
            }
            return val !== undefined ? val : null;
          });
        });
        // 使用 REPLACE 语义：主键冲突时覆盖
        await conn.query(
          `INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${cols.filter(c => c !== idField).map(c => `${c}=VALUES(${c})`).join(',')}`,
          values
        );
        total += batch.length;
      }
      return total;
    };

    // 使用 INSERT ... ON DUPLICATE KEY UPDATE 增量更新，不删除已有数据
    let sevenCount = 0, eightCount = 0, nineCount = 0, admCount = 0;
    if (gradeSevenList.length > 0) {
      sevenCount = await batchUpsert(connection, 'grade_seven', gradeSevenList);
    }
    if (gradeEightList.length > 0) {
      eightCount = await batchUpsert(connection, 'grade_eight', gradeEightList);
    }
    if (gradeNineList.length > 0) {
      nineCount = await batchUpsert(connection, 'grade_nine', gradeNineList);
    }
    if (admissionList.length > 0) {
      admCount = await batchUpsert(connection, 'admission', admissionList);
    }

    await connection.commit();
    console.log(`[SYNC] 七年级${sevenCount}条 八年级${eightCount}条 九年级${nineCount}条 中招${admCount}条`);
    ok(res, { gradeSevenCount: sevenCount, gradeEightCount: eightCount, gradeNineCount: nineCount, admissionCount: admCount }, '同步成功');
  } catch (err) {
    await connection.rollback();
    console.error('[同步数据错误]', err);
    fail(res, '同步失败：' + err.message);
  } finally {
    connection.release();
  }
});

// 清空所有成绩数据
app.post('/api/data/clear', authMiddleware, auditMiddleware({ operationType: 'delete', targetTable: 'grade_seven' }), async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM grade_seven');
    await connection.query('DELETE FROM grade_eight');
    await connection.query('DELETE FROM grade_nine');
    await connection.query('DELETE FROM admission');
    await connection.commit();
    ok(res, {}, '数据已清空');
  } catch (err) {
    await connection.rollback();
    console.error('[清空数据错误]', err);
    fail(res, '清空失败');
  } finally {
    connection.release();
  }
});

// 单条更新成绩数据
app.put('/api/data/:table/:id', authMiddleware, auditMiddleware({ operationType: 'update', targetTable: (req) => req.params.table }), async (req, res) => {
  try {
    const { table, id } = req.params;
    const allowedTables = ['grade_seven', 'grade_eight', 'grade_nine', 'admission'];
    if (!allowedTables.includes(table)) return fail(res, '无效的表名', 400);

    const snakeData = camelToSnake(req.body);
    const fields = Object.keys(snakeData).filter(k => k !== 'id');
    if (fields.length === 0) return fail(res, '无更新字段', 400);

    // 查询旧值用于审计对比
    const [oldRows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    const oldRecord = oldRows.length > 0 ? oldRows[0] : null;

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => snakeData[f]);

    const [result] = await pool.query(
      `UPDATE ${table} SET ${setClause} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0) return fail(res, '记录不存在', 404);

    // 构建字段中文名映射
    const fieldLabels = {
      attendance_score: '出勤率成绩', exam_score: '体育考试成绩', fitness_score: '体测成绩',
      total: '合计', long_run: '长跑', rope_skipping: '跳绳', long_jump: '跳远',
      ball_sports: '足(篮)球', martial_arts: '武术', grade_seven: '七年级成绩',
      grade_eight: '八年级成绩', registration_number: '报名序号', remark: '备注',
      review_status: '审核状态', review_remark: '审核备注',
    };

    // 构建变更详情
    const changes = fields.map(f => ({
      field: fieldLabels[f] || f,
      from: oldRecord ? (oldRecord[f] ?? '') : '',
      to: snakeData[f] ?? ''
    }));

    ok(res, {
      id,
      _audit: {
        record: oldRecord ? `${oldRecord.school} - ${oldRecord.name}` : `ID:${id}`,
        changes
      }
    }, '更新成功');
  } catch (err) {
    console.error('[单条更新错误]', err);
    fail(res, '更新失败：' + err.message);
  }
});

// ========== 材料管理路由 ==========

// 获取某年份的所有材料列表
app.get('/api/materials', authMiddleware, async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return fail(res, '请选择毕业年份', 400);
    const [rows] = await pool.query(
      'SELECT id, school, graduation_year, file_name, file_size, uploaded_by, created_at FROM materials WHERE graduation_year = ? ORDER BY school ASC',
      [year]
    );
    ok(res, rows);
  } catch (err) {
    console.error('[获取材料列表错误]', err);
    fail(res, '获取材料列表失败');
  }
});

// 上传材料（同一学校同年份只保留最新一份）
app.post('/api/materials/upload', authMiddleware, auditMiddleware({ operationType: 'create', targetTable: 'materials' }), async (req, res) => {
  try {
    const uploadSingle = upload.single('file');
    uploadSingle(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, '文件大小超过50MB限制', 400);
        return fail(res, '上传失败：' + err.message);
      }
      try {
        const { school, year } = req.body;
        if (!school || !year) return fail(res, '缺少学校或年份参数', 400);
        if (!req.file) return fail(res, '请选择文件', 400);

        // 查找是否已存在，存在则删除旧文件
        const [existing] = await pool.query(
          'SELECT file_path FROM materials WHERE school = ? AND graduation_year = ?',
          [school, year]
        );
        if (existing.length > 0) {
          const oldPath = existing[0].file_path;
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          await pool.query(
            'DELETE FROM materials WHERE school = ? AND graduation_year = ?',
            [school, year]
          );
        }

        // 插入新记录
        await pool.query(
          'INSERT INTO materials (school, graduation_year, file_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [school, year, req.file.originalname, req.file.path, req.file.size, req.user?.username || 'admin']
        );

        ok(res, { fileName: req.file.originalname, fileSize: req.file.size }, '上传成功');
      } catch (innerErr) {
        console.error('[上传材料错误]', innerErr);
        fail(res, '上传失败');
      }
    });
  } catch (err) {
    console.error('[上传材料错误]', err);
    fail(res, '上传失败');
  }
});

// 下载材料
app.get('/api/materials/download/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
    if (rows.length === 0) return fail(res, '文件不存在', 404);

    const file = rows[0];
    if (!fs.existsSync(file.file_path)) return fail(res, '文件已被删除', 404);

    res.download(file.file_path, file.file_name);
  } catch (err) {
    console.error('[下载材料错误]', err);
    fail(res, '下载失败');
  }
});

// 删除材料
app.delete('/api/materials/:id', authMiddleware, auditMiddleware({ operationType: 'delete', targetTable: 'materials' }), async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT file_path, school, graduation_year, file_name FROM materials WHERE id = ?', [id]);
    if (rows.length === 0) return fail(res, '文件不存在', 404);

    const { file_path: filePath, school, graduation_year, file_name } = rows[0];
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM materials WHERE id = ?', [id]);

    ok(res, { _audit: { summary: `删除材料【${school}】${graduation_year}届 - ${file_name}` } }, '删除成功');
  } catch (err) {
    console.error('[删除材料错误]', err);
    fail(res, '删除失败');
  }
});

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1');
    ok(res, { status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    fail(res, { status: 'error', db: 'disconnected' }, 500);
  }
});

// ========== 凭证管理路由 ==========

// 上传修改凭证
app.post('/api/credentials/upload', authMiddleware, async (req, res) => {
  try {
    const uploadSingle = upload.single('file');
    uploadSingle(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, '文件大小超过限制', 400);
        return fail(res, '上传失败：' + err.message);
      }
      try {
        const { grade, recordId } = req.body;
        if (!grade || !recordId || !req.file) return fail(res, '缺少参数', 400);

        // 删除旧凭证
        const [existing] = await pool.query(
          'SELECT file_path FROM grade_credentials WHERE grade_level = ? AND student_record_id = ?',
          [grade, recordId]
        );
        if (existing.length > 0) {
          const oldPath = existing[0].file_path;
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          await pool.query('DELETE FROM grade_credentials WHERE grade_level = ? AND student_record_id = ?', [grade, recordId]);
        }

        await pool.query(
          'INSERT INTO grade_credentials (grade_level, student_record_id, file_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [grade, recordId, req.file.originalname, req.file.path, req.file.size, req.user?.username || 'admin']
        );

        ok(res, { fileName: req.file.originalname }, '凭证上传成功');
      } catch (innerErr) {
        console.error('[上传凭证错误]', innerErr);
        fail(res, '上传失败');
      }
    });
  } catch (err) {
    console.error('[上传凭证错误]', err);
    fail(res, '上传失败');
  }
});

// 下载凭证
app.get('/api/credentials/download/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM grade_credentials WHERE id = ?', [id]);
    if (rows.length === 0) return fail(res, '凭证不存在', 404);

    const file = rows[0];
    if (!fs.existsSync(file.file_path)) return fail(res, '凭证文件已被删除', 404);

    res.download(file.file_path, file.file_name);
  } catch (err) {
    console.error('[下载凭证错误]', err);
    fail(res, '下载失败');
  }
});

// 获取某条记录的凭证信息
app.get('/api/credentials/info', authMiddleware, async (req, res) => {
  try {
    const { grade, recordId } = req.query;
    if (!grade || !recordId) return fail(res, '缺少参数', 400);
    const [rows] = await pool.query(
      'SELECT id, file_name, file_size, created_at FROM grade_credentials WHERE grade_level = ? AND student_record_id = ? ORDER BY created_at DESC LIMIT 1',
      [grade, recordId]
    );
    ok(res, rows[0] || null);
  } catch (err) {
    console.error('[获取凭证信息错误]', err);
    fail(res, '获取失败');
  }
});

// ========== 操作日志路由 ==========

// 分页查询操作日志
app.get('/api/logs', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
    const { operator, operationType, targetTable, startDate, endDate } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (operator) { where += ' AND operator LIKE ?'; params.push(`%${operator}%`); }
    if (operationType) { where += ' AND operation_type = ?'; params.push(operationType); }
    if (targetTable) { where += ' AND target_table = ?'; params.push(targetTable); }
    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate); }
    if (endDate) { where += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59'); }

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM operation_logs ${where}`, params
    );
    const total = countResult[0].total;

    const offset = (page - 1) * pageSize;
    const [rows] = await pool.query(
      `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    ok(res, {
      list: rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('[获取操作日志错误]', err);
    fail(res, '获取操作日志失败');
  }
});

// 获取日志筛选选项
app.get('/api/logs/options', authMiddleware, async (req, res) => {
  try {
    const [operators] = await pool.query('SELECT DISTINCT operator FROM operation_logs ORDER BY operator');
    const [types] = await pool.query('SELECT DISTINCT operation_type FROM operation_logs ORDER BY operation_type');
    const [tables] = await pool.query('SELECT DISTINCT target_table FROM operation_logs ORDER BY target_table');

    ok(res, {
      operators: operators.map(r => r.operator),
      operationTypes: types.map(r => r.operation_type),
      targetTables: tables.map(r => r.target_table),
    });
  } catch (err) {
    console.error('[获取日志选项错误]', err);
    fail(res, '获取日志选项失败');
  }
});

// ========== 启动服务 ==========
async function start() {
  try {
    await initDatabase();
    await initPool();
    app.locals.pool = pool; // 注册 pool 供审计中间件使用
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 体育成绩管理系统后端已启动: http://0.0.0.0:${PORT}`);
      console.log(`📊 API地址: http://你的服务器IP:${PORT}/api`);
      console.log(`✅ MySQL数据库: ${process.env.DB_NAME || 'sport_manage'} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
      console.log(`👤 默认管理员: admin / admin123\n`);
    });
  } catch (err) {
    console.error('[启动失败]', err);
    process.exit(1);
  }
}

start();

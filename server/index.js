/**
 * 体育成绩管理系统后端
 */
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const fs = require('fs')
const { initPool, initDatabase, getPool } = require('./db')

const app = express()

// 只信任第一跳代理（Nginx），避免攻击者伪造 X-Forwarded-For 绕过限流
app.set('trust proxy', 1)

const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 环境变量未设置，请检查 .env 文件')
  process.exit(1)
}
if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
  console.error('[FATAL] 生产环境的 JWT_SECRET 长度必须不少于 32 位')
  process.exit(1)
}

// ========== CORS ==========
// 白名单来源：生产环境用 CORS_ORIGINS 配置，开发环境默认放行本机端口
const DEFAULT_ORIGINS = [
  'http://localhost:3000', 'http://127.0.0.1:3000',
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:4000', 'http://127.0.0.1:4000',
]
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : DEFAULT_ORIGINS)

app.use(cors({
  origin(origin, callback) {
    // 同源请求 / curl 等没有 Origin 头的请求直接放行
    if (!origin) return callback(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true)
    return callback(new Error(`CORS 拒绝的来源: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))

// ========== 请求体 ==========
// 成绩数据走批量接口，5MB 足够覆盖数万行；文件上传走 multipart 不受此限制
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

// ========== 安全响应头 ==========
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; " +
    "object-src 'none'; base-uri 'self'",
  )
  next()
})

// ========== 路由 ==========
app.use('/api/auth', require('./routes/auth'))
app.use('/api/admins', require('./routes/admins'))
app.use('/api/schools', require('./routes/schools'))
app.use('/api/data', require('./routes/grades'))
app.use('/api/materials', require('./routes/materials'))
app.use('/api/credentials', require('./routes/credentials'))
app.use('/api/reconsiderations', require('./routes/reconsiderations'))
app.use('/api/submissions', require('./routes/submissions'))
app.use('/api/registrations', require('./routes/registrations'))
app.use('/api/settings', require('./routes/settings'))
app.use('/api/logs', require('./routes/logs'))

// 静态资源（生产构建产物）
const distDir = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '7d', index: false }))
  // SPA 回退：非 /api 路径一律交给前端路由
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    res.sendFile(path.join(distDir, 'index.html'), (err) => {
      if (err) next()
    })
  })
}

// 健康检查
app.get('/api/health', async (req, res) => {
  const started = Date.now()
  try {
    const pool = getPool()
    await pool.query('SELECT 1')
    res.json({
      code: 200,
      data: {
        status: 'ok',
        db: 'connected',
        latencyMs: Date.now() - started,
        uptime: Math.round(process.uptime()),
        time: new Date().toISOString(),
      },
      message: 'success',
    })
  } catch (err) {
    res.status(503).json({
      code: 503,
      data: { status: 'error', db: 'disconnected' },
      message: '数据库断开',
    })
  }
})

// 统一 404
app.use('/api', (req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在' })
})

// 统一错误处理
app.use((err, req, res, next) => {
  console.error('[未捕获异常]', err)
  if (res.headersSent) return next(err)
  res.status(500).json({ code: 500, message: '服务器内部错误' })
})

// ========== 启动 ==========
async function start() {
  try {
    await initDatabase()
    await initPool()
    app.locals.pool = getPool()
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 体育成绩管理系统后端已启动: http://0.0.0.0:${PORT}`)
      console.log(`📊 API 地址: http://127.0.0.1:${PORT}/api`)
      console.log(`✅ 数据库: ${process.env.DB_NAME || 'sport_manage'} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`)
      if (fs.existsSync(distDir)) {
        console.log(`🌐 前端已内置: http://127.0.0.1:${PORT}`)
      }
      console.log('')
    })
  } catch (err) {
    console.error('[启动失败]', err)
    process.exit(1)
  }
}

start()

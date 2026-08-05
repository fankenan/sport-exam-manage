/**
 * 体育成绩管理系统后端
 */
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { initPool, initDatabase, getPool } = require('./db')

const app = express()
app.set('trust proxy', true)
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 环境变量未设置，请检查 .env 文件')
  process.exit(1)
}

// ========== 中间件 ==========
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;")
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
app.use('/api/logs', require('./routes/logs'))

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query('SELECT 1')
    const { ok } = require('./utils')
    ok(res, { status: 'ok', db: 'connected', time: new Date().toISOString() })
  } catch (err) {
    const { fail } = require('./utils')
    fail(res, '数据库断开', 500, { status: 'error', db: 'disconnected' })
  }
})

// ========== 启动 ==========
async function start() {
  try {
    await initDatabase()
    await initPool()
    app.locals.pool = getPool()
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 体育成绩管理系统后端已启动: http://0.0.0.0:${PORT}`)
      console.log(`📊 API地址: http://你的服务器IP:${PORT}/api`)
      console.log(`✅ 数据库: ${process.env.DB_NAME || 'sport_manage'} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`)
      console.log(`👤 默认管理员: admin / admin123\n`)
    })
  } catch (err) {
    console.error('[启动失败]', err)
    process.exit(1)
  }
}

start()

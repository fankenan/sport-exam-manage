/**
 * 认证路由
 */
const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const rateLimit = require('express-rate-limit')
const { ok, fail } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { getPool } = require('../db')

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { code: 429, message: '登录尝试过于频繁，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
})

// 登录
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const pool = getPool()
    const { username, password } = req.body
    const cleanUsername = username?.trim()
    if (!cleanUsername || !password) return fail(res, '用户名和密码不能为空', 400)

    const [users] = await pool.query(
      'SELECT a.*, s.name AS school_name FROM admins a LEFT JOIN schools s ON a.school_id = s.id WHERE a.username = ?',
      [cleanUsername]
    )
    if (users.length === 0) return fail(res, '用户名或密码错误', 400)

    const user = users[0]
    const valid = bcrypt.compareSync(password, user.password)
    if (!valid) return fail(res, '用户名或密码错误', 400)

    // 学校账号停用检查
    if (user.school_id && user.status === 0) {
      return fail(res, '该账号已被管理员停用', 403)
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        schoolId: user.school_id || null,
        schoolName: user.school_name || null
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    ok(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        schoolId: user.school_id || null,
        schoolName: user.school_name || null,
        createdAt: user.created_at
      }
    })
  } catch (err) {
    console.error('[登录错误]', err)
    fail(res, '服务器内部错误')
  }
})

// 修改密码
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) return fail(res, '请填写原密码和新密码', 400)
    if (newPassword.length < 6) return fail(res, '新密码长度不能少于6位', 400)

    const [users] = await pool.query('SELECT password FROM admins WHERE id = ?', [req.user.id])
    if (users.length === 0) return fail(res, '用户不存在', 404)

    const valid = bcrypt.compareSync(oldPassword, users[0].password)
    if (!valid) return fail(res, '原密码错误', 400)

    const hash = bcrypt.hashSync(newPassword, 10)
    await pool.query('UPDATE admins SET password = ? WHERE id = ?', [hash, req.user.id])
    ok(res, {}, '密码修改成功')
  } catch (err) {
    console.error('[修改密码错误]', err)
    fail(res, '修改密码失败')
  }
})

// 验证 token
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const [users] = await pool.query(
      'SELECT a.id, a.username, a.role, a.school_id, a.created_at, s.name AS school_name FROM admins a LEFT JOIN schools s ON a.school_id = s.id WHERE a.id = ?',
      [req.user.id]
    )
    if (users.length === 0) return fail(res, '用户不存在', 404)
    const u = users[0]
    ok(res, {
      id: u.id,
      username: u.username,
      role: u.role,
      schoolId: u.school_id || null,
      schoolName: u.school_name || null,
      createdAt: u.created_at
    })
  } catch (err) {
    console.error('[验证错误]', err)
    fail(res, '服务器内部错误')
  }
})

module.exports = router

/**
 * JWT 认证中间件
 */
const jwt = require('jsonwebtoken')
const { getPool } = require('../db')

/**
 * 校验令牌
 *
 * 除签名与过期时间外，还比对数据库中的 token_version：
 * 用户修改密码或被管理员停用后，已签发的令牌立即失效。
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' })
  }
  const token = authHeader.substring(7)

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? '令牌已过期，请重新登录' : '令牌无效'
    return res.status(401).json({ code: 401, message: msg })
  }

  try {
    const pool = getPool()
    const [rows] = await pool.query(
      'SELECT id, username, role, school_id, status, token_version FROM admins WHERE id = ?',
      [decoded.id],
    )
    if (rows.length === 0) {
      return res.status(401).json({ code: 401, message: '账号不存在' })
    }
    const user = rows[0]

    // 账号被停用
    if (user.status === 0) {
      return res.status(403).json({ code: 403, message: '该账号已被停用' })
    }

    // 令牌版本落后于数据库（改过密码 / 被强制下线）
    const tokenVersion = decoded.tokenVersion || 0
    if (Number(user.token_version || 0) !== tokenVersion) {
      return res.status(401).json({ code: 401, message: '登录状态已失效，请重新登录' })
    }

    // 学校信息以数据库为准，避免改名后令牌里的旧学校名继续生效
    let schoolName = null
    if (user.school_id != null) {
      const [sch] = await pool.query('SELECT name FROM schools WHERE id = ?', [user.school_id])
      schoolName = sch.length > 0 ? sch[0].name : null
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      schoolId: user.school_id || null,
      schoolName,
      tokenVersion,
    }
    next()
  } catch (err) {
    console.error('[认证中间件错误]', err)
    return res.status(401).json({ code: 401, message: '认证失败' })
  }
}

module.exports = { authMiddleware }

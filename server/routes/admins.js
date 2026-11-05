/**
 * 管理员管理路由（仅管理员可访问）
 */
const express = require('express')
const bcrypt = require('bcryptjs')
const { ok, fail, snakeToCamel } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')

const router = express.Router()

// 获取管理员列表
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(
      'SELECT a.id, a.username, a.role, a.school_id, a.status, a.last_login_at, a.created_at, s.name AS school_name ' +
      'FROM admins a LEFT JOIN schools s ON a.school_id = s.id ORDER BY a.id ASC',
    )
    ok(res, snakeToCamel(rows))
  } catch (err) {
    console.error('[获取管理员列表错误]', err)
    fail(res, '获取列表失败')
  }
})

// 新增管理员
router.post('/', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'create', targetTable: 'admins' }), async (req, res) => {
  try {
    const pool = getPool()
    const { username, password, role, schoolId } = req.body
    const cleanUsername = username?.trim()
    if (!cleanUsername || !password) return fail(res, '用户名和密码不能为空', 400)
    if (String(password).length < 8) return fail(res, '密码长度不能少于 8 位', 400)

    const [existing] = await pool.query('SELECT id FROM admins WHERE username = ?', [cleanUsername])
    if (existing.length > 0) return fail(res, '用户名已存在', 400)

    // 如果指定了 schoolId，校验学校存在
    if (schoolId) {
      const [sch] = await pool.query('SELECT id FROM schools WHERE id = ?', [schoolId])
      if (sch.length === 0) return fail(res, '所选学校不存在', 400)
    }

    const hash = await bcrypt.hash(String(password), 10)
    const finalRole = role || (schoolId ? 'school' : 'admin')
    const [result] = await pool.query(
      'INSERT INTO admins (username, password, role, school_id) VALUES (?, ?, ?, ?)',
      [cleanUsername, hash, finalRole, schoolId || null],
    )

    ok(res, { id: result.insertId, username: cleanUsername, role: finalRole, schoolId: schoolId || null })
  } catch (err) {
    console.error('[新增管理员错误]', err)
    fail(res, '新增管理员失败')
  }
})

// 一键停用/启用所有学校账号
router.put('/toggle-schools', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'admins' }), async (req, res) => {
  try {
    const pool = getPool()
    const { enable } = req.body
    const status = enable ? 1 : 0
    const [result] = await pool.query('UPDATE admins SET status = ? WHERE school_id IS NOT NULL', [status])
    ok(res, { affected: result.affectedRows, enabled: !!enable }, enable ? '所有学校账号已启用' : '所有学校账号已停用')
  } catch (err) {
    console.error('[切换学校账号错误]', err)
    fail(res, '操作失败')
  }
})

// 查询学校账号的启用状态（供前端初始化按钮文案）
router.get('/schools-status', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS enabled ' +
      'FROM admins WHERE school_id IS NOT NULL',
    )
    ok(res, {
      total: Number(rows[0].total || 0),
      enabled: Number(rows[0].enabled || 0),
      allEnabled: Number(rows[0].total || 0) > 0 && Number(rows[0].enabled || 0) === Number(rows[0].total || 0),
    })
  } catch (err) {
    console.error('[查询学校账号状态错误]', err)
    fail(res, '操作失败')
  }
})

// 更新管理员
router.put('/:id', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'admins' }), async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const { username, password, role, schoolId, status } = req.body

    const [existing] = await pool.query('SELECT id, username, role, school_id FROM admins WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '管理员不存在', 404)
    const target = existing[0]

    // 不允许停用/降级最后一个可用的管理员账号
    const [activeAdmins] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM admins WHERE role = 'admin' AND school_id IS NULL AND status = 1",
    )
    const isLastAdmin = target.role === 'admin' && target.school_id == null && Number(activeAdmins[0].cnt) <= 1
    if (isLastAdmin && (status === 0 || (role && role !== 'admin') || (schoolId !== undefined && schoolId !== null))) {
      return fail(res, '不能停用或降级最后一个管理员账号', 400)
    }

    if (username) {
      const [dup] = await pool.query('SELECT id FROM admins WHERE username = ? AND id != ?', [username, id])
      if (dup.length > 0) return fail(res, '用户名已存在', 400)
    }

    // 如果传了 schoolId，校验学校存在
    if (schoolId !== undefined && schoolId !== null) {
      const [sch] = await pool.query('SELECT id FROM schools WHERE id = ?', [schoolId])
      if (sch.length === 0) return fail(res, '所选学校不存在', 400)
    }

    const sets = []
    const params = []
    if (username) { sets.push('username = ?'); params.push(username.trim()) }
    if (role) { sets.push('role = ?'); params.push(role) }
    if (schoolId !== undefined) { sets.push('school_id = ?'); params.push(schoolId) }
    if (status !== undefined) { sets.push('status = ?'); params.push(status ? 1 : 0) }
    if (password) {
      if (String(password).length < 8) return fail(res, '密码长度不能少于 8 位', 400)
      const hash = await bcrypt.hash(String(password), 10)
      sets.push('password = ?')
      params.push(hash)
      // 改密后吊销该账号已签发的令牌
      sets.push('token_version = token_version + 1')
    }

    if (sets.length === 0) return fail(res, '无更新字段', 400)
    params.push(id)
    await pool.query(`UPDATE admins SET ${sets.join(', ')} WHERE id = ?`, params)

    ok(res, {}, '更新成功')
  } catch (err) {
    console.error('[更新管理员错误]', err)
    fail(res, '更新失败')
  }
})

// 删除管理员
router.delete('/:id', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'delete', targetTable: 'admins' }), async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const [existing] = await pool.query('SELECT id, username, role, school_id FROM admins WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '管理员不存在', 404)
    const target = existing[0]

    // 不允许删除自己
    if (Number(id) === Number(req.user.id)) {
      return fail(res, '不能删除当前登录的账号', 400)
    }

    // 不允许删除最后一个管理员
    if (target.role === 'admin' && target.school_id == null) {
      const [admins] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM admins WHERE role = 'admin' AND school_id IS NULL AND status = 1",
      )
      if (Number(admins[0].cnt) <= 1) return fail(res, '不能删除最后一个管理员账号', 400)
    }

    await pool.query('DELETE FROM admins WHERE id = ?', [id])
    ok(res, { _audit: { summary: `删除管理员【${target.username}】` } }, '删除成功')
  } catch (err) {
    console.error('[删除管理员错误]', err)
    fail(res, '删除失败')
  }
})

module.exports = router

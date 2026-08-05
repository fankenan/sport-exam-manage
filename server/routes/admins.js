/**
 * 管理员管理路由（仅管理员可访问）
 */
const express = require('express')
const bcrypt = require('bcryptjs')
const { ok, fail } = require('../utils')
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
      'SELECT a.id, a.username, a.role, a.school_id, a.created_at, s.name AS school_name FROM admins a LEFT JOIN schools s ON a.school_id = s.id ORDER BY a.id ASC'
    )
    ok(res, rows.map(r => ({
      id: r.id,
      username: r.username,
      role: r.role,
      schoolId: r.school_id || null,
      schoolName: r.school_name || null,
      createdAt: r.created_at
    })))
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

    const [existing] = await pool.query('SELECT id FROM admins WHERE username = ?', [cleanUsername])
    if (existing.length > 0) return fail(res, '用户名已存在', 400)

    // 如果指定了 schoolId，校验学校存在
    if (schoolId) {
      const [sch] = await pool.query('SELECT id FROM schools WHERE id = ?', [schoolId])
      if (sch.length === 0) return fail(res, '所选学校不存在', 400)
    }

    const hash = bcrypt.hashSync(password, 10)
    const [result] = await pool.query(
      'INSERT INTO admins (username, password, role, school_id) VALUES (?, ?, ?, ?)',
      [cleanUsername, hash, role || (schoolId ? 'school' : 'admin'), schoolId || null]
    )

    ok(res, { id: result.insertId, username: cleanUsername, role: role || 'admin', schoolId: schoolId || null })
  } catch (err) {
    console.error('[新增管理员错误]', err)
    fail(res, '新增管理员失败')
  }
})

// 一键停用/启用所有学校账号
router.put('/toggle-schools', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pool = getPool()
    const { enable } = req.body
    const status = enable ? 1 : 0
    await pool.query('UPDATE admins SET status = ? WHERE school_id IS NOT NULL', [status])
    ok(res, {}, enable ? '所有学校账号已启用' : '所有学校账号已停用')
  } catch (err) {
    console.error('[切换学校账号错误]', err)
    fail(res, '操作失败')
  }
})

// 更新管理员
router.put('/:id', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'admins' }), async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const { username, password, role, schoolId } = req.body

    const [existing] = await pool.query('SELECT id FROM admins WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '管理员不存在', 404)

    if (username) {
      const [dup] = await pool.query('SELECT id FROM admins WHERE username = ? AND id != ?', [username, id])
      if (dup.length > 0) return fail(res, '用户名已存在', 400)
    }

    // 如果传了 schoolId，校验学校存在
    if (schoolId !== undefined) {
      if (schoolId !== null) {
        const [sch] = await pool.query('SELECT id FROM schools WHERE id = ?', [schoolId])
        if (sch.length === 0) return fail(res, '所选学校不存在', 400)
      }
      await pool.query('UPDATE admins SET school_id = ? WHERE id = ?', [schoolId, id])
    }

    if (password) {
      const hash = bcrypt.hashSync(password, 10)
      await pool.query(
        'UPDATE admins SET username = COALESCE(?, username), password = ?, role = COALESCE(?, role) WHERE id = ?',
        [username || null, hash, role || null, id]
      )
    } else if (username || role) {
      await pool.query(
        'UPDATE admins SET username = COALESCE(?, username), role = COALESCE(?, role) WHERE id = ?',
        [username || null, role || null, id]
      )
    }

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
    const [existing] = await pool.query('SELECT id, username FROM admins WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '管理员不存在', 404)
    const username = existing[0].username
    await pool.query('DELETE FROM admins WHERE id = ?', [id])
    ok(res, { _audit: { summary: `删除管理员【${username}】` } }, '删除成功')
  } catch (err) {
    console.error('[删除管理员错误]', err)
    fail(res, '删除失败')
  }
})

module.exports = router

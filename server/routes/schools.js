/**
 * 学校管理路由（仅管理员可访问）
 */
const express = require('express')
const { ok, fail } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')

const router = express.Router()

// 获取学校列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query('SELECT id, name, created_at FROM schools ORDER BY id ASC')
    ok(res, rows)
  } catch (err) {
    console.error('[获取学校列表错误]', err)
    fail(res, '获取学校列表失败')
  }
})

// 新增学校（仅管理员）
router.post('/', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'create', targetTable: 'schools' }), async (req, res) => {
  try {
    const pool = getPool()
    const { name } = req.body
    if (!name || !name.trim()) return fail(res, '学校名称不能为空', 400)

    const [existing] = await pool.query('SELECT id FROM schools WHERE name = ?', [name.trim()])
    if (existing.length > 0) return fail(res, '学校名称已存在', 400)

    const [result] = await pool.query('INSERT INTO schools (name) VALUES (?)', [name.trim()])
    ok(res, { id: result.insertId, name: name.trim() }, '添加成功')
  } catch (err) {
    console.error('[新增学校错误]', err)
    fail(res, '新增学校失败')
  }
})

// 更新学校（仅管理员）
router.put('/:id', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'schools' }), async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const { name } = req.body
    if (!name || !name.trim()) return fail(res, '学校名称不能为空', 400)

    const [existing] = await pool.query('SELECT id FROM schools WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '学校不存在', 404)

    const [dup] = await pool.query('SELECT id FROM schools WHERE name = ? AND id != ?', [name.trim(), id])
    if (dup.length > 0) return fail(res, '学校名称已存在', 400)

    await pool.query('UPDATE schools SET name = ? WHERE id = ?', [name.trim(), id])
    ok(res, { id: parseInt(id), name: name.trim() }, '更新成功')
  } catch (err) {
    console.error('[更新学校错误]', err)
    fail(res, '更新学校失败')
  }
})

// 删除学校（仅管理员）
router.delete('/:id', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'delete', targetTable: 'schools' }), async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params

    const [existing] = await pool.query('SELECT id, name FROM schools WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '学校不存在', 404)

    // 检查是否有关联账号
    const [linked] = await pool.query('SELECT COUNT(*) as cnt FROM admins WHERE school_id = ?', [id])
    if (linked[0].cnt > 0) {
      return fail(res, `该学校下有 ${linked[0].cnt} 个关联账号，请先解除关联后再删除`, 400)
    }

    const schoolName = existing[0].name
    await pool.query('DELETE FROM schools WHERE id = ?', [id])
    ok(res, { _audit: { summary: `删除学校【${schoolName}】` } }, '删除成功')
  } catch (err) {
    console.error('[删除学校错误]', err)
    fail(res, '删除学校失败')
  }
})

module.exports = router

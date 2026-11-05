/**
 * 学校管理路由（仅管理员可访问）
 */
const express = require('express')
const { ok, fail, snakeToCamel } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { requireAdmin, resolveSchoolName } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')

const router = express.Router()

// 学校名出现于这些表，改名时需要级联更新，避免成绩数据与学校表脱钩
const SCHOOL_SCOPED_TABLES = [
  'grade_seven', 'grade_eight', 'grade_nine', 'admission',
  'materials', 'grade_duplicates', 'grade_reconsiderations', 'grade_submissions',
]

// 获取学校列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    // 学校账号只能看到自己的学校
    if (req.user && req.user.schoolId != null) {
      const mySchool = await resolveSchoolName(pool, req)
      const [rows] = await pool.query('SELECT id, name, created_at FROM schools WHERE id = ?', [req.user.schoolId])
      ok(res, snakeToCamel(rows))
      return
    }
    const [rows] = await pool.query('SELECT id, name, created_at FROM schools ORDER BY id ASC')
    ok(res, snakeToCamel(rows))
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
    const cleanName = name.trim()

    const [existing] = await pool.query('SELECT id FROM schools WHERE name = ?', [cleanName])
    if (existing.length > 0) return fail(res, '学校名称已存在', 400)

    const [result] = await pool.query('INSERT INTO schools (name) VALUES (?)', [cleanName])
    ok(res, { id: result.insertId, name: cleanName }, '添加成功')
  } catch (err) {
    console.error('[新增学校错误]', err)
    fail(res, '新增学校失败')
  }
})

// 更新学校（仅管理员）——改名时级联更新所有引用该学校名的数据
router.put('/:id', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'schools' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { id } = req.params
    const { name } = req.body
    if (!name || !name.trim()) return fail(res, '学校名称不能为空', 400)
    const cleanName = name.trim()

    const [existing] = await connection.query('SELECT id, name FROM schools WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '学校不存在', 404)
    const oldName = existing[0].name

    const [dup] = await connection.query('SELECT id FROM schools WHERE name = ? AND id != ?', [cleanName, id])
    if (dup.length > 0) return fail(res, '学校名称已存在', 400)

    await connection.beginTransaction()
    await connection.query('UPDATE schools SET name = ? WHERE id = ?', [cleanName, id])

    // 级联更新引用了旧学校名的数据
    let affected = 0
    if (cleanName !== oldName) {
      for (const table of SCHOOL_SCOPED_TABLES) {
        const [r] = await connection.query(`UPDATE ${table} SET school = ? WHERE school = ?`, [cleanName, oldName])
        affected += r.affectedRows || 0
      }
    }
    await connection.commit()

    ok(res, {
      id: parseInt(id), name: cleanName, affected,
      _audit: { summary: `学校改名【${oldName} → ${cleanName}】，同步更新 ${affected} 条数据` },
    }, '更新成功')
  } catch (err) {
    await connection.rollback()
    console.error('[更新学校错误]', err)
    fail(res, '更新学校失败')
  } finally {
    connection.release()
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

    // 检查是否还有成绩数据
    const schoolName = existing[0].name
    for (const table of ['grade_seven', 'grade_eight', 'grade_nine', 'admission']) {
      const [cnt] = await pool.query(`SELECT COUNT(*) as cnt FROM ${table} WHERE school = ?`, [schoolName])
      if (cnt[0].cnt > 0) {
        return fail(res, `该学校下仍有 ${cnt[0].cnt} 条成绩数据，请先清理后再删除`, 400)
      }
    }

    await pool.query('DELETE FROM schools WHERE id = ?', [id])
    ok(res, { _audit: { summary: `删除学校【${schoolName}】` } }, '删除成功')
  } catch (err) {
    console.error('[删除学校错误]', err)
    fail(res, '删除学校失败')
  }
})

module.exports = router

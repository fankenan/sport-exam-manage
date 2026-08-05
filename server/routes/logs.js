/**
 * 操作日志路由（仅管理员可访问）
 */
const express = require('express')
const { ok, fail } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/rbac')
const { getPool } = require('../db')

const router = express.Router()

// 分页查询操作日志
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pool = getPool()
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
    const { operator, operationType, targetTable, startDate, endDate } = req.query

    let where = 'WHERE 1=1'
    const params = []

    if (operator) { where += ' AND operator LIKE ?'; params.push(`%${operator}%`) }
    if (operationType) { where += ' AND operation_type = ?'; params.push(operationType) }
    if (targetTable) { where += ' AND target_table = ?'; params.push(targetTable) }
    if (startDate) { where += ' AND created_at >= ?'; params.push(startDate) }
    if (endDate) { where += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59') }

    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM operation_logs ${where}`, params)
    const total = countResult[0].total

    const offset = (page - 1) * pageSize
    const [rows] = await pool.query(
      `SELECT * FROM operation_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    ok(res, { list: rows, total, page, pageSize, totalPages: Math.ceil(total / pageSize) })
  } catch (err) {
    console.error('[获取操作日志错误]', err)
    fail(res, '获取操作日志失败')
  }
})

// 获取日志筛选选项
router.get('/options', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pool = getPool()
    const [operators] = await pool.query('SELECT DISTINCT operator FROM operation_logs ORDER BY operator')
    const [types] = await pool.query('SELECT DISTINCT operation_type FROM operation_logs ORDER BY operation_type')
    const [tables] = await pool.query('SELECT DISTINCT target_table FROM operation_logs ORDER BY target_table')

    ok(res, {
      operators: operators.map(r => r.operator),
      operationTypes: types.map(r => r.operation_type),
      targetTables: tables.map(r => r.target_table),
    })
  } catch (err) {
    console.error('[获取日志选项错误]', err)
    fail(res, '获取日志选项失败')
  }
})

module.exports = router

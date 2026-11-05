/**
 * 系统设置路由
 *
 * 目前只有一项：学校端可导出哪些成绩表。
 * 管理员在「系统管理」里开关，学校端的导出按钮随之显示/隐藏；
 * **服务端导出接口也会校验这个设置**，前端隐藏按钮只是界面表现，不是权限控制。
 */
const express = require('express')
const { ok, fail } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { requireAdmin } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')

const router = express.Router()

const KEY = 'school_export_tables'
const DEFAULT_TABLES = ['grade_nine', 'admission']

/** 可导出的表（白名单，防止设置里被塞进任意表名） */
const EXPORTABLE_TABLES = ['grade_seven', 'grade_eight', 'grade_nine', 'admission']

const TABLE_LABELS = {
  grade_seven: '七年级成绩',
  grade_eight: '八年级成绩',
  grade_nine: '九年级成绩',
  admission: '中招体育成绩',
}

/** 读取设置 */
async function readSetting(pool) {
  const [rows] = await pool.query('SELECT setting_value FROM app_settings WHERE setting_key = ?', [KEY])
  if (rows.length === 0) return DEFAULT_TABLES.slice()
  const list = String(rows[0].setting_value || '')
    .split(',')
    .map(s => s.trim())
    .filter(s => EXPORTABLE_TABLES.includes(s))
  return list.length > 0 ? list : []
}

/**
 * 判断某账号能否导出指定表
 * 管理员始终可以；学校账号按设置的白名单
 */
async function canExport(pool, req, table) {
  if (!EXPORTABLE_TABLES.includes(table)) return false
  if (!req.user) return false
  if (req.user.schoolId == null) return true // 管理员
  const allowed = await readSetting(pool)
  return allowed.includes(table)
}

// 查询当前用户可导出的表（前端据此显示导出按钮）
router.get('/export-tables', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    if (req.user.schoolId == null) {
      ok(res, { tables: EXPORTABLE_TABLES.slice(), labels: TABLE_LABELS })
      return
    }
    const allowed = await readSetting(pool)
    ok(res, {
      tables: allowed,
      labels: TABLE_LABELS,
    })
  } catch (err) {
    console.error('[读取导出设置错误]', err)
    fail(res, '获取失败')
  }
})

// 管理员读取完整设置
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pool = getPool()
    const allowed = await readSetting(pool)
    ok(res, {
      schoolExportTables: allowed,
      exportableTables: EXPORTABLE_TABLES,
      labels: TABLE_LABELS,
    })
  } catch (err) {
    console.error('[读取设置错误]', err)
    fail(res, '获取失败')
  }
})

// 管理员保存设置
router.put('/school-export-tables', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'app_settings' }), async (req, res) => {
  try {
    const pool = getPool()
    const raw = Array.isArray(req.body?.tables) ? req.body.tables : []
    const tables = raw
      .map(t => String(t).trim())
      .filter(t => EXPORTABLE_TABLES.includes(t))
    const value = tables.join(',')
    await pool.query(
      `INSERT INTO app_settings (setting_key, setting_value, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
                               updated_by = VALUES(updated_by)`,
      [KEY, value, req.user?.username || 'admin'],
    )
    ok(res, {
      tables,
      _audit: {
        summary: `设置学校可导出的成绩表：${tables.map(t => TABLE_LABELS[t] || t).join('、') || '（全部关闭）'}`,
      },
    }, '已保存')
  } catch (err) {
    console.error('[保存导出设置错误]', err)
    fail(res, '保存失败')
  }
})

module.exports = router
module.exports.canExport = canExport
module.exports.readSetting = readSetting
module.exports.EXPORTABLE_TABLES = EXPORTABLE_TABLES
module.exports.TABLE_LABELS = TABLE_LABELS

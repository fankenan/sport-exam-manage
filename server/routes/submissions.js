/**
 * 学校成绩上报表路由（新增模块）
 *
 * 流程：学校上传 Excel → 服务端预检（校验 + 差异对比）→ 确认提交 → 管理员审核 → 发布写入成绩表
 *
 * - 学校账号：只能预检 / 提交 / 查看本校的上报记录
 * - 管理员：查看全部上报表、审核通过（写回成绩表）、驳回（必须填原因）
 */
const express = require('express')
const XLSX = require('xlsx')
const { ok, fail, snakeToCamel, camelToSnake } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { requireAdmin, requireSchoolUser, resolveSchoolName } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')
const { GRADE_TABLE_FIELDS, REVIEW_STATUS } = require('../constants')

const router = express.Router()

// 年级 → 成绩表 / 表单标题
const GRADE_LEVELS = {
  seven: { table: 'grade_seven', label: '七年级', title: '七年级体育成绩上报表' },
  eight: { table: 'grade_eight', label: '八年级', title: '八年级体育成绩上报表' },
  nine: { table: 'grade_nine', label: '九年级', title: '九年级体育成绩上报表' },
}

// 各年级的成绩字段及其取值上限
// （total 是三项之和，上限 300；其余单项上限 100）
const SCORE_FIELDS = {
  grade_seven: { attendance_score: 100, exam_score: 100, fitness_score: 100, total: 300 },
  grade_eight: { attendance_score: 100, exam_score: 100, fitness_score: 100, total: 300 },
  grade_nine: { long_run: 100, rope_skipping: 100, long_jump: 100, ball_sports: 100, martial_arts: 100 },
}

// 各年级的模板列定义
const TEMPLATE_COLUMNS = {
  seven: [
    { header: '姓名', key: 'name', width: 14 },
    { header: '身份证号', key: 'id_card', width: 22 },
    { header: '学号', key: 'student_number', width: 14 },
    { header: '毕业年份', key: 'graduation_year', width: 12 },
    { header: '出勤率成绩', key: 'attendance_score', width: 13 },
    { header: '体育考试成绩', key: 'exam_score', width: 15 },
    { header: '体测成绩', key: 'fitness_score', width: 12 },
    { header: '合计', key: 'total', width: 10 },
    { header: '备注', key: 'remark', width: 20 },
  ],
  eight: [
    { header: '姓名', key: 'name', width: 14 },
    { header: '身份证号', key: 'id_card', width: 22 },
    { header: '学号', key: 'student_number', width: 14 },
    { header: '毕业年份', key: 'graduation_year', width: 12 },
    { header: '出勤率成绩', key: 'attendance_score', width: 13 },
    { header: '体育考试成绩', key: 'exam_score', width: 15 },
    { header: '体测成绩', key: 'fitness_score', width: 12 },
    { header: '合计', key: 'total', width: 10 },
    { header: '备注', key: 'remark', width: 20 },
  ],
  nine: [
    { header: '姓名', key: 'name', width: 14 },
    { header: '身份证号', key: 'id_card', width: 22 },
    { header: '学号', key: 'student_number', width: 14 },
    { header: '毕业年份', key: 'graduation_year', width: 12 },
    { header: '长跑', key: 'long_run', width: 10 },
    { header: '跳绳', key: 'rope_skipping', width: 10 },
    { header: '跳远', key: 'long_jump', width: 10 },
    { header: '足(篮)球', key: 'ball_sports', width: 11 },
    { header: '武术', key: 'martial_arts', width: 10 },
    { header: '备注', key: 'remark', width: 20 },
  ],
}

const TEMPLATE_EXAMPLES = {
  seven: [
    { name: '张三', id_card: '310101200801011234', student_number: '2024001', graduation_year: '2026', attendance_score: 90, exam_score: 85, fitness_score: 88, total: 263, remark: '' },
    { name: '李四', id_card: '310101200801015678', student_number: '2024002', graduation_year: '2026', attendance_score: 95, exam_score: 90, fitness_score: 92, total: 277, remark: '免测长跑' },
  ],
  eight: [
    { name: '张三', id_card: '310101200801011234', student_number: '2024001', graduation_year: '2026', attendance_score: 90, exam_score: 85, fitness_score: 88, total: 263, remark: '' },
  ],
  nine: [
    { name: '张三', id_card: '310101200801011234', student_number: '2024001', graduation_year: '2026', long_run: 18, rope_skipping: 19, long_jump: 16, ball_sports: 17, martial_arts: 18, remark: '' },
  ],
}

// ========== 工具 ==========

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** 规范身份证号（去非字母数字并大写），与前端保持一致 */
function normalizeIdCard(idCard) {
  return String(idCard || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

/**
 * 校验上报数据
 * @param {boolean} checkSchool 是否校验「学校必须属于账号所在学校」
 * @returns {Array} 错误列表，空数组表示通过
 */
function validateRows(rows, level, school, year, checkSchool = true) {
  const errors = []
  const fields = SCORE_FIELDS[GRADE_LEVELS[level].table] || {}
  const seen = new Map()

  rows.forEach((row, idx) => {
    const rowNum = idx + 2
    const r = camelToSnake(row || {})

    if (!r.name || String(r.name).trim() === '') {
      errors.push({ row: rowNum, field: 'name', message: '缺少姓名' })
    }
    if (!r.id_card || String(r.id_card).trim() === '') {
      errors.push({ row: rowNum, field: 'id_card', message: '缺少身份证号' })
    } else if (!/^\d{17}[\dXx]$/.test(String(r.id_card).trim())) {
      errors.push({ row: rowNum, field: 'id_card', message: `身份证号格式不正确: ${r.id_card}` })
    } else {
      const identityId = normalizeIdCard(r.id_card)
      if (seen.has(identityId)) {
        errors.push({ row: rowNum, field: 'id_card', message: `文件内身份证号重复（第 ${seen.get(identityId)} 行已出现）` })
      } else {
        seen.set(identityId, rowNum)
      }
    }

    if (r.graduation_year && String(r.graduation_year).trim() !== String(year)) {
      errors.push({ row: rowNum, field: 'graduation_year', message: `毕业年份与所选年份不一致: ${r.graduation_year}` })
    }

    // 学校账号：文件里的学校必须与账号所属学校一致
    if (checkSchool && school && r.school && String(r.school).trim() !== school) {
      errors.push({
        row: rowNum,
        field: 'school',
        message: `学校名称'${r.school}'与账号所属学校'${school}'不一致`,
      })
    }

    for (const [f, max] of Object.entries(fields)) {
      const val = r[f]
      if (val === null || val === undefined || val === '') continue
      const num = parseFloat(val)
      if (isNaN(num)) {
        errors.push({ row: rowNum, field: f, message: `不是合法数字: ${val}` })
      } else if (num < 0 || num > max) {
        errors.push({ row: rowNum, field: f, message: `分数超出范围 (0-${max}): ${val}` })
      }
    }

    // 注意：「合计是否等于三项之和」不是校验错误，而是**校对结果**。
    // 导入必须放行（否则「校对异常」列表永远是空的），由服务端算出校对结果并标记。
  })

  return errors
}

/**
 * 统计「合计与三项之和不符」的条数
 *
 * 这类数据**不是校验错误**，导入时应放行，但会被标记为「校对异常」，
 * 由管理员在「成绩审核 / 校对异常」里处理。因此规则只在这里定义一次。
 */
function countMismatches(rows, level) {
  if (level !== 'seven' && level !== 'eight') return 0
  let count = 0
  for (const row of rows) {
    const r = camelToSnake(row || {})
    const att = parseFloat(r.attendance_score)
    const exam = parseFloat(r.exam_score)
    const fit = parseFloat(r.fitness_score)
    if ([att, exam, fit].some(v => Number.isNaN(v))) continue
    const sum = Math.round((att + exam + fit) * 10) / 10
    const total = parseFloat(r.total)
    const hasTotal = r.total !== null && r.total !== undefined && r.total !== ''
    if (!hasTotal) continue
    if (Math.abs(sum - (Number.isNaN(total) ? 0 : total)) >= 0.1) count++
  }
  return count
}

/**
 * 与数据库现有数据做差异对比
 *
 * 自然键是「身份证号 + 学校」：管理员导入的文件可能包含多所学校，
 * 因此比对时不能把学校写死成某一个，而是逐行按各自学校去匹配。
 */
async function buildDiff(pool, table, rows, defaultSchool, year) {
  const scoreFields = Object.keys(SCORE_FIELDS[table] || {})
  const identityIds = [...new Set(rows.map(r => normalizeIdCard(r.id_card)).filter(Boolean))]
  if (identityIds.length === 0) {
    return { newRows: [], updateRows: [], sameRows: [], existingMap: new Map() }
  }

  // 一次查出所有相关身份证号的记录，再按「身份证号||学校」建索引
  const existingMap = new Map()
  for (const ids of chunk(identityIds, 500)) {
    const [rows2] = await pool.query(
      `SELECT * FROM ${table} WHERE identity_id IN (${ids.map(() => '?').join(',')})`,
      ids,
    )
    rows2.forEach(r => existingMap.set(`${r.identity_id}||${r.school}`, r))
  }

  const newRows = []
  const updateRows = []
  const sameRows = []

  rows.forEach((row, idx) => {
    const r = camelToSnake(row || {})
    const identityId = normalizeIdCard(r.id_card)
    const rowSchool = r.school || defaultSchool || ''
    const old = existingMap.get(`${identityId}||${rowSchool}`)

    if (!old) {
      newRows.push({ row: idx + 2, name: r.name, idCard: r.id_card, school: rowSchool })
      return
    }

    // 比较成绩字段与毕业年份
    const changes = []
    for (const f of scoreFields) {
      const oldVal = old[f] === null || old[f] === undefined ? null : Number(old[f])
      const newVal = r[f] === null || r[f] === undefined || r[f] === '' ? null : Number(r[f])
      if (oldVal !== newVal && !(oldVal === null && newVal === null)) {
        changes.push({ field: f, from: oldVal, to: newVal })
      }
    }
    if (old.graduation_year !== String(year)) {
      changes.push({ field: 'graduation_year', from: old.graduation_year, to: String(year) })
    }

    if (changes.length === 0) {
      sameRows.push({ row: idx + 2, name: r.name, idCard: r.id_card, school: rowSchool })
    } else {
      updateRows.push({ row: idx + 2, name: r.name, idCard: r.id_card, school: rowSchool, changes })
    }
  })

  return { newRows, updateRows, sameRows, existingMap }
}

// ========== 模板下载 ==========

router.get('/template/:level', authMiddleware, async (req, res) => {
  try {
    const { level } = req.params
    if (!GRADE_LEVELS[level]) return fail(res, '无效的年级', 400)

    const columns = TEMPLATE_COLUMNS[level]
    const examples = TEMPLATE_EXAMPLES[level]

    const aoa = [
      columns.map(c => c.header),
      ...examples.map(ex => columns.map(c => ex[c.key] ?? '')),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = columns.map(c => ({ wch: c.width }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '上报模板')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const filename = encodeURIComponent(`${GRADE_LEVELS[level].title}.xlsx`)
    res.setHeader('Content-Disposition', `attachment; filename="template.xlsx"; filename*=UTF-8''${filename}`)
    res.send(buf)
  } catch (err) {
    console.error('[下载模板错误]', err)
    fail(res, '模板生成失败')
  }
})

// ========== 预检（不写库） ==========
// 管理员与学校账号都会用到：
//   管理员 —— 导入前的差异预览（文件可能包含多所学校）
//   学校   —— 上报前的自检

router.post('/preview', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { gradeLevel, rows, year } = req.body
    if (!GRADE_LEVELS[gradeLevel]) return fail(res, '无效的年级', 400)
    if (!year) return fail(res, '请选择毕业年份', 400)
    if (!Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400)
    if (rows.length > 50000) return fail(res, '单次上报不能超过 50000 行', 400)

    // 学校账号：学校名以账号绑定为准，且每行都必须属于本校
    const isSchoolUser = req.user.schoolId != null
    let school = (req.body.school || '').trim()
    if (isSchoolUser) {
      school = await resolveSchoolName(pool, req)
      if (!school) return fail(res, '账号未绑定学校', 403)
    }

    // 统一每行的学校：学校账号强制为本校；管理员保留文件里各自的学校
    const normalized = rows.map((r) => {
      const snake = camelToSnake(r || {})
      if (isSchoolUser) snake.school = school
      return snake
    })

    const errors = validateRows(normalized, gradeLevel, school, year, isSchoolUser)
    if (errors.length > 0) {
      return ok(res, {
        valid: false,
        errors: errors.slice(0, 500),
        errorCount: errors.length,
        totalRows: rows.length,
        newCount: 0,
        updateCount: 0,
        sameCount: 0,
      }, `校验未通过，共 ${errors.length} 处问题`)
    }

    const table = GRADE_LEVELS[gradeLevel].table
    const diff = await buildDiff(pool, table, normalized, school, year)

    ok(res, {
      valid: true,
      errors: [],
      errorCount: 0,
      totalRows: rows.length,
      newCount: diff.newRows.length,
      updateCount: diff.updateRows.length,
      sameCount: diff.sameRows.length,
      mismatchCount: countMismatches(normalized, gradeLevel),
      newRows: diff.newRows.slice(0, 200),
      updateRows: diff.updateRows.slice(0, 200),
      sameRows: diff.sameRows.slice(0, 200),
    }, '预检完成')
  } catch (err) {
    console.error('[上报预检错误]', err)
    fail(res, '预检失败：' + err.message)
  }
})

// ========== 提交上报（仅学校账号） ==========
// 管理员导入成绩走 POST /api/data/import（直接写正式表），不需要走审核。

router.post('/', authMiddleware, requireSchoolUser, auditMiddleware({ operationType: 'create', targetTable: 'grade_submissions' }), async (req, res) => {
  try {
    const pool = getPool()
    const { gradeLevel, rows, year, fileName } = req.body
    if (!GRADE_LEVELS[gradeLevel]) return fail(res, '无效的年级', 400)
    if (!year) return fail(res, '请选择毕业年份', 400)
    if (!Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400)
    if (rows.length > 50000) return fail(res, '单次上报不能超过 50000 行', 400)

    const school = await resolveSchoolName(pool, req)
    const schoolId = req.user.schoolId
    if (!school) return fail(res, '账号未绑定学校', 403)

    // 强制归属本校：不允许在文件里夹带其他学校
    const normalized = rows.map((r) => {
      const snake = camelToSnake(r || {})
      snake.school = school
      return snake
    })

    const errors = validateRows(normalized, gradeLevel, school, year, true)
    if (errors.length > 0) {
      return fail(res, `数据校验失败，共 ${errors.length} 条错误`, 400, {
        errors: errors.slice(0, 500),
        errorCount: errors.length,
      })
    }

    const table = GRADE_LEVELS[gradeLevel].table
    const diff = await buildDiff(pool, table, normalized, school, year)

    // 补齐入库所需字段
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const prepared = normalized.map((snake) => {
      snake.graduation_year = String(year)
      snake.identity_id = normalizeIdCard(snake.id_card)
      if (!snake.id) snake.id = 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
      snake.created_at = snake.created_at || now
      if (gradeLevel === 'seven' || gradeLevel === 'eight') {
        const att = parseFloat(snake.attendance_score) || 0
        const exam = parseFloat(snake.exam_score) || 0
        const fit = parseFloat(snake.fitness_score) || 0
        snake.total_verify = Math.round((att + exam + fit) * 10) / 10
        snake.verify_result = Math.abs(snake.total_verify - (parseFloat(snake.total) || 0)) < 0.1 ? 1 : 0
      }
      return snake
    })

    const payload = JSON.stringify(prepared)
    const diffJson = JSON.stringify({
      newRows: diff.newRows.slice(0, 500),
      updateRows: diff.updateRows.slice(0, 500),
      sameRows: diff.sameRows.slice(0, 500),
    })

    const [result] = await pool.query(
      `INSERT INTO grade_submissions
       (school_id, school, graduation_year, grade_level, file_name, row_count,
        new_count, update_count, conflict_count, status, payload, diff, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schoolId, school, String(year), gradeLevel, fileName || '', prepared.length,
        diff.newRows.length, diff.updateRows.length, diff.sameRows.length,
        REVIEW_STATUS.SUBMITTED, payload, diffJson, req.user?.username || 'admin'],
    )

    ok(res, {
      id: result.insertId,
      rowCount: prepared.length,
      newCount: diff.newRows.length,
      updateCount: diff.updateRows.length,
      sameCount: diff.sameRows.length,
      _audit: {
        summary: `上报【${school}】${year}届${GRADE_LEVELS[gradeLevel].label}成绩 ${prepared.length} 条（新增 ${diff.newRows.length} / 更新 ${diff.updateRows.length}）`,
      },
    }, '上报已提交，等待管理员审核')
  } catch (err) {
    console.error('[提交上报错误]', err)
    fail(res, '提交失败：' + err.message)
  }
})

// ========== 待审核数量（供侧边栏角标 / 页面提醒） ==========

router.get('/pending-count', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    let where = "WHERE status = 'submitted'"
    const params = []
    if (req.user.schoolId != null) {
      const school = await resolveSchoolName(pool, req)
      where += ' AND school = ?'
      params.push(school)
    }
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM grade_submissions ${where}`,
      params,
    )
    ok(res, { count: Number(rows[0].cnt || 0) })
  } catch (err) {
    console.error('[待审核数量错误]', err)
    fail(res, '获取失败')
  }
})

// ========== 上报列表 ==========

router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
    const status = (req.query.status || '').trim()
    const gradeLevel = (req.query.gradeLevel || '').trim()

    let where = 'WHERE 1=1'
    const params = []
    if (req.user.schoolId != null) {
      const mySchool = await resolveSchoolName(pool, req)
      where += ' AND school = ?'
      params.push(mySchool)
    } else if (req.query.school) {
      where += ' AND school = ?'
      params.push(req.query.school)
    }
    if (status) { where += ' AND status = ?'; params.push(status) }
    if (gradeLevel) { where += ' AND grade_level = ?'; params.push(gradeLevel) }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM grade_submissions ${where}`, params,
    )
    const total = countRows[0].total
    const offset = (page - 1) * pageSize

    const [rows] = await pool.query(
      `SELECT id, school_id, school, graduation_year, grade_level, file_name, file_size,
              row_count, new_count, update_count, conflict_count, status,
              reject_reason, uploaded_by, reviewed_by, reviewed_at, published_at, created_at, updated_at
       FROM grade_submissions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )

    ok(res, {
      list: snakeToCamel(rows),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (err) {
    console.error('[获取上报表列表错误]', err)
    fail(res, '获取列表失败')
  }
})

// ========== 上报详情（含数据明细） ==========

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query('SELECT * FROM grade_submissions WHERE id = ?', [req.params.id])
    if (rows.length === 0) return fail(res, '上报记录不存在', 404)
    const row = rows[0]

    if (req.user.schoolId != null) {
      const mySchool = await resolveSchoolName(pool, req)
      if (row.school !== mySchool) return fail(res, '权限不足：只能查看本校上报记录', 403)
    }

    ok(res, snakeToCamel(row))
  } catch (err) {
    console.error('[获取上报表详情错误]', err)
    fail(res, '获取失败')
  }
})

// ========== 管理员审核通过 → 发布写入成绩表 ==========

router.post('/:id/approve', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_submissions' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { id } = req.params
    const [rows] = await connection.query('SELECT * FROM grade_submissions WHERE id = ?', [id])
    if (rows.length === 0) return fail(res, '上报表不存在', 404)
    const sub = rows[0]

    if (sub.status === REVIEW_STATUS.PUBLISHED) {
      return fail(res, '该上报表已发布，请勿重复操作', 400)
    }
    if (sub.status === REVIEW_STATUS.REJECTED) {
      return fail(res, '已驳回的上报表需由学校重新提交后才能发布', 400)
    }

    const level = sub.grade_level
    if (!GRADE_LEVELS[level]) return fail(res, '无效的年级', 400)
    const table = GRADE_LEVELS[level].table

    let payload = []
    try {
      payload = typeof sub.payload === 'string' ? JSON.parse(sub.payload) : (sub.payload || [])
    } catch (e) {
      return fail(res, '上报表数据损坏，无法发布', 500)
    }
    if (!Array.isArray(payload) || payload.length === 0) return fail(res, '上报表无数据，无法发布', 400)

    await connection.beginTransaction()

    // 批量 upsert，写入 review_status = published
    const allowed = GRADE_TABLE_FIELDS[table]
    const BATCH = 500
    for (let i = 0; i < payload.length; i += BATCH) {
      const chunkRows = payload.slice(i, i + BATCH).map(r => ({ ...r, review_status: REVIEW_STATUS.PUBLISHED }))
      const columns = []
      for (const r of chunkRows) {
        for (const key of Object.keys(r)) {
          if (allowed.includes(key) && !columns.includes(key)) columns.push(key)
        }
      }
      if (columns.length === 0) continue
      const placeholders = chunkRows.map(() => `(${columns.map(() => '?').join(',')})`).join(',')
      const values = chunkRows.flatMap(r => columns.map(c => (r[c] === undefined ? null : r[c])))
      const updateCols = columns.filter(c => c !== 'id')
      await connection.query(
        `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}` +
        (updateCols.length ? ` ON DUPLICATE KEY UPDATE ${updateCols.map(c => `${c}=VALUES(${c})`).join(',')}` : ''),
        values,
      )
    }

    await connection.query(
      `UPDATE grade_submissions
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), published_at = NOW()
       WHERE id = ?`,
      [REVIEW_STATUS.PUBLISHED, req.user?.username || 'admin', id],
    )
    await connection.commit()

    ok(res, {
      published: payload.length,
      _audit: {
        summary: `审核通过并发布【${sub.school}】${sub.graduation_year}届${GRADE_LEVELS[level].label}成绩 ${payload.length} 条`,
      },
    }, `已发布 ${payload.length} 条成绩`)
  } catch (err) {
    await connection.rollback()
    console.error('[发布上报表错误]', err)
    fail(res, '发布失败：' + err.message)
  } finally {
    connection.release()
  }
})

// ========== 管理员驳回 ==========

router.post('/:id/reject', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_submissions' }), async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const reason = (req.body?.reason || '').trim()
    if (!reason) return fail(res, '请填写驳回原因', 400)

    const [rows] = await pool.query('SELECT * FROM grade_submissions WHERE id = ?', [id])
    if (rows.length === 0) return fail(res, '上报表不存在', 404)
    const sub = rows[0]
    if (sub.status === REVIEW_STATUS.PUBLISHED) {
      return fail(res, '已发布的上报表不能驳回', 400)
    }

    await pool.query(
      `UPDATE grade_submissions SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [REVIEW_STATUS.REJECTED, reason, req.user?.username || 'admin', id],
    )

    ok(res, {
      _audit: { summary: `驳回上报表【${sub.school}】${sub.graduation_year}届：${reason}` },
    }, '已驳回')
  } catch (err) {
    console.error('[驳回上报表错误]', err)
    fail(res, '操作失败')
  }
})

// ========== 删除上报表（仅管理员） ==========

router.delete('/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query('SELECT id, school, grade_level FROM grade_submissions WHERE id = ?', [req.params.id])
    if (rows.length === 0) return fail(res, '上报表不存在', 404)
    await pool.query('DELETE FROM grade_submissions WHERE id = ?', [req.params.id])
    ok(res, {}, '已删除')
  } catch (err) {
    console.error('[删除上报表错误]', err)
    fail(res, '删除失败')
  }
})

module.exports = router

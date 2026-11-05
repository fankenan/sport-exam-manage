/**
 * 成绩数据路由
 *
 * 安全约定：
 *  1. 所有列名一律取自 constants.js 的白名单，用户输入只作为「值」参与参数绑定
 *  2. 清空 / 全量覆盖属于全局破坏性操作，仅管理员可用
 *  3. 所有涉及学校的数据读写，学校账号一律只能操作本校数据
 *
 * 性能约定：
 *  1. 列表查询一律走服务端分页，不提供无上限的全量读取
 *  2. 写入一律走批量 upsert，避免逐行往返
 *  3. 统计一律在服务端用聚合查询完成
 */
const express = require('express')
const { ok, fail, snakeToCamel, camelToSnake, pickAllowed } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { schoolFilter, requireAdmin, validateSchoolAccess } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')
const {
  GRADE_TABLE_FIELDS, GRADE_TABLES, IMMUTABLE_FIELDS, DUPLICATE_FIELDS, REVIEW_STATUS, REVIEW_STATUS_VALUES,
} = require('../constants')
const { applyDerivedFields } = require('../derived')
const { canExport, TABLE_LABELS } = require('./settings')

const router = express.Router()

// 批量 upsert 的单批行数（受 max_allowed_packet 限制，500 行较安全）
const BATCH_SIZE = 500

// 允许的排序字段（防止 ORDER BY 注入）
const SORT_FIELDS = {
  grade_seven: ['name', 'school', 'graduation_year', 'total', 'created_at'],
  grade_eight: ['name', 'school', 'graduation_year', 'total', 'created_at'],
  grade_nine: ['name', 'school', 'graduation_year', 'created_at'],
  admission: ['name', 'school', 'graduation_year', 'total_score', 'created_at', 'registration_number'],
}

// 各表参与检索的字段
const SEARCH_FIELDS = {
  grade_seven: ['name', 'identity_id', 'id_card', 'school', 'student_number'],
  grade_eight: ['name', 'identity_id', 'id_card', 'school', 'student_number'],
  grade_nine: ['name', 'identity_id', 'id_card', 'school', 'student_number'],
  admission: ['name', 'identity_id', 'registration_number', 'school'],
}

// ========== 工具 ==========

/**
 * 把一批行转换成批量 upsert 的 SQL 与参数
 * 只使用白名单列，缺失的列补 null，保证同一批内列结构一致
 */
function buildBatchUpsert(table, rows, allowedFields) {
  const snakeRows = rows.map(r => camelToSnake(r || {}))

  // 取本批中实际出现的白名单列（保持稳定顺序）
  const columns = []
  for (const row of snakeRows) {
    for (const key of Object.keys(row)) {
      if (allowedFields.includes(key) && !columns.includes(key)) columns.push(key)
    }
  }
  if (columns.length === 0) return null

  const placeholders = columns.map(() => '?').join(',')
  const values = snakeRows.flatMap(row => columns.map(c => {
    const v = row[c]
    return v === undefined ? null : v
  }))

  const updateCols = columns.filter(c => c !== 'id')
  const sql =
    `INSERT INTO ${table} (${columns.join(',')}) VALUES ` +
    snakeRows.map(() => `(${columns.map(() => '?').join(',')})`).join(',') +
    (updateCols.length > 0
      ? ` ON DUPLICATE KEY UPDATE ${updateCols.map(c => `${c}=VALUES(${c})`).join(',')}`
      : '')

  return { sql, values }
}

/**
 * 分批执行批量 upsert
 */
async function batchUpsert(connection, table, rows, allowedFields) {
  let affected = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const built = buildBatchUpsert(table, chunk, allowedFields)
    if (!built) continue
    await connection.query(built.sql, built.values)
    affected += chunk.length
  }
  return affected
}

// ========== 数据校验 ==========

/**
 * 各表的可校验分数字段及其取值上限
 *
 * 注意：admission.grade_seven / grade_eight 存的是「七/八年级三项成绩之和」，
 * 上限是 300 而不是 100 —— 早期版本统一按 100 校验，会把正常数据判为非法。
 */
const SCORE_FIELDS = {
  grade_seven: {
    attendance_score: 100, exam_score: 100, fitness_score: 100, total: 300,
  },
  grade_eight: {
    attendance_score: 100, exam_score: 100, fitness_score: 100, total: 300,
  },
  grade_nine: {
    long_run: 100, rope_skipping: 100, long_jump: 100, ball_sports: 100, martial_arts: 100,
  },
  admission: {
    grade_seven: 300, grade_eight: 300,
    long_run: 100, rope_skipping: 100, long_jump: 100, ball_sports: 100, martial_arts: 100,
  },
}

function validateImportRows(table, rows, req, schoolName) {
  const errors = []
  const fields = SCORE_FIELDS[table] || []

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // Excel 行号（第 1 行是表头）
    const snake = camelToSnake(row || {})

    if (!snake.name || String(snake.name).trim() === '') {
      errors.push({ row: rowNum, field: 'name', message: '缺少姓名' })
    }
    if (!snake.school || String(snake.school).trim() === '') {
      errors.push({ row: rowNum, field: 'school', message: '缺少学校名称' })
    }

    // 学校用户：导入数据的学校必须与账号绑定学校一致
    if (schoolName && snake.school && String(snake.school).trim() !== schoolName) {
      errors.push({
        row: rowNum,
        field: 'school',
        message: `学校名称'${snake.school}'与账号所属学校'${schoolName}'不一致`,
      })
    }

    // 分数字段校验（按字段各自的取值上限）
    for (const [f, max] of Object.entries(fields)) {
      const val = snake[f]
      if (val !== null && val !== undefined && val !== '' && val !== 0) {
        const num = parseFloat(val)
        if (isNaN(num) || num < 0 || num > max) {
          errors.push({ row: rowNum, field: f, message: `分数超出范围 (0-${max}): ${val}` })
        }
      }
    }

    // 审核状态枚举校验
    if (snake.review_status && !REVIEW_STATUS_VALUES.includes(snake.review_status)) {
      errors.push({ row: rowNum, field: 'review_status', message: `非法的审核状态: ${snake.review_status}` })
    }
  })

  return errors
}

// ========== 年份 / 学校列表 ==========

router.get('/years', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const filter = await schoolFilter(pool, req)
    const sql = `
      SELECT DISTINCT graduation_year AS year FROM (
        SELECT graduation_year FROM grade_seven WHERE graduation_year IS NOT NULL AND graduation_year != '' ${filter.clause}
        UNION
        SELECT graduation_year FROM grade_eight WHERE graduation_year IS NOT NULL AND graduation_year != '' ${filter.clause}
        UNION
        SELECT graduation_year FROM grade_nine WHERE graduation_year IS NOT NULL AND graduation_year != '' ${filter.clause}
        UNION
        SELECT graduation_year FROM admission WHERE graduation_year IS NOT NULL AND graduation_year != '' ${filter.clause}
      ) AS all_years
      ORDER BY graduation_year DESC
    `
    const params = filter.params.concat(filter.params, filter.params, filter.params)
    const [rows] = await pool.query(sql, params)
    ok(res, rows.map(r => r.year))
  } catch (err) {
    console.error('[获取年份列表错误]', err)
    fail(res, '获取年份列表失败')
  }
})

router.get('/schools', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const filter = await schoolFilter(pool, req)
    const sql = `SELECT DISTINCT school FROM (
        SELECT school FROM grade_seven WHERE school IS NOT NULL AND school != '' ${filter.clause}
        UNION SELECT school FROM grade_eight WHERE school IS NOT NULL AND school != '' ${filter.clause}
        UNION SELECT school FROM grade_nine WHERE school IS NOT NULL AND school != '' ${filter.clause}
        UNION SELECT school FROM admission WHERE school IS NOT NULL AND school != '' ${filter.clause}
      ) AS all_schools ORDER BY school ASC`
    const params = filter.params.concat(filter.params, filter.params, filter.params)
    const [rows] = await pool.query(sql, params)
    ok(res, rows.map(r => r.school))
  } catch (err) {
    console.error('[获取学校列表错误]', err)
    fail(res, '获取学校列表失败')
  }
})

// ========== 分页查询 ==========

router.get('/page/:table', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { table } = req.params
    if (!GRADE_TABLES.includes(table)) return fail(res, '无效的表名', 400)

    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(500, Math.max(1, parseInt(req.query.pageSize) || 50))
    const keyword = (req.query.keyword || '').trim()
    const graduationYear = (req.query.graduationYear || '').trim()
    const school = (req.query.school || '').trim()
    const verifyResult = (req.query.verifyResult || '').trim()
    const remarkFilter = (req.query.remark || '').trim()
    const reviewStatus = (req.query.reviewStatus || '').trim()

    let where = 'WHERE 1=1'
    const params = []

    let orderBy = 'ORDER BY name ASC'
    if (table === 'grade_nine') {
      orderBy = 'ORDER BY school ASC, name ASC'
    } else if (table === 'admission') {
      orderBy = `ORDER BY school ASC,
        CASE WHEN SUBSTRING(identity_id, 17, 1) IN ('1','3','5','7','9') THEN 1 ELSE 2 END ASC,
        registration_number ASC`
    }

    // 自定义排序（白名单校验）
    const sortField = (req.query.sortField || '').trim()
    const sortOrder = String(req.query.sortOrder || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    if (sortField && (SORT_FIELDS[table] || []).includes(sortField)) {
      orderBy = `ORDER BY ${sortField} ${sortOrder}`
    }

    if (keyword) {
      const fieldList = SEARCH_FIELDS[table] || ['name']
      where += ' AND (' + fieldList.map(f => `${f} LIKE ?`).join(' OR ') + ')'
      const kw = `%${keyword}%`
      params.push(...Array(fieldList.length).fill(kw))
    }
    if (graduationYear) {
      where += ' AND graduation_year = ?'
      params.push(graduationYear)
    }
    if (school) {
      where += ' AND school = ?'
      params.push(school)
    }
    if (verifyResult === '1') {
      where += ' AND verify_result = 1'
    } else if (verifyResult === '0') {
      where += ' AND verify_result = 0'
    }
    if (remarkFilter === '1') {
      where += " AND remark IS NOT NULL AND remark != ''"
    } else if (remarkFilter === '0') {
      where += " AND (remark IS NULL OR remark = '')"
    }
    if (reviewStatus && REVIEW_STATUS_VALUES.includes(reviewStatus)) {
      where += ' AND review_status = ?'
      params.push(reviewStatus)
    }

    // 学校用户自动过滤
    const filter = await schoolFilter(pool, req)
    where += filter.clause
    params.push(...filter.params)

    const [countResult] = await pool.query(`SELECT COUNT(*) AS total FROM ${table} ${where}`, params)
    const total = countResult[0].total

    const offset = (page - 1) * pageSize
    const [rows] = await pool.query(
      `SELECT * FROM ${table} ${where} ${orderBy} LIMIT ? OFFSET ?`,
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
    console.error('[分页查询错误] table=', req.params.table, 'params=', req.query, err)
    fail(res, '查询失败')
  }
})

// ========== 中招成绩匹配（服务端计算，避免前端拉全量数据） ==========

router.post('/match-admission', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { rows, year } = req.body
    if (!Array.isArray(rows) || rows.length === 0) return fail(res, '无考生数据', 400)
    if (rows.length > 50000) return fail(res, '单次匹配不能超过 50000 人', 400)

    const filter = await schoolFilter(pool, req)
    const gradYear = (year || '').trim()

    // 只取匹配所需的窄字段，避免把整表（含审计列）传到前端
    const narrow = (table, cols) =>
      `SELECT ${cols.join(', ')} FROM ${table} WHERE 1=1 ${filter.clause}`

    const [sevenRows] = await pool.query(
      narrow('grade_seven', ['identity_id', 'school', 'name', 'graduation_year', 'total']),
      filter.params,
    )
    const [eightRows] = await pool.query(
      narrow('grade_eight', ['identity_id', 'school', 'name', 'graduation_year', 'total']),
      filter.params,
    )
    const [nineRows] = await pool.query(
      narrow('grade_nine', [
        'identity_id', 'school', 'name', 'graduation_year',
        'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts',
      ]),
      filter.params,
    )

    const sevenMap = new Map()
    sevenRows.forEach(r => {
      if (!sevenMap.has(r.identity_id)) {
        sevenMap.set(r.identity_id, { total: r.total, school: r.school, name: r.name })
      }
    })
    const eightMap = new Map()
    eightRows.forEach(r => {
      if (!eightMap.has(r.identity_id)) {
        eightMap.set(r.identity_id, { total: r.total, school: r.school, name: r.name })
      }
    })
    const nineMap = new Map()
    nineRows.forEach(r => {
      if (!nineMap.has(r.identity_id)) {
        nineMap.set(r.identity_id, r)
      }
    })

    const matched = []
    const unmatched = []
    const now = Date.now()

    rows.forEach((row, idx) => {
      const snake = camelToSnake(row || {})
      const identityId = String(snake.id_card || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      if (!identityId) {
        unmatched.push({ index: idx, name: snake.name, reason: '缺少身份证号' })
        return
      }

      const s7 = sevenMap.get(identityId)
      const s8 = eightMap.get(identityId)
      const s9 = nineMap.get(identityId)

      if (!s7 && !s8 && !s9) {
        unmatched.push({ index: idx, name: snake.name, idCard: snake.id_card, reason: '系统中未找到该考生成绩' })
        return
      }

      const school = snake.school || s7?.school || s8?.school || s9?.school || ''
      const longRun = s9?.long_run ?? 0
      const ropeSkipping = s9?.rope_skipping ?? 0
      const longJump = s9?.long_jump ?? 0
      const ballSports = s9?.ball_sports ?? 0
      const martialArts = s9?.martial_arts ?? 0
      const gradeSeven = s7?.total ?? 0
      const gradeEight = s8?.total ?? 0

      const totalScore = Math.round(
        Number(gradeSeven || 0) + Number(gradeEight || 0) +
        Number(longRun || 0) + Number(ropeSkipping || 0) + Number(longJump || 0) +
        Number(ballSports || 0) + Number(martialArts || 0),
      )

      matched.push({
        id: snake.id || `adm_${now}_${idx}`,
        identity_id: identityId,
        school,
        name: snake.name || s7?.name || s8?.name || s9?.name || '',
        id_card: snake.id_card || '',
        registration_number: snake.registration_number || '',
        graduation_year: gradYear || snake.graduation_year || '',
        grade_seven: gradeSeven,
        grade_eight: gradeEight,
        long_run: longRun,
        rope_skipping: ropeSkipping,
        long_jump: longJump,
        ball_sports: ballSports,
        martial_arts: martialArts,
        total_score: totalScore,
        review_status: REVIEW_STATUS.PUBLISHED,
      })
    })

    ok(res, {
      matched,
      unmatched,
      totalRows: rows.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
    }, `匹配完成：成功 ${matched.length} 人，未匹配 ${unmatched.length} 人`)
  } catch (err) {
    console.error('[中招成绩匹配错误]', err)
    fail(res, '匹配失败：' + err.message)
  }
})

// ========== 看板统计（服务端聚合，替代前端全量拉取后计算） ==========

router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const year = (req.query.year || '').trim()
    const school = (req.query.school || '').trim()
    const filter = await schoolFilter(pool, req)

    const yearClause = year ? ' AND graduation_year = ?' : ''
    const schoolClause = school ? ' AND school = ?' : ''
    const baseParams = []
    if (year) baseParams.push(year)
    if (school) baseParams.push(school)
    const oneBranch = baseParams.concat(filter.params)
    // 同一个 WHERE 片段在 UNION 的多个分支里重复出现，参数也要重复相应次数
    const repParams = (times) => {
      const out = []
      for (let i = 0; i < times; i++) out.push(...oneBranch)
      return out
    }

    // 各表条数
    const countSql = `
      SELECT 'grade_seven' AS t, COUNT(*) AS c FROM grade_seven WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
      UNION ALL SELECT 'grade_eight', COUNT(*) FROM grade_eight WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
      UNION ALL SELECT 'grade_nine',  COUNT(*) FROM grade_nine  WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
      UNION ALL SELECT 'admission',   COUNT(*) FROM admission   WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
    `
    const [countRows] = await pool.query(countSql, repParams(4))
    const counts = { gradeSeven: 0, gradeEight: 0, gradeNine: 0, admission: 0 }
    countRows.forEach(r => {
      const key = { grade_seven: 'gradeSeven', grade_eight: 'gradeEight', grade_nine: 'gradeNine', admission: 'admission' }[r.t]
      if (key) counts[key] = Number(r.c)
    })

    // 涉及学校数
    const [schoolRows] = await pool.query(`
      SELECT COUNT(DISTINCT school) AS c FROM (
        SELECT school FROM grade_seven WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
        UNION SELECT school FROM grade_eight WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
        UNION SELECT school FROM grade_nine  WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
      ) AS s
    `, repParams(3))
    counts.schoolCount = Number(schoolRows[0].c)

    // 校对结果统计（七八年级）
    const verifySql = `
      SELECT
        SUM(CASE WHEN verify_result = 1 THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN verify_result = 0 THEN 1 ELSE 0 END) AS failed
      FROM (
        SELECT verify_result FROM grade_seven WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
        UNION ALL SELECT verify_result FROM grade_eight WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
      ) AS v
    `
    const [verifyRows] = await pool.query(verifySql, repParams(2))
    const verify = {
      passed: Number(verifyRows[0].passed || 0),
      failed: Number(verifyRows[0].failed || 0),
    }

    // 中招各项目平均分
    const avgSql = `
      SELECT
        ROUND(AVG(long_run), 1)      AS longRun,
        ROUND(AVG(rope_skipping), 1) AS ropeSkipping,
        ROUND(AVG(long_jump), 1)     AS longJump,
        ROUND(AVG(ball_sports), 1)   AS ballSports,
        ROUND(AVG(martial_arts), 1)  AS martialArts
      FROM admission WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
    `
    const [avgRows] = await pool.query(avgSql, oneBranch)
    const admissionAvg = {
      longRun: Number(avgRows[0].longRun || 0),
      ropeSkipping: Number(avgRows[0].ropeSkipping || 0),
      longJump: Number(avgRows[0].longJump || 0),
      ballSports: Number(avgRows[0].ballSports || 0),
      martialArts: Number(avgRows[0].martialArts || 0),
    }

    // 各校中招平均分（降序）
    const [barRows] = await pool.query(`
      SELECT school, ROUND(AVG(total_score), 1) AS avg_score
      FROM admission WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause}
      GROUP BY school ORDER BY avg_score DESC
    `, oneBranch)
    const schoolBar = {
      schools: barRows.map(r => r.school),
      averages: barRows.map(r => Number(r.avg_score || 0)),
    }

    // 成绩分布直方图（服务端算好，前端只渲染）
    const [scoreRows] = await pool.query(
      `SELECT total_score FROM admission WHERE 1=1 ${yearClause} ${schoolClause} ${filter.clause} AND total_score IS NOT NULL`,
      oneBranch,
    )
    const bins = []
    for (let i = 0; i < 10; i++) bins.push({ label: `${i * 10}-${i * 10 + 10}`, count: 0 })
    scoreRows.forEach(r => {
      const s = Number(r.total_score)
      if (Number.isNaN(s) || s < 0) return
      const idx = Math.min(9, Math.floor(s / 10))
      bins[idx].count++
    })

    ok(res, { counts, verify, admissionAvg, schoolBar, scoreBins: bins })
  } catch (err) {
    console.error('[看板统计错误]', err)
    fail(res, '获取统计数据失败')
  }
})

// ========== 重复检查（服务端查重，避免前端逐行全表扫描） ==========

router.post('/check-duplicates', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { table, identities } = req.body
    if (!GRADE_TABLES.includes(table)) return fail(res, '无效的表名', 400)
    if (!Array.isArray(identities) || identities.length === 0) {
      return ok(res, { existing: [], count: 0 })
    }
    if (identities.length > 50000) return fail(res, '单次查询不能超过 50000 条', 400)

    const filter = await schoolFilter(pool, req)
    const unique = [...new Set(identities.map(s => String(s || '').trim()).filter(Boolean))]
    if (unique.length === 0) return ok(res, { existing: [], count: 0 })

    const existing = []
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      const chunk = unique.slice(i, i + BATCH_SIZE)
      const [rows] = await pool.query(
        `SELECT DISTINCT identity_id FROM ${table}
         WHERE identity_id IN (${chunk.map(() => '?').join(',')}) ${filter.clause}`,
        [...chunk, ...filter.params],
      )
      existing.push(...rows.map(r => r.identity_id))
    }

    ok(res, { existing, count: existing.length })
  } catch (err) {
    console.error('[重复检查错误]', err)
    fail(res, '重复检查失败')
  }
})

/**
 * 按自然键（identity_id + school）回填已存在记录的 id
 *
 * 成绩表的主键是 id，但导入时客户端无法知道库里已有的 id，
 * 因此这里先查一次已存在的记录并回填，保证 upsert 是「更新」而不是「重复插入」。
 */
async function attachExistingIds(connection, table, rows) {
  const identities = [...new Set(rows.map(r => r.identity_id).filter(Boolean))]
  if (identities.length === 0) return

  const idMap = new Map()
  for (let i = 0; i < identities.length; i += BATCH_SIZE) {
    const chunk = identities.slice(i, i + BATCH_SIZE)
    const [existing] = await connection.query(
      `SELECT id, identity_id, school FROM ${table}
       WHERE identity_id IN (${chunk.map(() => '?').join(',')})`,
      chunk,
    )
    for (const row of existing) {
      const key = `${row.identity_id}||${row.school}`
      if (!idMap.has(key)) idMap.set(key, row.id)
    }
  }

  for (const row of rows) {
    if (!row.identity_id) continue
    const existingId = idMap.get(`${row.identity_id}||${row.school}`)
    if (existingId) row.id = existingId
  }
}

// ========== 服务端导出 ==========
// 导出改为服务端生成 Excel：
//   1. 学校账号的导出权限在这里强校验（前端隐藏按钮只是界面表现，不是权限控制）
//   2. 大数据量导出不会把整个结果集塞进浏览器
router.post('/export', authMiddleware, auditMiddleware({ operationType: 'update', targetTable: 'grade_export' }), async (req, res) => {
  try {
    const pool = getPool()
    const { table, filters = {}, exportMapFn } = req.body
    if (!GRADE_TABLES.includes(table)) return fail(res, '无效的表名', 400)

    // 导出权限校验
    const allowed = await canExport(pool, req, table)
    if (!allowed) {
      return fail(res, '当前没有导出该成绩表的权限，请联系管理员开启', 403)
    }

    // 组装筛选条件（与分页查询同一套白名单逻辑）
    const keyword = (filters.keyword || '').trim()
    const graduationYear = (filters.graduationYear || '').trim()
    const school = (filters.school || '').trim()
    const verifyResult = (filters.verifyResult || '').trim()
    const remarkFilter = (filters.remark || '').trim()
    const reviewStatus = (filters.reviewStatus || '').trim()

    let where = 'WHERE 1=1'
    const params = []
    const searchFields = SEARCH_FIELDS[table] || ['name']

    if (keyword) {
      where += ' AND (' + searchFields.map(f => `${f} LIKE ?`).join(' OR ') + ')'
      const kw = `%${keyword}%`
      params.push(...Array(searchFields.length).fill(kw))
    }
    if (graduationYear) { where += ' AND graduation_year = ?'; params.push(graduationYear) }
    if (school) { where += ' AND school = ?'; params.push(school) }
    if (verifyResult === '1') where += ' AND verify_result = 1'
    else if (verifyResult === '0') where += ' AND verify_result = 0'
    if (remarkFilter === '1') where += " AND remark IS NOT NULL AND remark != ''"
    else if (remarkFilter === '0') where += " AND (remark IS NULL OR remark = '')"
    if (reviewStatus) { where += ' AND review_status = ?'; params.push(reviewStatus) }

    const filter = await schoolFilter(pool, req)
    where += filter.clause
    params.push(...filter.params)

    // 分批拉取，避免一次性把大结果集读进内存
    const rows = []
    const BATCH = 500
    let offset = 0
    for (;;) {
      const [batch] = await pool.query(
        `SELECT * FROM ${table} ${where} ORDER BY school ASC, name ASC LIMIT ? OFFSET ?`,
        [...params, BATCH, offset],
      )
      rows.push(...batch)
      if (batch.length < BATCH) break
      offset += BATCH
      if (rows.length > 200000) break // 安全上限
    }

    // 生成 Excel
    // 前端传 columns: [{ prop, label }]，服务端按 prop 取值（camelCase）
    const XLSX = require('xlsx')
    const camelRows = snakeToCamel(rows)
    const columns = Array.isArray(req.body.columns) && req.body.columns.length > 0
      ? req.body.columns.filter(c => c && c.prop)
      : Object.keys(camelRows[0] || {}).map(prop => ({ prop, label: prop }))

    const headers = columns.map(c => c.label || c.prop)
    const aoa = [headers, ...camelRows.map(r => columns.map(c => {
      const v = r[c.prop]
      if (v === null || v === undefined) return ''
      if (typeof v === 'object') return JSON.stringify(v)
      return v
    }))]

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = headers.map(h => ({ wch: Math.max(10, Math.min(30, String(h).length * 2.2)) }))
    const wb = XLSX.utils.book_new()
    const sheetName = String(req.body.sheetName || '导出').slice(0, 30)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const filename = encodeURIComponent(`${TABLE_LABELS[table] || '成绩导出'}_${graduationYear || ''}.xlsx`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="export.xlsx"; filename*=UTF-8''${filename}`)
    res.send(buf)

    console.log(`[导出] ${req.user?.username} 导出 ${table} ${rows.length} 条`)
  } catch (err) {
    console.error('[导出错误]', err)
    fail(res, '导出失败：' + err.message)
  }
})

// ========== 增量导入（批量 upsert） ==========
// 仅管理员可用：学校账号必须走「成绩上报」流程（POST /api/submissions），
// 由管理员审核通过后才写入正式成绩表，避免绕过审核。

router.post('/import', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'create', targetTable: (req) => req.body.table || 'unknown' }), async (req, res) => {
  const pool = getPool()
  const connection = await pool.getConnection()
  try {
    const { table, rows } = req.body
    if (!GRADE_TABLES.includes(table)) return fail(res, '无效的表名', 400)
    if (!rows || !Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400)
    if (rows.length > 50000) return fail(res, '单次导入不能超过 50000 行，请分批上传', 400)

    const filter = await schoolFilter(pool, req)

    const validationErrors = validateImportRows(table, rows, req, filter.schoolName)
    if (validationErrors.length > 0) {
      return fail(res, `数据校验失败，共 ${validationErrors.length} 条错误`, 400, {
        errors: validationErrors.slice(0, 500),
        totalRows: rows.length,
        errorCount: validationErrors.length,
      })
    }

    await connection.beginTransaction()

    // 为每行补齐 id（缺失时生成），并统一加上更新时间
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)
    const prepared = rows.map(r => {
      const snake = camelToSnake(r || {})
      if (!snake.id) {
        snake.id = 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
      }
      snake.created_at = snake.created_at || now
      return snake
    })

    // 按自然键（身份证号 + 学校）回填已有记录的 id，
    // 让 upsert 命中已有行而不是插入重复行
    await attachExistingIds(connection, table, prepared)

    // 服务端统一计算合计校对与校对结果
    applyDerivedFields(table, prepared)

    const affected = await batchUpsert(connection, table, prepared, GRADE_TABLE_FIELDS[table])

    await connection.commit()

    const schools = [...new Set(prepared.map(r => r.school).filter(Boolean))]
    const tableLabels = {
      grade_seven: '七年级成绩', grade_eight: '八年级成绩',
      grade_nine: '九年级成绩', admission: '中招成绩',
    }
    const tableLabel = tableLabels[table] || table
    const auditSummary = `导入${tableLabel}：${affected} 条` +
      (schools.length > 0 ? `，涉及学校：${schools.join('、')}` : '')

    ok(res, {
      importCount: affected,
      total: affected,
      _audit: { summary: auditSummary, importCount: affected, schools },
    }, '导入成功')
  } catch (err) {
    await connection.rollback()
    console.error('[增量导入错误]', err)
    fail(res, '导入失败：' + err.message)
  } finally {
    connection.release()
  }
})

// ========== 全量覆盖同步（仅管理员） ==========

router.post('/sync', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_seven' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { gradeSevenList = [], gradeEightList = [], gradeNineList = [], admissionList = [] } = req.body
    await connection.beginTransaction()

    // 七/八年级：服务端统一计算合计校对与校对结果
    const sevenRows = gradeSevenList.map(camelToSnake)
    const eightRows = gradeEightList.map(camelToSnake)
    applyDerivedFields('grade_seven', sevenRows)
    applyDerivedFields('grade_eight', eightRows)

    const sevenCount = await batchUpsert(connection, 'grade_seven', sevenRows, GRADE_TABLE_FIELDS.grade_seven)
    const eightCount = await batchUpsert(connection, 'grade_eight', eightRows, GRADE_TABLE_FIELDS.grade_eight)
    const nineCount = await batchUpsert(connection, 'grade_nine', gradeNineList, GRADE_TABLE_FIELDS.grade_nine)
    const admCount = await batchUpsert(connection, 'admission', admissionList, GRADE_TABLE_FIELDS.admission)

    await connection.commit()
    console.log(`[SYNC] 七年级${sevenCount}条 八年级${eightCount}条 九年级${nineCount}条 中招${admCount}条`)
    ok(res, {
      gradeSevenCount: sevenCount, gradeEightCount: eightCount,
      gradeNineCount: nineCount, admissionCount: admCount,
    }, '同步成功')
  } catch (err) {
    await connection.rollback()
    console.error('[同步数据错误]', err)
    fail(res, '同步失败：' + err.message)
  } finally {
    connection.release()
  }
})

// ========== 清空数据（仅管理员，全局破坏性操作） ==========

router.post('/clear', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'delete', targetTable: 'grade_seven' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    await connection.query('DELETE FROM grade_seven')
    await connection.query('DELETE FROM grade_eight')
    await connection.query('DELETE FROM grade_nine')
    await connection.query('DELETE FROM admission')
    await connection.commit()
    ok(res, { _audit: { summary: '清空全部成绩数据' } }, '数据已清空')
  } catch (err) {
    await connection.rollback()
    console.error('[清空数据错误]', err)
    fail(res, '清空失败')
  } finally {
    connection.release()
  }
})

// ========== 重复数据处理 ==========

router.post('/duplicates', authMiddleware, async (req, res) => {
  const pool = getPool()
  const connection = await pool.getConnection()
  try {
    const { rows } = req.body
    if (!rows || !Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400)
    if (rows.length > 50000) return fail(res, '单次暂存不能超过 50000 行', 400)

    const filter = await schoolFilter(pool, req)
    let count = 0
    await connection.beginTransaction()
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE)
      const built = buildBatchUpsert('grade_duplicates', chunk, DUPLICATE_FIELDS)
      if (!built) continue
      // 重复数据表没有主键 id，批量插入不适用，退化为逐行插入但放在一个事务里
      const cols = built.sql.match(/\(([^)]*)\) VALUES/)[1].split(',')
      const placeholders = cols.map(() => '?').join(',')
      for (const row of chunk) {
        const snake = camelToSnake(row || {})
        const vals = cols.map(c => (snake[c] === undefined ? null : snake[c]))
        await connection.query(
          `INSERT INTO grade_duplicates (${cols.join(',')}) VALUES (${placeholders})`,
          vals,
        )
        count++
      }
    }
    await connection.commit()
    ok(res, { count }, `已暂存 ${count} 条重复数据`)
  } catch (err) {
    await connection.rollback()
    console.error('[暂存重复数据错误]', err)
    fail(res, '暂存失败')
  } finally {
    connection.release()
  }
})

router.get('/duplicates', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const filter = await schoolFilter(pool, req)
    const [rows] = await pool.query(
      `SELECT * FROM grade_duplicates WHERE status = ? ${filter.clause} ORDER BY created_at DESC`,
      ['pending', ...filter.params],
    )
    ok(res, snakeToCamel(rows))
  } catch (err) {
    console.error('[获取重复数据错误]', err)
    fail(res, '获取失败')
  }
})

router.put('/duplicates/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { columns, values } = pickAllowed(req.body, DUPLICATE_FIELDS)
    if (columns.length === 0) return fail(res, '无更新字段', 400)

    const setClause = columns.map(c => `${c} = ?`).join(', ')
    const [result] = await pool.query(
      `UPDATE grade_duplicates SET ${setClause} WHERE id = ?`,
      [...values, req.params.id],
    )
    if (result.affectedRows === 0) return fail(res, '数据不存在', 404)
    ok(res, {}, '更新成功')
  } catch (err) {
    console.error('[更新重复数据错误]', err)
    fail(res, '更新失败')
  }
})

router.post('/duplicates/:id/submit', authMiddleware, async (req, res) => {
  const pool = getPool()
  try {
    const [rows] = await pool.query('SELECT * FROM grade_duplicates WHERE id = ?', [req.params.id])
    if (rows.length === 0) return fail(res, '数据不存在', 404)
    const d = rows[0]

    // 学校用户只能提交本校的重复数据
    const valid = await validateSchoolAccess(pool, req, d.school)
    if (!valid) return fail(res, '权限不足：只能提交本校数据', 403)

    const tableMap = { seven: 'grade_seven', eight: 'grade_eight', nine: 'grade_nine' }
    const table = tableMap[d.grade_level]
    if (!table) return fail(res, '无效年级', 400)

    const newId = 'dup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const { columns, values } = pickAllowed({
      id: newId,
      school: d.school, name: d.name, id_card: d.id_card, identity_id: d.identity_id,
      graduation_year: d.graduation_year, grade: d.grade,
      attendance_score: d.attendance_score, exam_score: d.exam_score, fitness_score: d.fitness_score,
      total: d.total, total_verify: d.total_verify, verify_result: d.verify_result,
      long_run: d.long_run, rope_skipping: d.rope_skipping, long_jump: d.long_jump,
      ball_sports: d.ball_sports, martial_arts: d.martial_arts, remark: d.remark,
    }, GRADE_TABLE_FIELDS[table])

    await pool.query(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
      values,
    )
    await pool.query(
      'UPDATE grade_duplicates SET status=?, processed_by=?, processed_at=NOW() WHERE id=?',
      ['submitted', req.user?.username || 'admin', req.params.id],
    )
    ok(res, {}, '提交成功')
  } catch (err) {
    console.error('[提交重复数据错误]', err)
    fail(res, '提交失败：' + err.message)
  }
})

router.delete('/duplicates/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query('SELECT school FROM grade_duplicates WHERE id = ?', [req.params.id])
    if (rows.length === 0) return fail(res, '数据不存在', 404)
    const valid = await validateSchoolAccess(pool, req, rows[0].school)
    if (!valid) return fail(res, '权限不足：只能删除本校数据', 403)

    await pool.query(
      'UPDATE grade_duplicates SET status=?, processed_by=?, processed_at=NOW() WHERE id=?',
      ['deleted', req.user?.username || 'admin', req.params.id],
    )
    ok(res, {}, '已删除')
  } catch (err) {
    console.error('[删除重复数据错误]', err)
    fail(res, '操作失败')
  }
})

// ========== 单条删除 ==========

router.delete('/:table/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { table, id } = req.params
    if (!GRADE_TABLES.includes(table)) return fail(res, '无效的表名', 400)

    const [oldRows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id])
    if (oldRows.length === 0) return fail(res, '记录不存在', 404)

    const old = oldRows[0]
    const valid = await validateSchoolAccess(pool, req, old.school)
    if (!valid) return fail(res, '权限不足：只能删除本校数据', 403)

    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id])
    ok(res, { _audit: { summary: `删除【${old.school} - ${old.name}】` } }, '删除成功')
  } catch (err) {
    console.error('[删除记录错误]', err)
    fail(res, '删除失败')
  }
})

// ========== 学校上报统计（聚合查询，消除 N+1） ==========

router.get('/school-stats', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { year } = req.query
    if (!year) return fail(res, '请选择毕业年份', 400)

    const [schools] = await pool.query('SELECT id, name FROM schools ORDER BY name ASC')
    if (schools.length === 0) return ok(res, [])

    // 一次性聚合出每校的人数与异常数，替代「每校 4 次 COUNT」
    const [rows] = await pool.query(`
      SELECT school,
             SUM(cnt)        AS total,
             SUM(anomaly)    AS anomalyCount
      FROM (
        SELECT school, COUNT(*) AS cnt, SUM(CASE WHEN verify_result = 0 THEN 1 ELSE 0 END) AS anomaly
          FROM grade_seven WHERE graduation_year = ? GROUP BY school
        UNION ALL
        SELECT school, COUNT(*), SUM(CASE WHEN verify_result = 0 THEN 1 ELSE 0 END)
          FROM grade_eight WHERE graduation_year = ? GROUP BY school
      ) AS t
      GROUP BY school
    `, [year, year])

    const bySchool = new Map(rows.map(r => [r.school, r]))
    const stats = schools.map(school => {
      const hit = bySchool.get(school.name)
      return {
        school: school.name,
        total: hit ? Number(hit.total || 0) : 0,
        anomalyCount: hit ? Number(hit.anomalyCount || 0) : 0,
      }
    })

    ok(res, stats)
  } catch (err) {
    console.error('[学校上报统计错误]', err)
    fail(res, '获取统计数据失败')
  }
})

// ========== 单条更新（字段白名单，防止 SQL 注入） ==========

router.put('/:table/:id', authMiddleware, auditMiddleware({ operationType: 'update', targetTable: (req) => req.params.table }), async (req, res) => {
  try {
    const pool = getPool()
    const { table, id } = req.params
    if (!GRADE_TABLES.includes(table)) return fail(res, '无效的表名', 400)

    const [oldRows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id])
    const oldRecord = oldRows.length > 0 ? oldRows[0] : null
    if (!oldRecord) return fail(res, '记录不存在', 404)

    const valid = await validateSchoolAccess(pool, req, oldRecord.school)
    if (!valid) return fail(res, '权限不足：只能修改本校数据', 403)

    // 只允许白名单列进入 SET 子句（主键等不可变字段除外）
    const { columns, values } = pickAllowed(req.body, GRADE_TABLE_FIELDS[table], IMMUTABLE_FIELDS)
    if (columns.length === 0) return fail(res, '无更新字段', 400)

    // 派生字段由服务端统一计算：只要动了分项或合计，就重算合计校对与校对结果
    const SCORE_TRIGGERS = ['attendance_score', 'exam_score', 'fitness_score', 'total']
    if (SCORE_TRIGGERS.some(c => columns.includes(c))) {
      const merged = { ...oldRecord }
      columns.forEach((c, i) => { merged[c] = values[i] })
      applyDerivedFields(table, [merged])
      if (merged.total_verify !== undefined) {
        if (!columns.includes('total_verify')) columns.push('total_verify')
        values[columns.indexOf('total_verify')] = merged.total_verify
      }
      if (merged.verify_result !== undefined) {
        if (!columns.includes('verify_result')) columns.push('verify_result')
        values[columns.indexOf('verify_result')] = merged.verify_result
      }
    }

    const setClause = columns.map(c => `${c} = ?`).join(', ')
    await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, id])

    const fieldLabels = {
      attendance_score: '出勤率成绩', exam_score: '体育考试成绩', fitness_score: '体测成绩',
      total: '合计', long_run: '长跑', rope_skipping: '跳绳', long_jump: '跳远',
      ball_sports: '足(篮)球', martial_arts: '武术', grade_seven: '七年级成绩',
      grade_eight: '八年级成绩', registration_number: '报名序号', remark: '备注',
      review_status: '审核状态', review_remark: '审核备注',
    }

    const changes = columns.map(c => ({
      field: fieldLabels[c] || c,
      from: oldRecord[c] ?? '',
      to: values[columns.indexOf(c)] ?? '',
    }))

    ok(res, {
      id,
      _audit: {
        record: `${oldRecord.school} - ${oldRecord.name}`,
        changes,
      },
    }, '更新成功')
  } catch (err) {
    console.error('[单条更新错误]', err)
    fail(res, '更新失败：' + err.message)
  }
})

module.exports = router

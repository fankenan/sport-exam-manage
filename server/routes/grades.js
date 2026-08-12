/**
 * 成绩数据路由
 */
const express = require('express')
const { ok, fail, snakeToCamel, camelToSnake } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { schoolFilter, validateSchoolAccess } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')

const router = express.Router()

// ========== 数据校验 ==========

function validateImportRows(table, rows, req) {
  const errors = []
  const scoreFields = {
    'grade_seven':  ['attendance_score', 'exam_score', 'fitness_score', 'total'],
    'grade_eight':  ['attendance_score', 'exam_score', 'fitness_score', 'total'],
    'grade_nine':   ['long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts'],
    'admission':    ['grade_seven', 'grade_eight', 'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts']
  }

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // Excel 行号（第1行是表头）

    // 必填校验
    if (!row.name || String(row.name).trim() === '') {
      errors.push({ row: rowNum, field: 'name', message: '缺少姓名' })
    }
    if (!row.school || String(row.school).trim() === '') {
      errors.push({ row: rowNum, field: 'school', message: '缺少学校名称' })
    }

    // 学校用户：校验导入数据中的学校是否与账号绑定学校一致
    if (req.user && req.user.schoolId != null && req.user.schoolName) {
      if (row.school && String(row.school).trim() !== req.user.schoolName) {
        errors.push({
          row: rowNum,
          field: 'school',
          message: `学校名称'${row.school}'与账号所属学校'${req.user.schoolName}'不一致`
        })
      }
    }

    // 分数字段校验 (0-100)
    const fields = scoreFields[table] || []
    for (const f of fields) {
      const val = row[f]
      if (val !== null && val !== undefined && val !== '' && val !== 0) {
        const num = parseFloat(val)
        if (isNaN(num) || num < 0 || num > 100) {
          errors.push({ row: rowNum, field: f, message: `分数超出范围 (0-100): ${val}` })
        }
      }
    }
  })

  return errors
}

// ========== 数据同步 ==========

router.get('/sync', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const filter = schoolFilter(req)
    const [gradeSevenList] = await pool.query('SELECT * FROM grade_seven WHERE 1=1' + filter.clause + ' ORDER BY name ASC', filter.params)
    const [gradeEightList] = await pool.query('SELECT * FROM grade_eight WHERE 1=1' + filter.clause + ' ORDER BY name ASC', filter.params)
    const [gradeNineList]  = await pool.query('SELECT * FROM grade_nine WHERE 1=1' + filter.clause + ' ORDER BY name ASC', filter.params)
    const [admissionList]  = await pool.query('SELECT * FROM admission WHERE 1=1' + filter.clause + ' ORDER BY name ASC', filter.params)

    ok(res, {
      gradeSevenList: snakeToCamel(gradeSevenList),
      gradeEightList: snakeToCamel(gradeEightList),
      gradeNineList: snakeToCamel(gradeNineList),
      admissionList: snakeToCamel(admissionList),
    })
  } catch (err) {
    console.error('[获取数据错误]', err)
    fail(res, '获取数据失败')
  }
})

// ========== 年份列表 ==========

router.get('/years', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const filter = schoolFilter(req)
    // 从所有年级表和录取表中获取年份
    const sql = `
      SELECT DISTINCT graduation_year as year FROM (
        SELECT graduation_year FROM grade_seven WHERE graduation_year IS NOT NULL AND graduation_year != ''
        UNION
        SELECT graduation_year FROM grade_eight WHERE graduation_year IS NOT NULL AND graduation_year != ''
        UNION
        SELECT graduation_year FROM grade_nine WHERE graduation_year IS NOT NULL AND graduation_year != ''
        UNION
        SELECT graduation_year FROM admission WHERE graduation_year IS NOT NULL AND graduation_year != ''
      ) AS all_years
      ORDER BY graduation_year DESC
    `
    const [rows] = await pool.query(sql)
    ok(res, rows.map(r => r.year))
  } catch (err) {
    console.error('[获取年份列表错误]', err)
    fail(res, '获取年份列表失败')
  }
})

// ========== 学校列表 ==========

router.get('/schools', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { year } = req.query
    // 从所有年级表中获取学校列表
    let sql = `SELECT DISTINCT school FROM (
      SELECT school FROM grade_seven WHERE school IS NOT NULL AND school != ''
      UNION SELECT school FROM grade_eight WHERE school IS NOT NULL AND school != ''
      UNION SELECT school FROM grade_nine WHERE school IS NOT NULL AND school != ''
      UNION SELECT school FROM admission WHERE school IS NOT NULL AND school != ''
    ) AS all_schools`
    const params = []
    // 注意：UNION 子查询无法直接做年份筛选，不过 schools 列表通常不需要按年筛选
    sql += ' ORDER BY school ASC'
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
    const allowedTables = ['grade_seven', 'grade_eight', 'grade_nine', 'admission']
    if (!allowedTables.includes(table)) return fail(res, '无效的表名', 400)

    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(10000, Math.max(1, parseInt(req.query.pageSize) || 50))
    const keyword = (req.query.keyword || '').trim()
    const graduationYear = (req.query.graduationYear || '').trim()
    const school = (req.query.school || '').trim()
    const verifyResult = (req.query.verifyResult || '').trim()
    const remarkFilter = (req.query.remark || '').trim()

    let where = 'WHERE 1=1'
    const params = []

    let searchFields = 'name, identity_id, school'
    let orderBy = 'ORDER BY name ASC'
    if (table === 'grade_nine') {
      orderBy = 'ORDER BY school ASC, name ASC'
    } else if (table === 'admission') {
      searchFields = 'name, identity_id, registration_number, school'
      orderBy = `ORDER BY school ASC,
        CASE WHEN SUBSTRING(identity_id, 17, 1) IN ('1','3','5','7','9') THEN 1 ELSE 2 END ASC,
        registration_number ASC`
    }

    if (keyword) {
      const fieldList = searchFields.split(', ')
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

    // 学校用户自动过滤
    const filter = schoolFilter(req)
    where += filter.clause
    params.push(...filter.params)

    // 查总数
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM ${table} ${where}`, params)
    const total = countResult[0].total

    // 查分页数据
    const offset = (page - 1) * pageSize
    const [rows] = await pool.query(
      `SELECT * FROM ${table} ${where} ${orderBy} LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    ok(res, {
      list: snakeToCamel(rows),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    })
  } catch (err) {
    console.error('[分页查询错误] table=', req.params.table, 'params=', req.query, err)
    fail(res, '查询失败')
  }
})

// ========== 增量导入 ==========

router.post('/import', authMiddleware, auditMiddleware({ operationType: 'create', targetTable: (req) => req.body.table || 'unknown' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { table, rows } = req.body
    const allowedTables = ['grade_seven', 'grade_eight', 'grade_nine', 'admission']
    if (!allowedTables.includes(table)) return fail(res, '无效的表名', 400)
    if (!rows || !Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400)

    // 逐行校验
    const validationErrors = validateImportRows(table, rows, req)
    if (validationErrors.length > 0) {
      return fail(res, `数据校验失败，共 ${validationErrors.length} 条错误`, 400, {
        errors: validationErrors,
        totalRows: rows.length,
        errorCount: validationErrors.length
      })
    }

    await connection.beginTransaction()

    let importCount = 0, updateCount = 0
    const BATCH = 500

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      for (const r of batch) {
        const snakeRow = camelToSnake(r)
        const cols = Object.keys(snakeRow)
        const idVal = snakeRow['id']

        if (!idVal) continue

        const [existing] = await connection.query(`SELECT id FROM ${table} WHERE id = ?`, [idVal])
        if (existing.length > 0) {
          const setClause = cols.filter(c => c !== 'id').map(c => `${c}=?`).join(',')
          const values = cols.filter(c => c !== 'id').map(c => snakeRow[c])
          if (setClause) {
            await connection.query(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, idVal])
            updateCount++
          }
        } else {
          const placeholders = cols.map(() => '?').join(',')
          await connection.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, cols.map(c => snakeRow[c]))
          importCount++
        }
      }
    }

    await connection.commit()

    const schools = [...new Set(rows.map(r => (camelToSnake(r)).school || r.school || '').filter(Boolean))]
    const tableLabels = { grade_seven: '七年级成绩', grade_eight: '八年级成绩', grade_nine: '九年级成绩', admission: '中招成绩' }
    const tableLabel = tableLabels[table] || table
    const auditSummary = `导入${tableLabel}：新增 ${importCount} 条，更新 ${updateCount} 条` + (schools.length > 0 ? `，涉及学校：${schools.join('、')}` : '')

    ok(res, { importCount, updateCount, total: importCount + updateCount, _audit: { summary: auditSummary, importCount, updateCount, schools } }, '导入成功')
  } catch (err) {
    await connection.rollback()
    console.error('[增量导入错误]', err)
    fail(res, '导入失败：' + err.message)
  } finally {
    connection.release()
  }
})

// ========== 全量覆盖同步 ==========

router.post('/sync', authMiddleware, auditMiddleware({ operationType: 'update', targetTable: 'grade_seven' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { gradeSevenList = [], gradeEightList = [], gradeNineList = [], admissionList = [] } = req.body
    await connection.beginTransaction()

    const batchUpsert = async (conn, table, rows, idField = 'id') => {
      if (!rows || rows.length === 0) return 0
      const BATCH = 500
      let total = 0
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        const cols = Object.keys(camelToSnake(batch[0]))
        const placeholders = batch.map(() => '(' + cols.map(() => '?').join(',') + ')').join(',')
        const values = batch.flatMap(r => {
          const snakeRow = camelToSnake(r)
          return cols.map(c => {
            let val = snakeRow[c]
            if ((c === 'created_at' || c === 'updated_at') && val !== null && val !== undefined) {
              if (typeof val === 'object') { val = null }
              else if (typeof val === 'string' && val.length > 0) {
                val = val.substring(0, 19)
                if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(val)) val = null
              } else { val = null }
            }
            return val !== undefined ? val : null
          })
        })
        await conn.query(
          `INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders} ON DUPLICATE KEY UPDATE ${cols.filter(c => c !== idField).map(c => `${c}=VALUES(${c})`).join(',')}`,
          values
        )
        total += batch.length
      }
      return total
    }

    let sevenCount = 0, eightCount = 0, nineCount = 0, admCount = 0
    if (gradeSevenList.length > 0) sevenCount = await batchUpsert(connection, 'grade_seven', gradeSevenList)
    if (gradeEightList.length > 0) eightCount = await batchUpsert(connection, 'grade_eight', gradeEightList)
    if (gradeNineList.length  > 0) nineCount  = await batchUpsert(connection, 'grade_nine',  gradeNineList)
    if (admissionList.length  > 0) admCount   = await batchUpsert(connection, 'admission',   admissionList)

    await connection.commit()
    console.log(`[SYNC] 七年级${sevenCount}条 八年级${eightCount}条 九年级${nineCount}条 中招${admCount}条`)
    ok(res, { gradeSevenCount: sevenCount, gradeEightCount: eightCount, gradeNineCount: nineCount, admissionCount: admCount }, '同步成功')
  } catch (err) {
    await connection.rollback()
    console.error('[同步数据错误]', err)
    fail(res, '同步失败：' + err.message)
  } finally {
    connection.release()
  }
})

// ========== 清空数据 ==========

router.post('/clear', authMiddleware, auditMiddleware({ operationType: 'delete', targetTable: 'grade_seven' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    await connection.query('DELETE FROM grade_seven')
    await connection.query('DELETE FROM grade_eight')
    await connection.query('DELETE FROM grade_nine')
    await connection.query('DELETE FROM admission')
    await connection.commit()
    ok(res, {}, '数据已清空')
  } catch (err) {
    await connection.rollback()
    console.error('[清空数据错误]', err)
    fail(res, '清空失败')
  } finally {
    connection.release()
  }
})

// ========== 单条删除 ==========

router.delete('/:table/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { table, id } = req.params
    const allowedTables = ['grade_seven', 'grade_eight', 'grade_nine', 'admission']
    if (!allowedTables.includes(table)) return fail(res, '无效的表名', 400)

    const [oldRows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id])
    if (oldRows.length === 0) return fail(res, '记录不存在', 404)

    const old = oldRows[0]
    if (req.user && req.user.schoolId != null) {
      const { validateSchoolAccess } = require('../middleware/rbac')
      const valid = await validateSchoolAccess(pool, req, old.school)
      if (!valid) return fail(res, '权限不足：只能删除本校数据', 403)
    }

    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id])
    ok(res, { _audit: { summary: `删除【${old.school} - ${old.name}】` } }, '删除成功')
  } catch (err) {
    console.error('[删除记录错误]', err)
    fail(res, '删除失败')
  }
})

// ========== 重复数据处理 ==========

// 暂存重复数据
router.post('/duplicates', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { rows } = req.body
    if (!rows || !Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400)
    let count = 0
    for (const row of rows) {
      const snake = camelToSnake(row)
      const fields = ['school','name','id_card','identity_id','graduation_year','grade','grade_level',
        'attendance_score','exam_score','fitness_score','total','total_verify','verify_result',
        'long_run','rope_skipping','long_jump','ball_sports','martial_arts','remark']
      const cols = fields.filter(f => snake[f] !== undefined)
      const values = cols.map(f => snake[f])
      await pool.query(`INSERT INTO grade_duplicates (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`, values)
      count++
    }
    ok(res, { count }, `已暂存 ${count} 条重复数据`)
  } catch (err) {
    console.error('[暂存重复数据错误]', err)
    fail(res, '暂存失败')
  }
})

// 获取重复数据列表
router.get('/duplicates', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query('SELECT * FROM grade_duplicates WHERE status = ? ORDER BY created_at DESC', ['pending'])
    ok(res, snakeToCamel(rows))
  } catch (err) {
    console.error('[获取重复数据错误]', err)
    fail(res, '获取失败')
  }
})

// 编辑单条重复数据
router.put('/duplicates/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const snakeData = camelToSnake(req.body)
    const fields = Object.keys(snakeData).filter(k => k !== 'id')
    if (fields.length === 0) return fail(res, '无更新字段', 400)
    const setClause = fields.map(f => `${f} = ?`).join(', ')
    await pool.query(`UPDATE grade_duplicates SET ${setClause} WHERE id = ?`, [...fields.map(f => snakeData[f]), id])
    ok(res, {}, '更新成功')
  } catch (err) {
    console.error('[更新重复数据错误]', err)
    fail(res, '更新失败')
  }
})

// 提交重复数据到正式表
router.post('/duplicates/:id/submit', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const [rows] = await pool.query('SELECT * FROM grade_duplicates WHERE id = ?', [id])
    if (rows.length === 0) return fail(res, '数据不存在', 404)
    const data = rows[0]
    const tableMap = { seven: 'grade_seven', eight: 'grade_eight', nine: 'grade_nine' }
    const table = tableMap[data.grade_level]
    if (!table) return fail(res, '无效的年级', 400)
    // 生成新 ID 并写入
    const newId = 'dup_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const fields = ['id','school','name','id_card','identity_id','graduation_year','grade',
      'attendance_score','exam_score','fitness_score','total','total_verify','verify_result',
      'long_run','rope_skipping','long_jump','ball_sports','martial_arts','remark']
    const values = [newId, data.school, data.name, data.id_card, data.identity_id,
      data.graduation_year, data.grade, data.attendance_score, data.exam_score, data.fitness_score,
      data.total, data.total_verify, data.verify_result, data.long_run, data.rope_skipping,
      data.long_jump, data.ball_sports, data.martial_arts, data.remark]
    // 动态构建（只包含存在的字段）
    const cols = []; const vals = []; let idx = 0
    const allFields = ['id','school','name','id_card','identity_id','graduation_year','grade',
      'attendance_score','exam_score','fitness_score','total','total_verify','verify_result',
      'long_run','rope_skipping','long_jump','ball_sports','martial_arts','remark']
    for (const f of allFields) {
      if (values[idx] !== undefined && values[idx] !== null) { cols.push(f); vals.push(values[idx]) }
      idx++
    }
    await pool.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`, vals)
    // 更新状态
    await pool.query('UPDATE grade_duplicates SET status=?, processed_by=?, processed_at=NOW() WHERE id=?',
      ['submitted', req.user?.username || 'admin', id])
    ok(res, {}, '提交成功')
  } catch (err) {
    console.error('[提交重复数据错误]', err)
    fail(res, '提交失败：' + err.message)
  }
})

// 删除重复数据（软删除）
router.delete('/duplicates/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    await pool.query('UPDATE grade_duplicates SET status=?, processed_by=?, processed_at=NOW() WHERE id=?',
      ['deleted', req.user?.username || 'admin', id])
    ok(res, {}, '已删除')
  } catch (err) {
    console.error('[删除重复数据错误]', err)
    fail(res, '操作失败')
  }
})

// ========== 学校上报统计 ==========

router.get('/school-stats', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { year } = req.query
    if (!year) return fail(res, '请选择毕业年份', 400)

    // 从 schools 表获取所有学校
    const [schools] = await pool.query('SELECT id, name FROM schools ORDER BY name ASC')

    const stats = []
    for (const school of schools) {
      // 统计七八年级人数和校对异常数
      const [sevenCount] = await pool.query(
        'SELECT COUNT(*) as cnt FROM grade_seven WHERE school = ? AND graduation_year = ?',
        [school.name, year]
      )
      const [eightCount] = await pool.query(
        'SELECT COUNT(*) as cnt FROM grade_eight WHERE school = ? AND graduation_year = ?',
        [school.name, year]
      )
      const [sevenAnomaly] = await pool.query(
        'SELECT COUNT(*) as cnt FROM grade_seven WHERE school = ? AND graduation_year = ? AND verify_result = 0',
        [school.name, year]
      )
      const [eightAnomaly] = await pool.query(
        'SELECT COUNT(*) as cnt FROM grade_eight WHERE school = ? AND graduation_year = ? AND verify_result = 0',
        [school.name, year]
      )

      const total = (sevenCount[0].cnt || 0) + (eightCount[0].cnt || 0)
      const anomalies = (sevenAnomaly[0].cnt || 0) + (eightAnomaly[0].cnt || 0)

      stats.push({
        school: school.name,
        total,
        anomalyCount: anomalies
      })
    }

    ok(res, stats)
  } catch (err) {
    console.error('[学校上报统计错误]', err)
    fail(res, '获取统计数据失败')
  }
})

// ========== 单条更新 ==========

router.put('/:table/:id', authMiddleware, auditMiddleware({ operationType: 'update', targetTable: (req) => req.params.table }), async (req, res) => {
  try {
    const pool = getPool()
    const { table, id } = req.params
    const allowedTables = ['grade_seven', 'grade_eight', 'grade_nine', 'admission']
    if (!allowedTables.includes(table)) return fail(res, '无效的表名', 400)

    // 学校用户校验记录归属
    const [oldRows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id])
    const oldRecord = oldRows.length > 0 ? oldRows[0] : null
    if (!oldRecord) return fail(res, '记录不存在', 404)

    if (req.user && req.user.schoolId != null) {
      const valid = await validateSchoolAccess(pool, req, oldRecord.school)
      if (!valid) return fail(res, '权限不足：只能修改本校数据', 403)
    }

    const snakeData = camelToSnake(req.body)
    const fields = Object.keys(snakeData).filter(k => k !== 'id')
    if (fields.length === 0) return fail(res, '无更新字段', 400)

    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => snakeData[f])

    await pool.query(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, id])

    const fieldLabels = {
      attendance_score: '出勤率成绩', exam_score: '体育考试成绩', fitness_score: '体测成绩',
      total: '合计', long_run: '长跑', rope_skipping: '跳绳', long_jump: '跳远',
      ball_sports: '足(篮)球', martial_arts: '武术', grade_seven: '七年级成绩',
      grade_eight: '八年级成绩', registration_number: '报名序号', remark: '备注',
      review_status: '审核状态', review_remark: '审核备注',
    }

    const changes = fields.map(f => ({
      field: fieldLabels[f] || f,
      from: oldRecord ? (oldRecord[f] ?? '') : '',
      to: snakeData[f] ?? ''
    }))

    ok(res, {
      id,
      _audit: {
        record: oldRecord ? `${oldRecord.school} - ${oldRecord.name}` : `ID:${id}`,
        changes
      }
    }, '更新成功')
  } catch (err) {
    console.error('[单条更新错误]', err)
    fail(res, '更新失败：' + err.message)
  }
})

module.exports = router

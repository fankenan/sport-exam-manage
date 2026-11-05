/**
 * 九年级报名名单路由
 *
 * 业务规则：
 *   1. 九年级成绩**不由学校导入**，由管理员统一导入。
 *      学校上传的是「参加考试的学生信息」（报名名单）。
 *   2. 教育局（管理员）审核通过名单后，系统把 学校/姓名/身份ID/报名序号/
 *      毕业年份/年级 等基本信息分别写入：
 *        - 九年级成绩表 grade_nine
 *        - 中招体育成绩表 admission
 *      此时各项成绩为空，等管理员再按身份证号导入成绩。
 *   3. 报名时有两个项目因人而异：
 *        - 项目1（长跑）：男生 1000米，女生 800米 → 导入校对时校验「性别 ↔ 长跑项目」一致
 *        - 项目4（球类）：有人报足球，有人报篮球
 *   4. 报名原始信息全部保留（raw），后续「考务编排」模块要用。
 */
const express = require('express')
const XLSX = require('xlsx')
const { ok, fail, snakeToCamel, camelToSnake } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { requireAdmin, requireSchoolUser, resolveSchoolName } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')
const { applyDerivedFields } = require('../derived')

const router = express.Router()

const STATUS = {
  PENDING: 'pending',     // 待审核
  APPROVED: 'approved',   // 审核通过（基本信息已写入成绩表，成绩待导入）
  REJECTED: 'rejected',   // 已驳回
  SCORED: 'scored',       // 已导入成绩
}

const STATUS_LABELS = {
  pending: '待审核',
  approved: '待导入成绩',
  rejected: '已驳回',
  scored: '已导入成绩',
}

// 项目名归一：把各种写法统一
function normalizeEvent(raw) {
  const s = String(raw || '').replace(/\s/g, '')
  if (!s) return ''
  if (s.includes('1000')) return '1000米'
  if (s.includes('800')) return '800米'
  if (s.includes('足球')) return '足球'
  if (s.includes('篮球')) return '篮球'
  if (s.includes('跳绳')) return '跳绳'
  if (s.includes('跳远')) return '跳远'
  if (s.includes('武术')) return '武术'
  return s
}

/** 性别归一 */
function normalizeGender(raw) {
  const s = String(raw || '').replace(/\s/g, '')
  if (s.includes('男')) return '男'
  if (s.includes('女')) return '女'
  return ''
}

/** 身份证 → 规范身份标识 */
function normalizeIdCard(idCard) {
  return String(idCard || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

/** 身份证第 17 位奇偶 → 推算性别（用于校验身份证与「性别」列是否自洽） */
function genderFromIdCard(idCard) {
  const s = normalizeIdCard(idCard)
  if (s.length !== 18) return ''
  const n = parseInt(s[16], 10)
  if (Number.isNaN(n)) return ''
  return n % 2 === 1 ? '男' : '女'
}

// ========== 报名表解析与校验 ==========
//
// 填报规则（由业务方确认）：
//   备注为空  → 必须填长跑项目（男 1000米 / 女 800米），球类只能是足球或篮球；
//   备注有内容 → 视为特殊考生（病免 / 残免 / 弃考 / 其它），五个项目列必须全部留空。
// 两条互斥，备注有内容又填了项目会被直接拦下。

/**
 * 校验一份报名名单
 *
 * @returns {{ errors: Array, rows: Array }}
 */
function validateRegistrationRows(rows, schoolName) {
  const errors = []
  const out = []
  const seen = new Map()

  rows.forEach((row, idx) => {
    const rowNum = idx + 2 // Excel 行号（1 行是表头）
    const r = camelToSnake(row || {})

    const name = String(r.name || '').trim()
    const idCard = String(r.id_card || '').trim()
    const gender = normalizeGender(r.gender)
    const longRunEvent = normalizeEvent(r.long_run_event)
    const ropeSkippingEvent = normalizeEvent(r.rope_skipping_event)
    const longJumpEvent = normalizeEvent(r.long_jump_event)
    const ballEvent = normalizeEvent(r.ball_event)
    const martialArtsEvent = normalizeEvent(r.martial_arts_event)

    // 备注有内容 = 特殊考生（病免 / 残免 / 弃考 / 其它），此时所有项目列都必须留空
    const remarkText = String(r.remark || '').trim()
    const hasRemark = remarkText.length > 0

    if (!name) errors.push({ row: rowNum, field: 'name', message: '缺少姓名' })
    if (!idCard) {
      errors.push({ row: rowNum, field: 'id_card', message: '缺少身份证号' })
    } else if (!/^\d{17}[\dXx]$/.test(idCard)) {
      errors.push({ row: rowNum, field: 'id_card', message: `身份证号格式不正确：${idCard}` })
    } else {
      const identityId = normalizeIdCard(idCard)
      if (seen.has(identityId)) {
        errors.push({ row: rowNum, field: 'id_card', message: `身份证号重复（第 ${seen.get(identityId)} 行已出现）` })
      } else {
        seen.set(identityId, rowNum)
      }
      // 身份证本身带性别，与「性别」列不一致要提示
      const idGender = genderFromIdCard(idCard)
      if (gender && idGender && gender !== idGender) {
        errors.push({
          row: rowNum, field: 'gender',
          message: `性别与身份证号不一致：填的是「${gender}」，身份证显示「${idGender}」`,
        })
      }
    }

    const projectFields = [
      ['长跑项目', longRunEvent],
      ['跳绳项目', ropeSkippingEvent],
      ['跳远项目', longJumpEvent],
      ['球类项目', ballEvent],
      ['武术项目', martialArtsEvent],
    ]
    const filledProjects = projectFields.filter(([, v]) => v).map(([label]) => label)

    if (hasRemark) {
      // 备注非空 → 特殊考生，项目列必须全部留空，否则直接拦下
      if (filledProjects.length > 0) {
        errors.push({
          row: rowNum, field: 'remark',
          message: `备注填了「${remarkText}」，就不能再填项目（已填：${filledProjects.join('、')}），请把项目列全部清空`,
        })
      }
    } else {
      // 正常考生：长跑必填，且与性别一致（男生 1000米，女生 800米）
      if (!longRunEvent) {
        errors.push({
          row: rowNum, field: 'long_run_event',
          message: '缺少长跑项目（男生 1000米 / 女生 800米）；病免/残免/弃考请只在备注里注明，项目列留空',
        })
      } else if (gender === '男' && longRunEvent !== '1000米') {
        errors.push({ row: rowNum, field: 'long_run_event', message: `男生应报 1000米，填的是「${longRunEvent}」` })
      } else if (gender === '女' && longRunEvent !== '800米') {
        errors.push({ row: rowNum, field: 'long_run_event', message: `女生应报 800米，填的是「${longRunEvent}」` })
      }

      // 球类项目只能是足球或篮球
      if (ballEvent && ballEvent !== '足球' && ballEvent !== '篮球') {
        errors.push({ row: rowNum, field: 'ball_event', message: `球类项目只能是「足球」或「篮球」，填的是「${ballEvent}」` })
      }
    }

    if (!r.graduation_year) {
      errors.push({ row: rowNum, field: 'graduation_year', message: '缺少毕业年份' })
    }
    if (!r.registration_number) {
      errors.push({ row: rowNum, field: 'registration_number', message: '缺少报名序号' })
    }
    if (schoolName && r.school && String(r.school).trim() !== schoolName) {
      errors.push({
        row: rowNum, field: 'school',
        message: `学校名称'${r.school}'与账号所属学校'${schoolName}'不一致`,
      })
    }

    out.push({
      school: schoolName || String(r.school || '').trim(),
      name,
      gender,
      id_card: idCard,
      identity_id: normalizeIdCard(idCard),
      registration_number: String(r.registration_number || '').trim(),
      graduation_year: String(r.graduation_year || '').trim(),
      grade: String(r.grade || '九年级').trim() || '九年级',
      long_run_event: longRunEvent,
      rope_skipping_event: ropeSkippingEvent,
      long_jump_event: longJumpEvent,
      ball_event: ballEvent,
      martial_arts_event: martialArtsEvent,
      remark: remarkText,
      raw: row,
    })
  })

  return { errors, rows: out }
}

// ========== 模板下载 ==========

router.get('/template', authMiddleware, async (req, res) => {
  try {
    const headers = ['学校', '姓名', '性别', '身份证', '报名序号', '毕业年份', '年级',
      '项目1', '项目2', '项目3', '项目4', '项目5', '备注']
    const sample = [
      ['实验第一中学', '张三', '男', '310101200801011234', '120001', '2026', '九年级', '1000米', '跳绳', '跳远', '足球', '武术', ''],
      ['实验第一中学', '李四', '女', '310101200801011235', '120002', '2026', '九年级', '800米', '跳绳', '跳远', '篮球', '武术', ''],
      ['实验第一中学', '王五', '男', '310101200801011236', '120003', '2026', '九年级', '', '', '', '', '', '病免'],
      ['实验第一中学', '赵六', '女', '310101200801011244', '120004', '2026', '九年级', '', '', '', '', '', '残免'],
      ['实验第一中学', '孙七', '男', '310101200801011255', '120005', '2026', '九年级', '', '', '', '', '', '弃考'],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample])
    ws['!cols'] = headers.map(() => ({ wch: 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '九年级报名表')

    // 第二个工作表放填写说明（解析只读第一个工作表，不影响导入）
    const notes = [
      ['填写说明'],
      [''],
      ['1. 项目1~项目5 按报名顺序填写即可，系统会自动识别长跑 / 跳绳 / 跳远 / 球类 / 武术。'],
      ['2. 男生长跑填 1000米，女生填 800米；球类只能填 足球 或 篮球。'],
      ['3. 备注为空的学生，必须填写长跑项目。'],
      ['4. 备注有内容的（病免 / 残免 / 弃考 / 其它），五个项目列必须全部留空，否则校验不通过。'],
      ['5. 身份证号请按文本格式填写，第 17 位决定性别，需与「性别」列一致。'],
      ['6. 报名序号、毕业年份必填，且同一份文件里身份证号不能重复。'],
    ]
    const wsNotes = XLSX.utils.aoa_to_sheet(notes)
    wsNotes['!cols'] = [{ wch: 90 }]
    XLSX.utils.book_append_sheet(wb, wsNotes, '填写说明')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const filename = encodeURIComponent('九年级报名表.xlsx')
    res.setHeader('Content-Disposition', `attachment; filename="registration.xlsx"; filename*=UTF-8''${filename}`)
    res.send(buf)
  } catch (err) {
    console.error('[下载报名模板错误]', err)
    fail(res, '模板生成失败')
  }
})

// ========== 成绩导入模板（管理员用，含项目名列以便校验） ==========

router.get('/score-template', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const headers = ['学校', '姓名', '身份证', '长跑项目', '长跑', '跳绳', '跳远', '球类项目', '足(篮)球', '武术', '备注']
    const sample = [
      ['实验第一中学', '张三', '310101200801011234', '1000米', 18, 19, 16, '足球', 17, 18, ''],
      ['实验第一中学', '李四', '310101200801011235', '800米', 16, 18, 15, '篮球', 16, 17, ''],
    ]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample])
    ws['!cols'] = headers.map(() => ({ wch: 16 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '九年级成绩')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const filename = encodeURIComponent('九年级体育成绩导入模板.xlsx')
    res.setHeader('Content-Disposition', `attachment; filename="scores.xlsx"; filename*=UTF-8''${filename}`)
    res.send(buf)
  } catch (err) {
    console.error('[下载成绩模板错误]', err)
    fail(res, '模板生成失败')
  }
})

// ========== 预检（不写库） ==========

router.post('/preview', authMiddleware, requireSchoolUser, async (req, res) => {
  try {
    const { rows, year } = req.body
    if (!Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400)
    if (rows.length > 50000) return fail(res, '单次上报不能超过 50000 行', 400)

    const school = await resolveSchoolName(getPool(), req)
    if (!school) return fail(res, '账号未绑定学校', 403)

    const { errors, rows: parsed } = validateRegistrationRows(rows, school)
    if (errors.length > 0) {
      return ok(res, {
        valid: false,
        errors: errors.slice(0, 500),
        errorCount: errors.length,
        totalRows: rows.length,
      }, `校验未通过，共 ${errors.length} 处问题`)
    }

    // 与已提交的报名名单查重
    const identities = parsed.map(r => r.identity_id).filter(Boolean)
    const [existing] = await getPool().query(
      `SELECT identity_id, status FROM grade_nine_registrations
       WHERE identity_id IN (${identities.map(() => '?').join(',')})
         AND status != 'rejected'`,
      identities,
    )
    const dupSet = new Set(existing.map(e => e.identity_id))

    ok(res, {
      valid: true,
      errors: [],
      errorCount: 0,
      totalRows: parsed.length,
      duplicateCount: parsed.filter(r => dupSet.has(r.identity_id)).length,
    }, '预检完成')
  } catch (err) {
    console.error('[报名预检错误]', err)
    fail(res, '预检失败：' + err.message)
  }
})

// ========== 提交报名名单（学校） ==========

router.post('/', authMiddleware, requireSchoolUser, auditMiddleware({ operationType: 'create', targetTable: 'grade_nine_registrations' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { rows, year } = req.body
    if (!Array.isArray(rows) || rows.length === 0) return fail(res, '无数据', 400)
    if (rows.length > 50000) return fail(res, '单次上报不能超过 50000 行', 400)

    const school = await resolveSchoolName(connection, req)
    if (!school) return fail(res, '账号未绑定学校', 403)

    const { errors, rows: parsed } = validateRegistrationRows(rows, school)
    if (errors.length > 0) {
      return fail(res, `数据校验失败，共 ${errors.length} 条错误`, 400, {
        errors: errors.slice(0, 500), errorCount: errors.length,
      })
    }

    await connection.beginTransaction()

    let inserted = 0
    // 已导入成绩的学生不允许学校再改报名信息：成绩表里的分项已经按当时的项目落库，
    // 允许改动会造成「项目变了、分数还是旧的」这种对不上的数据。
    const locked = []

    for (const r of parsed) {
      // 已存在未驳回的同名身份证 → 视为更新（重新提交）
      const [existed] = await connection.query(
        `SELECT id, status FROM grade_nine_registrations WHERE identity_id = ? AND school = ? AND status != 'rejected'`,
        [r.identity_id, r.school],
      )
      if (existed.length > 0 && existed[0].status === STATUS.SCORED) {
        locked.push(r.name)
        continue
      }
      const values = [
        r.school, r.name, r.gender, r.id_card, r.identity_id, r.registration_number,
        r.graduation_year, r.grade, r.long_run_event, r.rope_skipping_event,
        r.long_jump_event, r.ball_event, r.martial_arts_event, r.remark,
        JSON.stringify(r.raw), STATUS.PENDING, req.user?.username || '',
      ]
      if (existed.length > 0) {
        await connection.query(
          `UPDATE grade_nine_registrations SET
             school=?, name=?, gender=?, id_card=?, identity_id=?, registration_number=?,
             graduation_year=?, grade=?, long_run_event=?, rope_skipping_event=?,
             long_jump_event=?, ball_event=?, martial_arts_event=?, remark=?, raw=?,
             status=?, uploaded_by=?, reject_reason='',
             reviewed_by=NULL, reviewed_at=NULL, scored_at=NULL
           WHERE id = ?`,
          [...values, existed[0].id],
        )
      } else {
        await connection.query(
          `INSERT INTO grade_nine_registrations
            (school, name, gender, id_card, identity_id, registration_number,
             graduation_year, grade, long_run_event, rope_skipping_event,
             long_jump_event, ball_event, martial_arts_event, remark, raw, status, uploaded_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          values,
        )
        inserted++
      }
    }

    if (locked.length > 0) {
      await connection.rollback()
      return fail(
        res,
        `以下学生已导入成绩，报名信息不能再修改：${locked.slice(0, 20).join('、')}${locked.length > 20 ? ` 等 ${locked.length} 人` : ''}。如需修改，请联系教育局`,
        400,
        { locked, lockedCount: locked.length },
      )
    }

    await connection.commit()
    ok(res, {
      count: parsed.length,
      inserted,
      _audit: { summary: `上报九年级报名名单【${school}】${parsed.length} 人` },
    }, '报名名单已提交，等待教育局审核')
  } catch (err) {
    await connection.rollback()
    console.error('[提交报名名单错误]', err)
    fail(res, '提交失败：' + err.message)
  } finally {
    connection.release()
  }
})

// ========== 待审核数量（侧边栏角标） ==========

router.get('/pending-count', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    let where = "WHERE status = 'pending'"
    const params = []
    if (req.user.schoolId != null) {
      const school = await resolveSchoolName(pool, req)
      where += ' AND school = ?'
      params.push(school)
    }
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM grade_nine_registrations ${where}`, params,
    )
    ok(res, { count: Number(rows[0].cnt || 0) })
  } catch (err) {
    console.error('[待审核报名数量错误]', err)
    fail(res, '获取失败')
  }
})

// ========== 报名名单列表 ==========

router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
    const status = (req.query.status || '').trim()
    const school = (req.query.school || '').trim()
    const keyword = (req.query.keyword || '').trim()

    let where = 'WHERE 1=1'
    const params = []
    if (req.user.schoolId != null) {
      const my = await resolveSchoolName(pool, req)
      where += ' AND school = ?'
      params.push(my)
    } else if (school) {
      where += ' AND school = ?'
      params.push(school)
    }
    if (status) { where += ' AND status = ?'; params.push(status) }
    if (keyword) {
      where += ' AND (name LIKE ? OR identity_id LIKE ? OR registration_number LIKE ?)'
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM grade_nine_registrations ${where}`, params,
    )
    const total = countRows[0].total
    const offset = (page - 1) * pageSize

    const [rows] = await pool.query(
      `SELECT id, school, name, gender, id_card, identity_id, registration_number,
              graduation_year, grade, long_run_event, ball_event, remark,
              status, reject_reason, uploaded_by, reviewed_by, reviewed_at, scored_at, created_at
       FROM grade_nine_registrations ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    )

    ok(res, {
      list: snakeToCamel(rows),
      total, page, pageSize,
      totalPages: Math.ceil(total / pageSize),
      statusLabels: STATUS_LABELS,
    })
  } catch (err) {
    console.error('[获取报名名单错误]', err)
    fail(res, '获取列表失败')
  }
})

// ========== 管理员审核通过 → 写入九年级成绩表与中招成绩表 ==========

router.post('/:id/approve', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_nine_registrations' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const [rows] = await connection.query(
      'SELECT * FROM grade_nine_registrations WHERE id = ?', [req.params.id],
    )
    if (rows.length === 0) return fail(res, '报名记录不存在', 404)
    const reg = rows[0]
    if (reg.status === STATUS.SCORED) return fail(res, '该记录已导入成绩，无需重复审核', 400)

    await connection.beginTransaction()

    // 生成稳定的记录 id（用身份标识，重复审核不会产生重复行）
    const nineId = `nine_${reg.identity_id}`
    const admId = `adm_${reg.identity_id}`

    // 1) 九年级成绩表：写入基本信息，各项成绩留空
    const nineRow = {
      id: nineId,
      school: reg.school,
      name: reg.name,
      id_card: reg.id_card,
      identity_id: reg.identity_id,
      student_number: reg.registration_number,
      graduation_year: reg.graduation_year,
      grade: reg.grade,
      long_run: null, rope_skipping: null, long_jump: null,
      ball_sports: null, martial_arts: null,
      remark: reg.remark,
      review_status: 'published',
    }
    applyDerivedFields('grade_nine', [nineRow])
    await upsertRow(connection, 'grade_nine', nineRow, [
      'id', 'school', 'name', 'id_card', 'identity_id', 'student_number', 'graduation_year',
      'grade', 'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts',
      'remark', 'review_status',
    ])

    // 2) 中招体育成绩表：写入基本信息与报名序号
    const admRow = {
      id: admId,
      identity_id: reg.identity_id,
      school: reg.school,
      name: reg.name,
      id_card: reg.id_card,
      registration_number: reg.registration_number,
      graduation_year: reg.graduation_year,
      grade: reg.grade,
      grade_seven: null, grade_eight: null,
      long_run: null, rope_skipping: null, long_jump: null,
      ball_sports: null, martial_arts: null,
      total_score: null,
      remark: reg.remark,
      review_status: 'published',
    }
    applyDerivedFields('admission', [admRow])
    await upsertRow(connection, 'admission', admRow, [
      'id', 'identity_id', 'school', 'name', 'id_card', 'registration_number',
      'graduation_year', 'grade', 'grade_seven', 'grade_eight',
      'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts',
      'total_score', 'remark', 'review_status',
    ])

    await connection.query(
      `UPDATE grade_nine_registrations
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), reject_reason = ''
       WHERE id = ?`,
      [STATUS.APPROVED, req.user?.username || 'admin', req.params.id],
    )

    await connection.commit()

    ok(res, {
      _audit: { summary: `审核通过报名名单【${reg.school} - ${reg.name}】，已写入九年级成绩表与中招成绩表` },
    }, '已通过，报名信息已写入成绩表')
  } catch (err) {
    await connection.rollback()
    console.error('[审核报名错误]', err)
    fail(res, '审核失败：' + err.message)
  } finally {
    connection.release()
  }
})

// ========== 管理员驳回 ==========

router.post('/:id/reject', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_nine_registrations' }), async (req, res) => {
  try {
    const reason = (req.body?.reason || '').trim()
    if (!reason) return fail(res, '请填写驳回原因', 400)
    const [rows] = await getPool().query('SELECT id, school, name FROM grade_nine_registrations WHERE id = ?', [req.params.id])
    if (rows.length === 0) return fail(res, '报名记录不存在', 404)
    await getPool().query(
      `UPDATE grade_nine_registrations SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [STATUS.REJECTED, reason, req.user?.username || 'admin', req.params.id],
    )
    ok(res, { _audit: { summary: `驳回报名【${rows[0].school} - ${rows[0].name}】：${reason}` } }, '已驳回')
  } catch (err) {
    console.error('[驳回报名错误]', err)
    fail(res, '操作失败')
  }
})

// ========== 管理员删除报名记录 ==========
// 仅用于处理录错的名单（如学生已转学、重复上报）。
// 不回滚成绩表：成绩是正式数据，需要撤销请走成绩表的删除流程。

router.delete('/:id', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'delete', targetTable: 'grade_nine_registrations' }), async (req, res) => {
  try {
    const [rows] = await getPool().query('SELECT id, school, name FROM grade_nine_registrations WHERE id = ?', [req.params.id])
    if (rows.length === 0) return fail(res, '报名记录不存在', 404)
    await getPool().query('DELETE FROM grade_nine_registrations WHERE id = ?', [req.params.id])
    ok(res, { _audit: { summary: `删除报名记录【${rows[0].school} - ${rows[0].name}】` } }, '已删除')
  } catch (err) {
    console.error('[删除报名错误]', err)
    fail(res, '操作失败')
  }
})

// ========== 批量审核通过 ==========

router.post('/batch-approve', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_nine_registrations' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return fail(res, '请选择要审核的记录', 400)

    await connection.beginTransaction()
    let okCount = 0
    for (const id of ids) {
      const [rows] = await connection.query('SELECT * FROM grade_nine_registrations WHERE id = ?', [id])
      if (rows.length === 0) continue
      const reg = rows[0]
      if (reg.status === STATUS.SCORED) continue

      const nineRow = {
        id: `nine_${reg.identity_id}`, school: reg.school, name: reg.name,
        id_card: reg.id_card, identity_id: reg.identity_id,
        student_number: reg.registration_number, graduation_year: reg.graduation_year,
        grade: reg.grade, long_run: null, rope_skipping: null, long_jump: null,
        ball_sports: null, martial_arts: null, remark: reg.remark, review_status: 'published',
      }
      applyDerivedFields('grade_nine', [nineRow])
      await upsertRow(connection, 'grade_nine', nineRow, [
        'id', 'school', 'name', 'id_card', 'identity_id', 'student_number', 'graduation_year',
        'grade', 'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts',
        'remark', 'review_status',
      ])

      const admRow = {
        id: `adm_${reg.identity_id}`, identity_id: reg.identity_id, school: reg.school,
        name: reg.name, id_card: reg.id_card, registration_number: reg.registration_number,
        graduation_year: reg.graduation_year, grade: reg.grade,
        grade_seven: null, grade_eight: null,
        long_run: null, rope_skipping: null, long_jump: null,
        ball_sports: null, martial_arts: null, total_score: null,
        remark: reg.remark, review_status: 'published',
      }
      applyDerivedFields('admission', [admRow])
      await upsertRow(connection, 'admission', admRow, [
        'id', 'identity_id', 'school', 'name', 'id_card', 'registration_number',
        'graduation_year', 'grade', 'grade_seven', 'grade_eight',
        'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts',
        'total_score', 'remark', 'review_status',
      ])

      await connection.query(
        `UPDATE grade_nine_registrations SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
        [STATUS.APPROVED, req.user?.username || 'admin', id],
      )
      okCount++
    }
    await connection.commit()
    ok(res, { count: okCount, _audit: { summary: `批量审核通过报名名单 ${okCount} 条` } }, `已通过 ${okCount} 条`)
  } catch (err) {
    await connection.rollback()
    console.error('[批量审核报名错误]', err)
    fail(res, '批量审核失败：' + err.message)
  } finally {
    connection.release()
  }
})

// ========== 管理员导入成绩（按身份证号匹配报名名单） ==========

router.post('/import-scores', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_nine' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { rows, dryRun } = req.body
    if (!Array.isArray(rows) || rows.length === 0) return fail(res, '无成绩数据', 400)
    if (rows.length > 50000) return fail(res, '单次导入不能超过 50000 行', 400)

    const errors = []
    const prepared = []
    const seen = new Set()

    rows.forEach((row, idx) => {
      const rowNum = idx + 2
      const r = camelToSnake(row || {})
      const idCard = String(r.id_card || '').trim()
      const identityId = normalizeIdCard(idCard)
      if (!identityId) {
        errors.push({ row: rowNum, field: 'id_card', message: '缺少身份证号' })
        return
      }
      if (seen.has(identityId)) {
        errors.push({ row: rowNum, field: 'id_card', message: '身份证号重复' })
        return
      }
      seen.add(identityId)

      const longRunEvent = normalizeEvent(r.long_run_event)
      const ballEvent = normalizeEvent(r.ball_event)
      const num = (v) => {
        if (v === null || v === undefined || v === '') return null
        const n = parseFloat(v)
        return Number.isNaN(n) ? null : n
      }

      prepared.push({
        identity_id: identityId,
        id_card: idCard,
        long_run: num(r.long_run),
        rope_skipping: num(r.rope_skipping),
        long_jump: num(r.long_jump),
        ball_sports: num(r.ball_sports),
        martial_arts: num(r.martial_arts),
        long_run_event: longRunEvent,
        ball_event: ballEvent,
        remark: String(r.remark || '').trim(),
      })
    })

    // 单行就已经报错（比如整列身份证没读到）时先返回，避免拼出空的 IN ()
    if (errors.length > 0) {
      return fail(res, `数据校验失败，共 ${errors.length} 条错误`, 400, {
        errors: errors.slice(0, 500), errorCount: errors.length,
      })
    }

    // 与报名名单比对
    const ids = prepared.map(p => p.identity_id)
    const [regs] = await connection.query(
      `SELECT identity_id, school, name, gender, registration_number, graduation_year, grade,
              long_run_event, ball_event, status, remark
       FROM grade_nine_registrations
       WHERE identity_id IN (${ids.map(() => '?').join(',')})`,
      ids,
    )
    const regMap = new Map(regs.map(r => [r.identity_id, r]))

    const matched = []
    prepared.forEach((p, i) => {
      const reg = regMap.get(p.identity_id)
      if (!reg) {
        errors.push({ row: i + 2, field: 'id_card', message: `身份证号 ${p.id_card} 不在报名名单中，请先审核通过该学生的报名` })
        return
      }
      if (reg.status === STATUS.REJECTED) {
        errors.push({ row: i + 2, field: 'id_card', message: `报名已被驳回，不能导入成绩` })
        return
      }
      // 校验长跑项目与性别一致
      if (p.long_run_event && reg.gender) {
        const expect = reg.gender === '男' ? '1000米' : '800米'
        if (p.long_run_event !== expect) {
          errors.push({
            row: i + 2, field: 'long_run_event',
            message: `${reg.name} 报名时为${reg.gender}生，应报「${expect}」，成绩文件填的是「${p.long_run_event}」`,
          })
          return
        }
      }
      // 校验长跑项目与报名一致
      if (p.long_run_event && reg.long_run_event && p.long_run_event !== reg.long_run_event) {
        errors.push({
          row: i + 2, field: 'long_run_event',
          message: `${reg.name} 报名时是「${reg.long_run_event}」，成绩文件填的是「${p.long_run_event}」`,
        })
        return
      }
      // 校验球类项目与报名一致
      if (p.ball_event && reg.ball_event && p.ball_event !== reg.ball_event) {
        errors.push({
          row: i + 2, field: 'ball_event',
          message: `${reg.name} 报名时是「${reg.ball_event}」，成绩文件填的是「${p.ball_event}」`,
        })
        return
      }
      matched.push({ ...p, reg })
    })

    if (errors.length > 0) {
      return fail(res, `数据校验失败，共 ${errors.length} 条错误`, 400, {
        errors: errors.slice(0, 500), errorCount: errors.length,
      })
    }

    // 预检：全部校验通过但不写库，前端确认后再正式导入
    if (dryRun) {
      return ok(res, {
        _skipAudit: true,
        count: matched.length,
        dryRun: true,
        preview: matched.map(m => ({
          name: m.reg.name,
          school: m.reg.school,
          identityId: m.identity_id,
          longRunEvent: m.long_run_event,
          ballEvent: m.ball_event,
          longRun: m.long_run,
          ropeSkipping: m.rope_skipping,
          longJump: m.long_jump,
          ballSports: m.ball_sports,
          martialArts: m.martial_arts,
        })),
      }, `预检通过：${matched.length} 条成绩可导入`)
    }

    await connection.beginTransaction()
    let updated = 0
    for (const m of matched) {
      const nineRow = {
        id: `nine_${m.identity_id}`,
        school: m.reg.school,
        name: m.reg.name,
        id_card: m.id_card,
        identity_id: m.identity_id,
        student_number: m.reg.registration_number,
        graduation_year: m.reg.graduation_year,
        grade: m.reg.grade,
        long_run: m.long_run, rope_skipping: m.rope_skipping, long_jump: m.long_jump,
        ball_sports: m.ball_sports, martial_arts: m.martial_arts,
        remark: m.remark || m.reg.remark,
        review_status: 'published',
      }
      applyDerivedFields('grade_nine', [nineRow])
      await upsertRow(connection, 'grade_nine', nineRow, [
        'id', 'school', 'name', 'id_card', 'identity_id', 'student_number', 'graduation_year',
        'grade', 'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts',
        'remark', 'review_status',
      ])

      const admRow = {
        id: `adm_${m.identity_id}`,
        identity_id: m.identity_id,
        school: m.reg.school,
        name: m.reg.name,
        id_card: m.id_card,
        registration_number: m.reg.registration_number,
        graduation_year: m.reg.graduation_year,
        grade: m.reg.grade,
        grade_seven: null, grade_eight: null,
        long_run: m.long_run, rope_skipping: m.rope_skipping, long_jump: m.long_jump,
        ball_sports: m.ball_sports, martial_arts: m.martial_arts,
        total_score: null,
        remark: m.remark || m.reg.remark,
        review_status: 'published',
      }
      applyDerivedFields('admission', [admRow])
      await upsertRow(connection, 'admission', admRow, [
        'id', 'identity_id', 'school', 'name', 'id_card', 'registration_number',
        'graduation_year', 'grade', 'grade_seven', 'grade_eight',
        'long_run', 'rope_skipping', 'long_jump', 'ball_sports', 'martial_arts',
        'total_score', 'remark', 'review_status',
      ])

      await connection.query(
        `UPDATE grade_nine_registrations SET status = ?, scored_at = NOW() WHERE identity_id = ?`,
        [STATUS.SCORED, m.identity_id],
      )
      updated++
    }
    await connection.commit()

    ok(res, {
      count: updated,
      _audit: { summary: `导入九年级成绩 ${updated} 条（按身份证号匹配报名名单）` },
    }, `已导入 ${updated} 条成绩`)
  } catch (err) {
    await connection.rollback()
    console.error('[导入九年级成绩错误]', err)
    fail(res, '导入失败：' + err.message)
  } finally {
    connection.release()
  }
})

/**
 * 单行 upsert（只更新给定列）
 */
async function upsertRow(connection, table, row, columns) {
  const cols = columns.filter(c => c in row)
  const placeholders = cols.map(() => '?').join(',')
  const values = cols.map(c => row[c])
  const updates = cols.filter(c => c !== 'id').map(c => `${c}=VALUES(${c})`).join(',')
  await connection.query(
    `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updates}`,
    values,
  )
}

module.exports = router

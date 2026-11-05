/**
 * 成绩复核路由
 * - 学校用户提交复核申请
 * - 管理员查看、审批申请（审批通过时真正回写成绩表）
 */
const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { ok, fail, snakeToCamel } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { requireAdmin, validateSchoolAccess, resolveSchoolName } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')
const { UPLOAD_ALLOWED_EXT, UPLOAD_MIME_PREFIXES } = require('../constants')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    // 使用随机文件名，避免用户原始文件名参与磁盘路径
    const ext = path.extname(file.originalname || '').toLowerCase()
    cb(null, `${Date.now()}-${require('crypto').randomBytes(8).toString('hex')}${ext}`)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const mime = file.mimetype || ''
    const extOk = UPLOAD_ALLOWED_EXT.includes(ext)
    const mimeOk = UPLOAD_MIME_PREFIXES.some(p => mime.startsWith(p))
    if (!extOk && !mimeOk) return cb(new Error(`不支持的文件类型: ${ext || mime}`))
    cb(null, true)
  },
})

// 年级 → 成绩表
const GRADE_TABLE = { seven: 'grade_seven', eight: 'grade_eight', nine: 'grade_nine' }

// 学校用户提交复核申请
router.post('/', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const {
      school, studentName, idCard, gradeLevel,
      attendanceScore, examScore, fitnessScore, total,
      longRun, ropeSkipping, longJump, ballSports, martialArts,
      remark,
    } = req.body

    if (!school || !studentName || !idCard || !gradeLevel) {
      return fail(res, '请填写完整信息', 400)
    }
    if (!GRADE_TABLE[gradeLevel]) return fail(res, '无效的年级', 400)

    // 学校用户只能提交本校申请（学校名以账号绑定为准，不信任前端传入）
    let targetSchool = school
    if (req.user.schoolId != null) {
      const mySchool = await resolveSchoolName(pool, req)
      if (!mySchool) return fail(res, '账号未绑定学校', 403)
      if (school !== mySchool) return fail(res, '只能提交本校的复核申请', 403)
      targetSchool = mySchool
    }

    // 同一身份证号，审核前只允许提交一次
    const [duplicates] = await pool.query(
      'SELECT id FROM grade_reconsiderations WHERE id_card = ? AND status = ?',
      [idCard, 'pending'],
    )
    if (duplicates.length > 0) {
      return fail(res, '该身份证号已有待审核的复核申请，请勿重复提交', 400)
    }

    // 自动校对（七八年级）
    let totalVerify = null
    let verifyResult = null
    if (gradeLevel === 'seven' || gradeLevel === 'eight') {
      const att = parseFloat(attendanceScore) || 0
      const exam = parseFloat(examScore) || 0
      const fit = parseFloat(fitnessScore) || 0
      const tot = parseFloat(total) || 0
      totalVerify = parseFloat((att + exam + fit).toFixed(1))
      verifyResult = Math.abs(totalVerify - tot) < 0.1 ? 1 : 0
    }

    const [result] = await pool.query(
      `INSERT INTO grade_reconsiderations
       (school, student_name, id_card, grade_level,
        attendance_score, exam_score, fitness_score, total,
        long_run, rope_skipping, long_jump, ball_sports, martial_arts,
        total_verify, verify_result, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetSchool, studentName, idCard, gradeLevel,
        attendanceScore || null, examScore || null, fitnessScore || null, total || null,
        longRun || null, ropeSkipping || null, longJump || null, ballSports || null, martialArts || null,
        totalVerify, verifyResult, remark || null],
    )

    ok(res, {
      id: result.insertId,
      totalVerify,
      verifyResult,
    }, '申请已提交')
  } catch (err) {
    console.error('[提交复核申请错误]', err)
    fail(res, '提交失败：' + err.message)
  }
})

// 上传复核证明材料
router.post('/upload-credential', authMiddleware, async (req, res) => {
  try {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, '文件大小超过限制（最大 50MB）', 400)
        return fail(res, '上传失败：' + err.message)
      }
      try {
        const pool = getPool()
        const { reconsiderationId } = req.body
        if (!reconsiderationId || !req.file) return fail(res, '缺少参数', 400)

        const [recons] = await pool.query(
          'SELECT id, school, status FROM grade_reconsiderations WHERE id = ?',
          [reconsiderationId],
        )
        if (recons.length === 0) return fail(res, '申请不存在', 404)

        // 学校用户只能给自己学校的申请上传材料
        const valid = await validateSchoolAccess(pool, req, recons[0].school)
        if (!valid) return fail(res, '权限不足：只能为本校申请上传材料', 403)

        const [result] = await pool.query(
          `INSERT INTO grade_credentials (grade_level, student_record_id, file_name, file_path, file_size, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['recon', String(reconsiderationId), req.file.originalname, req.file.path, req.file.size, req.user?.username || 'unknown'],
        )

        await pool.query('UPDATE grade_reconsiderations SET credential_id = ? WHERE id = ?', [result.insertId, reconsiderationId])

        ok(res, { credentialId: result.insertId, fileName: req.file.originalname }, '上传成功')
      } catch (innerErr) {
        console.error('[上传证明材料错误]', innerErr)
        fail(res, '上传失败')
      }
    })
  } catch (err) {
    console.error('[上传证明材料错误]', err)
    fail(res, '上传失败')
  }
})

// 管理员获取复核申请列表（仅管理员）
router.get('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const pool = getPool()
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20))
    const status = (req.query.status || '').trim()
    const school = (req.query.school || '').trim()

    let where = 'WHERE 1=1'
    const params = []
    if (status) { where += ' AND r.status = ?'; params.push(status) }
    if (school) { where += ' AND r.school = ?'; params.push(school) }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM grade_reconsiderations r ${where}`, params,
    )
    const total = countRows[0].total
    const offset = (page - 1) * pageSize

    const [rows] = await pool.query(
      `SELECT r.*, gc.file_name AS credential_name
       FROM grade_reconsiderations r
       LEFT JOIN grade_credentials gc ON r.credential_id = gc.id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
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
    console.error('[获取复核列表错误]', err)
    fail(res, '获取列表失败')
  }
})

// 根据身份证号查询系统已有成绩
router.get('/check/:idCard', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const idCard = req.params.idCard
    const identityId = idCard.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

    const queries = [
      { table: 'grade_seven', label: '七年级' },
      { table: 'grade_eight', label: '八年级' },
      { table: 'grade_nine', label: '九年级' },
      { table: 'admission', label: '中招' },
    ]

    const results = []
    for (const { table, label } of queries) {
      const [rows] = await pool.query(
        `SELECT * FROM ${table} WHERE identity_id = ? OR id_card = ?`,
        [identityId, idCard],
      )
      if (rows.length === 0) continue

      // 学校用户只能看到本校学生的记录
      if (req.user.schoolId != null) {
        const mySchool = await resolveSchoolName(pool, req)
        const own = rows.filter(r => r.school === mySchool)
        if (own.length === 0) continue
        results.push({ grade: label, table, records: own })
      } else {
        results.push({ grade: label, table, records: rows })
      }
    }

    ok(res, { found: results.length > 0, results })
  } catch (err) {
    console.error('[查询学生成绩错误]', err)
    fail(res, '查询失败')
  }
})

// 学校用户获取本校申请列表
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const schoolName = await resolveSchoolName(pool, req)
    if (!schoolName) return fail(res, '仅学校用户可查看', 403)
    const [rows] = await pool.query(
      'SELECT * FROM grade_reconsiderations WHERE school = ? ORDER BY created_at DESC',
      [schoolName],
    )
    ok(res, snakeToCamel(rows))
  } catch (err) {
    console.error('[获取本校申请错误]', err)
    fail(res, '获取列表失败')
  }
})

/**
 * 管理员标记已处理
 * 审核通过时把申请中的分数真正写回成绩表，并把成绩置为已发布
 */
router.put('/:id/approve', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_reconsiderations' }), async (req, res) => {
  const connection = await getPool().getConnection()
  try {
    const { id } = req.params
    const [existing] = await connection.query('SELECT * FROM grade_reconsiderations WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '申请不存在', 404)
    const recon = existing[0]

    await connection.beginTransaction()

    // 回写成绩表
    const table = GRADE_TABLE[recon.grade_level]
    let updated = 0
    if (table) {
      const identityId = recon.id_card.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      const sets = []
      const params = []
      const push = (col, val) => { if (val !== null && val !== undefined) { sets.push(`${col} = ?`); params.push(val) } }

      push('attendance_score', recon.attendance_score)
      push('exam_score', recon.exam_score)
      push('fitness_score', recon.fitness_score)
      push('total', recon.total)
      push('total_verify', recon.total_verify)
      push('verify_result', recon.verify_result)
      push('long_run', recon.long_run)
      push('rope_skipping', recon.rope_skipping)
      push('long_jump', recon.long_jump)
      push('ball_sports', recon.ball_sports)
      push('martial_arts', recon.martial_arts)
      sets.push("review_status = 'published'")
      sets.push("review_remark = ?")
      params.push(`复核通过，由 ${req.user?.username || 'admin'} 审核`)

      const [result] = await connection.query(
        `UPDATE ${table} SET ${sets.join(', ')}
         WHERE identity_id = ? AND school = ?`,
        [...params, identityId, recon.school],
      )
      updated = result.affectedRows
    }

    await connection.query(
      'UPDATE grade_reconsiderations SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      ['approved', req.user?.username || 'admin', id],
    )
    await connection.commit()

    ok(res, {
      updated,
      _audit: {
        summary: `复核通过【${recon.school} - ${recon.student_name}】，回写成绩 ${updated} 条`,
      },
    }, updated > 0 ? '已通过，成绩已更新' : '已通过（未找到对应成绩记录）')
  } catch (err) {
    await connection.rollback()
    console.error('[审批错误]', err)
    fail(res, '操作失败')
  } finally {
    connection.release()
  }
})

// 管理员驳回
router.put('/:id/reject', authMiddleware, requireAdmin, auditMiddleware({ operationType: 'update', targetTable: 'grade_reconsiderations' }), async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const reason = (req.body?.reason || '').trim()

    const [existing] = await pool.query('SELECT * FROM grade_reconsiderations WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '申请不存在', 404)
    const recon = existing[0]

    await pool.query(
      'UPDATE grade_reconsiderations SET status = ?, reviewed_by = ?, reviewed_at = NOW(), remark = ? WHERE id = ?',
      ['rejected', req.user?.username || 'admin', reason || recon.remark, id],
    )

    ok(res, {
      _audit: {
        summary: `复核驳回【${recon.school} - ${recon.student_name}】${reason ? '：' + reason : ''}`,
      },
    }, '已驳回')
  } catch (err) {
    console.error('[驳回错误]', err)
    fail(res, '操作失败')
  }
})

module.exports = router

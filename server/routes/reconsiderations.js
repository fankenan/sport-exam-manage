/**
 * 成绩复核路由
 * - 学校用户提交复核申请
 * - 管理员查看和处理申请
 */
const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { ok, fail } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { getPool } = require('../db')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
  }
})
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } })

// 学校用户提交复核申请
router.post('/', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const {
      school, studentName, idCard, gradeLevel,
      attendanceScore, examScore, fitnessScore, total,
      longRun, ropeSkipping, longJump, ballSports, martialArts,
      remark
    } = req.body

    if (!school || !studentName || !idCard || !gradeLevel) {
      return fail(res, '请填写完整信息', 400)
    }

    // 学校用户只能提交本校申请
    if (req.user.schoolId != null && req.user.schoolName !== school) {
      return fail(res, '只能提交本校的复核申请', 403)
    }

    // 同一身份证号，审核前只允许提交一次
    const [duplicates] = await pool.query(
      'SELECT id FROM grade_reconsiderations WHERE id_card = ? AND status = ?',
      [idCard, 'pending']
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
      [school, studentName, idCard, gradeLevel,
        attendanceScore || null, examScore || null, fitnessScore || null, total || null,
        longRun || null, ropeSkipping || null, longJump || null, ballSports || null, martialArts || null,
        totalVerify, verifyResult, remark || null]
    )

    ok(res, {
      id: result.insertId,
      totalVerify,
      verifyResult
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
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, '文件大小超过限制', 400)
        return fail(res, '上传失败：' + err.message)
      }
      try {
        const pool = getPool()
        const { reconsiderationId } = req.body
        if (!reconsiderationId || !req.file) return fail(res, '缺少参数', 400)

        // 保存到 grade_credentials 表（复用现有表）
        const [result] = await pool.query(
          `INSERT INTO grade_credentials (grade_level, student_record_id, file_name, file_path, file_size, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          ['recon', String(reconsiderationId), req.file.originalname, req.file.path, req.file.size, req.user?.username || 'unknown']
        )

        // 关联到复核申请
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

// 管理员获取复核申请列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const [rows] = await pool.query(
      `SELECT r.*, gc.file_name AS credential_name, gc.file_path AS credential_path
       FROM grade_reconsiderations r
       LEFT JOIN grade_credentials gc ON r.credential_id = gc.id
       ORDER BY r.created_at DESC`
    )
    ok(res, rows)
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
      { table: 'grade_seven', label: '七年级', hasIdCard: true },
      { table: 'grade_eight', label: '八年级', hasIdCard: true },
      { table: 'grade_nine', label: '九年级', hasIdCard: true },
      { table: 'admission', label: '中招', hasIdCard: false },
    ]

    const results = []
    for (const { table, label, hasIdCard } of queries) {
      const where = hasIdCard
        ? 'WHERE identity_id = ? OR id_card = ?'
        : 'WHERE identity_id = ?'
      const params = hasIdCard ? [identityId, idCard] : [identityId]
      const [rows] = await pool.query(`SELECT * FROM ${table} ${where}`, params)
      if (rows.length > 0) {
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
    if (!req.user.schoolName) return fail(res, '仅学校用户可查看', 403)
    const [rows] = await pool.query(
      'SELECT * FROM grade_reconsiderations WHERE school = ? ORDER BY created_at DESC',
      [req.user.schoolName]
    )
    ok(res, rows)
  } catch (err) {
    console.error('[获取本校申请错误]', err)
    fail(res, '获取列表失败')
  }
})

// 管理员标记已处理
router.put('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const [existing] = await pool.query('SELECT * FROM grade_reconsiderations WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '申请不存在', 404)

    await pool.query(
      'UPDATE grade_reconsiderations SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      ['approved', req.user?.username || 'admin', id]
    )
    ok(res, {}, '已标记为已处理')
  } catch (err) {
    console.error('[审批错误]', err)
    fail(res, '操作失败')
  }
})

// 管理员驳回
router.put('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const [existing] = await pool.query('SELECT * FROM grade_reconsiderations WHERE id = ?', [id])
    if (existing.length === 0) return fail(res, '申请不存在', 404)

    await pool.query(
      'UPDATE grade_reconsiderations SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      ['rejected', req.user?.username || 'admin', id]
    )
    ok(res, {}, '已驳回')
  } catch (err) {
    console.error('[驳回错误]', err)
    fail(res, '操作失败')
  }
})

module.exports = router

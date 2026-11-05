/**
 * 凭证管理路由
 * 凭证归属校验：学校账号只能操作本校学生 / 本校申请的凭证
 */
const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { ok, fail } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { validateSchoolAccess, resolveSchoolName } = require('../middleware/rbac')
const { getPool } = require('../db')
const { UPLOAD_ALLOWED_EXT, UPLOAD_MIME_PREFIXES } = require('../constants')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`)
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

const GRADE_TABLE = { seven: 'grade_seven', eight: 'grade_eight', nine: 'grade_nine' }

/**
 * 解析凭证归属的学校
 * - grade_level 为 seven/eight/nine：从对应成绩表取记录的学校
 * - grade_level 为 recon：从复核申请表取学校
 */
async function resolveCredentialSchool(pool, credential) {
  if (credential.grade_level === 'recon') {
    const [recon] = await pool.query(
      'SELECT school FROM grade_reconsiderations WHERE id = ?',
      [credential.student_record_id],
    )
    return recon.length > 0 ? recon[0].school : null
  }
  const table = GRADE_TABLE[credential.grade_level]
  if (!table) return null
  const [rows] = await pool.query(`SELECT school FROM ${table} WHERE id = ?`, [credential.student_record_id])
  return rows.length > 0 ? rows[0].school : null
}

// 上传修改凭证
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, '文件大小超过限制（最大 50MB）', 400)
        return fail(res, '上传失败：' + err.message)
      }
      try {
        const pool = getPool()
        const { grade, recordId } = req.body
        if (!grade || !recordId || !req.file) return fail(res, '缺少参数', 400)

        // 归属校验：学校账号只能覆盖本校学生的凭证
        if (req.user.schoolId != null) {
          const mySchool = await resolveSchoolName(pool, req)
          if (!mySchool) return fail(res, '账号未绑定学校', 403)

          if (grade === 'recon') {
            const [recon] = await pool.query(
              'SELECT school FROM grade_reconsiderations WHERE id = ?', [recordId],
            )
            if (recon.length === 0) return fail(res, '申请不存在', 404)
            if (recon[0].school !== mySchool) return fail(res, '权限不足：只能为本校申请上传凭证', 403)
          } else {
            const table = GRADE_TABLE[grade]
            if (!table) return fail(res, '无效的年级', 400)
            const [rows] = await pool.query(`SELECT school FROM ${table} WHERE id = ?`, [recordId])
            if (rows.length === 0) return fail(res, '成绩记录不存在', 404)
            if (rows[0].school !== mySchool) return fail(res, '权限不足：只能为本校学生上传凭证', 403)
          }
        }

        const [existing] = await pool.query(
          'SELECT file_path FROM grade_credentials WHERE grade_level = ? AND student_record_id = ?',
          [grade, recordId],
        )
        if (existing.length > 0) {
          const oldPath = existing[0].file_path
          if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
          await pool.query('DELETE FROM grade_credentials WHERE grade_level = ? AND student_record_id = ?', [grade, recordId])
        }

        await pool.query(
          'INSERT INTO grade_credentials (grade_level, student_record_id, file_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [grade, recordId, req.file.originalname, req.file.path, req.file.size, req.user?.username || 'admin'],
        )

        ok(res, { fileName: req.file.originalname }, '凭证上传成功')
      } catch (innerErr) {
        console.error('[上传凭证错误]', innerErr)
        fail(res, '上传失败')
      }
    })
  } catch (err) {
    console.error('[上传凭证错误]', err)
    fail(res, '上传失败')
  }
})

// 下载凭证
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const [rows] = await pool.query('SELECT * FROM grade_credentials WHERE id = ?', [id])
    if (rows.length === 0) return fail(res, '凭证不存在', 404)

    const file = rows[0]

    // 归属校验
    if (req.user.schoolId != null) {
      const ownerSchool = await resolveCredentialSchool(pool, file)
      const valid = await validateSchoolAccess(pool, req, ownerSchool)
      if (!valid) return fail(res, '权限不足：只能下载本校凭证', 403)
    }

    if (!file.file_path || !fs.existsSync(file.file_path)) return fail(res, '凭证文件已被删除', 404)

    // 如果是复核申请的凭证，生成有意义文件名
    let downloadName = file.file_name
    if (file.grade_level === 'recon' && file.student_record_id) {
      const [recon] = await pool.query(
        'SELECT school, student_name, id_card, grade_level FROM grade_reconsiderations WHERE id = ?',
        [file.student_record_id],
      )
      if (recon.length > 0) {
        const r = recon[0]
        const gradeMap = { seven: '七年级', eight: '八年级', nine: '九年级' }
        const gradeLabel = gradeMap[r.grade_level] || r.grade_level
        const ext = path.extname(file.file_name)
        downloadName = `${r.school}-${r.student_name}-${gradeLabel}${ext}`
      }
    }

    res.setHeader('Content-Type', 'application/octet-stream')
    const encoded = encodeURIComponent(downloadName)
    res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`)
    res.sendFile(path.resolve(file.file_path))
  } catch (err) {
    console.error('[下载凭证错误]', err)
    fail(res, '下载失败')
  }
})

// 获取某条记录的凭证信息
router.get('/info', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { grade, recordId } = req.query
    if (!grade || !recordId) return fail(res, '缺少参数', 400)

    const [rows] = await pool.query(
      'SELECT id, file_name, file_size, created_at FROM grade_credentials WHERE grade_level = ? AND student_record_id = ? ORDER BY created_at DESC LIMIT 1',
      [grade, recordId],
    )
    const info = rows[0] || null

    // 归属校验
    if (info && req.user.schoolId != null) {
      const ownerSchool = await resolveCredentialSchool(pool, { grade_level: grade, student_record_id: recordId })
      const valid = await validateSchoolAccess(pool, req, ownerSchool)
      if (!valid) return fail(res, '权限不足：只能查看本校凭证', 403)
    }

    ok(res, info)
  } catch (err) {
    console.error('[获取凭证信息错误]', err)
    fail(res, '获取失败')
  }
})

module.exports = router

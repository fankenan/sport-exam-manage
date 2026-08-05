/**
 * 凭证管理路由
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

// 上传修改凭证
router.post('/upload', authMiddleware, async (req, res) => {
  try {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, '文件大小超过限制', 400)
        return fail(res, '上传失败：' + err.message)
      }
      try {
        const pool = getPool()
        const { grade, recordId } = req.body
        if (!grade || !recordId || !req.file) return fail(res, '缺少参数', 400)

        const [existing] = await pool.query(
          'SELECT file_path FROM grade_credentials WHERE grade_level = ? AND student_record_id = ?',
          [grade, recordId]
        )
        if (existing.length > 0) {
          const oldPath = existing[0].file_path
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
          await pool.query('DELETE FROM grade_credentials WHERE grade_level = ? AND student_record_id = ?', [grade, recordId])
        }

        await pool.query(
          'INSERT INTO grade_credentials (grade_level, student_record_id, file_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [grade, recordId, req.file.originalname, req.file.path, req.file.size, req.user?.username || 'admin']
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
    if (!fs.existsSync(file.file_path)) return fail(res, '凭证文件已被删除', 404)

    // 如果是复核申请的凭证，生成有意义文件名
    let downloadName = file.file_name
    if (file.grade_level === 'recon' && file.student_record_id) {
      const [recon] = await pool.query('SELECT school, student_name, id_card, grade_level FROM grade_reconsiderations WHERE id = ?', [file.student_record_id])
      if (recon.length > 0) {
        const r = recon[0]
        const gradeMap = { seven: '七年级', eight: '八年级', nine: '九年级' }
        const gradeLabel = gradeMap[r.grade_level] || r.grade_level
        const ext = path.extname(file.file_name)
        downloadName = `${r.school}-${r.student_name}-${r.id_card}-${gradeLabel}${ext}`
      }
    }
    // 中文文件名兼容处理
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
      [grade, recordId]
    )
    ok(res, rows[0] || null)
  } catch (err) {
    console.error('[获取凭证信息错误]', err)
    fail(res, '获取失败')
  }
})

module.exports = router

/**
 * 材料管理路由
 */
const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { ok, fail } = require('../utils')
const { authMiddleware } = require('../middleware/auth')
const { schoolFilter, validateSchoolAccess } = require('../middleware/rbac')
const { getPool } = require('../db')
const { auditMiddleware } = require('../auditMiddleware')

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

// 获取材料列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { year } = req.query
    if (!year) return fail(res, '请选择毕业年份', 400)

    let sql = 'SELECT id, school, graduation_year, file_name, file_size, uploaded_by, created_at FROM materials WHERE graduation_year = ?'
    const params = [year]

    const filter = schoolFilter(req)
    sql += filter.clause
    params.push(...filter.params)
    sql += ' ORDER BY school ASC'

    const [rows] = await pool.query(sql, params)
    ok(res, rows)
  } catch (err) {
    console.error('[获取材料列表错误]', err)
    fail(res, '获取材料列表失败')
  }
})

// 上传材料
router.post('/upload', authMiddleware, auditMiddleware({ operationType: 'create', targetTable: 'materials' }), async (req, res) => {
  try {
    upload.single('file')(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') return fail(res, '文件大小超过限制', 400)
        return fail(res, '上传失败：' + err.message)
      }
      try {
        const pool = getPool()
        let { school, year } = req.body
        if (!school || !year) return fail(res, '缺少学校或年份参数', 400)
        if (!req.file) return fail(res, '请选择文件', 400)

        // 学校用户：强制使用自己的学校名
        if (req.user && req.user.schoolId != null) {
          if (req.user.schoolName) {
            school = req.user.schoolName
          }
        }

        // 学校用户：校验是否匹配
        if (req.user && req.user.schoolId != null && req.user.schoolName) {
          if (school !== req.user.schoolName) {
            return fail(res, '权限不足：只能上传本校材料', 403)
          }
        }

        const [existing] = await pool.query(
          'SELECT file_path FROM materials WHERE school = ? AND graduation_year = ?',
          [school, year]
        )
        if (existing.length > 0) {
          const oldPath = existing[0].file_path
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
          await pool.query('DELETE FROM materials WHERE school = ? AND graduation_year = ?', [school, year])
        }

        await pool.query(
          'INSERT INTO materials (school, graduation_year, file_name, file_path, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
          [school, year, req.file.originalname, req.file.path, req.file.size, req.user?.username || 'admin']
        )

        ok(res, { fileName: req.file.originalname, fileSize: req.file.size }, '上传成功')
      } catch (innerErr) {
        console.error('[上传材料错误]', innerErr)
        fail(res, '上传失败')
      }
    })
  } catch (err) {
    console.error('[上传材料错误]', err)
    fail(res, '上传失败')
  }
})

// 下载材料
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const [rows] = await pool.query('SELECT * FROM materials WHERE id = ?', [id])
    if (rows.length === 0) return fail(res, '文件不存在', 404)

    const file = rows[0]
    if (!fs.existsSync(file.file_path)) return fail(res, '文件已被删除', 404)

    res.download(file.file_path, file.file_name)
  } catch (err) {
    console.error('[下载材料错误]', err)
    fail(res, '下载失败')
  }
})

// 删除材料
router.delete('/:id', authMiddleware, auditMiddleware({ operationType: 'delete', targetTable: 'materials' }), async (req, res) => {
  try {
    const pool = getPool()
    const { id } = req.params
    const [rows] = await pool.query('SELECT file_path, school, graduation_year, file_name FROM materials WHERE id = ?', [id])
    if (rows.length === 0) return fail(res, '文件不存在', 404)

    const file = rows[0]

    // 学校用户校验归属
    if (req.user && req.user.schoolId != null) {
      const valid = await validateSchoolAccess(pool, req, file.school)
      if (!valid) return fail(res, '权限不足：只能删除本校材料', 403)
    }

    if (fs.existsSync(file.file_path)) fs.unlinkSync(file.file_path)
    await pool.query('DELETE FROM materials WHERE id = ?', [id])

    ok(res, { _audit: { summary: `删除材料【${file.school}】${file.graduation_year}届 - ${file.file_name}` } }, '删除成功')
  } catch (err) {
    console.error('[删除材料错误]', err)
    fail(res, '删除失败')
  }
})

module.exports = router

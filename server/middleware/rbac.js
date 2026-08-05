/**
 * RBAC 中间件
 * - 管理员 (schoolId === null / undefined): 全部权限
 * - 学校用户 (schoolId !== null): 仅本校数据
 */

// 返回 SQL WHERE 片段和参数，自动为用户过滤本校数据
function schoolFilter(req) {
  if (req.user && req.user.schoolId != null) {
    return {
      clause: ' AND school = (SELECT name FROM schools WHERE id = ?)',
      params: [req.user.schoolId]
    }
  }
  return { clause: '', params: [] }
}

// 仅管理员可访问
function requireAdmin(req, res, next) {
  if (req.user && req.user.schoolId != null) {
    return res.status(403).json({ code: 403, message: '权限不足：仅管理员可访问' })
  }
  next()
}

// 校验学校用户是否可访问目标学校
function checkSchoolAccess(req, targetSchool) {
  if (req.user && req.user.schoolId != null) {
    // 需要通过 schoolId 查找学校名称来比对
    return false // 默认拒绝，由调用方通过查库判定
  }
  return true // 管理员全部通过
}

// 通过 schoolId 验证是否匹配目标学校名称
async function validateSchoolAccess(pool, req, targetSchool) {
  if (req.user && req.user.schoolId != null) {
    const [rows] = await pool.query('SELECT name FROM schools WHERE id = ?', [req.user.schoolId])
    if (rows.length === 0) return false
    return rows[0].name === targetSchool
  }
  return true // 管理员
}

module.exports = { schoolFilter, requireAdmin, checkSchoolAccess, validateSchoolAccess }

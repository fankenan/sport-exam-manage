/**
 * RBAC 中间件
 * - 管理员 (schoolId === null / undefined): 全部权限
 * - 学校用户 (schoolId !== null): 仅本校数据
 */

/**
 * 解析当前用户所属学校名称
 *
 * 每次请求按主键查一次 schools（表极小，代价可忽略），
 * 好处是学校改名后无需重新登录即可继续访问，且避免把学校名写死进 JWT。
 *
 * @returns {Promise<string|null>} 管理员返回 null
 */
async function resolveSchoolName(pool, req) {
  if (!req.user || req.user.schoolId == null) return null
  const [rows] = await pool.query('SELECT name FROM schools WHERE id = ?', [req.user.schoolId])
  return rows.length > 0 ? rows[0].name : null
}

/**
 * 返回 SQL WHERE 片段和参数，自动为用户过滤本校数据
 *
 * 用一次解析后的等值条件替代相关子查询
 * `school = (SELECT name FROM schools WHERE id = ?)`，
 * 让过滤能直接命中 (school, graduation_year) 复合索引。
 */
async function schoolFilter(pool, req) {
  const schoolName = await resolveSchoolName(pool, req)
  if (schoolName === null) return { clause: '', params: [], schoolName: null }
  // 学校账号查不到对应学校记录时，返回恒假条件而不是放行全部数据
  if (schoolName === undefined) return { clause: ' AND 1 = 0', params: [], schoolName: null }
  return { clause: ' AND school = ?', params: [schoolName], schoolName }
}

// 仅管理员可访问
function requireAdmin(req, res, next) {
  if (req.user && req.user.schoolId != null) {
    return res.status(403).json({ code: 403, message: '权限不足：仅管理员可访问' })
  }
  next()
}

// 仅学校账号可访问
function requireSchoolUser(req, res, next) {
  if (!req.user || req.user.schoolId == null) {
    return res.status(403).json({ code: 403, message: '权限不足：仅学校账号可访问' })
  }
  next()
}

/**
 * 校验学校用户是否可访问目标学校
 * 管理员一律通过；学校账号必须与目标学校完全一致
 */
async function validateSchoolAccess(pool, req, targetSchool) {
  if (req.user && req.user.schoolId != null) {
    const schoolName = await resolveSchoolName(pool, req)
    if (!schoolName) return false
    return schoolName === targetSchool
  }
  return true // 管理员
}

module.exports = {
  schoolFilter,
  requireAdmin,
  requireSchoolUser,
  validateSchoolAccess,
  resolveSchoolName,
}

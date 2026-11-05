/**
 * 工具函数
 */

// 统一成功响应
function ok(res, data = {}, message = 'success') {
  res.json({ code: 200, data, message })
}

/**
 * 统一失败响应
 * 同时设置真实的 HTTP 状态码，便于前端与网关正确识别（不再一律返回 200）
 */
function fail(res, message = '操作失败', code = 500, data = null) {
  const body = { code, message }
  if (data) body.data = data
  // 允许调用方指定 HTTP 状态码，默认与业务 code 保持一致
  const httpStatus = code >= 400 && code <= 599 ? code : 500
  res.status(httpStatus).json(body)
}

// snake_case 转 camelCase
function snakeToCamel(obj) {
  if (!obj) return obj
  if (Array.isArray(obj)) return obj.map(snakeToCamel)
  if (typeof obj !== 'object') return obj
  // Date → 本地时间字符串（不要用 toISOString，那是 UTC，会比库里存的北京时间差 8 小时）
  if (obj instanceof Date) return formatLocalDateTime(obj)
  const result = {}
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camelKey] = snakeToCamel(obj[key])
  }
  return result
}

/**
 * 把 Date 格式化为本地时间字符串 'YYYY-MM-DD HH:mm:ss'
 */
function formatLocalDateTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return String(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// camelCase 转 snake_case
function camelToSnake(obj) {
  if (!obj) return obj
  if (Array.isArray(obj)) return obj.map(camelToSnake)
  if (typeof obj !== 'object') return obj
  if (obj instanceof Date) return obj.toISOString().replace('T', ' ').substring(0, 19)
  const result = {}
  for (const key of Object.keys(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
    let val = obj[key]
    if (typeof val === 'boolean') val = val ? 1 : 0
    result[snakeKey] = val
  }
  return result
}

// 合法列名（防止 SQL 标识符注入）
const COLUMN_NAME_RE = /^[a-z_][a-z0-9_]*$/

/**
 * 从对象中挑出白名单字段，并转换为 snake_case
 *
 * 这是所有"用户输入拼进 SQL"的地方的唯一入口：
 * 只有白名单内的键、且键名通过标识符校验，才允许进入 SQL。
 *
 * @param {object} obj 原始对象（通常是 req.body）
 * @param {string[]} allowed 白名单列名（snake_case）
 * @param {string[]} [exclude] 需要额外排除的列（如主键）
 * @returns {object} 形如 { columns: string[], values: any[] }
 */
function pickAllowed(obj, allowed, exclude = []) {
  const snake = camelToSnake(obj || {})
  const columns = []
  const values = []
  for (const key of Object.keys(snake)) {
    if (!allowed.includes(key)) continue
    if (exclude.includes(key)) continue
    if (!COLUMN_NAME_RE.test(key)) continue
    columns.push(key)
    values.push(snake[key] === undefined ? null : snake[key])
  }
  return { columns, values }
}

/**
 * 构造 WHERE 片段与参数，把过滤条件限制在白名单列上
 * @param {object} filters 形如 { school: 'x', graduationYear: '2026' }
 * @param {string[]} allowed 允许参与过滤的列（snake_case）
 */
function buildWhere(filters, allowed) {
  let where = 'WHERE 1=1'
  const params = []
  for (const key of Object.keys(filters || {})) {
    if (!allowed.includes(key)) continue
    const value = filters[key]
    if (value === undefined || value === null || value === '') continue
    where += ` AND ${key} = ?`
    params.push(value)
  }
  return { where, params }
}

/**
 * 生成本地时间字符串（YYYY-MM-DD HH:mm:ss），用于写入 DATETIME 列
 */
function nowString() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

module.exports = { ok, fail, snakeToCamel, camelToSnake, pickAllowed, buildWhere, nowString, formatLocalDateTime, COLUMN_NAME_RE }

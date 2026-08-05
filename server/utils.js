/**
 * 工具函数
 */

function ok(res, data = {}, message = 'success') {
  res.json({ code: 200, data, message })
}

function fail(res, message = '操作失败', code = 500, data = null) {
  const body = { code, message }
  if (data) body.data = data
  res.json(body)
}

// snake_case 转 camelCase
function snakeToCamel(obj) {
  if (!obj) return obj
  if (Array.isArray(obj)) return obj.map(snakeToCamel)
  if (typeof obj !== 'object') return obj
  if (obj instanceof Date) return obj.toISOString().replace('T', ' ').substring(0, 19)
  const result = {}
  for (const key of Object.keys(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camelKey] = snakeToCamel(obj[key])
  }
  return result
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

module.exports = { ok, fail, snakeToCamel, camelToSnake }

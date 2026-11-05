/**
 * 日期时间格式化
 *
 * 后端返回两种可能：
 *   1. 'YYYY-MM-DD HH:mm:ss' —— 业务本地时间（DATETIME 直接按字符串返回）
 *   2. ISO 串（'2026-11-04T08:49:09.000Z'）—— UTC，需要转成本地时间再显示
 *
 * 统一在这里处理，页面里不再各自写 replace('T', ' ')。
 */

/** 是否是 'YYYY-MM-DD HH:mm:ss' 形态的业务时间字符串 */
const LOCAL_DATETIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/

/**
 * 格式化为 'YYYY-MM-DD HH:mm:ss'
 * @param value 后端返回的时间值
 * @param fallback 空值时的占位
 */
export function formatDateTime(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback

  const s = String(value)

  // 业务本地时间：原样使用
  if (LOCAL_DATETIME_RE.test(s)) return s.replace('T', ' ').substring(0, 19)

  // ISO / UTC：转成本地时间
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 只取日期部分 'YYYY-MM-DD' */
export function formatDate(value: unknown, fallback = '—'): string {
  const s = formatDateTime(value, fallback)
  return s === fallback ? fallback : s.substring(0, 10)
}

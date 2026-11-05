/**
 * 表格列宽计算工具
 *
 * 背景（Element Plus 的一个坑）：
 *   当表格总宽超过容器宽度时，el-table 的布局逻辑会执行
 *   `column.realWidth = Number(column.minWidth)`。
 *   只设置了 `width` 而没有设置 `minWidth` 的列会得到 NaN，
 *   列宽塌缩 → 单元格内容换行。
 *
 *   因此这里的约定是：**width 与 minWidth 必须成对设置**，
 *   并且 width 由内容实测得出，保证「内容一行显示得下」。
 */

/** 是否为全角字符（中日韩文字、全角标点等） */
function isFullWidth(ch: string): boolean {
  const code = ch.codePointAt(0) || 0
  return (
    (code >= 0x1100 && code <= 0x115f) ||   // 韩文字母
    (code >= 0x2e80 && code <= 0x303e) ||   // CJK 部首、标点
    (code >= 0x3041 && code <= 0x33ff) ||   // 假名、CJK 兼容
    (code >= 0x3400 && code <= 0x4dbf) ||   // 扩展 A
    (code >= 0x4e00 && code <= 0x9fff) ||   // 基本汉字
    (code >= 0xa000 && code <= 0xa4cf) ||   // 彝文
    (code >= 0xac00 && code <= 0xd7a3) ||   // 韩文音节
    (code >= 0xf900 && code <= 0xfaff) ||   // 兼容汉字
    (code >= 0xfe30 && code <= 0xfe6f) ||   // 竖排标点
    (code >= 0xff00 && code <= 0xff60) ||   // 全角 ASCII
    (code >= 0xffe0 && code <= 0xffe6)
  )
}

/**
 * 估算一段文本渲染后的宽度（px）
 *
 * 这是无 DOM 环境下的兜底估算；浏览器里优先用 canvas 实测（见 measureText）。
 */
export function estimateTextWidth(text: unknown, fontSize = 13): number {
  const s = text === null || text === undefined ? '' : String(text)
  if (!s) return 0
  let units = 0
  for (const ch of s) {
    units += isFullWidth(ch) ? 1 : 0.55
  }
  return Math.ceil(units * fontSize * 1.1)
}

/** 与正文一致的字体栈 */
const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, ' +
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'

let measureCtx: CanvasRenderingContext2D | null = null

/**
 * 用 canvas 实测文本宽度（浏览器里精确得多，避免估算偏差导致换行）
 */
export function measureText(text: unknown, fontSize = 13, fontWeight = 400): number {
  const s = text === null || text === undefined ? '' : String(text)
  if (!s) return 0
  if (typeof document === 'undefined') return estimateTextWidth(s, fontSize)
  try {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d')
    }
    if (!measureCtx) return estimateTextWidth(s, fontSize)
    measureCtx.font = `${fontWeight} ${fontSize}px ${FONT_STACK}`
    return Math.ceil(measureCtx.measureText(s).width)
  } catch {
    return estimateTextWidth(s, fontSize)
  }
}

export interface AutoColumn {
  prop?: string
  label?: string
  width?: number | string
  minWidth?: number | string
  align?: string
  fixed?: boolean | string
  [key: string]: any
}

export interface AutoWidthOptions {
  /**
   * 单元格左右内边距合计（px）
   * App.vue 把 .cell 的横向内边距收到 8px（共 16），再加 2px 边框，按 18 计算。
   */
  padding?: number
  /** 列宽下限 */
  min?: number
  /** 列宽上限 */
  max?: number
  /** 正文字号 */
  fontSize?: number
  /** 表头字号 */
  headerFontSize?: number
  /** 表格可用宽度；超出时按比例压缩 */
  availableWidth?: number
  /** 不参与自动计算（固定列、操作列等） */
  skip?: (col: AutoColumn) => boolean
  /** @deprecated 剩余空间改由 Element Plus 按 min-width 等比分配，不再需要单列吸收 */
  absorb?: string
  /**
   * 需要从可用宽度里额外扣掉的像素（模板里写死、或不在 columns 里的列，
   * 比如「序号」「操作」两列）。
   */
  reservedWidth?: number
}

/**
 * 按「表头 + 当前页数据」计算每列**至少**需要多宽（px）
 *
 * 返回值用作 el-table-column 的 min-width：
 *  - 内容放得下 → Element Plus 会把剩余空间按 min-width 等比分配，整表刚好铺满容器，
 *    不会出现「一列很宽、一列很挤」；
 *  - 内容放不下 → 这里先按比例压缩到容器宽度以内，保证一页显示（配合不换行样式）；
 *  - 用户手动拖动列宽时，被拖的列变成固定宽度，其余列按 min-width 重新分配剩余空间，
 *    右侧不会留下空白。
 */
export function computeColumnWidths(
  columns: AutoColumn[],
  rows: any[],
  options: AutoWidthOptions = {},
): Record<string, number> {
  const {
    padding = 18,
    min = 56,
    max = 360,
    fontSize = 13,
    headerFontSize = 11.5,
    availableWidth = 0,
    skip,
    reservedWidth = 0,
  } = options

  const widths: Record<string, number> = {}
  const keys: string[] = []
  let total = 0

  columns.forEach(col => {
    if (!col.prop) return
    if (skip && skip(col)) return

    // 表头宽度（加粗，比正文略宽）
    let need = measureText(col.label ?? '', headerFontSize, 600)

    for (const row of rows) {
      const v = row?.[col.prop]
      if (v === null || v === undefined) continue
      const text = typeof v === 'object' ? '' : String(v)
      need = Math.max(need, measureText(text, fontSize))
    }

    // sortable 列的表头右侧还有一个排序箭头
    const extra = col.sortable ? 14 : 0
    // 留 3px 安全余量：字体回退、缩放等差异都可能让实际宽度略大于测量值
    const SAFETY = 3

    // 列可以单独声明下限（例如模板里给值加了「届」字后缀，实测不到）
    const colMin = toPx(col.minWidth, min) ?? min

    const w = Math.min(max, Math.max(colMin, need + padding + extra + SAFETY))
    widths[col.prop] = w
    keys.push(col.prop)
    total += w
  })

  // 只有「放不下」时才介入：等比压缩到容器宽度以内，保证不换行、不横向滚动。
  // 放得下就把剩余空间交给 Element Plus 按 min-width 等比分配 —— 这样各列宽窄协调，
  // 用户拖动某一列后，其余列也会自动重新分配，右侧不会留白。
  if (availableWidth > 0 && total > 0) {
    const usable = Math.max(min, availableWidth - reservedWidth)
    if (total > usable) {
      const ratio = usable / total
      keys.forEach(k => {
        widths[k] = Math.max(min, Math.floor(widths[k] * ratio))
      })
      // 受 min 下限约束可能仍略超，再补一刀（从最宽的列开始削）
      let over = keys.reduce((s, k) => s + widths[k], 0) - usable
      const byDesc = keys.slice().sort((a, b) => widths[b] - widths[a])
      for (const k of byDesc) {
        if (over <= 0) break
        const cut = Math.min(over, Math.max(0, widths[k] - min))
        widths[k] -= cut
        over -= cut
      }
    }
  }

  return widths
}

/**
 * 把字符串形式的 width / minWidth 统一转成数字
 */
export function toPx(value: number | string | undefined, fallback?: number): number | undefined {
  if (value === undefined || value === null || value === '') return fallback
  const n = typeof value === 'number' ? value : parseInt(value, 10)
  return Number.isNaN(n) ? fallback : n
}

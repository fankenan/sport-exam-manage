/**
 * 图表配色 —— 全站唯一的图表色板
 *
 * ECharts 在 canvas 上绘制，CSS 变量无法解析，
 * 因此图表色板使用字面量，并在此集中维护，保证所有图表风格一致。
 */

export const CHART_COLORS = {
  primary: '#3b82f6',
  primaryLight: '#93c5fd',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  violet: '#8b5cf6',
  cyan: '#00b8e6',
  indigo: '#6366f1',
  slate: '#64748b',
} as const

/** 分类色板：按顺序循环取用 */
export const CATEGORY_PALETTE: string[] = [
  CHART_COLORS.primary,
  CHART_COLORS.cyan,
  CHART_COLORS.violet,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.indigo,
  CHART_COLORS.danger,
  CHART_COLORS.slate,
]

/** 按下标取色 */
export const paletteAt = (index: number) => CATEGORY_PALETTE[index % CATEGORY_PALETTE.length]

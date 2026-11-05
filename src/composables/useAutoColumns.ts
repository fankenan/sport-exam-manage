import { ref, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import { computeColumnWidths, type AutoColumn } from '@/utils/table'

/**
 * 表格列宽自适应
 *
 * - 按「表头 + 当前页数据」实测内容宽度，列宽刚好够显示且不换行
 * - 总宽超出容器时按比例压缩，保证「一页内」显示
 * - 容器尺寸变化时自动重算
 *
 * 用法：
 *   const { wrapRef, colWidth } = useAutoColumns(columns, tableData)
 *   <div ref="wrapRef"><el-table-column :width="colWidth(col.prop)" :min-width="colWidth(col.prop)" /></div>
 */
export function useAutoColumns(
  columns: Ref<AutoColumn[]> | (() => AutoColumn[]) | AutoColumn[],
  rows: Ref<any[]>,
  options: {
    padding?: number
    min?: number
    max?: number
    /** 不参与内容计算的列（如固定列） */
    skip?: (col: AutoColumn) => boolean
    /**
     * 吸收剩余空间的列（只给 min-width、不给 width，交给 Element Plus 弹性分配）。
     * 用于让表格铺满容器宽度，右侧不留空白。
     */
    absorb?: string
    /**
     * 模板里写死且为 fixed 的列所占宽度（sticky 叠加，会遮挡中间列）
     */
    reservedWidth?: number
  } = {},
) {
  const { padding = 18, min = 60, max = 320, skip, absorb, reservedWidth = 0 } = options

  const wrapRef = ref<HTMLElement | null>(null)
  const wrapWidth = ref(0)
  const widths = ref<Record<string, number>>({})
  /** 实测的正文 / 表头字号（从 DOM 读，避免与实际渲染不一致） */
  const fontSize = ref(13)
  const headerFontSize = ref(11.5)

  const getColumns = (): AutoColumn[] => {
    if (typeof columns === 'function') return columns()
    if (Array.isArray(columns)) return columns
    return columns.value
  }

  /** 从真实渲染结果里读字号，保证测量与显示一致 */
  const readFontSizes = () => {
    const root = wrapRef.value
    if (!root) return
    const cell = root.querySelector('.el-table__body td .cell') as HTMLElement | null
    if (cell) {
      const fs = parseFloat(getComputedStyle(cell).fontSize)
      if (!Number.isNaN(fs) && fs > 0) fontSize.value = fs
    }
    const head = root.querySelector('.el-table__header th .cell') as HTMLElement | null
    if (head) {
      const fs = parseFloat(getComputedStyle(head).fontSize)
      if (!Number.isNaN(fs) && fs > 0) headerFontSize.value = fs
    }
  }

  const recalc = () => {
    readFontSizes()
    widths.value = computeColumnWidths(getColumns(), rows.value || [], {
      availableWidth: wrapWidth.value,
      padding,
      min,
      max,
      fontSize: fontSize.value,
      headerFontSize: headerFontSize.value,
      skip,
      absorb,
      reservedWidth,
    })
  }

  /** 某列的最终宽度（px） */
  const colWidth = (prop: string): number => widths.value[prop] ?? 120

  let observer: ResizeObserver | null = null

  const attachObserver = () => {
    const el = wrapRef.value
    if (!el || observer) return
    wrapWidth.value = Math.floor(el.clientWidth)
    recalc()
    observer = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect?.width || 0)
      if (Math.abs(w - wrapWidth.value) > 4) {
        wrapWidth.value = w
        recalc()
      }
    })
    observer.observe(el)
  }

  onMounted(() => {
    attachObserver()
    recalc()
  })

  // 容器可能延迟出现（例如抽屉里的表格，元素在抽屉打开后才渲染），
  // 这里等它出现后再挂观察器并重算列宽。
  watch(wrapRef, (el) => {
    if (el) {
      attachObserver()
      recalc()
    }
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  // 数据或列定义变化后重算
  watch([rows, () => getColumns()], () => recalc(), { deep: false })

  return { wrapRef, colWidth, widths, recalc }
}

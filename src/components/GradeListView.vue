<template>
  <div class="grade-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-text">
        <h2 class="page-title">{{ props.title }}</h2>
        <p class="page-desc">{{ gradeDesc }}</p>
      </div>
      <div class="header-extra">
        <span class="mono-label">TOTAL</span>
        <span class="total-value">{{ total }}</span>
      </div>
    </div>

    <!-- 筛选工具栏 -->
    <div class="filter-section">
      <div class="filter-left">
        <el-select
          v-model="filterSchool"
          placeholder="选择学校"
          clearable
          filterable
          :disabled="authStore.isSchoolUser"
          class="w-school"
          @change="handleSearch"
        >
          <el-option v-for="school in schoolOptions" :key="school" :label="school" :value="school" />
        </el-select>

        <el-select
          v-model="filterYear"
          placeholder="选择毕业年份"
          clearable
          class="w-year"
          @change="handleSearch"
        >
          <el-option v-for="year in yearOptions" :key="year" :label="year" :value="year" />
        </el-select>

        <el-input
          v-model="searchKeyword"
          placeholder="搜索姓名或身份证号"
          clearable
          class="w-keyword"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-select
          v-if="props.grade !== 'nine'"
          v-model="verifyResult"
          placeholder="校对结果"
          clearable
          class="w-verify"
          @change="handleSearch"
        >
          <el-option label="✅ 校对正确" :value="'1'" />
          <el-option label="❌ 校对错误" :value="'0'" />
        </el-select>

        <el-select
          v-model="remarkFilter"
          placeholder="备注筛选"
          clearable
          class="w-remark"
          @change="handleSearch"
        >
          <el-option label="有备注" value="1" />
          <el-option label="无备注" value="0" />
        </el-select>
      </div>

      <div class="filter-right">
        <el-button @click="resetFilter">重置</el-button>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button
          v-if="props.importable && !authStore.isSchoolUser"
          type="primary"
          plain
          @click="gotoScoreImport"
        >
          <el-icon><Upload /></el-icon>
          导入九年级成绩
        </el-button>
        <el-button v-if="canExport" :loading="exporting" @click="exportData">
          <el-icon><Download /></el-icon>
          导出Excel
        </el-button>
      </div>
    </div>

    <!-- 表格 -->
    <div ref="tableWrapRef" class="table-section">
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        stripe
        max-height="560"
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" :width="58" :min-width="58" align="center" fixed :index="indexMethod" />
        <el-table-column
          v-for="col in props.columns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :min-width="colWidth(col.prop)"
          :align="col.align"
          :fixed="col.fixed"
          :show-overflow-tooltip="col.showOverflowTooltip"
        >
          <template v-if="col.prop === 'verifyResult'" #default="{ row }">
            <el-tag :type="row.verifyResult ? 'success' : 'danger'" size="small">
              {{ row.verifyResult ? '✅' : '❌' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="!authStore.isSchoolUser" label="操作" :width="112" :min-width="112" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDeleteRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-section">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[50, 100, 200]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑成绩" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item v-for="col in editColumns" :key="col.prop" :label="col.label">
          <!-- 学校：下拉选择 -->
          <el-select v-if="col.prop === 'school'" v-model="editForm.school" filterable style="width: 100%">
            <el-option v-for="s in schoolOptions" :key="s" :label="s" :value="s" />
          </el-select>
          <!-- 姓名：可编辑输入 -->
          <el-input v-else-if="col.prop === 'name'" v-model="editForm.name" />
          <!-- 可编辑文本（备注） -->
          <el-input
            v-else-if="col.editable && col.textarea"
            v-model="editForm[col.prop]"
            type="textarea"
            rows="2"
          />
          <!-- 可编辑数字 -->
          <el-input-number
            v-else-if="col.editable"
            v-model="editForm[col.prop]"
            :min="col.editMin ?? 0"
            :max="col.editMax ?? 100"
            :precision="col.editPrecision ?? 1"
          />
          <!-- 其他只读 -->
          <el-input v-else v-model="editForm[col.prop]" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Search, Upload } from '@element-plus/icons-vue'
import { useGradeStore } from '@/stores/grade'
import { useAuthStore } from '@/stores/auth'
import { dataApi, settingsApi } from '@/api'
import { useAutoColumns } from '@/composables/useAutoColumns'

export interface ColumnConfig {
  prop: string
  label: string
  width?: string
  minWidth?: string
  align?: string
  fixed?: boolean | string
  showOverflowTooltip?: boolean
  editable?: boolean
  editMin?: number
  editMax?: number
  editPrecision?: number
  textarea?: boolean
}

interface Props {
  title: string
  grade: 'seven' | 'eight' | 'nine'
  columns: ColumnConfig[]
  exportFileName: string
  exportSheetName: string
  /** 是否在工具栏显示「导入」入口（九年级成绩由教育局统一导入） */
  importable?: boolean
}

type GradeKey = 'seven' | 'eight' | 'nine'

/**
 * 年级 → 服务端表名 / store 方法 的唯一映射表
 * （原先散落在 5 处三路 if/else 里，这里收敛成一处）
 */
const GRADE_CONFIG = {
  seven: {
    table: 'grade_seven',
    storeKey: 'gradeSevenList',
    update: 'updateGradeSevenData',
    remove: 'deleteGradeSevenData',
    syncCache: 'setGradeSevenList',
  },
  eight: {
    table: 'grade_eight',
    storeKey: 'gradeEightList',
    update: 'updateGradeEightData',
    remove: 'deleteGradeEightData',
    syncCache: 'setGradeEightList',
  },
  nine: {
    table: 'grade_nine',
    storeKey: 'gradeNineList',
    update: 'updateGradeNineData',
    remove: 'deleteGradeNineData',
    syncCache: 'setGradeNineList',
  },
} as const

const GRADE_DESC: Record<GradeKey, string> = {
  seven: '七年级成绩采用「出勤率 + 体育考试 + 体测」三项制，由各校上报后统一校对。',
  eight: '八年级成绩采用「出勤率 + 体育考试 + 体测」三项制，由各校上报后统一校对。',
  nine: '九年级成绩采用「长跑 / 跳绳 / 跳远 / 足(篮)球 / 武术」分项制，由各校上报后统一校对。',
}

const props = defineProps<Props>()

const gradeStore = useGradeStore()
const authStore = useAuthStore()
const router = useRouter()

const loading = ref(false)
const exporting = ref(false)
const saving = ref(false)

/** 跳到成绩导入页的九年级模式 */
const gotoScoreImport = () => router.push('/grade-import?mode=score9')

/** 当前账号允许导出的表（学校账号由管理员在「系统管理」里授权） */
const exportTables = ref<string[]>([])

const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const tableData = ref<any[]>([])

// ========== 筛选条件 ==========
const filterSchool = ref(authStore.isSchoolUser ? authStore.userSchoolName : '')
const filterYear = ref('')
const searchKeyword = ref('')
const verifyResult = ref('')
const remarkFilter = ref('')

// 下拉选项（服务端提供，学校账号已按角色过滤）
const yearOptions = ref<string[]>([])
const schoolOptions = ref<string[]>([])

const editDialogVisible = ref(false)
const editForm = ref<Record<string, any>>({})
const editingId = ref('')

const cfg = computed(() => GRADE_CONFIG[props.grade])
const gradeDesc = computed(() => GRADE_DESC[props.grade])

/** 当前页面对应的表是否允许导出（服务端还会再校验一次） */
const canExport = computed(() => exportTables.value.includes(cfg.value.table))

// ========== 列宽自适应 ==========
// 目标：单元格内容永远单行显示；列宽按内容实测计算；总宽不超过容器（一页内）。
const { wrapRef: tableWrapRef, colWidth } = useAutoColumns(
  computed(() => props.columns as any[]),
  tableData,
  // 「序号」(58) 与「操作」(112) 是模板里写死的 sticky 列，会遮挡中间列，需从可用宽度里扣掉
  { padding: 18, min: 56, max: 320, reservedWidth: 170 },
)

/** 编辑弹窗展示的列：完全由 props.columns 推导，备注列始终可编辑 */
const editColumns = computed<ColumnConfig[]>(() => {
  const list: ColumnConfig[] = []
  for (const col of props.columns) {
    if (col.prop === 'remark') continue
    if (col.prop === 'school' || col.prop === 'name') {
      list.push({ ...col, editable: true })
    } else {
      list.push({ ...col })
    }
  }
  list.push({ prop: 'remark', label: '备注', editable: true, textarea: true })
  return list
})

/** 序号跨页连续 */
const indexMethod = (i: number) => (currentPage.value - 1) * pageSize.value + i + 1

// ========== store 访问器（通过映射表里的方法名调用，避免三路 if/else） ==========
type StoreBridge = Record<string, (...args: any[]) => any>

const callStore = (method: string, ...args: any[]) => {
  const bridge = gradeStore as unknown as StoreBridge
  return bridge[method](...args)
}

/** 把当前页数据写入 store 缓存：store 的 update* 需要先在缓存中定位到该行 */
const syncStoreCache = (rows: any[]) => {
  callStore(cfg.value.syncCache, rows)
}

// ========== 数据加载 ==========

/** 当前生效的筛选条件（列表查询与导出共用，保证导出的就是所见） */
const currentFilters = () => ({
  keyword: searchKeyword.value.trim() || undefined,
  graduationYear: filterYear.value || undefined,
  school: filterSchool.value || undefined,
  verifyResult: verifyResult.value || undefined,
  remark: remarkFilter.value || undefined,
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await dataApi.page(cfg.value.table, {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...currentFilters(),
    })
    tableData.value = res?.list || []
    total.value = res?.total || 0
    // 当前页写入 store 缓存，供编辑 / 删除时定位记录
    syncStoreCache(tableData.value)
  } catch (e: any) {
    tableData.value = []
    total.value = 0
    ElMessage.error(e?.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

const loadOptions = async () => {
  try {
    const [years, schools] = await Promise.all([
      dataApi.getYears(),
      // 注意：/data/schools 服务端不按年份过滤，返回的是全部年份的学校集合
      dataApi.getSchools(),
    ])
    yearOptions.value = Array.isArray(years) ? years : []
    schoolOptions.value = Array.isArray(schools) ? schools : []
  } catch {
    yearOptions.value = []
    schoolOptions.value = []
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadData()
}

const handlePageChange = () => {
  loadData()
}

const handleSizeChange = () => {
  currentPage.value = 1
  loadData()
}

const resetFilter = () => {
  filterSchool.value = authStore.isSchoolUser ? authStore.userSchoolName : ''
  filterYear.value = ''
  searchKeyword.value = ''
  verifyResult.value = ''
  remarkFilter.value = ''
  currentPage.value = 1
  loadData()
}

// ========== 编辑 ==========

const openEdit = (row: any) => {
  editingId.value = row.id
  const form: Record<string, any> = { ...row }
  // DECIMAL 字段从服务端返回的是字符串，转成数字后再交给 el-input-number
  for (const col of editColumns.value) {
    if (col.prop === 'remark' || col.prop === 'name' || col.prop === 'school') continue
    const v = form[col.prop]
    if (v !== undefined && v !== null && v !== '') form[col.prop] = Number(v)
  }
  editForm.value = form
  editDialogVisible.value = true
}

const saveEdit = async () => {
  if (!editingId.value) return

  const updateData: Record<string, any> = {}
  for (const col of editColumns.value) {
    if (!col.editable) continue
    const v = editForm.value[col.prop]
    if (v !== undefined) updateData[col.prop] = v
  }
  if (Object.keys(updateData).length === 0) {
    ElMessage.warning('没有需要保存的修改')
    return
  }

  saving.value = true
  try {
    // store 的 update* 会等待服务端写入完成，失败时抛错
    await callStore(cfg.value.update, editingId.value, updateData)
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// ========== 删除 ==========

const handleDeleteRow = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要删除 ${row.name} 的成绩记录吗？`, '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }

  try {
    await callStore(cfg.value.remove, row.id)
    ElMessage.success('删除成功')
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

// ========== 导出 ==========

/**
 * 读取当前账号的导出权限
 * 管理员可导出全部成绩表；学校账号只能导出管理员在「系统管理」里勾选授权的表。
 */
const loadExportTables = async () => {
  try {
    const res = await settingsApi.getExportTables()
    exportTables.value = Array.isArray(res?.tables) ? res.tables : []
  } catch (e: any) {
    exportTables.value = []
    ElMessage.error(e?.message || '获取导出权限失败')
  }
}

/**
 * 导出当前筛选条件下的全部数据（服务端生成 Excel）。
 * 权限由服务端强制校验，前端隐藏按钮只是界面表现。
 */
const exportData = async () => {
  if (!canExport.value) {
    ElMessage.warning('当前没有导出该成绩表的权限，请联系管理员开启')
    return
  }

  exporting.value = true
  const progress = ElMessage({ message: `正在导出「${props.exportFileName}」，请稍候…`, duration: 0, type: 'info' })
  try {
    await dataApi.export({
      table: cfg.value.table,
      filters: currentFilters(),
      columns: props.columns.map(col => ({ prop: col.prop, label: col.label })),
      sheetName: props.exportSheetName,
    })
    ElMessage.success('导出成功，文件已下载')
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败')
  } finally {
    progress.close()
    exporting.value = false
  }
}

onMounted(async () => {
  filterSchool.value = authStore.isSchoolUser ? authStore.userSchoolName : ''
  await loadExportTables()
  await loadOptions()
  await loadData()
})

// 切换年级或登录账号变化时，重新拉取导出权限
watch(() => [props.grade, authStore.user?.id], () => {
  loadExportTables()
})
</script>

<style scoped lang="scss">
.grade-page {
  @include page-container;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: $page-gap;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: $table-border;

  .page-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.2px;
  }

  .page-desc {
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .header-extra {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .total-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }
}

.filter-section {
  @include toolbar;
  border-bottom: $table-border;

  .filter-left,
  .filter-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .w-school { width: 200px; }
  .w-year { width: 140px; }
  .w-keyword { width: 220px; }
  .w-verify { width: 140px; }
  .w-remark { width: 120px; }
}

.table-section {
  // 直接显示表格本身，不再套一层卡片：外层卡片会和表格自己的 border 叠成"双层白边"
  margin-top: $page-gap;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: $page-gap;
}
</style>

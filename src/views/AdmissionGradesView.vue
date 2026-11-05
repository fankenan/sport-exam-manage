<template>
  <div class="admission-grades-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-text">
        <h2 class="page-title">中招体育成绩</h2>
        <p class="page-desc">汇总各校上报考生名单，按身份证号自动匹配七、八、九年级体育成绩并计算总分。</p>
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
          v-model="filterYear"
          placeholder="选择毕业年份"
          clearable
          class="w-year"
          @change="handleYearChange"
        >
          <el-option v-for="year in yearOptions" :key="year" :label="year" :value="year" />
        </el-select>

        <!--
          学校下拉：服务端 GET /data/schools 目前不按年份过滤（只按角色过滤），
          因此这里不做「按年份联动」，并在下拉上明确标注，避免用户误以为年份已生效。
        -->
        <el-tooltip
          content="学校列表暂不支持按毕业年份过滤（服务端限制），毕业年份仅作用于下方的数据查询"
          placement="top"
        >
          <el-select
            v-model="filterSchool"
            placeholder="全部学校"
            clearable
            filterable
            class="w-school"
            :disabled="authStore.isSchoolUser"
            @change="handleFilterChange"
          >
            <el-option v-for="school in schoolOptions" :key="school" :label="school" :value="school" />
          </el-select>
        </el-tooltip>

        <el-input
          v-model="searchKeyword"
          placeholder="搜索姓名、身份证号或报名序号"
          clearable
          class="w-keyword"
          @keyup.enter="handleSearch()"
          @clear="handleSearch()"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-select
          v-model="remarkFilter"
          placeholder="备注筛选"
          clearable
          class="w-remark"
          @change="handleSearch()"
        >
          <el-option label="有备注" value="1" />
          <el-option label="无备注" value="0" />
        </el-select>
      </div>

      <div class="filter-right">
        <el-button @click="resetFilter">重置</el-button>
        <el-button v-if="!authStore.isSchoolUser" type="success" :loading="matching" @click="matchScores">
          <el-icon><Refresh /></el-icon>
          {{ matching ? '匹配中' : '匹配成绩' }}
        </el-button>
        <el-button v-if="canExport" :loading="exporting" @click="exportData">
          <el-icon><Download /></el-icon>
          导出Excel
        </el-button>
      </div>
    </div>

    <!-- 列表 -->
    <div ref="tableWrapRef" class="table-section">
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        stripe
        max-height="560"
        style="width: 100%"
      >
        <el-table-column type="index" label="序号" :width="56" :min-width="56" align="center" fixed :index="indexMethod" />
        <el-table-column prop="identityId" label="身份ID" :min-width="colWidth('identityId')" show-overflow-tooltip fixed />
        <el-table-column prop="school" label="学校名称" :min-width="colWidth('school')" show-overflow-tooltip fixed />
        <el-table-column prop="name" label="姓名" :min-width="colWidth('name')" align="center" fixed />
        <el-table-column prop="registrationNumber" label="报名序号" :min-width="colWidth('registrationNumber')" show-overflow-tooltip />
        <el-table-column prop="graduationYear" label="毕业年份" :min-width="colWidth('graduationYear')" align="center" />
        <el-table-column prop="gradeSeven" label="七年级" :min-width="colWidth('gradeSeven')" align="center" />
        <el-table-column prop="gradeEight" label="八年级" :min-width="colWidth('gradeEight')" align="center" />
        <el-table-column prop="longRun" label="长跑" :min-width="colWidth('longRun')" align="center" />
        <el-table-column prop="ropeSkipping" label="跳绳" :min-width="colWidth('ropeSkipping')" align="center" />
        <el-table-column prop="longJump" label="跳远" :min-width="colWidth('longJump')" align="center" />
        <el-table-column prop="ballSports" label="足(篮)球" :min-width="colWidth('ballSports')" align="center" />
        <el-table-column prop="martialArts" label="武术" :min-width="colWidth('martialArts')" align="center" />
        <el-table-column prop="totalScore" label="总分" :min-width="colWidth('totalScore')" align="center">
          <template #default="{ row }">
            <span class="score-tag">{{ row.totalScore }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="!authStore.isSchoolUser" label="操作" :width="112" :min-width="112" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
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
        <el-form-item label="学校">
          <el-select v-model="editForm.school" filterable style="width: 100%">
            <el-option v-for="s in schoolOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="报名序号">
          <el-input v-model="editForm.registrationNumber" />
        </el-form-item>
        <el-form-item label="七年级成绩">
          <el-input-number v-model="editForm.gradeSeven" :min="0" :max="100" :precision="1" />
        </el-form-item>
        <el-form-item label="八年级成绩">
          <el-input-number v-model="editForm.gradeEight" :min="0" :max="100" :precision="1" />
        </el-form-item>
        <el-form-item label="长跑">
          <el-input-number v-model="editForm.longRun" :min="0" :max="100" :precision="1" />
        </el-form-item>
        <el-form-item label="跳绳">
          <el-input-number v-model="editForm.ropeSkipping" :min="0" :max="100" :precision="1" />
        </el-form-item>
        <el-form-item label="跳远">
          <el-input-number v-model="editForm.longJump" :min="0" :max="100" :precision="1" />
        </el-form-item>
        <el-form-item label="足(篮)球">
          <el-input-number v-model="editForm.ballSports" :min="0" :max="100" :precision="1" />
        </el-form-item>
        <el-form-item label="武术">
          <el-input-number v-model="editForm.martialArts" :min="0" :max="100" :precision="1" />
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
import { ref, computed, onMounted } from 'vue'
import { Download, Search, Refresh } from '@element-plus/icons-vue'
import { useGradeStore } from '@/stores/grade'
import { useAuthStore } from '@/stores/auth'
import { dataApi, settingsApi } from '@/api'
import { useAutoColumns } from '@/composables/useAutoColumns'

// ========== 类型 ==========
interface MatchedRow {
  id?: string
  identityId: string
  school: string
  name: string
  idCard: string
  registrationNumber: string
  graduationYear: string
  gradeSeven: number
  gradeEight: number
  longRun: number
  ropeSkipping: number
  longJump: number
  ballSports: number
  martialArts: number
  totalScore: number
  reviewStatus: string
}

interface UnmatchedRow {
  index: number
  name: string
  idCard: string
  reason: string
}

const gradeStore = useGradeStore()
const authStore = useAuthStore()

const loading = ref(false)
const matching = ref(false)
const exporting = ref(false)
const saving = ref(false)

/** 当前账号允许导出的表（学校账号由管理员在「系统管理」里授权） */
const exportTables = ref<string[]>([])
/** 中招体育成绩是否允许导出（服务端还会再校验一次） */
const canExport = computed(() => exportTables.value.includes('admission'))

const searchKeyword = ref('')
const remarkFilter = ref('')
const filterYear = ref('')
const filterSchool = ref(authStore.isSchoolUser ? authStore.userSchoolName : '')
const yearOptions = ref<string[]>([])
const schoolOptions = ref<string[]>([])
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const tableData = ref<any[]>([])

// ========== 列宽自适应 ==========
const ADMISSION_COLUMNS = [
  { prop: 'identityId', label: '身份ID' },
  { prop: 'school', label: '学校名称' },
  { prop: 'name', label: '姓名' },
  { prop: 'registrationNumber', label: '报名序号' },
  { prop: 'graduationYear', label: '毕业年份' },
  { prop: 'gradeSeven', label: '七年级' },
  { prop: 'gradeEight', label: '八年级' },
  { prop: 'longRun', label: '长跑' },
  { prop: 'ropeSkipping', label: '跳绳' },
  { prop: 'longJump', label: '跳远' },
  { prop: 'ballSports', label: '足(篮)球' },
  { prop: 'martialArts', label: '武术' },
  { prop: 'totalScore', label: '总分', minWidth: 88 },
]
const { wrapRef: tableWrapRef, colWidth } = useAutoColumns(ADMISSION_COLUMNS, tableData, {
  // 「序号」(56) 与「操作」(112) 是模板里写死的 sticky 列
  padding: 18, min: 56, max: 240, reservedWidth: 168,
})

const editDialogVisible = ref(false)
const editForm = ref<Record<string, any>>({})
const editingId = ref('')

/** 服务端单页上限 500，超过就要翻页 */
const MAX_PAGE_SIZE = 500
/** 匹配接口单次上限 50000，这里留出余量分批提交 */
const MATCH_CHUNK_SIZE = 20000

const indexMethod = (i: number) => (currentPage.value - 1) * pageSize.value + i + 1

// ========== 选项加载 ==========
const loadYears = async () => {
  try {
    const years = await dataApi.getYears()
    yearOptions.value = Array.isArray(years) ? years : []
  } catch {
    yearOptions.value = []
  }
}

const loadSchools = async () => {
  try {
    // 注意：GET /data/schools 服务端目前不接收年份参数（只按角色过滤），
    // 因此这里不再随年份重新拉取，避免造成「年份已联动生效」的错觉。
    const schools = await dataApi.getSchools()
    schoolOptions.value = Array.isArray(schools) ? schools : []
  } catch {
    schoolOptions.value = []
  }
}

// ========== 列表 ==========
/** 当前生效的筛选条件（列表查询、导出、匹配共用） */
const currentFilters = () => ({
  keyword: searchKeyword.value.trim() || undefined,
  graduationYear: filterYear.value || undefined,
  school: filterSchool.value || undefined,
  remark: remarkFilter.value || undefined,
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await dataApi.page('admission', {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...currentFilters(),
    })
    tableData.value = res?.list || []
    total.value = res?.total || 0
  } catch (err: any) {
    tableData.value = []
    total.value = 0
    ElMessage.error(err?.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  currentPage.value = 1
  await loadData()
}

const handleFilterChange = async () => {
  currentPage.value = 1
  await loadData()
}

const handleYearChange = async () => {
  // 学校下拉不随年份变化（服务端限制），这里只重置学校筛选并重新查询
  if (!authStore.isSchoolUser) filterSchool.value = ''
  currentPage.value = 1
  await loadData()
}

const handlePageChange = () => {
  loadData()
}

const handleSizeChange = () => {
  currentPage.value = 1
  loadData()
}

const resetFilter = () => {
  searchKeyword.value = ''
  filterYear.value = ''
  filterSchool.value = authStore.isSchoolUser ? authStore.userSchoolName : ''
  remarkFilter.value = ''
  currentPage.value = 1
  loadData()
}

// ========== 编辑 / 删除 ==========
const handleEdit = (row: any) => {
  editingId.value = row.id
  const form: Record<string, any> = { ...row }
  // DECIMAL 字段从服务端返回的是字符串，先转数字再交给 el-input-number
  for (const key of ['gradeSeven', 'gradeEight', 'longRun', 'ropeSkipping', 'longJump', 'ballSports', 'martialArts', 'totalScore']) {
    const v = form[key]
    if (v !== undefined && v !== null && v !== '') form[key] = Number(v)
  }
  editForm.value = form
  editDialogVisible.value = true
}

const saveEdit = async () => {
  if (!editingId.value) return
  const updated = {
    school: editForm.value.school,
    name: editForm.value.name,
    registrationNumber: editForm.value.registrationNumber,
    gradeSeven: editForm.value.gradeSeven,
    gradeEight: editForm.value.gradeEight,
    longRun: editForm.value.longRun,
    ropeSkipping: editForm.value.ropeSkipping,
    longJump: editForm.value.longJump,
    ballSports: editForm.value.ballSports,
    martialArts: editForm.value.martialArts,
    totalScore: Math.round(
      Number(editForm.value.gradeSeven || 0) +
      Number(editForm.value.gradeEight || 0) +
      Number(editForm.value.longRun || 0) +
      Number(editForm.value.ropeSkipping || 0) +
      Number(editForm.value.longJump || 0) +
      Number(editForm.value.ballSports || 0) +
      Number(editForm.value.martialArts || 0),
    ),
  }
  saving.value = true
  try {
    await dataApi.update('admission', editingId.value, updated)
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    await loadData()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.name} 的中招成绩？`, '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }
  try {
    await dataApi.delete('admission', row.id)
    ElMessage.success('删除成功')
    await loadData()
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败')
  }
}

// ========== 匹配 ==========
/** 兼容服务端可能返回的 camelCase / snake_case 两种字段名 */
const pick = (row: any, camel: string, snake: string) => row?.[camel] ?? row?.[snake]

/** 拼接服务端返回的校验错误明细，便于用户定位失败原因 */
const formatApiError = (err: any): string => {
  const base = err?.message || '未知错误'
  const list = Array.isArray(err?.errors) ? err.errors : []
  if (list.length === 0) return base
  const head = list.slice(0, 3).map((e: any) => `${e.field}：${e.message}`).join('；')
  return `${base}（${head}${list.length > 3 ? ' 等' : ''}）`
}

const normalizeMatched = (row: any): MatchedRow => ({
  id: row?.id,
  identityId: String(pick(row, 'identityId', 'identity_id') || ''),
  school: String(pick(row, 'school', 'school') || ''),
  name: String(pick(row, 'name', 'name') || ''),
  idCard: String(pick(row, 'idCard', 'id_card') || ''),
  registrationNumber: String(pick(row, 'registrationNumber', 'registration_number') || ''),
  graduationYear: String(pick(row, 'graduationYear', 'graduation_year') || ''),
  gradeSeven: Number(pick(row, 'gradeSeven', 'grade_seven') || 0),
  gradeEight: Number(pick(row, 'gradeEight', 'grade_eight') || 0),
  longRun: Number(pick(row, 'longRun', 'long_run') || 0),
  ropeSkipping: Number(pick(row, 'ropeSkipping', 'rope_skipping') || 0),
  longJump: Number(pick(row, 'longJump', 'long_jump') || 0),
  ballSports: Number(pick(row, 'ballSports', 'ball_sports') || 0),
  martialArts: Number(pick(row, 'martialArts', 'martial_arts') || 0),
  totalScore: Number(pick(row, 'totalScore', 'total_score') || 0),
  reviewStatus: String(pick(row, 'reviewStatus', 'review_status') || 'published'),
})

const normalizeUnmatched = (row: any, idx: number): UnmatchedRow => ({
  index: Number(pick(row, 'index', 'index') ?? idx) + 1,
  name: String(pick(row, 'name', 'name') || ''),
  idCard: String(pick(row, 'idCard', 'id_card') || ''),
  reason: String(pick(row, 'reason', 'reason') || '未匹配'),
})

/** 调用服务端匹配接口（分批提交，避免超过单次 5 万条的限制） */
const matchRows = async (rows: any[], year?: string) => {
  const matched: MatchedRow[] = []
  const unmatched: UnmatchedRow[] = []

  for (let i = 0; i < rows.length; i += MATCH_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + MATCH_CHUNK_SIZE)
    const res = await dataApi.matchAdmission(chunk, year)
    for (const item of res?.matched || []) matched.push(normalizeMatched(item))
    const chunkUnmatched = res?.unmatched || []
    for (let j = 0; j < chunkUnmatched.length; j++) {
      unmatched.push(normalizeUnmatched(chunkUnmatched[j], i + j))
    }
  }

  return { matched, unmatched }
}

/** 名单匹配：上传名单 → 预览 → 匹配 → 写入 */
const matchScores = async () => {
  if (!filterYear.value) {
    ElMessage.warning('请先选择毕业年份')
    return
  }

  matching.value = true
  try {
    const rows: any[] = []
    let page = 1
    let totalPages = 1
    let realTotal = 0
    do {
      const res = await dataApi.page('admission', {
        ...currentFilters(),
        page,
        pageSize: MAX_PAGE_SIZE,
      })
      rows.push(...(res?.list || []))
      realTotal = res?.total || 0
      totalPages = res?.totalPages || 1
      page++
    } while (page <= totalPages)

    if (rows.length === 0) {
      ElMessage.warning('当前筛选条件下没有考生数据')
      return
    }
    if (rows.length < realTotal) {
      ElMessage.warning(`本次仅取到 ${rows.length} 条（服务端共 ${realTotal} 条），请检查分页是否被限制`)
    }

    const { matched, unmatched } = await matchRows(rows, filterYear.value)
    if (matched.length === 0) {
      ElMessage.info('未找到可匹配的成绩数据')
      return
    }

    await dataApi.import('admission', matched)
    const scope = filterSchool.value ? `「${filterSchool.value}」` : '所有学校'
    ElMessage.success(
      `${scope} ${filterYear.value} 届成绩匹配完成：共 ${rows.length} 条考生，成功匹配 ${matched.length} 人，未匹配 ${unmatched.length} 人`,
    )
    await loadData()
  } catch (err: any) {
    ElMessage.error('匹配失败：' + formatApiError(err))
  } finally {
    matching.value = false
  }
}

// ========== 导出 ==========
const loadExportTables = async () => {
  try {
    const res = await settingsApi.getExportTables()
    exportTables.value = Array.isArray(res?.tables) ? res.tables : []
  } catch (err: any) {
    exportTables.value = []
    ElMessage.error(err?.message || '获取导出权限失败')
  }
}

/** 导出当前筛选条件下的全部数据（服务端生成 Excel，权限由服务端强校验） */
const exportData = async () => {
  if (!canExport.value) {
    ElMessage.warning('当前没有导出该成绩表的权限，请联系管理员开启')
    return
  }

  exporting.value = true
  const progress = ElMessage({ message: '正在导出「中招体育成绩」，请稍候…', duration: 0, type: 'info' })
  try {
    await dataApi.export({
      table: 'admission',
      filters: currentFilters(),
      columns: ADMISSION_COLUMNS.map(col => ({ prop: col.prop, label: col.label })),
      sheetName: '中招体育成绩',
    })
    ElMessage.success('导出成功，文件已下载')
  } catch (err: any) {
    ElMessage.error(err?.message || '导出失败')
  } finally {
    progress.close()
    exporting.value = false
  }
}

onMounted(async () => {
  filterSchool.value = authStore.isSchoolUser ? authStore.userSchoolName : ''
  await Promise.all([loadYears(), loadSchools(), loadExportTables()])
  await loadData()
})
</script>

<style scoped lang="scss">
.admission-grades-page {
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

  .w-year { width: 150px; }
  .w-school { width: 200px; }
  .w-keyword { width: 260px; }
  .w-remark { width: 120px; }
}

.table-section {
  // 直接显示表格本身，不再套一层卡片：外层卡片会和表格自己的 border 叠成「双层白边」
  margin-top: $page-gap;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: $page-gap;
}

.score-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 13px;
  min-width: 36px;
  text-align: center;
}

// ========== 上传 / 匹配 ==========
.upload-steps {
  margin-bottom: 20px;
}

.upload-section {
  min-height: 220px;
}

.preview-table {
  border: $table-border;
  border-radius: $table-radius;
  overflow: hidden;
}

.match-summary {
  display: flex;
  gap: 48px;
  margin-bottom: 16px;
  padding: 14px 20px;
  background: var(--bg-surface);
  border: $table-border;
  border-radius: $table-radius;
}

.upload-area {
  :deep(.el-upload-dragger) {
    width: 100%;
    height: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    border: 2px dashed var(--border);
    background: var(--bg-surface);
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--brand-cyan);
      background: var(--bg-hover);
    }

    .upload-icon {
      font-size: 40px;
      color: var(--brand-cyan);
      margin-bottom: 12px;
    }

    .upload-text {
      font-size: 14px;
      color: var(--text-primary);
      margin-bottom: 4px;

      em {
        color: var(--brand-cyan);
        font-style: normal;
        font-weight: 500;
      }
    }

    .upload-tip {
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}
</style>

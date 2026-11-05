<template>
  <div class="registration-review-page">
    <div class="page-header">
      <div>
        <div class="header-title">报名审核</div>
        <div class="header-desc">
          审核学校上报的九年级报名名单；通过后报名信息写入九年级成绩表与中招体育成绩表，再按身份证号导入成绩。
        </div>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="openScoreImport">
          <el-icon><UploadFilled /></el-icon>
          导入九年级成绩
        </el-button>
        <el-button plain @click="downloadScoreTemplate">
          <el-icon><Download /></el-icon>
          下载成绩模板
        </el-button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filter-bar card-surface">
      <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px" @change="reload">
        <el-option v-for="(label, key) in STATUS_LABELS" :key="key" :label="label" :value="key" />
      </el-select>
      <el-select v-model="filters.school" placeholder="全部学校" clearable filterable style="width: 200px" @change="reload">
        <el-option v-for="s in schoolOptions" :key="s" :label="s" :value="s" />
      </el-select>
      <el-input
        v-model="filters.keyword"
        placeholder="搜索姓名 / 身份证 / 报名序号"
        clearable
        style="width: 240px"
        @keyup.enter="reload"
        @clear="reload"
      />
      <div class="filter-spacer" />
      <el-button @click="reload">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <!-- 列表 -->
    <div ref="tableWrapRef" class="table-card">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="list"
        border
        stripe
        row-key="id"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" :width="44" :min-width="44" align="center" :selectable="canSelect" />
        <el-table-column prop="school" label="学校" :min-width="colWidth('school')" show-overflow-tooltip />
        <el-table-column prop="name" label="姓名" :min-width="colWidth('name')" />
        <el-table-column prop="gender" label="性别" :min-width="colWidth('gender')" align="center" />
        <el-table-column prop="idCard" label="身份证号" :min-width="colWidth('idCard')" show-overflow-tooltip />
        <el-table-column prop="registrationNumber" label="报名序号" :min-width="colWidth('registrationNumber')" align="center" />
        <el-table-column prop="graduationYear" label="毕业年份" :min-width="colWidth('graduationYear')" align="center">
          <template #default="{ row }">{{ row.graduationYear }}届</template>
        </el-table-column>
        <el-table-column prop="longRunEvent" label="长跑项目" :min-width="colWidth('longRunEvent')" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.longRunEvent" size="small" :type="row.longRunEvent === '1000米' ? 'primary' : 'warning'">
              {{ row.longRunEvent }}
            </el-tag>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="ballEvent" label="球类项目" :min-width="colWidth('ballEvent')" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.ballEvent" size="small" :type="row.ballEvent === '足球' ? 'success' : 'info'">
              {{ row.ballEvent }}
            </el-tag>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" :min-width="colWidth('remark')" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" :min-width="colWidth('status')" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TYPES[row.status] || 'info'" size="small">
              {{ STATUS_LABELS[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="提交时间" :min-width="colWidth('createdAt')">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="120" :min-width="120" align="center" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button text type="success" size="small" @click="approve(row)">通过</el-button>
              <el-button text type="danger" size="small" @click="reject(row)">驳回</el-button>
            </template>
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无报名名单" :image-size="90" />
        </template>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="load"
          @size-change="reload"
        />
      </div>
    </div>

    <!-- 批量操作条 -->
    <div v-if="selected.length > 0" class="batch-bar">
      <span>已选择 <b>{{ selected.length }}</b> 条待审核报名</span>
      <el-button type="success" :loading="acting" @click="batchApprove">批量通过</el-button>
      <el-button @click="clearSelection">取消选择</el-button>
    </div>

    <!-- 导入成绩弹窗 -->
    <el-dialog v-model="scoreDialogVisible" title="导入九年级成绩" width="620px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 14px"
        title="成绩文件按身份证号与报名名单匹配；系统会校验「性别 ↔ 长跑项目（男生1000米 / 女生800米）」以及球类项目是否与报名一致。"
      />
      <el-upload
        drag
        action="#"
        :auto-upload="false"
        :on-change="onScoreFileChange"
        :show-file-list="false"
        accept=".xlsx,.xls"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">点击选择或拖拽成绩文件到此处</div>
        <div class="upload-tip">.xlsx / .xls，不超过 10MB</div>
      </el-upload>
      <div v-if="scoreFileName" class="score-file">
        已选择：<b>{{ scoreFileName }}</b>
      </div>
      <el-alert
        v-if="scoreErrors.length > 0"
        type="error"
        :closable="false"
        show-icon
        style="margin-top: 14px"
        :title="`发现 ${scoreErrors.length} 处问题，成绩未导入`"
      />
      <el-table v-if="scoreErrors.length > 0" :data="scoreErrors" border size="small" max-height="240" style="margin-top: 10px">
        <el-table-column prop="row" label="Excel行号" width="90" align="center" />
        <el-table-column prop="field" label="字段" width="140" />
        <el-table-column prop="message" label="错误说明" min-width="280" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="scoreDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" :disabled="!scoreFile" @click="doImportScores">
          导入成绩
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { UploadFilled, Download, Refresh } from '@element-plus/icons-vue'
import { registrationApi, dataApi } from '@/api'
import { loadXLSX, parseNineScoreFile } from '@/utils/excel'
import { formatDateTime } from '@/utils/date'
import { useAutoColumns } from '@/composables/useAutoColumns'

const STATUS_LABELS: Record<string, string> = {
  pending: '待审核', approved: '待导入成绩', rejected: '已驳回', scored: '已导入成绩',
}
const STATUS_TYPES: Record<string, any> = {
  pending: 'warning', approved: 'primary', rejected: 'danger', scored: 'success',
}

/**
 * 列宽按内容实测，只给 min-width；剩余空间由 el-table 等比分配，
 * 手动拖动某一列时其余列会跟着重新分配，不会在右侧留白。
 */
const REVIEW_COLUMNS = [
  { prop: 'school', label: '学校' },
  { prop: 'name', label: '姓名' },
  { prop: 'gender', label: '性别' },
  { prop: 'idCard', label: '身份证号' },
  { prop: 'registrationNumber', label: '报名序号' },
  { prop: 'graduationYear', label: '毕业年份' },
  // 下面几列渲染的是带内边距的 el-tag，实测文字宽度不够，单独给下限
  { prop: 'longRunEvent', label: '长跑项目', minWidth: 88 },
  { prop: 'ballEvent', label: '球类项目', minWidth: 84 },
  { prop: 'remark', label: '备注' },
  { prop: 'status', label: '状态', minWidth: 104 },
  { prop: 'createdAt', label: '提交时间' },
]

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const acting = ref(false)
const importing = ref(false)
const schoolOptions = ref<string[]>([])
const filters = reactive({ status: '', school: '', keyword: '' })
const tableRef = ref()
const selected = ref<any[]>([])

// 复选框 44 + 操作 120 是模板里写死的列，从可用宽度里扣掉
const { wrapRef: tableWrapRef, colWidth } = useAutoColumns(REVIEW_COLUMNS, list, {
  padding: 18, min: 56, max: 260, reservedWidth: 164,
})

const scoreDialogVisible = ref(false)
const scoreFile = ref<File | null>(null)
const scoreFileName = ref('')
const scoreErrors = ref<any[]>([])

const formatTime = (t?: string) => formatDateTime(t)

/** 只有「待审核」的记录才能勾选批量通过 */
const canSelect = (row: any) => row.status === 'pending'

const onSelectionChange = (rows: any[]) => {
  selected.value = rows
}

const clearSelection = () => {
  tableRef.value?.clearSelection()
  selected.value = []
}

const load = async () => {
  loading.value = true
  try {
    const res = await registrationApi.getList({
      page: page.value,
      pageSize: pageSize.value,
      status: filters.status || undefined,
      school: filters.school || undefined,
      keyword: filters.keyword || undefined,
    })
    list.value = res.list || []
    total.value = res.total || 0
  } catch (err: any) {
    ElMessage.error('加载报名名单失败：' + (err.message || ''))
  } finally {
    loading.value = false
  }
}

const reload = () => {
  page.value = 1
  clearSelection()
  load()
}

// ========== 审核 ==========

const approve = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认通过【${row.school} - ${row.name}】的报名？` +
      `通过后，该学生的学校、姓名、身份ID、报名序号、毕业年份、年级将写入九年级成绩表与中招体育成绩表。`,
      '审核通过',
      { type: 'warning', confirmButtonText: '通过', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  acting.value = true
  try {
    await registrationApi.approve(row.id)
    ElMessage.success('已通过，报名信息已写入成绩表')
    await load()
  } catch (err: any) {
    ElMessage.error('审核失败：' + (err.message || ''))
  } finally {
    acting.value = false
  }
}

const batchApprove = async () => {
  const ids = selected.value.map(r => r.id)
  if (ids.length === 0) return
  try {
    await ElMessageBox.confirm(
      `确认批量通过 ${ids.length} 条报名记录？通过后报名信息会写入两张成绩表。`,
      '批量审核通过',
      { type: 'warning', confirmButtonText: '通过', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  acting.value = true
  try {
    const res = await registrationApi.batchApprove(ids)
    ElMessage.success(`已通过 ${res.count} 条`)
    clearSelection()
    await load()
  } catch (err: any) {
    ElMessage.error('批量审核失败：' + (err.message || ''))
  } finally {
    acting.value = false
  }
}

const reject = async (row: any) => {
  let reason = ''
  try {
    const result = await ElMessageBox.prompt(
      `请填写驳回原因，学校会看到该说明：`,
      `驳回【${row.name}】的报名`,
      {
        confirmButtonText: '确认驳回',
        cancelButtonText: '取消',
        inputPlaceholder: '例如：第 12 行身份证号与学籍不符，请核对后重新提交',
        inputValidator: (v: string) => {
          if (!v || !v.trim()) return '请填写驳回原因'
          return true
        },
      },
    )
    reason = result.value
  } catch {
    return
  }

  acting.value = true
  try {
    await registrationApi.reject(row.id, reason)
    ElMessage.success('已驳回')
    await load()
  } catch (err: any) {
    ElMessage.error('驳回失败：' + (err.message || ''))
  } finally {
    acting.value = false
  }
}

// ========== 导入成绩 ==========

const openScoreImport = () => {
  scoreFile.value = null
  scoreFileName.value = ''
  scoreErrors.value = []
  scoreDialogVisible.value = true
}

const onScoreFileChange = (file: any) => {
  const raw: File | undefined = file?.raw
  if (!raw) return
  if (raw.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小超过 10MB 限制')
    return
  }
  scoreFile.value = raw
  scoreFileName.value = raw.name
  scoreErrors.value = []
}

const doImportScores = async () => {
  if (!scoreFile.value) return
  importing.value = true
  scoreErrors.value = []
  try {
    const { rows } = await parseNineScoreFile(scoreFile.value)
    if (rows.length === 0) {
      ElMessage.error('文件中没有可导入的成绩')
      return
    }
    await registrationApi.importScores({ year: '', rows })
    ElMessage.success('成绩导入成功')
    scoreDialogVisible.value = false
    await load()
  } catch (err: any) {
    if (err?.errors && Array.isArray(err.errors)) {
      scoreErrors.value = err.errors
    }
    ElMessage.error('导入失败：' + (err.message || '未知错误'))
  } finally {
    importing.value = false
  }
}

const downloadScoreTemplate = async () => {
  try {
    await registrationApi.downloadScoreTemplate()
  } catch (err: any) {
    ElMessage.error('模板下载失败：' + (err.message || ''))
  }
}

onMounted(async () => {
  try {
    schoolOptions.value = await dataApi.getSchools()
  } catch { /* ignore */ }
  await load()
})
</script>

<style scoped lang="scss">
.registration-review-page {
  @include page-container;

  .page-header {
    @include toolbar;
    margin-bottom: 16px;

    .header-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .header-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
      max-width: 760px;
    }

    .header-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
  }

  .card-surface {
    @include card-surface;
    padding: 16px 18px;
    margin-bottom: 16px;
  }

  .filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .filter-spacer { flex: 1; }
  }

  .table-card {
  margin-top: 14px;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

  .pagination-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
  }

  .batch-bar {
    position: sticky;
    bottom: 16px;
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    font-size: 13px;
    color: var(--text-secondary);
  }

  .muted { color: var(--text-muted); }

  .upload-icon {
    font-size: 38px;
    color: var(--brand-cyan);
    margin-bottom: 10px;
  }

  .upload-text {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .upload-tip {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }

  .score-file {
    margin-top: 12px;
    font-size: 13px;
    color: var(--text-secondary);
  }
}
</style>

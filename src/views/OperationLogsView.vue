<template>
  <div class="operation-logs-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>操作日志</span>
        </div>
      </template>

      <div class="filter-section">
        <el-input
          v-model="filterOperator"
          placeholder="操作人"
          clearable
          style="width: 150px"
        />

        <el-select
          v-model="filterOperationType"
          placeholder="操作类型"
          clearable
          style="width: 130px; margin-left: 12px"
        >
          <el-option
            v-for="opt in operationTypeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <el-select
          v-model="filterTargetTable"
          placeholder="目标表"
          clearable
          style="width: 150px; margin-left: 12px"
        >
          <el-option
            v-for="opt in targetTableOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>

        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          style="margin-left: 12px"
        />

        <el-button type="primary" style="margin-left: 12px" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button type="default" style="margin-left: 8px" @click="resetFilter">
          重置
        </el-button>
      </div>

      <div class="table-section">
        <el-table
          :data="tableData"
          border
          stripe
          v-loading="loading"
          style="width: 100%"
          :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="operator" label="操作人" width="120" align="center" />
          <el-table-column label="操作类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag
                :type="row.operation_type === 'create' ? 'success' : row.operation_type === 'update' ? 'warning' : 'danger'"
                size="small"
              >
                {{ opTypeLabel(row.operation_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="目标表" width="130" align="center">
            <template #default="{ row }">
              {{ tableLabel(row.target_table) }}
            </template>
          </el-table-column>
          <el-table-column label="操作详情" min-width="350" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="detail-text">{{ formatDetails(row.details) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="ip_address" label="IP地址" width="140" align="center" />
          <el-table-column prop="created_at" label="操作时间" width="170" align="center">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pagination-section">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadData"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { logApi } from '@/api'

const loading = ref(false)
const tableData = ref<any[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const filterOperator = ref('')
const filterOperationType = ref('')
const filterTargetTable = ref('')
const dateRange = ref<[string, string] | null>(null)

const operationTypeOptions = [
  { label: '新增', value: 'create' },
  { label: '修改', value: 'update' },
  { label: '删除', value: 'delete' },
]

const targetTableOptions = [
  { label: '七年级成绩', value: 'grade_seven' },
  { label: '八年级成绩', value: 'grade_eight' },
  { label: '九年级成绩', value: 'grade_nine' },
  { label: '中招成绩', value: 'admission' },
  { label: '管理员', value: 'admins' },
  { label: '材料', value: 'materials' },
]

const opTypeLabel = (type: string) => {
  const map: Record<string, string> = { create: '新增', update: '修改', delete: '删除' }
  return map[type] || type
}

const tableLabel = (table: string) => {
  const map: Record<string, string> = {
    grade_seven: '七年级成绩', grade_eight: '八年级成绩', grade_nine: '九年级成绩',
    admission: '中招成绩', admins: '管理员', materials: '材料文件'
  }
  return map[table] || table
}

const formatTime = (val: string) => {
  if (!val) return '-'
  return val.substring(0, 19).replace('T', ' ')
}

const formatDetails = (details: any) => {
  if (!details) return '-'
  try {
    if (typeof details === 'string') details = JSON.parse(details)

    // 优先显示 summary
    if (details.summary) return details.summary

    // 构建变更列表
    const parts: string[] = []
    if (details.record) parts.push(`【${details.record}】`)
    if (details.schools && details.schools.length > 0) parts.push(`涉及学校：${details.schools.join('、')}`)
    if (details.importCount !== undefined) parts.push(`新增${details.importCount}条`)
    if (details.updateCount !== undefined) parts.push(`更新${details.updateCount}条`)

    // 显示具体字段变更
    if (details.changes && Array.isArray(details.changes)) {
      details.changes.forEach((c: any) => {
        parts.push(`${c.field}：${c.from || '(空)'} → ${c.to || '(空)'}`)
      })
    }

    if (parts.length > 0) return parts.join('；')

    // 兜底：显示 JSON
    return JSON.stringify(details)
  } catch {
    return String(details)
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const result = await logApi.getList({
      page: currentPage.value,
      pageSize: pageSize.value,
      operator: filterOperator.value || undefined,
      operationType: filterOperationType.value || undefined,
      targetTable: filterTargetTable.value || undefined,
      startDate: dateRange.value?.[0] || undefined,
      endDate: dateRange.value?.[1] || undefined,
    })
    tableData.value = result.list || []
    total.value = result.total || 0
  } catch (err: any) {
    ElMessage.error(err.message || '加载操作日志失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => { currentPage.value = 1; loadData() }
const handleSizeChange = () => { currentPage.value = 1; loadData() }

const resetFilter = () => {
  filterOperator.value = ''
  filterOperationType.value = ''
  filterTargetTable.value = ''
  dateRange.value = null
  currentPage.value = 1
  loadData()
}

onMounted(() => { loadData() })
</script>

<style scoped lang="scss">
.operation-logs-page {
  padding: 24px;
  background: var(--bg-page);
  min-height: 100%;

  :deep(.el-card) {
    border-radius: 24px;
    border: 1px solid var(--border-light);
    background: var(--bg-card);
    color: var(--text-primary);
  }

  :deep(.el-button) { border-radius: 8px; }

  :deep(.el-table) {
    border-radius: 12px;
    border: 1px solid var(--border-light);
    overflow: hidden;
    th.el-table__cell {
      background: var(--bg-surface) !important;
      color: var(--text-primary);
    }
  }

  :deep(.el-pagination) { .is-active { background: var(--primary) !important; } }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 18px;
  }

  .filter-section {
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .table-section { margin-bottom: 20px; }

  .pagination-section {
    display: flex;
    justify-content: flex-end;
  }

  .detail-text {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
  }
}
</style>

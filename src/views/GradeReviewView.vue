<template>
  <div class="grade-review-page">
    <el-card :body-style="{ padding: '0px' }">
      <template #header>
        <div class="card-header">
          <span>成绩审核</span>
          <div class="header-actions">
            <el-button type="primary" @click="exportData">
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
          </div>
        </div>
      </template>

      <div class="search-section">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索姓名或身份证号"
          clearable
          style="width: 220px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-button type="primary" style="margin-left: 12px" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button type="default" style="margin-left: 8px" @click="resetSearch">
          重置
        </el-button>
      </div>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane v-for="tab in tabs" :key="tab.grade" :label="tab.label" :name="tab.grade">
          <GradeReviewTable
            :grade="tab.grade"
            :table-data="tableData"
            :loading="loading"
            :current-page="currentPage"
            :page-size="pageSize"
            :total="total"
            @approve="handleApprove"
            @reject="handleReject"
            @page-change="currentPage = $event; loadData()"
            @size-change="currentPage = 1; pageSize = $event; loadData()"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog
      v-model="rejectDialogVisible"
      title="驳回原因"
      width="500px"
    >
      <el-form :model="rejectForm" label-width="80px">
        <el-form-item label="驳回原因">
          <el-input
            v-model="rejectForm.remark"
            type="textarea"
            rows="3"
            placeholder="请输入驳回原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="rejectDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmReject">确认驳回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Download } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { dataApi } from '@/api'
import GradeReviewTable from '@/components/GradeReviewTable.vue'

const tabs = [
  { grade: 'seven' as const, label: '七年级' },
  { grade: 'eight' as const, label: '八年级' },
  { grade: 'nine' as const, label: '九年级' },
]

const loading = ref(false)
const activeTab = ref<'seven' | 'eight' | 'nine'>('seven')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const tableData = ref<any[]>([])

const rejectDialogVisible = ref(false)
const rejectForm = ref<{ id: string; remark: string }>({ id: '', remark: '' })

const tableNameMap: Record<string, string> = {
  seven: 'grade_seven',
  eight: 'grade_eight',
  nine: 'grade_nine'
}

const loadData = async () => {
  loading.value = true
  try {
    const tableName = tableNameMap[activeTab.value]
    const result = await dataApi.page(tableName, {
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value
    })
    tableData.value = result.list || []
    total.value = result.total || 0
  } catch (err: any) {
    ElMessage.error(err.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => { currentPage.value = 1; loadData() }
const resetSearch = () => { searchKeyword.value = ''; currentPage.value = 1; loadData() }
const handleTabChange = () => { currentPage.value = 1; loadData() }

const handleApprove = (row: any) => {
  ElMessageBox.confirm(
    `确定要通过 ${row.name} 的成绩审核吗？`,
    '审核确认',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'success' }
  ).then(async () => {
    try {
      await dataApi.update(tableNameMap[activeTab.value], row.id, {
        reviewStatus: 'approved',
        reviewRemark: ''
      })
      ElMessage.success('审核通过')
      loadData()
    } catch (err: any) {
      ElMessage.error(err.message || '操作失败')
    }
  }).catch(() => {})
}

const handleReject = (row: any) => {
  rejectForm.value = { id: row.id, remark: '' }
  rejectDialogVisible.value = true
}

const confirmReject = async () => {
  if (!rejectForm.value.remark.trim()) {
    ElMessage.warning('请输入驳回原因')
    return
  }
  try {
    await dataApi.update(tableNameMap[activeTab.value], rejectForm.value.id, {
      reviewStatus: 'rejected',
      reviewRemark: rejectForm.value.remark
    })
    ElMessage.success('已驳回')
    rejectDialogVisible.value = false
    loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '操作失败')
  }
}

const exportData = async () => {
  loading.value = true
  try {
    const allData = await dataApi.sync()
    const tableName = activeTab.value === 'seven' ? 'gradeSevenList'
      : activeTab.value === 'eight' ? 'gradeEightList'
      : 'gradeNineList'
    const list = allData[tableName] || []
    const gradeLabel = activeTab.value === 'seven' ? '七年级' : activeTab.value === 'eight' ? '八年级' : '九年级'

    let exportRows: any[]
    if (activeTab.value === 'nine') {
      exportRows = list.map((item: any) => ({
        '学校': item.school, '姓名': item.name, '身份ID': item.identityId,
        '毕业年份': item.graduationYear, '长跑': item.longRun, '跳绳': item.ropeSkipping,
        '跳远': item.longJump, '足(篮)球': item.ballSports, '武术': item.martialArts,
        '审核状态': item.reviewStatus === 'approved' ? '已通过' : item.reviewStatus === 'rejected' ? '已驳回' : '待审核',
        '审核备注': item.reviewRemark || ''
      }))
    } else {
      exportRows = list.map((item: any) => ({
        '学校': item.school, '姓名': item.name, '身份ID': item.identityId,
        '毕业年份': item.graduationYear, '出勤率成绩': item.attendanceScore, '体育考试成绩': item.examScore,
        '体测成绩': item.fitnessScore, '合计': item.total,
        '审核状态': item.reviewStatus === 'approved' ? '已通过' : item.reviewStatus === 'rejected' ? '已驳回' : '待审核',
        '审核备注': item.reviewRemark || ''
      }))
    }

    const ws = XLSX.utils.json_to_sheet(exportRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${gradeLabel}成绩审核`)
    XLSX.writeFile(wb, `${gradeLabel}成绩审核_${new Date().toISOString().split('T')[0]}.xlsx`)
    ElMessage.success('导出成功')
  } catch (err: any) {
    ElMessage.error(err.message || '导出失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadData() })
</script>

<style scoped lang="scss">
.grade-review-page {
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
  :deep(.el-tabs--border-card) {
    border-radius: 12px;
    border: 1px solid var(--border-light);
    background: var(--bg-card);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 18px;
  }

  .search-section {
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>

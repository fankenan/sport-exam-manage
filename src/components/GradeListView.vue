<template>
  <div class="grade-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>{{ title }}</span>
          <div class="header-actions">
            <el-button type="primary" @click="exportData">
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
          </div>
        </div>
      </template>

      <div class="filter-section">
        <el-select
          v-model="filterSchoolPending"
          placeholder="选择学校"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="school in gradeStore.schools"
            :key="school"
            :label="school"
            :value="school"
          />
        </el-select>

        <el-select
          v-model="filterYearPending"
          placeholder="选择毕业年份"
          clearable
          style="width: 140px; margin-left: 12px"
        >
          <el-option
            v-for="year in gradeStore.graduationYears"
            :key="year"
            :label="year"
            :value="year"
          />
        </el-select>

        <el-input
          v-model="searchKeywordPending"
          placeholder="搜索姓名或身份证号"
          clearable
          style="width: 220px; margin-left: 12px"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-button type="primary" style="margin-left: 12px" @click="handleSearch">
          确定
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
          <el-table-column type="index" label="序号" width="60" align="center" fixed />
          <el-table-column
            v-for="col in columns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
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
          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" link size="small" @click="openEdit(row)">
                编辑
              </el-button>
              <el-button type="danger" link size="small" @click="handleDeleteRow(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

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
    </el-card>

    <el-dialog
      v-model="editDialogVisible"
      title="编辑成绩"
      width="600px"
    >
      <el-form :model="editForm" label-width="100px">
        <el-form-item v-for="col in displayColumns" :key="col.prop" :label="col.label">
          <el-input-number
            v-if="col.editable && !col.textarea"
            v-model="editForm[col.prop]"
            :min="col.editMin ?? 0"
            :max="col.editMax ?? 100"
            :precision="col.editPrecision ?? 1"
          />
          <el-input
            v-else-if="col.editable && col.textarea"
            v-model="editForm[col.prop]"
            type="textarea"
            rows="2"
          />
          <el-input v-else v-model="editForm[col.prop]" disabled />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Search } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { useGradeStore } from '@/stores/grade'
import { dataApi } from '@/api'

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
  exportMapFn: (item: any) => Record<string, any>
}

const props = defineProps<Props>()

const gradeStore = useGradeStore()
const loading = ref(false)

const filterSchool = ref('')
const filterYear = ref('')
const searchKeyword = ref('')
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const tableData = ref<any[]>([])

const filterSchoolPending = ref('')
const filterYearPending = ref('')
const searchKeywordPending = ref('')

const editDialogVisible = ref(false)
const editForm = ref<Record<string, any>>({})
const editingId = ref('')

const tableName = props.grade === 'seven' ? 'grade_seven'
  : props.grade === 'eight' ? 'grade_eight'
  : 'grade_nine'

// 编辑弹窗显示的列（基本列 + 可编辑的成绩列 + 备注）
const displayColumns = computed(() => {
  return [
    { prop: 'school', label: '学校', editable: false },
    { prop: 'name', label: '姓名', editable: false },
    { prop: 'grade', label: '年级', editable: false },
    ...props.columns.filter(c => c.editable),
    { prop: 'remark', label: '备注', editable: true, textarea: true }
  ]
})

onMounted(async () => {
  filterSchoolPending.value = ''
  filterYearPending.value = ''
  searchKeywordPending.value = ''
  await loadData()
})

const loadData = async () => {
  loading.value = true
  try {
    const kw = searchKeywordPending.value.trim()
    const normalizedKw = gradeStore.generateIdentityId(kw)
    const res = await dataApi.page(tableName, {
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: normalizedKw || undefined,
      graduationYear: filterYearPending.value || undefined,
      school: filterSchoolPending.value || undefined
    })
    tableData.value = res.list || res.data || []
    total.value = res.total || 0
  } catch (e: any) {
    ElMessage.error(e.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  filterSchool.value = filterSchoolPending.value
  filterYear.value = filterYearPending.value
  searchKeyword.value = searchKeywordPending.value
  currentPage.value = 1
  loadData()
}

const handlePageChange = () => { loadData() }
const handleSizeChange = () => { currentPage.value = 1; loadData() }

const resetFilter = () => {
  filterSchoolPending.value = ''
  filterYearPending.value = ''
  searchKeywordPending.value = ''
  filterSchool.value = ''
  filterYear.value = ''
  searchKeyword.value = ''
  currentPage.value = 1
  loadData()
}

const openEdit = (row: any) => {
  editingId.value = row.id
  editForm.value = { ...row }
  editDialogVisible.value = true
}

const saveEdit = async () => {
  if (!editingId.value) return

  const updateData: Record<string, any> = {}
  displayColumns.value.forEach(col => {
    if (col.editable && editForm.value[col.prop] !== undefined) {
      updateData[col.prop] = editForm.value[col.prop]
    }
  })

  // Recalculate totals for seven/eight
  if (props.grade === 'seven') {
    await gradeStore.updateGradeSevenData(editingId.value, updateData)
  } else if (props.grade === 'eight') {
    await gradeStore.updateGradeEightData(editingId.value, updateData)
  } else {
    await gradeStore.updateGradeNineData(editingId.value, updateData)
  }
  ElMessage.success('保存成功')
  editDialogVisible.value = false
  loadData()
}

const handleDeleteRow = (row: any) => {
  ElMessageBox.confirm(
    `确定要删除 ${row.name} 的成绩记录吗？`,
    '确认删除',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    if (props.grade === 'seven') {
      await gradeStore.deleteGradeSevenData(row.id)
    } else if (props.grade === 'eight') {
      await gradeStore.deleteGradeEightData(row.id)
    } else {
      await gradeStore.deleteGradeNineData(row.id)
    }
    ElMessage.success('删除成功')
    loadData()
  })
}

const exportData = async () => {
  try {
    loading.value = true
    const allData = await dataApi.sync()
    const key = props.grade === 'seven' ? 'gradeSevenList'
      : props.grade === 'eight' ? 'gradeEightList'
      : 'gradeNineList'
    const list = allData[key] || []
    const data = list.map(props.exportMapFn)

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, props.exportSheetName)
    XLSX.writeFile(wb, `${props.exportFileName}_${new Date().toISOString().split('T')[0]}.xlsx`)

    ElMessage.success('导出成功')
  } catch (e: any) {
    ElMessage.error(e.message || '导出失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.grade-page {
  padding: 24px;
  background: var(--bg-page);
  min-height: 100%;

  :deep(.el-card) {
    border-radius: 24px;
    border: 1px solid var(--border-light);
    background: var(--bg-card);
    color: var(--text-primary);
  }

  :deep(.el-button) {
    border-radius: 8px;
  }

  :deep(.el-table) {
    border-radius: 12px;
    border: 1px solid var(--border-light);
    overflow: hidden;

    th.el-table__cell {
      background: var(--bg-surface) !important;
      color: var(--text-primary);
    }
  }

  :deep(.el-pagination) {
    .is-active {
      background: var(--primary) !important;
    }
  }

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

  .table-section {
    margin-bottom: 20px;
  }

  .pagination-section {
    display: flex;
    justify-content: flex-end;
  }
}
</style>

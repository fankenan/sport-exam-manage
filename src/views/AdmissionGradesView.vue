<template>
  <div class="admission-grades-page">
    <div class="filter-section">
        <el-select
          v-model="filterYear"
          placeholder="选择毕业年份"
          clearable
          class="mac-select"
          @change="handleYearChange"
        >
          <el-option
            v-for="year in yearOptions"
            :key="year"
            :label="year"
            :value="year"
          />
        </el-select>

        <el-select
          v-model="filterSchool"
          placeholder="选择学校"
          clearable
          filterable
          class="mac-select"
          @change="handleSchoolChange"
        >
          <el-option
            v-for="school in schoolOptions"
            :key="school"
            :label="school"
            :value="school"
          />
        </el-select>

        <el-input
          v-model="searchKeyword"
          placeholder="搜索姓名、身份证号或报名序号"
          clearable
          class="mac-search"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>

        <el-select
          v-model="remarkFilter"
          placeholder="备注筛选"
          clearable
          class="mac-select"
        >
          <el-option label="有备注" value="1" />
          <el-option label="无备注" value="0" />
        </el-select>

        <el-button type="primary" class="mac-btn-primary" @click="handleSearch">
          搜索
        </el-button>
        <el-button type="default" class="mac-btn" @click="resetFilter">
          重置
        </el-button>
        <el-button type="default" size="small" @click="downloadTemplate">
          <el-icon><Download /></el-icon>
          下载模板
        </el-button>
        <el-button type="primary" size="small" @click="showUploadDialog = true">
          <el-icon><Upload /></el-icon>
          上传
        </el-button>
        <el-button v-if="!authStore.isSchoolUser" type="success" size="small" @click="matchScores" :loading="matching">
          <el-icon><Refresh /></el-icon>
          {{ matching ? '匹配中' : '匹配成绩' }}
        </el-button>
        <el-button type="primary" size="small" @click="exportData">
          <el-icon><Download /></el-icon>
          导出Excel
        </el-button>
      </div>

      <div class="table-section">
        <el-table
          :data="tableData"
          v-loading="loading"
          class="mac-table"
          :header-cell-style="{ background: 'rgba(0,0,0,0.02)', fontWeight: 600, color: '#1d1d1f' }"
          :row-style="{ color: '#1d1d1f' }"
          stripe
        >
          <el-table-column type="index" label="序号" width="60" align="center" fixed />
          <el-table-column prop="identityId" label="身份ID" min-width="180" show-overflow-tooltip fixed />
          <el-table-column prop="school" label="学校名称" min-width="180" show-overflow-tooltip fixed />
          <el-table-column prop="name" label="姓名" width="100" align="center" fixed />
          <el-table-column prop="registrationNumber" label="报名序号" min-width="120" show-overflow-tooltip />
          <el-table-column prop="graduationYear" label="毕业年份" width="100" align="center" />
          <el-table-column prop="gradeSeven" label="七年级" width="80" align="center" />
          <el-table-column prop="gradeEight" label="八年级" width="80" align="center" />
          <el-table-column prop="longRun" label="长跑" width="70" align="center" />
          <el-table-column prop="ropeSkipping" label="跳绳" width="70" align="center" />
          <el-table-column prop="longJump" label="跳远" width="70" align="center" />
          <el-table-column prop="ballSports" label="足(篮)球" width="90" align="center" />
          <el-table-column prop="martialArts" label="武术" width="70" align="center" />
          <el-table-column prop="totalScore" label="总分" width="100" align="center">
            <template #default="{ row }">
              <span class="score-tag">{{ row.totalScore }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" align="center">
            <template #default="{ row }">
              <el-button v-if="!authStore.isSchoolUser" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button v-if="!authStore.isSchoolUser" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
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

    <el-dialog
      v-model="showUploadDialog"
      title="考生信息上传"
      width="700px"
    >
      <el-alert
        title="请上传包含以下列的Excel文件：身份证号、学校名称、姓名、报名序号、毕业年份。建议先下载模板按格式填写。"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-upload
        class="upload-area"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleStudentFileChange"
        :show-file-list="false"
        accept=".xlsx,.xls"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">
          <em>点击上传</em> 或拖拽文件到此处
        </div>
        <div class="upload-tip">
          支持 .xlsx 和 .xls 格式
        </div>
      </el-upload>

      <!-- 解析预览 -->
      <div v-if="previewData.length > 0" class="preview-table" style="margin-top: 16px; max-height: 200px; overflow-y: auto;">
        <el-alert title="数据预览（前10行，确认无误后点击「确认导入」）" type="success" :closable="false" show-icon style="margin-bottom: 8px;" />
        <el-table :data="previewData" size="small" border stripe>
          <el-table-column prop="idCard" label="身份证号" min-width="180" show-overflow-tooltip />
          <el-table-column prop="school" label="学校" min-width="120" show-overflow-tooltip />
          <el-table-column prop="name" label="姓名" width="80" align="center" />
          <el-table-column prop="regNum" label="报名序号" min-width="120" show-overflow-tooltip />
        </el-table>
      </div>

      <template #footer>
        <el-button type="default" @click="showUploadDialog = false; selectedFile = null; previewData = []">取消</el-button>
        <el-button type="primary" :disabled="previewData.length === 0" @click="confirmImport">
          确认导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editDialogVisible"
      title="编辑成绩"
      width="600px"
    >
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
        <el-button type="default" @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Search, Upload, Refresh, UploadFilled } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { useGradeStore, type AdmissionData } from '@/stores/grade'
import { useAuthStore } from '@/stores/auth'
import { dataApi } from '@/api'

const gradeStore = useGradeStore()
const authStore = useAuthStore()
const loading = ref(false)
const matching = ref(false)

const searchKeyword = ref('')
const remarkFilter = ref('')
const filterYear = ref('')
const filterSchool = ref('')
const yearOptions = ref<string[]>([])
const schoolOptions = ref<string[]>([])
const currentPage = ref(1)
const pageSize = ref(50)
const total = ref(0)
const tableData = ref<AdmissionData[]>([])
const showUploadDialog = ref(false)

const editDialogVisible = ref(false)
const editForm = ref<Partial<AdmissionData>>({})
const editingId = ref('')

// 加载年份列表
const loadYears = async () => {
  try {
    yearOptions.value = await dataApi.getYears()
  } catch { /* ignore */ }
}

// 加载学校列表（根据年份）
const loadSchools = async (year?: string) => {
  try {
    schoolOptions.value = await dataApi.getSchools(year || undefined)
  } catch { /* ignore */ }
}

const handleYearChange = (year: string | null) => {
  filterSchool.value = ''
  currentPage.value = 1
  loadSchools(year || undefined)
  loadData()
}

const handleSchoolChange = (school: string | null) => {
  currentPage.value = 1
  loadData()
}

// 服务端分页加载
const loadData = async () => {
  loading.value = true
  try {
    const result = await dataApi.page('admission', {
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value,
      graduationYear: filterYear.value || undefined,
      school: filterSchool.value || undefined,
      remark: remarkFilter.value || undefined
    })
    tableData.value = result.list || []
    total.value = result.total || 0
  } catch (err: any) {
    console.error('[加载数据失败]', err)
    ElMessage.error(err.message || '加载数据失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadData()
}

const resetFilter = () => {
  searchKeyword.value = ''
  filterYear.value = ''
  filterSchool.value = ''
  remarkFilter.value = ''
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

const handleEdit = (row: AdmissionData) => {
  editingId.value = row.id
  editForm.value = { ...row }
  editDialogVisible.value = true
}

const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认删除 ${row.name} 的中招成绩？`, '确认删除', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
    })
    await dataApi.delete('admission', row.id)
    ElMessage.success('删除成功')
    loadData()
  } catch { /* cancelled */ }
}

const saveEdit = async () => {
  if (editingId.value && editForm.value) {
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
        Number(editForm.value.gradeSeven || 0) + Number(editForm.value.gradeEight || 0) +
        Number(editForm.value.longRun || 0) + Number(editForm.value.ropeSkipping || 0) +
        Number(editForm.value.longJump || 0) + Number(editForm.value.ballSports || 0) +
        Number(editForm.value.martialArts || 0)
      )
    }
    // 增量更新单条记录
    try {
      await dataApi.update('admission', editingId.value, updated)
    } catch (err: any) {
      ElMessage.error(err.message || '保存失败')
      return
    }
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    loadData()
  }
}

const matchScores = async () => {
  if (!filterYear.value) {
    ElMessage.warning('请先选择毕业年份')
    return
  }

  matching.value = true
  try {
    // 只获取当前筛选条件下的考生数据（而非全量）
    const result = await dataApi.page('admission', {
      page: 1,
      pageSize: 99999,
      graduationYear: filterYear.value,
      school: filterSchool.value || undefined
    })
    const admissionList = result.list || []

    if (admissionList.length === 0) {
      ElMessage.warning('当前筛选条件下没有考生数据')
      return
    }

    // 获取全部年级数据用于匹配（年级数据量相对较小）
    const allData = await dataApi.sync()
    const gradeSevenList = allData.gradeSevenList || []
    const gradeEightList = allData.gradeEightList || []
    const gradeNineList = allData.gradeNineList || []

    // 构建年级数据的 Map 加速查找（避免 O(n*m) 全量遍历）
    const sevenMap = new Map(gradeSevenList.map((item: any) => [item.identityId, item]))
    const eightMap = new Map(gradeEightList.map((item: any) => [item.identityId, item]))
    const nineMap = new Map(gradeNineList.map((item: any) => [item.identityId, item]))

    let matchedCount = 0
    const matchedIds: string[] = []

    admissionList.forEach((admission: any) => {
      const identityId = admission.identityId
      let changed = false

      const sevenData = sevenMap.get(identityId)
      if (sevenData && sevenData.total) { admission.gradeSeven = sevenData.total; changed = true; matchedCount++ }

      const eightData = eightMap.get(identityId)
      if (eightData && eightData.total) { admission.gradeEight = eightData.total; changed = true; matchedCount++ }

      const nineData = nineMap.get(identityId)
      if (nineData) {
        if (nineData.longRun) { admission.longRun = nineData.longRun; changed = true }
        if (nineData.ropeSkipping) { admission.ropeSkipping = nineData.ropeSkipping; changed = true }
        if (nineData.longJump) { admission.longJump = nineData.longJump; changed = true }
        if (nineData.ballSports) { admission.ballSports = nineData.ballSports; changed = true }
        if (nineData.martialArts) { admission.martialArts = nineData.martialArts; changed = true }
        if (changed) matchedCount++
      }

      if (changed) {
        admission.totalScore = Math.round(
          Number(admission.gradeSeven || 0) + Number(admission.gradeEight || 0) +
          Number(admission.longRun || 0) + Number(admission.ropeSkipping || 0) +
          Number(admission.longJump || 0) + Number(admission.ballSports || 0) + Number(admission.martialArts || 0)
        )
        matchedIds.push(admission.id)
      }
    })

    if (matchedIds.length === 0) {
      ElMessage.info('未找到可匹配的成绩数据')
      return
    }

    // 用增量导入 API 只更新匹配到的数据（避免全量覆盖）
    const matchedRows = admissionList.filter((a: any) => matchedIds.includes(a.id))
    await dataApi.import('admission', matchedRows)

    const schoolInfo = filterSchool.value ? `「${filterSchool.value}」` : `所有学校`
    ElMessage.success(`${schoolInfo} ${filterYear.value} 届成绩匹配完成，共匹配 ${matchedCount} 项数据（${matchedIds.length} 人）`)
    loadData()
  } catch (err: any) {
    ElMessage.error(err.message || '匹配失败')
  } finally {
    matching.value = false
  }
}

// 记录选择的文件（确认时才真正处理）
const selectedFile = ref<File | null>(null)

// 确认导入：真正保存数据
const confirmImport = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  await readStudentFile(selectedFile.value, true)
}

const handleStudentFileChange = (file: any) => {
  if (file.raw) {
    selectedFile.value = file.raw
    // 仅解析并显示预览，不保存
    readStudentFile(file.raw, false).then((result: any) => {
      previewData.value = result.preview
      const totalCount = result.totalCount || 0
      const duplicates = result.duplicates
      if (duplicates.length > 0) {
        ElMessage.warning(`发现 ${duplicates.length} 条重复数据（身份证已存在），系统将覆盖旧数据。\n如需取消，请关闭此弹窗后点击「取消」。`)
      } else {
        if (totalCount > 0) {
          ElMessage.success(`解析成功，共 ${totalCount} 条数据，请点击「确认导入」`)
        } else {
          ElMessage.warning('未解析到有效数据，请检查文件格式')
        }
      }
    })
  }
}

const previewData = ref<any[]>([])
const previewColumns = ref<string[]>([])

// 下载导入模板
const downloadTemplate = () => {
  const templateData = [
    ['身份证号', '学校名称', '姓名', '报名序号', '毕业年份'],
    ['410123200501011234', 'XX中学', '张三', '001', '2026'],
    ['41012320050102221X', 'XX中学', '李四', '002', '2026']
  ]
  const ws = XLSX.utils.aoa_to_sheet(templateData)
  // 设置列宽
  ws['!cols'] = [
    { wch: 22 },  // 身份证号
    { wch: 16 },  // 学校名称
    { wch: 10 },  // 姓名
    { wch: 12 },  // 报名序号
    { wch: 12 }   // 毕业年份
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '考生信息模板')
  XLSX.writeFile(wb, '考生信息导入模板.xlsx')
  ElMessage.success('模板下载成功，请按模板格式填写数据后上传')
}

const readStudentFile = (file: File, doSave = true): Promise<{ preview: any[], duplicates: any[], totalCount?: number }> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

        // 同时读取（raw:false 确保文字不会被转成科学计数法）
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as any[][]

        if (jsonData.length < 2) {
          ElMessage.error('文件数据为空')
          resolve({ preview: [], duplicates: [] })
          return
        }

        // 打印原始表头和数据（前2行），方便调试
        const headers = (jsonData[0] || []).map((h: any) => String(h || '').trim())
        console.log('[导入调试] 表头:', headers)
        console.log('[导入调试] 第1行数据:', jsonData[1])

        // 自动识别列索引
        let idCardIdx = -1, schoolIdx = -1, nameIdx = -1, regNumIdx = -1, yearIdx = -1
        headers.forEach((h: string, i: number) => {
          const hl = h.toLowerCase()
          if (hl.includes('身份证') || hl.includes('身份号码')) idCardIdx = i
          else if (hl.includes('学校')) schoolIdx = i
          else if (hl === '姓名' || hl === '名字') nameIdx = i
          else if (hl.includes('报名序号') || hl.includes('报名号')) regNumIdx = i
          else if (hl.includes('毕业年份') || hl.includes('毕业')) yearIdx = i
        })

        // 没找到则按默认顺序
        if (idCardIdx === -1) idCardIdx = 0
        if (schoolIdx === -1) schoolIdx = 1
        if (nameIdx === -1) nameIdx = 2
        if (regNumIdx === -1) regNumIdx = 3
        if (yearIdx === -1) yearIdx = 4

        const rows = jsonData.slice(1)
        let importCount = 0, updateCount = 0, skipCount = 0
        const duplicates: any[] = []

        for (const row of rows) {
          if (!row || row.length === 0) continue

          // 从表头索引直接取值（raw:false 模式，字符串最准确）
          let idCard = String(row[idCardIdx] || '').trim()
          const school = String(row[schoolIdx] || '').trim()
          const name = String(row[nameIdx] || '').trim()
          const registrationNumber = String(row[regNumIdx] || '').trim()
          const graduationYear = String(row[yearIdx] || '').trim()

          // 如果身份证号列为空，但报名序号是G开头 → 跳过（模板列错位，不处理）
          if (!idCard && registrationNumber.toUpperCase().startsWith('G')) {
            console.log(`[导入调试] 身份证号列为空，跳过第 ${rows.indexOf(row) + 2} 行`)
            skipCount++
            continue
          }

          // 如果身份证号是纯数字且超过14位 → 当作科学计数法处理（Excel常见问题）
          if (!idCard || (!/^[A-Z0-9]{15}$/.test(idCard) && !/^[A-Z0-9]{18}$/.test(idCard))) {
            if (/^\d+$/.test(idCard) && idCard.length >= 15) {
              // Excel把长数字转成了纯数字字符串 → 补足位数
              idCard = idCard.padStart(18, '0')
            }
          }

          const idCardClean = idCard.toUpperCase()
          const idCardValid = /^[A-Z0-9]{15}$/.test(idCardClean) || /^[A-Z0-9]{18}$/.test(idCardClean)

          if (!idCard || !idCardValid) {
            console.log(`[导入调试] 第 ${rows.indexOf(row) + 2} 行身份证号无效: idCard="${idCard}" regNum="${registrationNumber}"`)
            skipCount++
            continue
          }

          const identityId = gradeStore.generateIdentityId(idCard)

          const existingIndex = gradeStore.admissionList.findIndex(item => item.identityId === identityId)
          if (existingIndex !== -1) {
            duplicates.push({ idCard, name, school, regNum: registrationNumber })
            updateCount++
          } else {
            importCount++
          }
        }

        if (doSave) {
          // 增量导入到后端
          const importRows: any[] = []
          for (const row of rows) {
            if (!row || row.length === 0) continue

            let idCard = String(row[idCardIdx] || '').trim()
            const school = String(row[schoolIdx] || '').trim()
            const name = String(row[nameIdx] || '').trim()
            const registrationNumber = String(row[regNumIdx] || '').trim()
            const graduationYear = String(row[yearIdx] || '').trim()

            if (!idCard && registrationNumber.toUpperCase().startsWith('G')) continue
            if (!idCard || (!/^[A-Z0-9]{15}$/.test(idCard) && !/^[A-Z0-9]{18}$/.test(idCard))) {
              if (/^\d+$/.test(idCard) && idCard.length >= 15) {
                idCard = idCard.padStart(18, '0')
              }
            }
            const idCardClean = idCard.toUpperCase()
            const idCardValid = /^[A-Z0-9]{15}$/.test(idCardClean) || /^[A-Z0-9]{18}$/.test(idCardClean)
            if (!idCard || !idCardValid) continue

            const identityId = gradeStore.generateIdentityId(idCard)
            importRows.push({
              id: 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + importRows.length,
              identityId,
              school,
              name,
              registrationNumber,
              graduationYear,
              gradeSeven: 0,
              gradeEight: 0,
              longRun: 0,
              ropeSkipping: 0,
              longJump: 0,
              ballSports: 0,
              martialArts: 0,
              totalScore: 0
            })
          }

          // 调用增量导入 API
          try {
            const result = await dataApi.import('admission', importRows)
            ElMessage.success(`考生信息导入成功！新增 ${result.importCount} 条，更新 ${result.updateCount} 条` + (skipCount > 0 ? `，跳过 ${skipCount} 行` : ''))
            showUploadDialog.value = false
            previewData.value = []
            selectedFile.value = null
            loadData()
          } catch (err: any) {
            ElMessage.error('导入失败：' + (err.message || '未知错误'))
          }
          resolve({ preview: [], duplicates: [] })
        } else {
          // 仅预览模式：返回前10行预览数据和重复数据
          const previewRows = rows.slice(0, 10).map((row: any) => {
            let idCard = String(row[idCardIdx] || '').trim()
            const school = String(row[schoolIdx] || '').trim()
            const name = String(row[nameIdx] || '').trim()
            const regNum = String(row[regNumIdx] || '').trim()
            if (!idCard && regNum.toUpperCase().startsWith('G')) idCard = regNum
            return { idCard, school, name, regNum }
          }).filter((item: any) => item.idCard || item.regNum)
          resolve({ preview: previewRows, duplicates, totalCount: importCount + updateCount })
        }
      } catch (error) {
        ElMessage.error('文件解析失败：' + (error instanceof Error ? error.message : String(error)))
        resolve({ preview: [], duplicates: [] })
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

const exportData = async () => {
  try {
    const allData = await dataApi.sync()
    const list = allData.admissionList || []
    const data = list.map((item: any) => ({
      '身份ID': item.identityId,
      '学校名称': item.school,
      '姓名': item.name,
      '报名序号': item.registrationNumber,
      '毕业年份': item.graduationYear,
      '七年级': item.gradeSeven,
      '八年级': item.gradeEight,
      '长跑': item.longRun,
      '跳绳': item.ropeSkipping,
      '跳远': item.longJump,
      '足(篮)球': item.ballSports,
      '武术': item.martialArts,
      '总分': item.totalScore
    }))
  
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '中招体育成绩')
    XLSX.writeFile(wb, `中招体育成绩_${new Date().toISOString().split('T')[0]}.xlsx`)

    ElMessage.success('导出成功')
  } catch (err: any) {
    ElMessage.error('导出失败：' + (err.message || '未知错误'))
  }
}

onMounted(async () => {
  await loadYears()
  await loadSchools()
  loadData()
})
</script>

<style scoped lang="scss">
.admission-grades-page {
  padding: 0;

  .mac-card {
    border-radius: 24px;
    border: 1px solid var(--border-light);
    box-shadow: 0 4px 24px rgba(99, 102, 241, 0.06);
    background: var(--bg-card);

    :deep(.el-card__header) {
      border-bottom: 1px solid var(--border-light);
      padding: 20px 28px;
    }

    :deep(.el-card__body) {
      padding: 24px 28px;
    }
  }

  .page-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .mac-btn {
    border-radius: 8px;
    font-weight: 500;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    background: var(--bg-card);
    transition: all 0.2s ease;

    &:hover {
      background: var(--bg-hover);
      border-color: var(--primary-light);
      color: var(--primary);
    }
  }

  .mac-btn-primary {
    border-radius: 8px;
    font-weight: 500;
    background: var(--primary);
    border: none;
    transition: all 0.2s ease;

    &:hover {
      background: var(--primary-light);
    }
  }

  .mac-btn-success {
    border-radius: 8px;
    font-weight: 500;
    background: var(--accent);
    border: none;
    transition: all 0.2s ease;

    &:hover {
      background: var(--accent-light);
    }
  }

  .filter-section {
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .mac-select {
    width: 180px;
  }

  .mac-search {
    width: 280px;
  }

  .table-section {
    margin-bottom: 20px;
  }

  .mac-table {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid var(--border-light);

    :deep(.el-table__header-wrapper th) {
      border-bottom: 1px solid var(--border-light);
    }

    :deep(.el-table__row) {
      transition: background-color 0.15s ease;

      &:hover > td {
        background: rgba(99, 102, 241, 0.03) !important;
      }
    }

    :deep(.el-table__body tr.el-table__row--striped td) {
      background: rgba(99, 102, 241, 0.015);
    }

    :deep(.el-table__empty-block) {
      min-height: 200px;
    }
  }

  .score-tag {
    display: inline-block;
    background: linear-gradient(135deg, #00c6ff, #8b5cf6);
    color: #fff;
    padding: 2px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    min-width: 36px;
    text-align: center;
  }

  .pagination-section {
    display: flex;
    justify-content: flex-end;

    :deep(.el-pagination) {
      .btn-prev, .btn-next, .el-pager li {
        border-radius: 8px;
        margin: 0 2px;
      }

      .el-pager li.is-active {
        background: var(--primary);
        color: #fff;
      }
    }
  }

  .upload-area {
    :deep(.el-upload-dragger) {
      width: 100%;
      height: 150px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
      border: 2px dashed var(--border);
      background: var(--bg-surface);
      transition: all 0.2s ease;

      &:hover {
        border-color: var(--primary);
        background: rgba(99, 102, 241, 0.02);
      }

      .upload-icon {
        font-size: 36px;
        color: var(--primary);
        margin-bottom: 12px;
      }

      .upload-text {
        font-size: 14px;
        color: var(--text-primary);
        margin-bottom: 4px;

        em {
          color: var(--primary);
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
}
</style>

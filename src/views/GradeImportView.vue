<template>
  <div class="grade-import-page">
    <div class="import-section">
      <div class="card-header">
        <el-button type="primary" @click="downloadTemplate">
          <el-icon><Download /></el-icon>
          下载模板
        </el-button>
      </div>

      <el-upload
        class="upload-area"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="false"
        accept=".xlsx,.xls"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">
          <em>点击上传</em> 或拖拽文件到此处
        </div>
        <div class="upload-tip">
          支持 .xlsx 和 .xls 格式，文件大小不超过 10MB
        </div>
      </el-upload>
      
      <div v-if="uploadedFile" class="file-info">
        <el-alert
          :title="`已选择文件: ${uploadedFile.name}`"
          type="success"
          :closable="false"
          show-icon
        />
        <div class="import-actions">
          <el-button type="primary" :loading="importing" @click="processImport">
            开始导入
          </el-button>
          <el-button type="default" @click="clearFile">重新选择</el-button>
        </div>
      </div>
    </div>

    <div v-if="previewData.length > 0" class="preview-section">
      <div class="section-header">
        <div class="header-actions">
            <el-tag :type="detectedGrade === 'unknown' ? 'danger' : 'success'">
              检测到: {{ gradeText }}
            </el-tag>
            <el-button type="danger" size="small" @click="clearPreview">
              清除预览
            </el-button>
          </div>
        </div>

      <div class="preview-table-wrapper">
        <el-table
          :data="previewData"
          border
          stripe
          height="400"
          style="width: 100%"
        >
          <el-table-column
            v-for="col in previewColumns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            show-overflow-tooltip
          />
        </el-table>
      </div>
      
      <div class="import-summary">
        <el-statistic title="总记录数" :value="previewData.length" />
        <el-popover placement="bottom" :width="550" trigger="hover" :disabled="duplicateCount === 0">
          <template #reference>
            <el-statistic title="重复数据" :value="duplicateCount" value-style="color: #f56c6c; cursor: pointer; text-decoration: underline" />
          </template>
          <el-table :data="duplicateList" border size="small" max-height="300">
            <el-table-column type="index" label="序号" width="50" align="center" />
            <el-table-column prop="school" label="学校" min-width="120" show-overflow-tooltip />
            <el-table-column prop="name" label="姓名" width="80" align="center" />
            <el-table-column prop="idCard" label="身份证号" min-width="160" show-overflow-tooltip />
          </el-table>
        </el-popover>
        <el-statistic title="有效数据" :value="previewData.length - duplicateCount" value-style="color: #67c23a" />
      </div>
      
      <div class="import-actions-bottom">
        <el-button type="primary" size="large" :loading="importing" :disabled="authStore.isSchoolUser && duplicateCount > 0" @click="confirmImport">
          确认导入
        </el-button>
        <el-button type="default" size="large" @click="clearPreview">取消</el-button>
      </div>
    </div>

    <el-dialog
      v-model="duplicateDialogVisible"
      title="发现重复数据"
      width="700px"
    >
      <el-alert
        :title="authStore.isSchoolUser ? '以下数据在系统中已存在，学校账号无法导入重复数据，请联系管理员处理' : '以下数据在系统中已存在，点击确认将排除重复数据，仅导入唯一数据'"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-table :data="duplicateList" border size="small" height="300">
        <el-table-column prop="school" label="学校名称" min-width="180" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="idCard" label="身份证号" min-width="180" />
      </el-table>
      <template #footer>
        <el-button type="default" @click="duplicateDialogVisible = false">取消</el-button>
        <el-button v-if="!authStore.isSchoolUser" type="primary" @click="handleDuplicateConfirm">
          确认（排除重复）
        </el-button>
      </template>
    </el-dialog>

    <!-- 导入错误详情弹窗 -->
    <el-dialog v-model="errorDialogVisible" title="导入校验错误" width="800px">
      <el-alert
        :title="`共发现 ${importErrors.length} 条错误，请修正后重新导入`"
        type="error"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-table :data="importErrors" border size="small" max-height="400">
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="row" label="Excel行号" width="100" align="center" />
        <el-table-column prop="field" label="字段" width="140">
          <template #default="{ row }">
            <el-tag type="danger" size="small">{{ row.field }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="message" label="错误说明" min-width="300" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button type="primary" @click="errorDialogVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, Download } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import { useGradeStore } from '@/stores/grade'
import { useAuthStore } from '@/stores/auth'
import { dataApi } from '@/api'
import { useRouter } from 'vue-router'

const router = useRouter()
const gradeStore = useGradeStore()
const authStore = useAuthStore()

const uploadedFile = ref<File | null>(null)
const importing = ref(false)
const previewData = ref<any[]>([])
const previewColumns = ref<any[]>([])
const detectedGrade = ref<'seven' | 'eight' | 'nine' | 'unknown' | 'mixed'>('unknown')
const duplicateList = ref<Array<{school: string, name: string, idCard: string}>>([])
const duplicateDialogVisible = ref(false)
const duplicateCount = ref(0)

const importErrors = ref<Array<{row: number, field: string, message: string}>>([])
const errorDialogVisible = ref(false)

// 保存 worksheet 引用，用于读取 cell 格式化值（解决身份证号数字精度问题）
let currentSheet: XLSX.WorkSheet | null = null

const gradeText = computed(() => {
  const map: Record<string, string> = {
    'seven': '七年级',
    'eight': '八年级',
    'nine': '九年级',
    'mixed': '七/八年级混合',
    'unknown': '无法识别'
  }
  return map[detectedGrade.value]
})

// 根据年级列内容标准化为年级标识
const normalizeGradeValue = (grade: string, fallback: string): 'seven' | 'eight' | 'nine' => {
  if (!grade) {
    // 如果年级列为空，使用检测到的默认年级
    if (fallback === 'eight') return 'eight'
    if (fallback === 'nine') return 'nine'
    return 'seven'
  }
  const s = grade.replace(/\s/g, '')
  if (s.includes('七') || s.includes('7') || s.includes('初一')) return 'seven'
  if (s.includes('八') || s.includes('8') || s.includes('初二')) return 'eight'
  if (s.includes('九') || s.includes('9') || s.includes('初三')) return 'nine'
  // 默认使用检测到的年级
  if (fallback === 'eight') return 'eight'
  if (fallback === 'nine') return 'nine'
  return 'seven'
}

const handleFileChange = (file: any) => {
  if (file.raw) {
    uploadedFile.value = file.raw
    readExcel(file.raw)
  }
}

const readExcel = (file: File) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      currentSheet = firstSheet // 保存引用供 parseData 使用
      // 使用 raw: true 获取原始值，然后手动处理数字精度问题
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true }) as any[][]
      
      if (jsonData.length < 2) {
        ElMessage.error('文件数据为空')
        return
      }
      
      const headers = jsonData[0] as string[]
      detectGrade(headers)
      processPreviewData(jsonData)
    } catch (error) {
      ElMessage.error('文件解析失败')
      console.error(error)
    }
  }
  reader.readAsArrayBuffer(file)
}

const detectGrade = (headers: string[]) => {
  const headerStr = headers.join(',')
  // 标准化表头：去除空格，统一为无括号形式便于匹配
  const normalizedHeaderStr = headerStr.replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')')

  // 七/八年级识别：通过出勤率、体育考试、体测等关键字组合判断
  const hasAttendance = normalizedHeaderStr.includes('出勤率') || normalizedHeaderStr.includes('出勤')
  const hasExam = normalizedHeaderStr.includes('体育考试') || normalizedHeaderStr.includes('考试成绩')
  const hasFitness = normalizedHeaderStr.includes('体测') || normalizedHeaderStr.includes('体质')

  if (hasAttendance && hasExam && hasFitness) {
    if (normalizedHeaderStr.includes('七年级') || normalizedHeaderStr.includes('初一')) {
      detectedGrade.value = 'seven'
    } else if (normalizedHeaderStr.includes('八年级') || normalizedHeaderStr.includes('初二')) {
      detectedGrade.value = 'eight'
    } else {
      // 如果表头没有明确年级标识，默认按七年级处理（用户可在预览中确认）
      detectedGrade.value = 'seven'
    }
    return
  }

  // 九年级识别：通过长跑、跳绳、跳远、球类、武术等关键字判断
  const hasLongRun = normalizedHeaderStr.includes('长跑') || normalizedHeaderStr.includes('1000米') || normalizedHeaderStr.includes('800米')
  const hasRopeSkipping = normalizedHeaderStr.includes('跳绳')
  const hasLongJump = normalizedHeaderStr.includes('跳远')
  const hasBallSports = normalizedHeaderStr.includes('足球') || normalizedHeaderStr.includes('篮球') || normalizedHeaderStr.includes('球')
  const hasMartialArts = normalizedHeaderStr.includes('武术')

  if (hasLongRun || hasRopeSkipping || hasLongJump || hasBallSports || hasMartialArts) {
    detectedGrade.value = 'nine'
    return
  }

  // 兜底：通过合计列判断（七/八年级模板有"合计"列）
  if (normalizedHeaderStr.includes('合计')) {
    detectedGrade.value = 'seven'
    return
  }

  detectedGrade.value = 'unknown'
}

// 从表头构建列索引映射（兼容旧模板有学籍号和新模板无学籍号）
function buildColMap(headers) {
  const map: Record<string, number> = {}
  headers.forEach((h, i) => {
    const s = String(h || '').replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')')
    if (s.includes('学校') && !s.includes('毕业')) map.school = i
    else if (s === '姓名' || s === '名字') map.name = i
    else if (s.includes('身份证') || s.includes('身份号码')) map.idCard = i
    else if (s.includes('学籍号') || s.includes('报名序号') || s.includes('报名号')) map.studentNumber = i
    else if (s.includes('毕业年份') || s.includes('毕业') || s.includes('届')) map.graduationYear = i
    else if (s.includes('年级') && !s.includes('毕业年')) map.grade = i
    else if (s.includes('出勤率') || s.includes('出勤')) map.attendanceScore = i
    else if (s.includes('体育考试') || s.includes('考试成绩')) map.examScore = i
    else if (s.includes('体测') || s.includes('体质')) map.fitnessScore = i
    else if (s === '合计' || s === '总分') map.total = i
    else if (s.includes('长跑') || s.includes('1000米') || s.includes('800米')) map.longRun = i
    else if (s.includes('跳绳')) map.ropeSkipping = i
    else if (s.includes('跳远')) map.longJump = i
    else if (s.includes('足球') || s.includes('篮球') || s.includes('球')) map.ballSports = i
    else if (s.includes('武术')) map.martialArts = i
    else if (s.includes('备注')) map.remark = i
  })
  return map
}

// 安全读取单元格值
function cellVal(row, colMap, key, fallbackIdx) {
  const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx
  return idx >= 0 ? String(row[idx] || '').trim() : ''
}

// 安全读取数值单元格
function cellNum(row, colMap, key, fallbackIdx) {
  const idx = colMap[key] !== undefined ? colMap[key] : fallbackIdx
  return idx >= 0 ? (parseFloat(row[idx]) || 0) : 0
}

const processPreviewData = (jsonData: any[][]) => {
  const headers = jsonData[0] as string[]
  const rows = jsonData.slice(1)

  // 构建列映射
  const colMap = buildColMap(headers)

  // 先根据表头判断格式类型
  const headerStr = headers.join(',')
  const normalizedHeaderStr = headerStr.replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')')

  const hasAttendance = normalizedHeaderStr.includes('出勤率') || normalizedHeaderStr.includes('出勤')
  const hasExam = normalizedHeaderStr.includes('体育考试') || normalizedHeaderStr.includes('考试成绩')
  const hasFitness = normalizedHeaderStr.includes('体测') || normalizedHeaderStr.includes('体质')
  const hasLongRun = normalizedHeaderStr.includes('长跑') || normalizedHeaderStr.includes('1000米') || normalizedHeaderStr.includes('800米')
  const hasRopeSkipping = normalizedHeaderStr.includes('跳绳')

  let formatType: 'seven-eight' | 'nine' = 'seven-eight'
  if (hasLongRun || hasRopeSkipping) {
    formatType = 'nine'
  } else if (!(hasAttendance && hasExam && hasFitness)) {
    if (!normalizedHeaderStr.includes('合计')) {
      ElMessage.error('无法识别文件格式，请检查表头')
      return
    }
  }

  // 年级列索引（优先从映射获取）
  const gradeCol = colMap.grade !== undefined ? colMap.grade : 4

  // 扫描数据行的年级列，确定实际年级
  const gradeCounts: Record<string, number> = { seven: 0, eight: 0, nine: 0 }
  let actualGrade: 'seven' | 'eight' | 'nine' | 'mixed' = 'seven'

  rows.forEach(row => {
    const grade = String(row[gradeCol] || '').trim()
    if (!grade) return

    const normalizedGrade = grade.replace(/\s/g, '')
    if (normalizedGrade.includes('七') || normalizedGrade.includes('7') || normalizedGrade.includes('初一')) {
      gradeCounts.seven++
    } else if (normalizedGrade.includes('八') || normalizedGrade.includes('8') || normalizedGrade.includes('初二')) {
      gradeCounts.eight++
    } else if (normalizedGrade.includes('九') || normalizedGrade.includes('9') || normalizedGrade.includes('初三')) {
      gradeCounts.nine++
    }
  })

  // 确定实际年级
  const totalRows = rows.filter(row => row[0]).length
  const sevenRatio = gradeCounts.seven / totalRows
  const eightRatio = gradeCounts.eight / totalRows
  const nineRatio = gradeCounts.nine / totalRows

  if (formatType === 'nine') {
    // 九年级格式，默认按九年级处理
    actualGrade = 'nine'
  } else {
    // 七/八年级格式，根据数据行的年级列判断
    if (eightRatio > 0.5) {
      actualGrade = 'eight'
    } else if (sevenRatio > 0.5) {
      actualGrade = 'seven'
    } else if (gradeCounts.eight > 0 && gradeCounts.seven > 0) {
      // 同时有七年级和八年级
      actualGrade = 'mixed'
    } else if (gradeCounts.eight > 0) {
      actualGrade = 'eight'
    } else {
      actualGrade = 'seven'
    }
  }

  detectedGrade.value = actualGrade

  const columns: any[] = []
  
  if (detectedGrade.value === 'seven' || detectedGrade.value === 'eight' || detectedGrade.value === 'mixed') {
    columns.push(
      { prop: 'school', label: '学校', width: 180 },
      { prop: 'name', label: '姓名', width: 100 },
      { prop: 'idCard', label: '身份证', width: 180 },
      { prop: 'identityId', label: '身份ID', width: 180 },
      { prop: 'graduationYear', label: '毕业年份', width: 100 },
      { prop: 'grade', label: '年级', width: 80 },
      { prop: 'attendanceScore', label: '出勤率成绩', width: 100 },
      { prop: 'examScore', label: '体育考试成绩', width: 110 },
      { prop: 'fitnessScore', label: '体测成绩', width: 90 },
      { prop: 'total', label: '合计', width: 80 },
      { prop: 'totalVerify', label: '合计校对', width: 100 },
      { prop: 'verifyResult', label: '校对结果', width: 90 },
      { prop: 'remark', label: '备注', width: '80', showOverflowTooltip: true }
    )
  } else if (detectedGrade.value === 'nine') {
    columns.push(
      { prop: 'school', label: '学校', width: 180 },
      { prop: 'name', label: '姓名', width: 100 },
      { prop: 'idCard', label: '身份证', width: 180 },
      { prop: 'identityId', label: '身份ID', width: 180 },
      { prop: 'graduationYear', label: '毕业年份', width: 100 },
      { prop: 'grade', label: '年级', width: 80 },
      { prop: 'longRun', label: '长跑', width: 80 },
      { prop: 'ropeSkipping', label: '跳绳', width: 80 },
      { prop: 'longJump', label: '跳远', width: 80 },
      { prop: 'ballSports', label: '足(篮)球', width: 90 },
      { prop: 'martialArts', label: '武术', width: 80 },
      { prop: 'remark', label: '备注', width: '80', showOverflowTooltip: true }
    )
  }
  
  previewColumns.value = columns

  const processedData: any[] = []
  duplicateList.value = []
  const pushedIds = new Set<string>()
  // 本次导入文件内的身份证号去重检测
  const idCardInFile = new Map<string, { school: string; name: string; idCard: string }>()

  rows.forEach((row, index) => {
    // 使用列映射安全读取，带兜底索引
    const school = cellVal(row, colMap, 'school', 0)
    const name = cellVal(row, colMap, 'name', 1)
    if (!school && !name) return

    // 提取身份证号：优先从 worksheet cell 的格式化值中获取
    let idCard = ''
    const idCardCol = colMap.idCard !== undefined ? colMap.idCard : 2
    if (currentSheet) {
      const cellRef = XLSX.utils.encode_cell({ r: index + 1, c: idCardCol })
      const cell = currentSheet[cellRef]
      if (cell && cell.w) {
        idCard = String(cell.w).trim()
      }
    }
    if (!idCard) {
      idCard = String(row[idCardCol] || '').trim()
    }

    const identityId = idCard.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const graduationYear = cellVal(row, colMap, 'graduationYear', 3)
    const grade = cellVal(row, colMap, 'grade', 4)
    const remark = cellVal(row, colMap, 'remark', formatType === 'nine' ? 10 : 9)

    const rowGrade = normalizeGradeValue(grade, detectedGrade.value)

    // 检测导入文件内部的重复身份证号
    if (idCard) {
      const idKey = idCard.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      if (idCardInFile.has(idKey)) {
        const exist = idCardInFile.get(idKey)!
        if (!pushedIds.has(idKey)) { duplicateList.value.push({ school: exist.school, name: exist.name, idCard: exist.idCard }); pushedIds.add(idKey) }
        duplicateList.value.push({ school, name, idCard })
        duplicateCount.value++
      } else {
        idCardInFile.set(idKey, { school, name, idCard })
      }
    }

    // 检测与系统已有数据的重复
    const duplicates = gradeStore.checkDuplicateIdCard(idCard, rowGrade, grade)
    if (duplicates.length > 0 && !pushedIds.has(identityId)) {
      duplicateList.value.push({ school, name, idCard })
      duplicateCount.value++
      pushedIds.add(identityId)
    }

    const baseData = {
      school,
      name,
      idCard,
      identityId,
      graduationYear,
      grade,
      remark,
      _rowGrade: rowGrade
    }

    if (formatType === 'seven-eight') {
      const attendanceScore = cellNum(row, colMap, 'attendanceScore', 5)
      const examScore = cellNum(row, colMap, 'examScore', 6)
      const fitnessScore = cellNum(row, colMap, 'fitnessScore', 7)
      const total = cellNum(row, colMap, 'total', 8)
      const totalVerify = parseFloat((attendanceScore + examScore + fitnessScore).toFixed(1))
      const verifyResult = Math.abs(totalVerify - total) < 0.1

      processedData.push({
        ...baseData,
        attendanceScore,
        examScore,
        fitnessScore,
        total,
        totalVerify,
        verifyResult: verifyResult ? '✅' : '❌'
      })
    } else if (formatType === 'nine') {
      processedData.push({
        ...baseData,
        longRun: cellNum(row, colMap, 'longRun', 5),
        ropeSkipping: cellNum(row, colMap, 'ropeSkipping', 6),
        longJump: cellNum(row, colMap, 'longJump', 7),
        ballSports: cellNum(row, colMap, 'ballSports', 8),
        martialArts: cellNum(row, colMap, 'martialArts', 9)
      })
    }
  })
  
  previewData.value = processedData
}

// 页面加载时同步数据，确保重复检测能对比系统已有数据
onMounted(async () => {
  try {
    const res = await dataApi.sync()
    if (res) {
      gradeStore.gradeSevenList = res.gradeSevenList || []
      gradeStore.gradeEightList = res.gradeEightList || []
      gradeStore.gradeNineList = res.gradeNineList || []
      gradeStore.admissionList = res.admissionList || []
    }
  } catch { /* ignore */ }
})

const processImport = async () => {
  if (detectedGrade.value === 'unknown') {
    ElMessageBox.confirm(
      '系统无法自动识别该文件的年级类型，请手动选择。',
      '请选择年级',
      {
        confirmButtonText: '七/八年级',
        cancelButtonText: '九年级',
        distinguishCancelAndClose: true,
        type: 'warning'
      }
    ).then(() => {
      detectedGrade.value = 'seven'
      // 重新处理预览数据
      if (uploadedFile.value) {
        readExcel(uploadedFile.value)
      }
      ElMessage.info('已识别为七/八年级格式，请确认预览数据')
    }).catch((action) => {
      if (action === 'cancel') {
        // 学校用户不能导入九年级成绩
        if (authStore.isSchoolUser) {
          ElMessage.error('学校账号无法导入九年级成绩，请使用管理员账号操作')
          detectedGrade.value = 'unknown'
          previewData.value = []
          previewColumns.value = []
          return
        }
        detectedGrade.value = 'nine'
        // 重新处理预览数据
        if (uploadedFile.value) {
          readExcel(uploadedFile.value)
        }
        ElMessage.info('已识别为九年级格式，请确认预览数据')
      }
    })
    return
  }
  
  if (previewData.value.length === 0) {
    ElMessage.warning('没有可导入的数据，请检查文件内容')
    return
  }

  if (duplicateList.value.length > 0) {
    // 暂存重复数据到后端
    try {
      const dupRows = duplicateList.value.map(d => {
        const item = previewData.value.find(p => p.idCard === d.idCard)
        if (!item) return null
        return {
          school: item.school || '', name: item.name || '', idCard: item.idCard || '',
          identityId: item.identityId || '', graduationYear: item.graduationYear || '',
          grade: item.grade || '', gradeLevel: detectedGrade.value,
          attendanceScore: item.attendanceScore ?? null, examScore: item.examScore ?? null,
          fitnessScore: item.fitnessScore ?? null, total: item.total ?? null,
          totalVerify: item.totalVerify ?? null,
          verifyResult: (item.verifyResult === '✅' || item.verifyResult === true) ? 1 : 0,
          longRun: item.longRun ?? null, ropeSkipping: item.ropeSkipping ?? null,
          longJump: item.longJump ?? null, ballSports: item.ballSports ?? null,
          martialArts: item.martialArts ?? null,
          remark: item.remark || ''
        }
      }).filter(Boolean)
      if (dupRows.length > 0) {
        await dataApi.saveDuplicates(dupRows)
      }
    } catch (e: any) { console.error('暂存重复数据失败', e) }
    duplicateDialogVisible.value = true
  } else {
    confirmImport()
  }
}

const handleDuplicateConfirm = () => {
  duplicateDialogVisible.value = false
  confirmImport()
}

const confirmImport = async () => {
  importing.value = true

  try {
    // 构建重复身份证号集合（仅用于提示和查找已有ID）
    const duplicateIdCards = new Set(duplicateList.value.map(d => d.idCard))

    // 按年级分组构建所有行（包括重复数据，使用已有ID以支持更新）
    const sevenRows: any[] = []
    const eightRows: any[] = []
    const nineRows: any[] = []
    let sevenNew = 0, sevenUpd = 0, eightNew = 0, eightUpd = 0, nineNew = 0, nineUpd = 0

    for (const item of previewData.value) {
      const rowGrade = item._rowGrade || detectedGrade.value
      const identityId = gradeStore.generateIdentityId(item.idCard)

      // 查找是否已存在于对应年级列表中（用于获取已有ID）
      const targetList = rowGrade === 'seven' ? gradeStore.gradeSevenList
        : rowGrade === 'eight' ? gradeStore.gradeEightList
        : gradeStore.gradeNineList
      const existing = targetList.find((s: any) => s.identityId === identityId)

      const commonData = {
        school: item.school,
        name: item.name,
        idCard: item.idCard,
        identityId,
        graduationYear: item.graduationYear,
        grade: item.grade,
        remark: item.remark || ''
      }

      // ID：已有记录用旧ID（更新），新记录生成新ID
      const rowId = existing ? existing.id : ('id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9))
      const isUpdate = !!existing

      if (rowGrade === 'seven') {
        const totalVerify = parseFloat(((item.attendanceScore || 0) + (item.examScore || 0) + (item.fitnessScore || 0)).toFixed(1))
        sevenRows.push({
          ...commonData,
          id: rowId,
          attendanceScore: item.attendanceScore || 0,
          examScore: item.examScore || 0,
          fitnessScore: item.fitnessScore || 0,
          total: item.total || 0,
          totalVerify,
          verifyResult: Math.abs(totalVerify - (item.total || 0)) < 0.1 ? 1 : 0
        })
        isUpdate ? sevenUpd++ : sevenNew++
      } else if (rowGrade === 'eight') {
        const totalVerify = parseFloat(((item.attendanceScore || 0) + (item.examScore || 0) + (item.fitnessScore || 0)).toFixed(1))
        eightRows.push({
          ...commonData,
          id: rowId,
          attendanceScore: item.attendanceScore || 0,
          examScore: item.examScore || 0,
          fitnessScore: item.fitnessScore || 0,
          total: item.total || 0,
          totalVerify,
          verifyResult: Math.abs(totalVerify - (item.total || 0)) < 0.1 ? 1 : 0
        })
        isUpdate ? eightUpd++ : eightNew++
      } else if (rowGrade === 'nine') {
        nineRows.push({
          ...commonData,
          id: rowId,
          longRun: item.longRun || 0,
          ropeSkipping: item.ropeSkipping || 0,
          longJump: item.longJump || 0,
          ballSports: item.ballSports || 0,
          martialArts: item.martialArts || 0
        })
        isUpdate ? nineUpd++ : nineNew++
      }
    }

    // 批量导入：每个年级只发一次 HTTP 请求
    const promises: Promise<any>[] = []
    if (sevenRows.length > 0) promises.push(dataApi.import('grade_seven', sevenRows))
    if (eightRows.length > 0) promises.push(dataApi.import('grade_eight', eightRows))
    if (nineRows.length > 0) promises.push(dataApi.import('grade_nine', nineRows))
    await Promise.all(promises)

    // 同步更新本地 store：移除已有记录，追加新数据
    if (sevenRows.length > 0) {
      const sevenIds = new Set(sevenRows.map(r => r.id))
      gradeStore.gradeSevenList = gradeStore.gradeSevenList.filter(s => !sevenIds.has(s.id)).concat(sevenRows)
    }
    if (eightRows.length > 0) {
      const eightIds = new Set(eightRows.map(r => r.id))
      gradeStore.gradeEightList = gradeStore.gradeEightList.filter(s => !eightIds.has(s.id)).concat(eightRows)
    }
    if (nineRows.length > 0) {
      const nineIds = new Set(nineRows.map(r => r.id))
      gradeStore.gradeNineList = gradeStore.gradeNineList.filter(s => !nineIds.has(s.id)).concat(nineRows)
    }

    // 构建结果提示
    const parts: string[] = []
    if (sevenRows.length > 0) parts.push(`七年级 ${sevenNew} 条新增${sevenUpd > 0 ? '，' + sevenUpd + ' 条更新' : ''}`)
    if (eightRows.length > 0) parts.push(`八年级 ${eightNew} 条新增${eightUpd > 0 ? '，' + eightUpd + ' 条更新' : ''}`)
    if (nineRows.length > 0) parts.push(`九年级 ${nineNew} 条新增${nineUpd > 0 ? '，' + nineUpd + ' 条更新' : ''}`)
    ElMessage.success(`成功导入：${parts.join('；')}`)

    // 跳转
    setTimeout(() => {
      const sc = sevenRows.length, ec = eightRows.length, nc = nineRows.length
      if (sc >= ec && sc >= nc) router.push('/grade-seven')
      else if (ec >= sc && ec >= nc) router.push('/grade-eight')
      else router.push('/grade-nine')
    }, 1000)
  } catch (error: any) {
    if (error.errors && Array.isArray(error.errors)) {
      importErrors.value = error.errors
      errorDialogVisible.value = true
    } else {
      ElMessage.error('导入失败：' + (error?.message || '未知错误'))
    }
    console.error(error)
  } finally {
    importing.value = false
  }
}

const clearFile = () => {
  uploadedFile.value = null
  previewData.value = []
  previewColumns.value = []
  detectedGrade.value = 'unknown'
  duplicateList.value = []
  duplicateCount.value = 0
}

const clearPreview = () => {
  previewData.value = []
  previewColumns.value = []
  detectedGrade.value = 'unknown'
  duplicateList.value = []
  duplicateCount.value = 0
}

const downloadTemplate = () => {
  if (authStore.isSchoolUser) {
    downloadSevenEightTemplate()
    return
  }
  ElMessageBox.confirm('请选择要下载的模板类型', '下载模板', {
    confirmButtonText: '七/八年级模板',
    cancelButtonText: '九年级模板',
    distinguishCancelAndClose: true
  }).then(() => {
    downloadSevenEightTemplate()
  }).catch((action) => {
    if (action === 'cancel') {
      downloadNineTemplate()
    }
  })
}

const downloadSevenEightTemplate = () => {
  const headers = ['学校', '姓名', '身份证', '毕业年份', '年级', '出勤率成绩', '体育考试成绩', '体测成绩', '合计', '备注']
  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '模板')
  XLSX.writeFile(wb, '七八年级成绩导入模板.xlsx')
}

const downloadNineTemplate = () => {
  const headers = ['学校', '姓名', '身份证', '毕业年份', '年级', '长跑', '跳绳', '跳远', '足(篮)球', '武术', '备注']
  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '模板')
  XLSX.writeFile(wb, '九年级成绩导入模板.xlsx')
}
</script>

<style scoped lang="scss">
.grade-import-page {
  padding: 0;
  min-height: 100%;

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

  .import-section {
    margin-bottom: 24px;
  }

  .preview-section {
    margin-top: 24px;
  }

  .section-header, .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 18px;
    margin-bottom: 12px;

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }
  }

  .upload-area {
    :deep(.el-upload-dragger) {
      width: 100%;
      height: 200px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      .upload-icon {
        font-size: 48px;
        color: var(--primary);
        margin-bottom: 16px;
      }

      .upload-text {
        font-size: 16px;
        color: var(--text-secondary);
        margin-bottom: 8px;

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

  .file-info {
    margin-top: 24px;

    .import-actions {
      margin-top: 16px;
      display: flex;
      gap: 12px;
    }
  }

  .preview-table-wrapper {
    margin-bottom: 24px;
  }

  .import-summary {
    display: flex;
    gap: 48px;
    margin-bottom: 24px;
    padding: 16px;
    background: var(--bg-surface);
    border-radius: 8px;
  }

  .import-actions-bottom {
    display: flex;
    justify-content: center;
    gap: 16px;
  }
}
</style>

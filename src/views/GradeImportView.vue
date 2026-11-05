<template>
  <div class="grade-import-page">
    <!-- 顶部说明：当前身份对应的落点 -->
    <el-alert
      :type="authStore.isSchoolUser ? 'warning' : 'info'"
      :closable="false"
      show-icon
      class="mode-alert"
    >
      <template #title>
        <template v-if="isRegistrationMode">
          当前身份：<b>{{ authStore.userSchoolName }}</b> —— 九年级由学校上报<b>报名信息</b>，
          教育局审核通过名单并导入成绩后，才会计入正式成绩表。
        </template>
        <template v-else-if="authStore.isSchoolUser">
          当前身份：<b>{{ authStore.userSchoolName }}</b> —— 导入的成绩将<b>提交管理员审核</b>，审核发布后才会计入正式成绩表。
        </template>
        <template v-else>
          当前身份：<b>管理员</b> —— 导入的成绩将<b>直接写入正式成绩表</b>，并记录操作日志。
        </template>
      </template>
    </el-alert>

    <!-- 上报条件：学校账号需要显式选年份与年级 -->
    <div v-if="authStore.isSchoolUser" class="form-card card-surface">
      <el-form :inline="true" label-position="top">
        <el-form-item label="毕业年份">
          <el-select v-model="form.year" placeholder="请选择" style="width: 160px">
            <el-option v-for="y in yearOptions" :key="y" :label="y + '届'" :value="y" />
          </el-select>
        </el-form-item>
        <el-form-item label="上报年级">
          <el-select v-model="form.gradeLevel" placeholder="请选择" style="width: 160px" @change="resetAll">
            <el-option label="七年级" value="seven" />
            <el-option label="八年级" value="eight" />
            <el-option label="九年级（上报报名信息）" value="nine" />
          </el-select>
        </el-form-item>
        <el-form-item label="&nbsp;">
          <el-button type="primary" plain :disabled="!form.gradeLevel" @click="downloadTemplate">
            <el-icon><Download /></el-icon>
            {{ isRegistrationMode ? '下载报名表模板' : '下载上报模板' }}
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 管理员：导入类型 -->
    <div v-else class="form-card card-surface">
      <el-form :inline="true" label-position="top">
        <el-form-item label="毕业年份">
          <el-select v-model="form.year" placeholder="请选择" style="width: 160px">
            <el-option v-for="y in yearOptions" :key="y" :label="y + '届'" :value="y" />
          </el-select>
        </el-form-item>
        <el-form-item label="导入类型">
          <el-radio-group v-model="adminMode" @change="resetAll">
            <el-radio-button value="score78">七/八年级成绩</el-radio-button>
            <el-radio-button value="score9">九年级成绩</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="&nbsp;">
          <el-button type="primary" plain :disabled="!form.year" @click="downloadTemplate">
            <el-icon><Download /></el-icon>
            {{ isNineScoreMode ? '下载成绩模板' : '下载导入模板' }}
          </el-button>
        </el-form-item>
      </el-form>
      <el-alert
        v-if="isNineScoreMode"
        type="info"
        :closable="false"
        show-icon
        title="九年级成绩按身份证号与学校上报的报名名单匹配，导入时会校验「性别 ↔ 长跑项目（男生1000米 / 女生800米）」以及球类项目是否与报名一致。"
      />
    </div>

    <!-- 上传区 -->
    <div class="upload-card card-surface">
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
          支持 .xlsx / .xls 格式，文件大小不超过 10MB，单次最多 5 万行
          <template v-if="isRegistrationMode">；请上传「九年级报名表」，列含性别、长跑项目、球类项目；<b>备注有内容时（病免/残免/弃考等）项目列必须留空</b></template>
          <template v-else-if="isNineScoreMode">；请上传「九年级成绩表」，按身份证号匹配报名名单</template>
          <template v-else-if="!authStore.isSchoolUser">；年级由系统自动识别，可混合七/八年级</template>
        </div>
      </el-upload>

      <div v-if="uploadedFile" class="file-info">
        <el-alert :title="`已选择文件：${uploadedFile.name}`" type="success" :closable="false" show-icon />
        <div class="file-actions">
          <el-button type="primary" :loading="checking" @click="runPreview">
            {{ isRegistrationMode ? '预检报名信息' : '校验并预览差异' }}
          </el-button>
          <el-button @click="clearFile">重新选择</el-button>
        </div>
      </div>
    </div>

    <!-- 预检结果 -->
    <div v-if="previewResult" class="result-card card-surface">
      <div class="section-header">
        <div class="header-title">校验结果</div>
        <el-tag v-if="previewResult.valid" type="success" effect="light">
          校验通过
        </el-tag>
        <el-tag v-else type="danger" effect="light">
          发现 {{ previewResult.errorCount }} 处问题
        </el-tag>
      </div>

      <!-- 报名模式：只报人数 -->
      <div v-if="previewResult.valid && isRegistrationMode" class="diff-summary">
        <div class="diff-item">
          <div class="diff-value new">{{ previewResult.totalRows }}</div>
          <div class="diff-label">可报名人数</div>
        </div>
      </div>

      <!-- 九年级成绩：只报可导入人数 -->
      <div v-else-if="previewResult.valid && isNineScoreMode" class="diff-summary">
        <div class="diff-item">
          <div class="diff-value new">{{ previewResult.newCount }}</div>
          <div class="diff-label">可导入成绩</div>
        </div>
        <div class="diff-item">
          <div class="diff-value total">{{ previewResult.totalRows }}</div>
          <div class="diff-label">文件行数</div>
        </div>
      </div>

      <!-- 成绩模式：差异概览 -->
      <div v-else-if="previewResult.valid" class="diff-summary">
        <div class="diff-item">
          <div class="diff-value new">{{ previewResult.newCount }}</div>
          <div class="diff-label">新增</div>
        </div>
        <div class="diff-item">
          <div class="diff-value update">{{ previewResult.updateCount }}</div>
          <div class="diff-label">更新</div>
        </div>
        <div class="diff-item">
          <div class="diff-value same">{{ previewResult.sameCount }}</div>
          <div class="diff-label">无变化</div>
        </div>
        <div class="diff-item">
          <div class="diff-value total">{{ previewResult.totalRows }}</div>
          <div class="diff-label">总行数</div>
        </div>
        <div class="diff-item" v-if="mismatchCount > 0">
          <div class="diff-value mismatch">{{ mismatchCount }}</div>
          <div class="diff-label">合计不符</div>
        </div>
      </div>

      <el-alert
        v-if="previewResult.valid && mismatchCount > 0"
        type="warning"
        :closable="false"
        show-icon
        class="mismatch-alert"
        :title="`有 ${mismatchCount} 条记录的「合计」与出勤率 + 体育考试 + 体测之和不符，导入后会被标记为校对异常，请确认是否为原始数据的问题。`"
      />

      <!-- 错误清单 -->
      <template v-if="!previewResult.valid">
        <el-table :data="previewResult.errors" border size="small" max-height="320">
          <el-table-column type="index" label="序号" :width="60" :min-width="60" align="center" />
          <el-table-column prop="row" label="Excel行号" :width="100" :min-width="100" align="center" />
          <el-table-column prop="field" label="字段" :width="150" :min-width="150">
            <template #default="{ row }">
              <el-tag type="danger" size="small">{{ row.field }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="错误说明" min-width="320" show-overflow-tooltip />
        </el-table>
        <div class="tip-row">
          <el-button type="danger" plain @click="exportErrors">导出错误清单</el-button>
          <span class="tip-text">导出后可对照修正，再重新上传</span>
        </div>
        <el-alert
          v-if="canPartialImport"
          type="warning"
          :closable="false"
          show-icon
          class="partial-alert"
          :title="`以上 ${previewResult.errorCount} 处问题涉及 ${blockedRows.size} 行，这些行不会被导入。其余 ${importableCount} 条数据是正常的，可以先导入，剩下的改完再传一次。`"
        />
      </template>

      <!-- 九年级成绩：逐条预览 -->
      <template v-if="previewResult.valid && isNineScoreMode">
        <el-table :data="nineScorePreview" border stripe size="small" max-height="320">
          <el-table-column type="index" label="序号" :width="60" :min-width="60" align="center" />
          <el-table-column prop="school" label="学校" min-width="140" show-overflow-tooltip />
          <el-table-column prop="name" label="姓名" :width="100" :min-width="100" />
          <el-table-column prop="identityId" label="身份ID" min-width="180" show-overflow-tooltip />
          <el-table-column prop="longRunEvent" label="长跑项目" :width="100" :min-width="100" align="center" />
          <el-table-column prop="longRun" label="长跑" :width="80" :min-width="80" align="center" />
          <el-table-column prop="ropeSkipping" label="跳绳" :width="80" :min-width="80" align="center" />
          <el-table-column prop="longJump" label="跳远" :width="80" :min-width="80" align="center" />
          <el-table-column prop="ballEvent" label="球类项目" :width="100" :min-width="100" align="center" />
          <el-table-column prop="ballSports" label="足(篮)球" :width="90" :min-width="90" align="center" />
          <el-table-column prop="martialArts" label="武术" :width="80" :min-width="80" align="center" />
        </el-table>
        <div class="tip-row">
          <span class="tip-text">以上成绩将同时写入「九年级成绩」与「中招体育成绩」两张表。</span>
        </div>
      </template>

      <!-- 差异明细 -->
      <template v-else-if="!isRegistrationMode && !isNineScoreMode">
        <el-tabs v-model="diffTab" class="diff-tabs">
          <el-tab-pane :label="`新增 (${previewResult.newCount})`" name="new">
            <el-table :data="previewResult.newRows" border stripe size="small" max-height="300">
              <el-table-column prop="row" label="Excel行号" :width="100" :min-width="100" align="center" />
              <el-table-column prop="school" label="学校" min-width="140" show-overflow-tooltip />
              <el-table-column prop="name" label="姓名" :width="110" :min-width="110" />
              <el-table-column prop="idCard" label="身份证号" min-width="180" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
          <el-tab-pane :label="`更新 (${previewResult.updateCount})`" name="update">
            <el-table :data="previewResult.updateRows" border stripe size="small" max-height="300">
              <el-table-column prop="row" label="Excel行号" :width="100" :min-width="100" align="center" />
              <el-table-column prop="school" label="学校" min-width="130" show-overflow-tooltip />
              <el-table-column prop="name" label="姓名" :width="100" :min-width="100" />
              <el-table-column prop="idCard" label="身份证号" min-width="170" show-overflow-tooltip />
              <el-table-column label="变动字段" min-width="280">
                <template #default="{ row }">
                  <el-tag
                    v-for="(c, i) in row.changes"
                    :key="i"
                    size="small"
                    type="warning"
                    class="change-tag"
                  >
                    {{ FIELD_LABELS[c.field] || c.field }}：{{ c.from ?? '空' }} → {{ c.to ?? '空' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
          <el-tab-pane :label="`无变化 (${previewResult.sameCount})`" name="same">
            <el-table :data="previewResult.sameRows" border stripe size="small" max-height="300">
              <el-table-column prop="row" label="Excel行号" :width="100" :min-width="100" align="center" />
              <el-table-column prop="school" label="学校" min-width="140" show-overflow-tooltip />
              <el-table-column prop="name" label="姓名" :width="110" :min-width="110" />
              <el-table-column prop="idCard" label="身份证号" min-width="180" show-overflow-tooltip />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>

      <!-- 提交栏（三种模式共用） -->
      <div v-if="previewResult.valid || canPartialImport" class="submit-row">
        <template v-if="previewResult.valid && !authStore.isSchoolUser && !isRegistrationMode && previewResult.updateCount > 0">
          <el-radio-group v-model="importMode" size="default">
            <el-radio value="all">导入全部（新增 + 更新 {{ previewResult.updateCount }} 条）</el-radio>
            <el-radio value="onlyNew">仅导入新增，更新项暂存到「待处理」</el-radio>
          </el-radio-group>
        </template>
        <el-button
          type="primary"
          size="large"
          :loading="submitting"
          :disabled="isRegistrationMode ? previewResult.totalRows === 0 : importableCount === 0"
          @click="doSubmit"
        >
          {{ submitButtonText }}
        </el-button>
        <el-button size="large" @click="clearAll">取消</el-button>
      </div>
    </div>

    <!-- 我的上报记录（仅学校账号） -->
    <div v-if="authStore.isSchoolUser" class="history-card card-surface">
      <div class="section-header">
        <div class="header-title">{{ isRegistrationMode ? '我的报名记录' : '我的上报记录' }}</div>
        <el-button text :loading="loadingHistory" @click="loadHistory">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>

      <!-- 报名记录 -->
      <el-table v-if="isRegistrationMode" v-loading="loadingHistory" :data="history" border stripe size="small">
        <el-table-column type="index" label="#" :width="64" :min-width="64" align="center" />
        <el-table-column prop="graduationYear" label="年份" :width="90" :min-width="90" align="center">
          <template #default="{ row }">{{ row.graduationYear }}届</template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" :width="100" :min-width="100" />
        <el-table-column prop="gender" label="性别" :width="70" :min-width="70" align="center" />
        <el-table-column prop="idCard" label="身份证号" :width="190" :min-width="190" show-overflow-tooltip />
        <el-table-column prop="registrationNumber" label="报名序号" :width="100" :min-width="100" align="center" />
        <el-table-column prop="longRunEvent" label="长跑项目" :width="94" :min-width="94" align="center" />
        <el-table-column prop="ballEvent" label="球类项目" :width="94" :min-width="94" align="center" />
        <el-table-column prop="status" label="状态" :width="104" :min-width="104" align="center">
          <template #default="{ row }">
            <el-tag :type="REG_STATUS_TYPES[row.status] || 'info'" size="small">
              {{ REG_STATUS_LABELS[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rejectReason" label="驳回原因" :width="180" :min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.rejectReason || '—' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="提交时间" :width="168" :min-width="168">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="还没有报名记录" :image-size="90" />
        </template>
      </el-table>

      <!-- 成绩上报记录 -->
      <el-table v-else v-loading="loadingHistory" :data="history" border stripe size="small">
        <el-table-column type="index" label="#" :width="64" :min-width="64" align="center" />
        <el-table-column prop="graduationYear" label="年份" :width="94" :min-width="94" align="center">
          <template #default="{ row }">{{ row.graduationYear }}届</template>
        </el-table-column>
        <el-table-column prop="gradeLevel" label="年级" :width="94" :min-width="94" align="center">
          <template #default="{ row }">{{ GRADE_LABELS[row.gradeLevel] || row.gradeLevel }}</template>
        </el-table-column>
        <el-table-column prop="rowCount" label="条数" :width="80" :min-width="80" align="center" />
        <el-table-column prop="newCount" label="新增" :width="76" :min-width="76" align="center" />
        <el-table-column prop="updateCount" label="更新" :width="76" :min-width="76" align="center" />
        <el-table-column prop="status" label="状态" :width="104" :min-width="104" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TYPES[row.status] || 'info'" size="small">
              {{ STATUS_LABELS[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="rejectReason" label="驳回原因" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.rejectReason || '—' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="提交时间" :width="168" :min-width="168">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <template #empty>
          <el-empty description="还没有上报记录" :image-size="90" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { UploadFilled, Download, Refresh } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { dataApi, submissionApi, registrationApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import {
  loadXLSX, parseGradeFile, parseRegistrationFile, parseNineScoreFile,
  cellVal, cellNum, readIdCard,
  normalizeIdCard, normalizeGradeValue, downloadWorkbook,
  type GradeLevel,
} from '@/utils/excel'
import { formatDateTime } from '@/utils/date'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const GRADE_LABELS: Record<string, string> = { seven: '七年级', eight: '八年级', nine: '九年级' }
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', submitted: '待审核', approved: '已通过', rejected: '已驳回', published: '已发布',
}
const STATUS_TYPES: Record<string, any> = {
  draft: 'info', submitted: 'warning', approved: 'success', rejected: 'danger', published: 'success',
}
/** 报名记录的状态 */
const REG_STATUS_LABELS: Record<string, string> = {
  pending: '待审核', approved: '待导入成绩', rejected: '已驳回', scored: '已导入成绩',
}
const REG_STATUS_TYPES: Record<string, any> = {
  pending: 'warning', approved: 'primary', rejected: 'danger', scored: 'success',
}
const FIELD_LABELS: Record<string, string> = {
  attendance_score: '出勤率', exam_score: '体育考试', fitness_score: '体测',
  total: '合计', graduation_year: '毕业年份',
  long_run: '长跑', rope_skipping: '跳绳', long_jump: '跳远',
  ball_sports: '足(篮)球', martial_arts: '武术',
}

const TABLE_BY_LEVEL: Record<string, string> = {
  seven: 'grade_seven', eight: 'grade_eight', nine: 'grade_nine',
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

const form = reactive({ year: '', gradeLevel: '' as GradeLevel | '' })
const yearOptions = ref<string[]>([])
const uploadedFile = ref<File | null>(null)
const checking = ref(false)
const submitting = ref(false)
const loadingHistory = ref(false)
const diffTab = ref('new')
const importMode = ref<'all' | 'onlyNew'>('all')
const history = ref<any[]>([])

interface DiffRow { row: number; name: string; idCard: string; school: string; changes?: any[] }
interface PreviewResult {
  valid: boolean
  errors: Array<{ row: number; field: string; message: string }>
  errorCount: number
  totalRows: number
  newCount: number
  updateCount: number
  sameCount: number
  mismatchCount: number
  newRows: DiffRow[]
  updateRows: DiffRow[]
  sameRows: DiffRow[]
}
const previewResult = ref<PreviewResult | null>(null)

/** 合计与三项之和不符的条数（导入后会被标记为校对异常），仅用于导入前提示 */
const mismatchCount = ref(0)

/** 解析出来的行（含每行所属年级与学校） */
const parsedRows = ref<any[]>([])

/** 九年级成绩预检通过后的逐条清单（服务端匹配结果） */
const nineScorePreview = ref<any[]>([])

/** 校验没通过的行：管理员可以跳过它们，只导入其余正确的数据 */
const blockedRows = ref<Set<any>>(new Set())

/** 可导入条数（出错的行已经排除在外） */
const importableCount = computed(() => {
  const p = previewResult.value
  return p ? p.newCount + p.updateCount : 0
})

/** 有校验错误、但仍有可导入的行 → 允许「仅导入正确数据」 */
const canPartialImport = computed(() =>
  !isSchool.value
  && !isNineScoreMode.value
  && !isRegistrationMode.value
  && !!previewResult.value
  && !previewResult.value.valid
  && importableCount.value > 0,
)

const isSchool = computed(() => authStore.isSchoolUser)
const formatTime = (t?: string) => formatDateTime(t)

/**
 * 三种模式：
 *  - registration 学校上传九年级报名信息（等教育局审核）
 *  - score9       管理员导入九年级成绩（按身份证匹配报名名单）
 *  - score78      七/八年级成绩（学校走审核，管理员直写）
 */
const adminMode = ref<'score78' | 'score9'>('score78')
const isRegistrationMode = computed(() => isSchool.value && form.gradeLevel === 'nine')
const isNineScoreMode = computed(() => !isSchool.value && adminMode.value === 'score9')

const submitButtonText = computed(() => {
  if (isRegistrationMode.value) return '提交报名信息'
  if (isNineScoreMode.value) return '确认导入成绩'
  if (canPartialImport.value) return `仅导入正确数据（${importableCount.value} 条）`
  return isSchool.value ? '提交上报' : '确认导入'
})

// ========== 数据加载 ==========

const loadYears = async () => {
  try {
    yearOptions.value = await dataApi.getYears()
    // 学校第一次上传时成绩表里还没有数据，年份列表会是空的 —— 用当前年份兜底
    if (!form.year) {
      form.year = yearOptions.value[0] || String(new Date().getFullYear())
    }
  } catch (err: any) {
    ElMessage.error('加载年份失败：' + (err.message || ''))
    if (!form.year) form.year = String(new Date().getFullYear())
  }
}

const loadHistory = async () => {
  loadingHistory.value = true
  try {
    if (isRegistrationMode.value) {
      const res = await registrationApi.getList({ page: 1, pageSize: 100 })
      history.value = res.list || []
    } else {
      const res = await submissionApi.getList({ page: 1, pageSize: 50 })
      history.value = res.list || []
    }
  } catch (err: any) {
    ElMessage.error('加载上报记录失败：' + (err.message || ''))
  } finally {
    loadingHistory.value = false
  }
}

// ========== 文件解析 ==========

const handleFileChange = async (file: any) => {
  const raw: File | undefined = file?.raw
  if (!raw) return
  if (raw.size > MAX_FILE_SIZE) {
    ElMessage.error(`文件大小 ${(raw.size / 1024 / 1024).toFixed(1)}MB 超过 10MB 限制`)
    clearFile()
    return
  }
  uploadedFile.value = raw
  previewResult.value = null
  parsedRows.value = []
  nineScorePreview.value = []
  blockedRows.value = new Set()
}

const clearFile = () => {
  uploadedFile.value = null
  previewResult.value = null
  parsedRows.value = []
  nineScorePreview.value = []
  blockedRows.value = new Set()
}

const clearAll = () => {
  clearFile()
  diffTab.value = 'new'
  importMode.value = 'all'
}

const resetAll = () => {
  clearAll()
}

/** 把 Excel 解析成结构化行 */
const parseFile = async (file: File) => {
  // 报名表 / 九年级成绩表 有各自的列结构，单独解析
  if (isRegistrationMode.value) {
    const { rows } = await parseRegistrationFile(file)
    return { rows, formatType: 'registration' as const }
  }
  if (isNineScoreMode.value) {
    const { rows } = await parseNineScoreFile(file)
    return { rows, formatType: 'nineScore' as const }
  }

  const xlsx = await loadXLSX()
  const parsed = await parseGradeFile(file)
  const rows: any[] = []

  parsed.rows.forEach((row: any[], index: number) => {
    if (!row) return
    // 没有「学校」「年级」列时不要按列号硬猜 —— 猜错会把姓名当学校、
    // 把出勤率成绩（"90"）当年级（含 9 → 九年级）。缺列就留空，交给下面的逻辑兜底。
    const schoolRaw = parsed.colMap.school !== undefined ? cellVal(row, parsed.colMap, 'school', -1) : ''
    const name = cellVal(row, parsed.colMap, 'name', 1)
    if (!schoolRaw && !name) return

    const idCard = readIdCard(row, index, parsed.colMap, parsed.sheet, xlsx)
    const gradeRaw = parsed.colMap.grade !== undefined ? cellVal(row, parsed.colMap, 'grade', -1) : ''
    const rowGrade = normalizeGradeValue(gradeRaw, parsed.detectedGrade)
    const graduationYear = cellVal(row, parsed.colMap, 'graduationYear', 3)
      || (isSchool.value ? form.year : '')

    const item: any = {
      school: schoolRaw || (isSchool.value ? authStore.userSchoolName : ''),
      name,
      idCard,
      identityId: normalizeIdCard(idCard),
      graduationYear,
      grade: gradeRaw,
      remark: cellVal(row, parsed.colMap, 'remark', parsed.formatType === 'nine' ? 10 : 9),
      rowGrade,
    }
    if (parsed.formatType === 'nine') {
      item.longRun = cellNum(row, parsed.colMap, 'longRun', 5)
      item.ropeSkipping = cellNum(row, parsed.colMap, 'ropeSkipping', 6)
      item.longJump = cellNum(row, parsed.colMap, 'longJump', 7)
      item.ballSports = cellNum(row, parsed.colMap, 'ballSports', 8)
      item.martialArts = cellNum(row, parsed.colMap, 'martialArts', 9)
    } else {
      item.attendanceScore = cellNum(row, parsed.colMap, 'attendanceScore', 5)
      item.examScore = cellNum(row, parsed.colMap, 'examScore', 6)
      item.fitnessScore = cellNum(row, parsed.colMap, 'fitnessScore', 7)
      item.total = cellNum(row, parsed.colMap, 'total', 8)
    }
    rows.push(item)
  })

  return { rows, formatType: parsed.formatType }
}

/** 文件里没写毕业年份时，取文件中最常见的那个年份兜底 */
const fillMissingYears = (rows: any[]) => {
  const counter = new Map<string, number>()
  rows.forEach(r => {
    if (r.graduationYear) counter.set(r.graduationYear, (counter.get(r.graduationYear) || 0) + 1)
  })
  let fallback = ''
  let max = 0
  counter.forEach((v, k) => {
    if (v > max) { max = v; fallback = k }
  })
  if (!fallback) fallback = yearOptions.value[0] || String(new Date().getFullYear())
  rows.forEach(r => {
    if (!r.graduationYear) r.graduationYear = fallback
  })
  return fallback
}

// ========== 预检 ==========

const runPreview = async () => {
  if (!uploadedFile.value) {
    ElMessage.warning('请先选择要导入的文件')
    return
  }
  if (isSchool.value && (!form.year || !form.gradeLevel)) {
    ElMessage.warning('请先选择毕业年份与上报年级')
    return
  }

  checking.value = true
  try {
    const { rows } = await parseFile(uploadedFile.value)
    if (rows.length === 0) {
      ElMessage.error('文件中没有可导入的数据')
      return
    }
    fillMissingYears(rows)

    // 管理员导入七/八年级时，学校必须来自文件；缺列会写成空学校
    if (!isSchool.value && !isRegistrationMode.value && !isNineScoreMode.value) {
      const noSchool = rows.filter(r => !r.school).length
      if (noSchool > 0) {
        ElMessage.error(`有 ${noSchool} 行缺少「学校」列，管理员导入时每行都必须填学校名称`)
        return
      }
    }

    // ---- 模式一：学校上传九年级报名信息 ----
    if (isRegistrationMode.value) {
      const res = await registrationApi.preview({ year: form.year, rows })
      parsedRows.value = rows
      previewResult.value = {
        valid: res.valid,
        errors: res.errors || [],
        errorCount: res.errorCount || 0,
        totalRows: res.totalRows || rows.length,
        newCount: res.totalRows || rows.length,
        updateCount: 0, sameCount: 0, mismatchCount: 0,
        newRows: [], updateRows: [], sameRows: [],
      }
      diffTab.value = 'new'
      if (res.valid) {
        ElMessage.success(`预检通过：共 ${res.totalRows} 人可提交报名`)
      } else {
        ElMessage.error(`预检未通过，共 ${res.errorCount} 处问题`)
      }
      return
    }

    // ---- 模式二：管理员导入九年级成绩（按身份证匹配报名名单） ----
    if (isNineScoreMode.value) {
      const scoreRows = rows.map(toScoreRow)
      // 先预检（dryRun）：服务端按身份证匹配名单并逐条核对，但不写库
      try {
        const res = await registrationApi.importScores({ year: form.year, rows: scoreRows, dryRun: true })
        parsedRows.value = scoreRows
        nineScorePreview.value = res.preview || []
        previewResult.value = {
          valid: true,
          errors: [],
          errorCount: 0,
          totalRows: rows.length,
          newCount: res.count || 0,
          updateCount: 0, sameCount: 0, mismatchCount: 0,
          newRows: [], updateRows: [], sameRows: [],
        }
        ElMessage.success(`预检通过：${res.count || 0} 条成绩可导入`)
      } catch (e: any) {
        // 服务端按行返回的错误清单，直接铺在「校验结果」里
        if (e?.errors && Array.isArray(e.errors)) {
          previewResult.value = {
            valid: false,
            errors: e.errors,
            errorCount: e.errors.length,
            totalRows: rows.length,
            newCount: 0, updateCount: 0, sameCount: 0, mismatchCount: 0,
            newRows: [], updateRows: [], sameRows: [],
          }
          ElMessage.error(`预检未通过，共 ${e.errors.length} 处问题`)
        } else {
          throw e
        }
      }
      return
    }

    // 学校账号：只能有一个年级，且必须与所选年级一致
    if (isSchool.value) {
      const wrong = rows.find(r => r.rowGrade !== form.gradeLevel)
      if (wrong) {
        ElMessage.error(`文件中存在${GRADE_LABELS[wrong.rowGrade]}数据，与所选的${GRADE_LABELS[form.gradeLevel]}不符`)
        return
      }
    }

    // 按「年级 + 毕业年份」分组：管理员的文件可能是多校多年级混合
    const groups = new Map<string, { level: GradeLevel; year: string; rows: any[] }>()
    for (const r of rows) {
      const year = r.graduationYear || form.year || ''
      const key = `${r.rowGrade}||${year}`
      if (!groups.has(key)) groups.set(key, { level: r.rowGrade, year, rows: [] })
      groups.get(key)!.rows.push(r)
    }

    // 逐组预检，合并结果
    const merged: PreviewResult = {
      valid: true,
      errors: [],
      errorCount: 0,
      totalRows: rows.length,
      newCount: 0, updateCount: 0, sameCount: 0, mismatchCount: 0,
      newRows: [], updateRows: [], sameRows: [],
    }

    // 管理员可以跳过出错的行、只导入正确的数据；学校必须整批改对
    const allowPartial = !isSchool.value
    const blocked = new Set<any>()

    for (const g of groups.values()) {
      const res = await submissionApi.preview({
        year: g.year,
        gradeLevel: g.level,
        rows: g.rows.map(stripInternal),
        allowPartial,
      })
      if (!res.valid) {
        merged.valid = false
        merged.errors.push(...(res.errors || []))
        merged.errorCount += res.errorCount || 0

        if (!allowPartial) continue
        // 标记出错的行（服务端给的是 0 基下标），导入时整行跳过。
        // 拿不到下标清单时按「整组都不可导入」处理，宁可不导入也不写坏数据。
        const idxs: number[] | null = Array.isArray(res.validIndexes) ? res.validIndexes : null
        if (idxs) {
          g.rows.forEach((row, i) => { if (!idxs.includes(i)) blocked.add(row) })
        } else {
          g.rows.forEach(row => blocked.add(row))
          merged.newCount = 0
          merged.updateCount = 0
        }
      }
      // 有错误时，服务端返回的计数已经只统计「通过校验的行」
      merged.newCount += res.newCount || 0
      merged.updateCount += res.updateCount || 0
      merged.sameCount += res.sameCount || 0
      // 「合计不符」的判定规则在服务端，前端只展示结果
      merged.mismatchCount += res.mismatchCount || 0
      merged.newRows.push(...(res.newRows || []))
      merged.updateRows.push(...(res.updateRows || []))
      merged.sameRows.push(...(res.sameRows || []))
    }

    blockedRows.value = blocked
    parsedRows.value = rows
    previewResult.value = merged
    diffTab.value = 'new'
    mismatchCount.value = merged.mismatchCount

    if (merged.valid) {
      ElMessage.success(
        `校验通过：新增 ${merged.newCount} 条，更新 ${merged.updateCount} 条，无变化 ${merged.sameCount} 条`
        + (mismatchCount.value > 0 ? `，其中 ${mismatchCount.value} 条合计不符` : ''),
      )
    } else if (importableCount.value > 0) {
      ElMessage.warning(
        `发现 ${merged.errorCount} 处问题（${blocked.size} 行），其余 ${importableCount.value} 条可先导入`,
      )
    } else {
      ElMessage.error(`校验未通过，共 ${merged.errorCount} 处问题`)
    }
  } catch (err: any) {
    ElMessage.error('校验失败：' + (err.message || '未知错误'))
  } finally {
    checking.value = false
  }
}

/** 去掉内部字段，只提交后端认识的列 */
const stripInternal = (r: any) => {
  const { rowGrade, ...rest } = r
  return rest
}

// ========== 落库 ==========

/** 九年级成绩行 → 服务端需要的字段（带项目名，用于与报名信息核对）
 *  parseNineScoreFile 返回的就是 snake_case，这里两种写法都兼容。 */
const toScoreRow = (r: any) => ({
  school: r.school,
  name: r.name,
  id_card: r.id_card ?? r.idCard,
  long_run_event: r.long_run_event ?? r.longRunEvent,
  long_run: r.long_run ?? r.longRun,
  rope_skipping: r.rope_skipping ?? r.ropeSkipping,
  long_jump: r.long_jump ?? r.longJump,
  ball_event: r.ball_event ?? r.ballEvent,
  ball_sports: r.ball_sports ?? r.ballSports,
  martial_arts: r.martial_arts ?? r.martialArts,
  remark: r.remark || '',
})

const doSubmit = async () => {
  // 校验全通过 → 正常导入；有错误但管理员选择「只导入正确数据」→ 也放行
  const p = previewResult.value
  if (!p) return
  if (!p.valid && !canPartialImport.value) return
  const preview = p

  // 管理员：直接写正式表；学校：提交审核
  const partial = canPartialImport.value
  const actionText = isRegistrationMode.value
    ? '提交报名信息'
    : (isNineScoreMode.value
        ? '确认导入成绩'
        : (isSchool.value ? '提交上报' : (partial ? '仅导入正确数据' : '确认导入')))
  const onlyNew = !isSchool.value && importMode.value === 'onlyNew'
  const willWrite = onlyNew ? preview.newCount : preview.newCount + preview.updateCount
  const skipText = partial ? `，跳过 ${blockedRows.value.size} 行有问题的数据和 ${preview.errorCount} 处错误` : ''
  const extra = isRegistrationMode.value
    ? '提交后将进入教育局审核，审核通过名单并导入成绩后，才会计入正式成绩表。'
    : (isSchool.value
        ? '提交后将进入管理员审核队列，审核通过才会计入正式成绩表。'
        : (onlyNew
            ? `将只导入 ${preview.newCount} 条新增记录，${preview.updateCount} 条更新项会暂存到「待处理」${skipText}。`
            : (preview.updateCount > 0
                ? `其中 ${preview.updateCount} 条会覆盖系统中已有的记录${skipText}，确定继续吗？`
                : `导入后将立即生效${skipText}。`)))

  try {
    await ElMessageBox.confirm(
      `即将${actionText} ${willWrite} 条记录，${extra}`,
      actionText,
      { type: 'warning', confirmButtonText: actionText, cancelButtonText: '再检查一下' },
    )
  } catch {
    return
  }

  submitting.value = true
  try {
    // 管理员：确认导入九年级成绩（预检已通过，这里正式写库）
    if (isNineScoreMode.value) {
      const res = await registrationApi.importScores({
        year: form.year,
        rows: parsedRows.value,
      })
      ElMessage.success(`已导入 ${res.count || 0} 条九年级成绩（同时写入九年级成绩表与中招体育成绩表）`)
      clearAll()
      setTimeout(() => router.push('/grade-nine'), 800)
      return
    }

    if (isRegistrationMode.value) {
      // 学校：提交九年级报名信息
      const res = await registrationApi.submit({
        year: form.year,
        rows: parsedRows.value.map(stripInternal),
      })
      ElMessage.success(`报名信息已提交：${res.count} 人，等待教育局审核`)
      clearAll()
      await loadHistory()
    } else if (isSchool.value) {
      // 学校：提交成绩上报
      const res = await submissionApi.submit({
        year: form.year,
        gradeLevel: form.gradeLevel,
        fileName: uploadedFile.value?.name || '',
        rows: parsedRows.value.map(stripInternal),
      })
      ElMessage.success(`上报已提交：${res.rowCount} 条，等待管理员审核`)
      await loadHistory()
    } else {
  // 管理员：按年级分组直接导入（只写新增与更新的，无变化的跳过）
  // 用「身份证号||学校」标识一条记录，与服务端的自然键保持一致
  const sameKeys = new Set(
    preview.sameRows.map(s => `${normalizeIdCard(s.idCard)}||${s.school || ''}`),
  )
  const updateKeys = new Set(
    preview.updateRows.map(s => `${normalizeIdCard(s.idCard)}||${s.school || ''}`),
  )

  // 「仅导入新增」模式：把被跳过的更新项暂存到「待处理」队列
  if (importMode.value === 'onlyNew' && preview.updateCount > 0) {
    const stashRows = parsedRows.value
      .filter(r => updateKeys.has(`${r.identityId}||${r.school || ''}`))
      .map(r => ({
        school: r.school, name: r.name, idCard: r.idCard, identityId: r.identityId,
        graduationYear: r.graduationYear, grade: r.grade, gradeLevel: r.rowGrade,
        attendanceScore: r.attendanceScore ?? null, examScore: r.examScore ?? null,
        fitnessScore: r.fitnessScore ?? null, total: r.total ?? null,
        longRun: r.longRun ?? null, ropeSkipping: r.ropeSkipping ?? null,
        longJump: r.longJump ?? null, ballSports: r.ballSports ?? null,
        martialArts: r.martialArts ?? null, remark: r.remark || '',
      }))
    if (stashRows.length > 0) {
      try {
        await dataApi.saveDuplicates(stashRows)
      } catch (e: any) {
        ElMessage.warning('更新项暂存失败，将直接跳过：' + (e?.message || ''))
      }
    }
  }

  const byLevel = new Map<GradeLevel, any[]>()
  for (const r of parsedRows.value) {
    if (!byLevel.has(r.rowGrade)) byLevel.set(r.rowGrade, [])
    byLevel.get(r.rowGrade)!.push(r)
  }
  const parts: string[] = []
  let skippedRows = 0
  for (const [level, list] of byLevel) {
    const table = TABLE_BY_LEVEL[level]
    const changed = list.filter(r => {
      // 校验没通过的行整行跳过（管理员「仅导入正确数据」）
      if (blockedRows.value.has(r)) { skippedRows++; return false }
      const key = `${r.identityId}||${r.school || ''}`
      if (sameKeys.has(key)) return false
      if (importMode.value === 'onlyNew' && updateKeys.has(key)) return false
      return true
    })
    if (changed.length === 0) continue
    await dataApi.import(table, changed.map(stripInternal))
    parts.push(`${GRADE_LABELS[level]} ${changed.length} 条`)
  }
  ElMessage.success(
    `导入成功：${parts.join('；') || '没有需要写入的记录'}`
    + (skippedRows > 0 ? `（已跳过 ${skippedRows} 行有问题的数据）` : ''),
  )

      setTimeout(() => {
        const seven = byLevel.get('seven')?.length || 0
        const eight = byLevel.get('eight')?.length || 0
        const nine = byLevel.get('nine')?.length || 0
        if (seven >= eight && seven >= nine) router.push('/grade-seven')
        else if (eight >= seven && eight >= nine) router.push('/grade-eight')
        else router.push('/grade-nine')
      }, 900)
    }
    clearAll()
  } catch (err: any) {
    if (err?.errors && Array.isArray(err.errors)) {
      ElMessage.error(`校验未通过，共 ${err.errors.length} 处问题`)
    } else {
      ElMessage.error((isSchool.value ? '提交失败：' : '导入失败：') + (err?.message || '未知错误'))
    }
  } finally {
    submitting.value = false
  }
}

// ========== 工具 ==========

/** 导出错误清单 */
const exportErrors = async () => {
  const errors = previewResult.value?.errors || []
  if (errors.length === 0) return
  await downloadWorkbook(
    '错误清单',
    ['Excel行号', '字段', '错误说明'],
    errors.map(e => [e.row, e.field, e.message]),
    `导入错误清单_${form.year || ''}.xlsx`,
  )
}

/** 下载模板 */
const downloadTemplate = async () => {
  // 九年级报名表（学校）—— 由服务端生成，列与业务规则一致
  if (isRegistrationMode.value) {
    try {
      await registrationApi.downloadTemplate()
    } catch (e: any) {
      ElMessage.error('模板下载失败：' + (e?.message || ''))
    }
    return
  }
  // 九年级成绩模板（管理员）—— 带「长跑项目」「球类项目」列，便于与报名信息核对
  if (isNineScoreMode.value) {
    try {
      await registrationApi.downloadScoreTemplate()
    } catch (e: any) {
      ElMessage.error('模板下载失败：' + (e?.message || ''))
    }
    return
  }

  const level = form.gradeLevel
  if (!level) return
  const year = form.year || '2026'
  const templates: Record<string, { headers: string[]; sample: any[][]; title: string }> = {
    seven: {
      headers: ['学校', '姓名', '身份证', '毕业年份', '年级', '出勤率成绩', '体育考试成绩', '体测成绩', '合计', '备注'],
      sample: [
        [authStore.userSchoolName, '张三', '310101200801011234', year, '七年级', 90, 85, 88, 263, ''],
        [authStore.userSchoolName, '李四', '310101200801015678', year, '七年级', 95, 90, 92, 277, '免测长跑'],
      ],
      title: '七年级体育成绩导入模板',
    },
    eight: {
      headers: ['学校', '姓名', '身份证', '毕业年份', '年级', '出勤率成绩', '体育考试成绩', '体测成绩', '合计', '备注'],
      sample: [
        [authStore.userSchoolName, '张三', '310101200801011234', year, '八年级', 90, 85, 88, 263, ''],
      ],
      title: '八年级体育成绩导入模板',
    },
    nine: {
      headers: ['学校', '姓名', '身份证', '毕业年份', '年级', '长跑', '跳绳', '跳远', '足(篮)球', '武术', '备注'],
      sample: [
        [authStore.userSchoolName, '张三', '310101200801011234', year, '九年级', 18, 19, 16, 17, 18, ''],
      ],
      title: '九年级体育成绩导入模板',
    },
  }
  const t = templates[level]
  await downloadWorkbook(t.title, t.headers, t.sample, `${t.title}.xlsx`)
}

onMounted(async () => {
  // 从「九年级成绩」列表页的「导入九年级成绩」按钮进来时，直接落到九年级模式
  if (!isSchool.value && route.query.mode === 'score9') {
    adminMode.value = 'score9'
  }
  await loadYears()
  if (isSchool.value) await loadHistory()
})
</script>

<style scoped lang="scss">
.grade-import-page {
  @include page-container;

  .mode-alert {
    margin-bottom: 16px;
  }

  .card-surface {
    @include card-surface;
    padding: 18px 20px;
    margin-bottom: 16px;
  }

  .form-card {
    padding-bottom: 4px;
  }

  .upload-area {
    :deep(.el-upload-dragger) {
      width: 100%;
      height: 190px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-lg);
      border-style: dashed;
      transition: border-color 0.15s, background 0.15s;

      &:hover { border-color: var(--brand-cyan); background: var(--bg-hover); }

      .upload-icon {
        font-size: 44px;
        color: var(--brand-cyan);
        margin-bottom: 12px;
      }

      .upload-text {
        font-size: 15px;
        color: var(--text-secondary);

        em {
          color: var(--brand-cyan);
          font-style: normal;
          font-weight: 600;
        }
      }

      .upload-tip {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 6px;
      }
    }
  }

  .file-info {
    margin-top: 16px;

    .file-actions {
      margin-top: 14px;
      display: flex;
      gap: 12px;
    }
  }

  .section-header {
    @include toolbar;
    margin-bottom: 14px;

    .header-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .diff-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 16px;

    .diff-item {
      padding: 14px 16px;
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      border: 1px solid var(--border);
      text-align: center;
    }

    .diff-value {
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;

      &.new { color: var(--success); }
      &.update { color: var(--warning); }
      &.same { color: var(--text-muted); }
      &.total { color: var(--accent); }
      &.mismatch { color: var(--danger); }
    }

    .diff-label {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
  }

  .mismatch-alert {
    margin-bottom: 16px;
  }

  .diff-tabs { margin-top: 4px; }

  .change-tag {
    margin: 2px 4px 2px 0;
  }

  .tip-row, .submit-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 16px;
  }

  .partial-alert {
    margin-top: 12px;
  }

  .submit-row {
    justify-content: flex-end;
    padding-top: 14px;
    border-top: 1px solid var(--border-light);
  }

  .tip-text {
    font-size: 12px;
    color: var(--text-muted);
  }
}

@media (max-width: 768px) {
  .grade-import-page {
    .diff-summary {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}
</style>

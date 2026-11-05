<template>
  <div class="grade-verify-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-text">
        <h2 class="page-title">成绩校对</h2>
        <p class="page-desc">按姓名或身份证号检索七、八、九年级成绩，核对分项合计并留存修改凭证。</p>
      </div>
      <div v-if="hasSearched" class="header-extra">
        <span class="mono-label">RESULTS</span>
        <span class="total-value">{{ totalCount }}</span>
      </div>
    </div>

    <!-- 检索工具栏 -->
    <div class="search-section">
      <div class="search-left">
        <el-input
          v-model="searchName"
          placeholder="输入学生姓名"
          clearable
          class="w-name"
          @keyup.enter="handleSearch()"
          @clear="handleSearch()"
        >
          <template #prefix>
            <el-icon><User /></el-icon>
          </template>
        </el-input>

        <el-input
          v-model="searchIdCard"
          placeholder="输入身份证号"
          clearable
          class="w-idcard"
          @keyup.enter="handleSearch()"
          @clear="handleSearch()"
        >
          <template #prefix>
            <el-icon><Document /></el-icon>
          </template>
        </el-input>
      </div>

      <div class="search-right">
        <el-button type="primary" :loading="loading" @click="handleSearch()">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <!-- 未检索：空状态提示 -->
    <div v-if="!hasSearched" class="empty-state">
      <el-empty description="请输入姓名或身份证号后搜索" :image-size="120" />
    </div>

    <!-- 检索结果 -->
    <div v-else class="results-section">
      <div class="result-summary">
        共 {{ totalCount }} 条结果
        <span v-if="truncated" class="result-tip">（结果过多，仅显示前 {{ MAX_RESULTS }} 条／每个年级）</span>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane v-for="level in LEVELS" :key="level.key" :name="level.key" :label="level.label">
          <div v-if="searchResults[level.key].length === 0" class="empty-text">
            未找到{{ level.label }}数据
          </div>
          <el-table
            v-else
            v-loading="loading"
            :data="searchResults[level.key]"
            border
            stripe
            max-height="560"
            style="width: 100%"
          >
            <el-table-column
              v-for="col in columnsOf(level.key)"
              :key="col.prop"
              :prop="col.prop"
              :label="col.label"
              :width="col.width"
              :min-width="col.minWidth"
              :align="col.align"
              :show-overflow-tooltip="col.showOverflowTooltip"
            >
              <template v-if="col.prop === 'verifyResult'" #default="{ row }">
                <el-tag :type="row.verifyResult ? 'success' : 'danger'" size="small">
                  {{ row.verifyResult ? '✅' : '❌' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" :width="160" :min-width="160" align="center" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link size="small" @click="handleEdit(row, level.key)">
                  修改
                </el-button>
                <el-button type="warning" link size="small" @click="handleUploadCredential(row, level.key)">
                  修改凭证
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- 修改成绩弹窗 -->
    <el-dialog v-model="editDialogVisible" title="修改成绩" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="学校">
          <el-input v-model="editForm.school" disabled />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.name" disabled />
        </el-form-item>
        <el-form-item label="身份证">
          <el-input v-model="editForm.idCard" disabled />
        </el-form-item>

        <template v-if="editGrade === 'seven' || editGrade === 'eight'">
          <el-form-item label="出勤率成绩">
            <el-input-number v-model="editForm.attendanceScore" :min="0" :max="100" :precision="1" />
          </el-form-item>
          <el-form-item label="体育考试成绩">
            <el-input-number v-model="editForm.examScore" :min="0" :max="100" :precision="1" />
          </el-form-item>
          <el-form-item label="体测成绩">
            <el-input-number v-model="editForm.fitnessScore" :min="0" :max="100" :precision="1" />
          </el-form-item>
          <el-form-item label="合计">
            <el-input-number v-model="editForm.total" :min="0" :max="100" :precision="1" />
          </el-form-item>
        </template>

        <template v-if="editGrade === 'nine'">
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
        </template>

        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 上传修改凭证 -->
    <el-dialog v-model="credentialDialogVisible" title="上传修改凭证" width="500px">
      <el-alert
        title="请上传PDF文件或图片格式的修改凭证"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      />
      <el-upload
        class="credential-upload"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleCredentialChange"
        :show-file-list="true"
        accept=".pdf,.jpg,.jpeg,.png"
        :limit="1"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">
          <em>点击上传</em> 或拖拽文件到此处
        </div>
        <div class="upload-tip">
          支持 PDF、JPG、PNG 格式
        </div>
      </el-upload>
      <template #footer>
        <el-button @click="credentialDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="credentialUploading" @click="saveCredential">确认上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Search, User, Document, UploadFilled } from '@element-plus/icons-vue'
import { useGradeStore } from '@/stores/grade'
import { credentialApi, dataApi } from '@/api'

interface ColumnConfig {
  prop: string
  label: string
  width?: string
  minWidth?: string
  align?: string
  showOverflowTooltip?: boolean
}

type LevelKey = 'seven' | 'eight' | 'nine'

const gradeStore = useGradeStore()

/** 三个年级共用同一张表格模板，差异只体现在列定义上 */
const LEVELS: Array<{ key: LevelKey; label: string; table: string }> = [
  { key: 'seven', label: '七年级', table: 'grade_seven' },
  { key: 'eight', label: '八年级', table: 'grade_eight' },
  { key: 'nine', label: '九年级', table: 'grade_nine' },
]

const COMMON_COLUMNS: ColumnConfig[] = [
  { prop: 'school', label: '学校', minWidth: '180' },
  { prop: 'name', label: '姓名', width: '100', align: 'center' },
  { prop: 'idCard', label: '身份证', minWidth: '180' },
  { prop: 'identityId', label: '身份ID', minWidth: '180' },
  { prop: 'graduationYear', label: '毕业年份', width: '100', align: 'center' },
]

const SEVEN_EIGHT_COLUMNS: ColumnConfig[] = [
  ...COMMON_COLUMNS,
  { prop: 'attendanceScore', label: '出勤率成绩', width: '100', align: 'center' },
  { prop: 'examScore', label: '体育考试成绩', width: '110', align: 'center' },
  { prop: 'fitnessScore', label: '体测成绩', width: '90', align: 'center' },
  { prop: 'total', label: '合计', width: '80', align: 'center' },
  { prop: 'totalVerify', label: '合计校对', width: '100', align: 'center' },
  { prop: 'verifyResult', label: '校对结果', width: '90', align: 'center' },
  { prop: 'remark', label: '备注', width: '80', showOverflowTooltip: true },
]

const NINE_COLUMNS: ColumnConfig[] = [
  ...COMMON_COLUMNS,
  { prop: 'longRun', label: '长跑', width: '80', align: 'center' },
  { prop: 'ropeSkipping', label: '跳绳', width: '80', align: 'center' },
  { prop: 'longJump', label: '跳远', width: '80', align: 'center' },
  { prop: 'ballSports', label: '足(篮)球', width: '90', align: 'center' },
  { prop: 'martialArts', label: '武术', width: '80', align: 'center' },
]

const columnsOf = (level: LevelKey): ColumnConfig[] =>
  level === 'nine' ? NINE_COLUMNS : SEVEN_EIGHT_COLUMNS

// ========== 状态 ==========
/** 每个年级最多返回多少条结果 */
const MAX_RESULTS = 200

const searchName = ref('')
const searchIdCard = ref('')
const hasSearched = ref(false)
const loading = ref(false)
const saving = ref(false)
const credentialUploading = ref(false)
const activeTab = ref<LevelKey>('seven')

const searchResults = reactive<Record<LevelKey, any[]>>({
  seven: [],
  eight: [],
  nine: [],
})

const totalCount = computed(() =>
  searchResults.seven.length + searchResults.eight.length + searchResults.nine.length,
)

/** 是否因为结果过多而被截断 */
const truncated = ref(false)

const editDialogVisible = ref(false)
const editForm = ref<any>({})
const editGrade = ref<LevelKey>('seven')
const editingId = ref('')
const credentialDialogVisible = ref(false)
const credentialFile = ref<File | null>(null)
const credentialRow = ref<any>(null)
const credentialGrade = ref<LevelKey>('seven')

// ========== 检索 ==========

/** 单表检索：走服务端分页接口，不再依赖整库缓存 */
const queryLevel = async (table: string, keyword: string): Promise<any[]> => {
  const res = await dataApi.page(table, { page: 1, pageSize: MAX_RESULTS, keyword })
  return res?.list || []
}

/**
 * 合并多个关键词的结果。
 * 姓名与身份证号同时填写时分别检索再合并（原先只取其中一个，导致身份证框被忽略）。
 */
const mergeRows = (lists: any[][]): any[] => {
  const map = new Map<string, any>()
  for (const list of lists) {
    for (const row of list) {
      const key = row.id || `${row.identityId || ''}|${row.school || ''}|${row.name || ''}`
      if (!map.has(key)) map.set(key, row)
    }
  }
  return Array.from(map.values())
}

/** 检索单个年级：按关键词分别查询 → 合并去重 → 截断到上限 */
const searchLevel = async (table: string, keywords: string[]) => {
  const lists = await Promise.all(keywords.map((kw) => queryLevel(table, kw)))
  const merged = mergeRows(lists)
  if (merged.length > MAX_RESULTS) truncated.value = true
  return merged.slice(0, MAX_RESULTS)
}

const handleSearch = async (silent = false) => {
  const name = searchName.value.trim()
  const idCard = searchIdCard.value.trim()
  if (!name && !idCard) {
    ElMessage.warning('请输入姓名或身份证号')
    return
  }

  const keywords = [name, idCard].filter(Boolean)

  loading.value = true
  truncated.value = false
  try {
    const [seven, eight, nine] = await Promise.all([
      searchLevel(LEVELS[0].table, keywords),
      searchLevel(LEVELS[1].table, keywords),
      searchLevel(LEVELS[2].table, keywords),
    ])
    searchResults.seven = seven
    searchResults.eight = eight
    searchResults.nine = nine
    hasSearched.value = true

    // 写入 store 缓存：store 的 update* 需要先在缓存中定位到该行
    gradeStore.setGradeSevenList(seven)
    gradeStore.setGradeEightList(eight)
    gradeStore.setGradeNineList(nine)

    const total = searchResults.seven.length + searchResults.eight.length + searchResults.nine.length
    if (total === 0) {
      ElMessage.info('未找到相关数据')
    } else if (!silent) {
      ElMessage.success(`共查询到 ${total} 条结果`)
    }
  } catch (err: any) {
    ElMessage.error(err?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

const resetSearch = () => {
  searchName.value = ''
  searchIdCard.value = ''
  hasSearched.value = false
  truncated.value = false
  searchResults.seven = []
  searchResults.eight = []
  searchResults.nine = []
}

// ========== 修改 ==========

const handleEdit = (row: any, level: LevelKey) => {
  editingId.value = row.id
  const form: Record<string, any> = { ...row }
  // DECIMAL 字段从服务端返回的是字符串，先转数字再交给 el-input-number
  for (const key of ['attendanceScore', 'examScore', 'fitnessScore', 'total', 'longRun', 'ropeSkipping', 'longJump', 'ballSports', 'martialArts']) {
    const v = form[key]
    if (v !== undefined && v !== null && v !== '') form[key] = Number(v)
  }
  editForm.value = form
  editGrade.value = level
  editDialogVisible.value = true
}

const saveEdit = async () => {
  if (!editingId.value) return

  const level = editGrade.value
  const payload: Record<string, any> = { remark: editForm.value.remark ?? '' }
  if (level === 'seven' || level === 'eight') {
    payload.attendanceScore = editForm.value.attendanceScore
    payload.examScore = editForm.value.examScore
    payload.fitnessScore = editForm.value.fitnessScore
    payload.total = editForm.value.total
  } else {
    payload.longRun = editForm.value.longRun
    payload.ropeSkipping = editForm.value.ropeSkipping
    payload.longJump = editForm.value.longJump
    payload.ballSports = editForm.value.ballSports
    payload.martialArts = editForm.value.martialArts
  }

  saving.value = true
  try {
    // store 的 update* 会等待服务端写入完成，失败时抛错
    if (level === 'seven') {
      await gradeStore.updateGradeSevenData(editingId.value, payload)
    } else if (level === 'eight') {
      await gradeStore.updateGradeEightData(editingId.value, payload)
    } else {
      await gradeStore.updateGradeNineData(editingId.value, payload)
    }
    ElMessage.success('修改成功')
    editDialogVisible.value = false
    await handleSearch(true)
  } catch (err: any) {
    ElMessage.error(err?.message || '修改失败')
  } finally {
    saving.value = false
  }
}

// ========== 凭证 ==========

const handleUploadCredential = (row: any, level: LevelKey) => {
  credentialRow.value = row
  credentialGrade.value = level
  credentialFile.value = null
  credentialDialogVisible.value = true
}

const handleCredentialChange = (file: any) => {
  if (file.raw) {
    credentialFile.value = file.raw
  }
}

const saveCredential = async () => {
  if (!credentialFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  credentialUploading.value = true
  try {
    await credentialApi.upload(credentialGrade.value, credentialRow.value.id, credentialFile.value)
    ElMessage.success('凭证上传成功')
    credentialDialogVisible.value = false
  } catch (err: any) {
    ElMessage.error(err?.message || '凭证上传失败')
  } finally {
    credentialUploading.value = false
  }
}
</script>

<style scoped lang="scss">
.grade-verify-page {
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

.search-section {
  @include toolbar;
  border-bottom: $table-border;

  .search-left,
  .search-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .w-name { width: 200px; }
  .w-idcard { width: 220px; }
}

.empty-state {
  padding: 56px 0;
}

.results-section {
  .result-summary {
    margin: 12px 0;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .result-tip {
    color: var(--text-muted);
  }

  .empty-text {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
  }
}

.credential-upload {
  :deep(.el-upload-dragger) {
    width: 100%;
    height: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);

    .upload-icon {
      font-size: 48px;
      color: var(--brand-cyan);
      margin-bottom: 16px;
    }

    .upload-text {
      font-size: 16px;
      color: var(--text-secondary);
      margin-bottom: 8px;

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

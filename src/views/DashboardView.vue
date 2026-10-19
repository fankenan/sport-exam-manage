<template>
  <div class="dashboard-page">
    <!-- 顶部工具栏 -->
    <div class="dashboard-toolbar">
      <div class="toolbar-actions">
        <el-select
          v-model="selectedYear"
          placeholder="请选择毕业年份"
          clearable
          style="width: 180px"
          @change="handleYearChange"
        >
          <el-option v-for="y in yearOptions" :key="y" :label="y + '届'" :value="y" />
        </el-select>
        <el-select
          v-if="!authStore.isSchoolUser"
          v-model="selectedSchool"
          placeholder="选择学校（可选）"
          clearable
          filterable
          style="width: 200px; margin-left: 12px"
          @change="handleSchoolChange"
        >
          <el-option v-for="s in schoolOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-tag v-if="authStore.isSchoolUser" type="primary" style="margin-left: 12px">
          {{ authStore.userSchoolName }}
        </el-tag>
        <el-button type="primary" style="margin-left: 12px" @click="openConfig">
          <el-icon><Setting /></el-icon>
          配置组件
        </el-button>
        <el-button type="default" @click="refreshData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 未选择年份时提示 -->
    <div v-if="!selectedYear" class="empty-state">
      <el-empty description="请先选择毕业年份，然后查看数据统计" :image-size="120" />
    </div>

    <!-- 看板内容 -->
    <div v-else v-loading="loading" class="dashboard-grid">
      <!-- 统计卡片（始终显示） -->
      <div class="grid-full">
        <StatsCards
          :grade-seven-count="filteredSeven.length"
          :grade-eight-count="filteredEight.length"
          :grade-nine-count="filteredNine.length"
          :admission-count="filteredAdmission.length"
          :school-count="schoolSet.size"
        />
      </div>

      <!-- 图表网格 -->
      <template v-for="widget in visibleWidgets" :key="widget.key">
        <div v-if="widgets[widget.key]" :class="widget.wide ? 'grid-full' : 'grid-half'">
          <WidgetContainer :title="widget.label">
            <GradePieChart v-if="widget.key === 'gradePie'"
              :seven="filteredSeven.length" :eight="filteredEight.length" :nine="filteredNine.length" />
            <SchoolBarChart v-if="widget.key === 'schoolBar'"
              :schools="schoolBarData.schools" :averages="schoolBarData.averages" />
            <ScoreDistribution v-if="widget.key === 'scoreDist'"
              :scores="allAdmissionScores" />
            <AdmissionRadar v-if="widget.key === 'admissionRadar'"
              :long-run="admAvg.longRun" :rope-skipping="admAvg.ropeSkipping"
              :long-jump="admAvg.longJump" :ball-sports="admAvg.ballSports" :martial-arts="admAvg.martialArts" />
            <VerifyPieChart v-if="widget.key === 'verifyPie'"
              :passed="verifyStats.passed" :failed="verifyStats.failed" />
            <RecentImports v-if="widget.key === 'recentImports'" />
            <SchoolStats v-if="widget.key === 'schoolStats'" :stats="schoolStats" />
          </WidgetContainer>
        </div>
      </template>
    </div>

    <!-- 配置组件弹窗 -->
    <el-dialog v-model="configVisible" title="配置显示组件" width="480px">
      <el-checkbox-group v-model="enabledWidgets" class="config-list">
        <el-checkbox v-for="w in visibleWidgets" :key="w.key" :label="w.key" :value="w.key">
          {{ w.label }}
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="configVisible = false">关闭</el-button>
        <el-button type="primary" @click="saveConfig">保存配置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Setting, Refresh } from '@element-plus/icons-vue'
import { dataApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import WidgetContainer from '@/components/dashboard/WidgetContainer.vue'
import StatsCards from '@/components/dashboard/StatsCards.vue'
import GradePieChart from '@/components/dashboard/GradePieChart.vue'
import SchoolBarChart from '@/components/dashboard/SchoolBarChart.vue'
import ScoreDistribution from '@/components/dashboard/ScoreDistribution.vue'
import AdmissionRadar from '@/components/dashboard/AdmissionRadar.vue'
import VerifyPieChart from '@/components/dashboard/VerifyPieChart.vue'
import RecentImports from '@/components/dashboard/RecentImports.vue'
import SchoolStats from '@/components/dashboard/SchoolStats.vue'

// ========== 组件配置 ==========
interface WidgetDef { key: string; label: string; wide?: boolean }
const widgetList: WidgetDef[] = [
  { key: 'gradePie', label: '各年级人数分布' },
  { key: 'schoolBar', label: '中招体育考试平均分' },
  { key: 'scoreDist', label: '成绩分布直方图' },
  { key: 'admissionRadar', label: '中招各项目平均分' },
  { key: 'verifyPie', label: '校对结果统计' },
  { key: 'recentImports', label: '最近操作记录' },
  { key: 'schoolStats', label: '学校上报统计', wide: true },
]

const defaultWidgets: Record<string, boolean> = {}
widgetList.forEach(w => { defaultWidgets[w.key] = true })

// 从 localStorage 恢复
function loadWidgetConfig(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem('dashboard_widgets')
    if (saved) return { ...defaultWidgets, ...JSON.parse(saved) }
  } catch { /* ignore */ }
  return { ...defaultWidgets }
}

const widgets = reactive<Record<string, boolean>>(loadWidgetConfig())
const configVisible = ref(false)
const enabledWidgets = ref<string[]>(Object.keys(widgets).filter(k => widgets[k]))

const openConfig = () => {
  enabledWidgets.value = Object.keys(widgets).filter(k => widgets[k])
  configVisible.value = true
}
const saveConfig = () => {
  widgetList.forEach(w => { widgets[w.key] = enabledWidgets.value.includes(w.key) })
  localStorage.setItem('dashboard_widgets', JSON.stringify({ ...widgets }))
  configVisible.value = false
  ElMessage.success('组件配置已保存')
}

// ========== 数据 ==========
const authStore = useAuthStore()
// 学校用户隐藏最近操作记录
const visibleWidgets = computed(() => {
  if (authStore.isSchoolUser) {
    return widgetList.filter(w => w.key !== 'recentImports' && w.key !== 'schoolStats')
  }
  return widgetList
})
const selectedYear = ref('')
const selectedSchool = ref(authStore.isSchoolUser ? authStore.userSchoolName : '')
const yearOptions = ref<string[]>([])
const schoolOptions = ref<string[]>([])
const loading = ref(false)

const allSeven = ref<any[]>([])
const allEight = ref<any[]>([])
const allNine = ref<any[]>([])
const allAdmission = ref<any[]>([])
const schoolStats = ref<Array<{ school: string; total: number; anomalyCount: number }>>([])

// 筛选后的数据
const filteredSeven = computed(() => filterData(allSeven.value))
const filteredEight = computed(() => filterData(allEight.value))
const filteredNine = computed(() => filterData(allNine.value))
const filteredAdmission = computed(() => filterData(allAdmission.value))

function filterData(list: any[]) {
  return list.filter(item => {
    if (selectedYear.value && item.graduationYear !== selectedYear.value) return false
    if (selectedSchool.value && item.school !== selectedSchool.value) return false
    return true
  })
}

const schoolSet = computed(() => {
  const set = new Set<string>()
  filteredSeven.value.forEach((i: any) => set.add(i.school))
  filteredEight.value.forEach((i: any) => set.add(i.school))
  filteredNine.value.forEach((i: any) => set.add(i.school))
  return set
})

// 学校柱状图数据 - 中招体育考试成绩
const schoolBarData = computed(() => {
  const map = new Map<string, { total: number; count: number }>()
  filteredAdmission.value.forEach((item: any) => {
    if (!item.school) return
    let entry = map.get(item.school) || { total: 0, count: 0 }
    entry.total += Number(item.totalScore || 0)
    entry.count++
    map.set(item.school, entry)
  })
  const schools: string[] = []
  const averages: number[] = []
  map.forEach((v, k) => {
    if (v.count > 0) { schools.push(k); averages.push(Math.round(v.total / v.count * 10) / 10) }
  })
  const paired = schools.map((s, i) => ({ s, a: averages[i] })).sort((x, y) => y.a - x.a)
  return { schools: paired.map(p => p.s), averages: paired.map(p => p.a) }
})

// 中招成绩列表（用于分布直方图）
const allAdmissionScores = computed(() => {
  const scores: number[] = []
  filteredAdmission.value.forEach((i: any) => scores.push(Number(i.totalScore || 0)))
  return scores
})

// 校对统计
const verifyStats = computed(() => {
  let passed = 0, failed = 0
  const check = (list: any[]) => list.forEach((i: any) => { i.verifyResult ? passed++ : failed++ })
  check(filteredSeven.value)
  check(filteredEight.value)
  return { passed, failed }
})

// 中招平均分
const admAvg = computed(() => {
  const list = filteredAdmission.value
  if (list.length === 0) return { longRun: 0, ropeSkipping: 0, longJump: 0, ballSports: 0, martialArts: 0 }
  const avg = (field: string) => Math.round(list.reduce((s: number, i: any) => s + Number(i[field] || 0), 0) / list.length * 10) / 10
  return { longRun: avg('longRun'), ropeSkipping: avg('ropeSkipping'), longJump: avg('longJump'), ballSports: avg('ballSports'), martialArts: avg('martialArts') }
})

// ========== 数据加载 ==========
const loadYears = async () => {
  try { yearOptions.value = await dataApi.getYears() } catch { /* ignore */ }
}
const loadSchools = async () => {
  try { schoolOptions.value = await dataApi.getSchools(selectedYear.value || undefined) } catch { /* ignore */ }
  schoolOptions.value = [...new Set(schoolOptions.value)].sort()
}
const loadAllData = async () => {
  loading.value = true
  try {
    const data = await dataApi.sync()
    allSeven.value = data.gradeSevenList || []
    allEight.value = data.gradeEightList || []
    allNine.value = data.gradeNineList || []
    allAdmission.value = data.admissionList || []
  } catch (err: any) {
    ElMessage.error('加载数据失败：' + (err.message || ''))
  } finally {
    loading.value = false
  }
}

const loadSchoolStats = async () => {
  if (!authStore.isSchoolUser && selectedYear.value) {
    try {
      schoolStats.value = await dataApi.getSchoolStats(selectedYear.value)
    } catch { schoolStats.value = [] }
  } else {
    schoolStats.value = []
  }
}

const handleYearChange = () => {
  selectedSchool.value = ''
  loadSchools()
  loadSchoolStats()
}
const handleSchoolChange = () => { /* computed 自动更新 */ }
const refreshData = () => loadAllData()

onMounted(async () => {
  await loadYears()
  await loadAllData()
})
</script>

<style scoped lang="scss">
.dashboard-page {
  padding: 0;
  min-height: 100%;
}

.dashboard-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  flex-wrap: wrap;
  gap: 8px;

  .toolbar-title { font-size: 20px; font-weight: 700; color: var(--text-primary); }
  .toolbar-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
}

.empty-state {
  padding: 80px 0;
  text-align: center;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.grid-full { grid-column: 1 / -1; }
.grid-half { min-width: 0; }

.config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  :deep(.el-checkbox) { margin-right: 0; font-size: 14px; }
}

@media (max-width: 900px) {
  .dashboard-grid { grid-template-columns: 1fr; }
  .grid-half { grid-column: 1 / -1; }
}
</style>

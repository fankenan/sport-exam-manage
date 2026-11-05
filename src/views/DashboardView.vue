<template>
  <div class="dashboard-page">
    <!-- 顶部工具栏 -->
    <div class="dashboard-toolbar">
      <div class="toolbar-left">
        <el-select
          v-model="selectedYear"
          placeholder="请选择毕业年份"
          clearable
          class="w-year"
          @change="handleFilterChange"
        >
          <el-option v-for="y in yearOptions" :key="y" :label="y + '届'" :value="y" />
        </el-select>
        <el-select
          v-if="!authStore.isSchoolUser"
          v-model="selectedSchool"
          placeholder="选择学校（可选）"
          clearable
          filterable
          class="w-school"
          @change="handleFilterChange"
        >
          <el-option v-for="s in schoolOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <el-tag v-if="authStore.isSchoolUser" type="primary" effect="light">
          {{ authStore.userSchoolName }}
        </el-tag>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" plain @click="openConfig">
          <el-icon><Setting /></el-icon>
          配置组件
        </el-button>
        <el-button @click="refreshData">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
    </div>

    <!-- 未选择年份时提示 -->
    <div v-if="!selectedYear" class="empty-state">
      <el-empty description="请先选择毕业年份，然后查看数据统计" :image-size="140">
        <el-button type="primary" @click="loadAll">加载数据</el-button>
      </el-empty>
    </div>

    <!-- 看板内容 -->
    <div v-else v-loading="loading" class="dashboard-grid">
      <!-- 统计卡片 -->
      <div class="grid-full">
        <StatsCards
          :grade-seven-count="stats.counts.gradeSeven"
          :grade-eight-count="stats.counts.gradeEight"
          :grade-nine-count="stats.counts.gradeNine"
          :admission-count="stats.counts.admission"
          :school-count="stats.counts.schoolCount"
        />
      </div>

      <!-- 图表网格 -->
      <template v-for="widget in visibleWidgets" :key="widget.key">
        <div v-if="widgets[widget.key]" :class="widget.wide ? 'grid-full' : 'grid-half'">
          <WidgetContainer :title="widget.label">
            <GradePieChart
              v-if="widget.key === 'gradePie'"
              :seven="stats.counts.gradeSeven"
              :eight="stats.counts.gradeEight"
              :nine="stats.counts.gradeNine"
            />
            <SchoolBarChart
              v-if="widget.key === 'schoolBar'"
              :schools="stats.schoolBar.schools"
              :averages="stats.schoolBar.averages"
            />
            <ScoreDistribution
              v-if="widget.key === 'scoreDist'"
              :bins="stats.scoreBins"
            />
            <AdmissionRadar
              v-if="widget.key === 'admissionRadar'"
              :long-run="stats.admissionAvg.longRun"
              :rope-skipping="stats.admissionAvg.ropeSkipping"
              :long-jump="stats.admissionAvg.longJump"
              :ball-sports="stats.admissionAvg.ballSports"
              :martial-arts="stats.admissionAvg.martialArts"
            />
            <VerifyPieChart
              v-if="widget.key === 'verifyPie'"
              :passed="stats.verify.passed"
              :failed="stats.verify.failed"
            />
            <RecentImports v-if="widget.key === 'recentImports'" />
            <SchoolStats v-if="widget.key === 'schoolStats'" :stats="schoolStats" />
          </WidgetContainer>
        </div>
      </template>
    </div>

    <!-- 配置组件弹窗 -->
    <el-dialog v-model="configVisible" title="配置显示组件" width="460px">
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
import { ref, reactive, computed, onMounted } from 'vue'
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

// 学校用户隐藏管理员专属组件
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
const schoolStats = ref<Array<{ school: string; total: number; anomalyCount: number }>>([])

/**
 * 看板数据全部由服务端聚合返回
 * （旧实现是「拉全量数据 → 在浏览器里 filter/sort」，数据量大时极慢）
 */
const stats = reactive({
  counts: { gradeSeven: 0, gradeEight: 0, gradeNine: 0, admission: 0, schoolCount: 0 },
  verify: { passed: 0, failed: 0 },
  admissionAvg: { longRun: 0, ropeSkipping: 0, longJump: 0, ballSports: 0, martialArts: 0 },
  schoolBar: { schools: [] as string[], averages: [] as number[] },
  scoreBins: [] as Array<{ label: string; count: number }>,
})

const loadYears = async () => {
  try {
    yearOptions.value = await dataApi.getYears()
  } catch (err: any) {
    ElMessage.error('加载年份失败：' + (err.message || ''))
  }
}

const loadSchools = async () => {
  try {
    schoolOptions.value = await dataApi.getSchools(selectedYear.value || undefined)
  } catch (err: any) {
    ElMessage.error('加载学校列表失败：' + (err.message || ''))
  }
}

const loadStats = async () => {
  const res = await dataApi.statsOverview({
    year: selectedYear.value || undefined,
    school: selectedSchool.value || undefined,
  })
  Object.assign(stats.counts, res.counts)
  Object.assign(stats.verify, res.verify)
  Object.assign(stats.admissionAvg, res.admissionAvg)
  stats.schoolBar = res.schoolBar
  stats.scoreBins = res.scoreBins
}

const loadSchoolStats = async () => {
  if (!authStore.isSchoolUser && selectedYear.value) {
    try {
      schoolStats.value = await dataApi.getSchoolStats(selectedYear.value)
    } catch {
      schoolStats.value = []
    }
  } else {
    schoolStats.value = []
  }
}

const loadAll = async () => {
  loading.value = true
  try {
    await Promise.all([loadStats(), loadSchoolStats()])
  } catch (err: any) {
    ElMessage.error('加载数据失败：' + (err.message || ''))
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => {
  if (!selectedYear.value) return
  loadAll()
}

const refreshData = async () => {
  await Promise.all([loadYears(), loadSchools()])
  await loadAll()
}

onMounted(async () => {
  await loadYears()
  await loadSchools()
  // 默认选中最近一年，直接给出可用的看板
  if (yearOptions.value.length > 0) selectedYear.value = yearOptions.value[0]
  if (selectedYear.value) await loadAll()
})
</script>

<style scoped lang="scss">
.dashboard-page {
  @include page-container;
}

.dashboard-toolbar {
  @include toolbar;

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

  .w-year { width: 170px; }
  .w-school { width: 210px; }
}

.empty-state {
  padding: 72px 0;
  text-align: center;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: $page-gap;
}

.grid-full { grid-column: 1 / -1; }
.grid-half { min-width: 0; }

.config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  :deep(.el-checkbox) { margin-right: 0; font-size: 14px; }
}

@media (max-width: 1024px) {
  .dashboard-grid { grid-template-columns: minmax(0, 1fr); }
  .grid-half { grid-column: 1 / -1; }
}
</style>

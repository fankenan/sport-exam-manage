<template>
  <div class="submission-review-page">
    <div class="page-header">
      <div>
        <div class="header-title">上报审核</div>
        <div class="header-desc">审核学校上报的成绩数据，通过后发布写入成绩表</div>
      </div>
    </div>

    <!-- 待审核提醒：避免上报被淹没在历史记录里 -->
    <el-alert
      v-if="pendingCount > 0"
      type="warning"
      :closable="false"
      show-icon
      class="pending-alert"
    >
      <template #title>
        当前有 <b>{{ pendingCount }}</b> 条学校上报等待审核。
        <el-button text type="primary" size="small" @click="onlyPending">只看待审核</el-button>
      </template>
    </el-alert>

    <!-- 筛选 -->
    <div class="filter-bar card-surface">
      <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 140px" @change="reload">
        <el-option v-for="(label, key) in STATUS_LABELS" :key="key" :label="label" :value="key" />
      </el-select>
      <el-select v-model="filters.gradeLevel" placeholder="全部年级" clearable style="width: 140px" @change="reload">
        <el-option label="七年级" value="seven" />
        <el-option label="八年级" value="eight" />
        <el-option label="九年级" value="nine" />
      </el-select>
      <el-select v-model="filters.school" placeholder="全部学校" clearable filterable style="width: 200px" @change="reload">
        <el-option v-for="s in schoolOptions" :key="s" :label="s" :value="s" />
      </el-select>
      <div class="filter-spacer" />
      <el-button :loading="loading" @click="reload">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <!-- 列表 -->
    <div ref="tableWrapRef" class="table-card">
      <el-table v-loading="loading" :data="list" border stripe>
        <el-table-column type="index" label="#" :width="56" :min-width="56" align="center">
          <template #default="{ $index }">{{ (page - 1) * pageSize + $index + 1 }}</template>
        </el-table-column>
        <el-table-column prop="school" label="学校" :min-width="colWidth('school')" show-overflow-tooltip />
        <el-table-column prop="graduationYear" label="年份" :min-width="colWidth('graduationYear')" align="center">
          <template #default="{ row }">{{ row.graduationYear }}届</template>
        </el-table-column>
        <el-table-column prop="gradeLevel" label="年级" :min-width="colWidth('gradeLevel')" align="center">
          <template #default="{ row }">{{ GRADE_LABELS[row.gradeLevel] || row.gradeLevel }}</template>
        </el-table-column>
        <el-table-column prop="rowCount" label="总条数" :min-width="colWidth('rowCount')" align="center" sortable />
        <el-table-column prop="newCount" label="新增" :min-width="colWidth('newCount')" align="center" />
        <el-table-column prop="updateCount" label="更新" :min-width="colWidth('updateCount')" align="center" />
        <el-table-column prop="status" label="状态" :min-width="colWidth('status')" align="center">
          <template #default="{ row }">
            <el-tag :type="STATUS_TYPES[row.status] || 'info'" size="small">
              {{ STATUS_LABELS[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="uploadedBy" label="上报人" :min-width="colWidth('uploadedBy')" align="center" />
        <el-table-column prop="createdAt" label="提交时间" :min-width="colWidth('createdAt')">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="216" :min-width="216" align="center" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openDetail(row)">查看</el-button>
            <template v-if="row.status === 'submitted'">
              <el-button text type="success" size="small" @click="approve(row)">通过并发布</el-button>
              <el-button text type="danger" size="small" @click="reject(row)">驳回</el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无上报表" :image-size="90" />
        </template>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="load"
          @size-change="reload"
        />
      </div>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" title="上报表详情" size="760px">
      <div v-if="detail" class="detail">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="学校">{{ detail.school }}</el-descriptions-item>
          <el-descriptions-item label="年份">{{ detail.graduationYear }}届</el-descriptions-item>
          <el-descriptions-item label="年级">{{ GRADE_LABELS[detail.gradeLevel] || detail.gradeLevel }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="STATUS_TYPES[detail.status] || 'info'" size="small">
              {{ STATUS_LABELS[detail.status] || detail.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="总条数">{{ detail.rowCount }}</el-descriptions-item>
          <el-descriptions-item label="新增 / 更新">
            {{ detail.newCount }} / {{ detail.updateCount }}
          </el-descriptions-item>
          <el-descriptions-item label="上报人">{{ detail.uploadedBy }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.rejectReason" label="驳回原因" :span="2">
            <span class="reject-reason">{{ detail.rejectReason }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <div class="detail-title">数据明细</div>
          <div ref="detailWrapRef">
            <el-table :data="detailRows" border stripe size="small" max-height="420">
              <el-table-column type="index" label="#" :width="50" :min-width="50" align="center" />
              <el-table-column prop="name" label="姓名" :min-width="detailColWidth('name')" />
              <el-table-column prop="idCard" label="身份证号" :min-width="detailColWidth('idCard')" show-overflow-tooltip />
              <el-table-column prop="graduationYear" label="年份" :min-width="detailColWidth('graduationYear')" align="center" />
              <el-table-column label="成绩" :min-width="detailColWidth('scoreText')">
                <template #default="{ row }">
                  <span v-if="row.attendanceScore !== undefined">
                    出勤 {{ row.attendanceScore }} / 考试 {{ row.examScore }} / 体测 {{ row.fitnessScore }} / 合计 {{ row.total }}
                  </span>
                  <span v-else>
                    长跑 {{ row.longRun }} / 跳绳 {{ row.ropeSkipping }} / 跳远 {{ row.longJump }} /
                    球类 {{ row.ballSports }} / 武术 {{ row.martialArts }}
                  </span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>

      <div v-if="detail && detail.status === 'submitted'" class="detail-actions">
        <el-button type="danger" plain @click="reject(detail)">驳回</el-button>
        <el-button type="primary" :loading="actioning" @click="approve(detail)">通过并发布</el-button>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { submissionApi, dataApi } from '@/api'
import { useAutoColumns } from '@/composables/useAutoColumns'
import { formatDateTime } from '@/utils/date'

const GRADE_LABELS: Record<string, string> = { seven: '七年级', eight: '八年级', nine: '九年级' }
const STATUS_LABELS: Record<string, string> = {
  draft: '草稿', submitted: '待审核', approved: '已通过', rejected: '已驳回', published: '已发布',
}
const STATUS_TYPES: Record<string, any> = {
  draft: 'info', submitted: 'warning', approved: 'success', rejected: 'danger', published: 'success',
}

const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const actioning = ref(false)
const filters = reactive({ status: '', gradeLevel: '', school: '' })
const schoolOptions = ref<string[]>([])

const detailVisible = ref(false)
const detail = ref<any>(null)
const detailRows = ref<any[]>([])

// ========== 列宽自适应 ==========
const REVIEW_COLUMNS = [
  { prop: 'school', label: '学校' },
  // 模板里给年份加了「届」字后缀，测量值里没有，这里单独声明下限
  { prop: 'graduationYear', label: '年份', minWidth: 86 },
  { prop: 'gradeLevel', label: '年级', minWidth: 84 },
  { prop: 'rowCount', label: '总条数' },
  { prop: 'newCount', label: '新增' },
  { prop: 'updateCount', label: '更新' },
  { prop: 'status', label: '状态', minWidth: 92 },
  { prop: 'uploadedBy', label: '上报人' },
  { prop: 'createdAt', label: '提交时间', minWidth: 168 },
]
const { wrapRef: tableWrapRef, colWidth } = useAutoColumns(REVIEW_COLUMNS, list, {
  // 「#」(56) 与「操作」(216) 是模板里写死的 sticky 列
  padding: 18, min: 56, max: 260, reservedWidth: 272,
})

// 抽屉里的「数据明细」表同样按内容自适应
const DETAIL_COLUMNS = [
  { prop: 'name', label: '姓名' },
  { prop: 'idCard', label: '身份证号' },
  { prop: 'graduationYear', label: '年份' },
  { prop: 'scoreText', label: '成绩' },
]
const { wrapRef: detailWrapRef, colWidth: detailColWidth } = useAutoColumns(
  DETAIL_COLUMNS,
  detailRows,
  { padding: 26, min: 60, max: 420 },
)

const formatTime = (t?: string) => formatDateTime(t)

const load = async () => {
  loading.value = true
  try {
    const res = await submissionApi.getList({
      page: page.value,
      pageSize: pageSize.value,
      status: filters.status || undefined,
      gradeLevel: filters.gradeLevel || undefined,
      school: filters.school || undefined,
    })
    list.value = res.list || []
    total.value = res.total || 0
  } catch (err: any) {
    ElMessage.error('加载上报表失败：' + (err.message || ''))
  } finally {
    loading.value = false
    loadPendingCount()
  }
}

const reload = () => {
  page.value = 1
  load()
}

/** 只看待审核 */
const onlyPending = () => {
  filters.status = 'submitted'
  reload()
}

/** 待审核数量 */
const pendingCount = ref(0)
const loadPendingCount = async () => {
  try {
    const res = await submissionApi.getPendingCount()
    pendingCount.value = res.count || 0
  } catch {
    pendingCount.value = 0
  }
}

const openDetail = async (row: any) => {
  try {
    const res = await submissionApi.getDetail(row.id)
    detail.value = res
    let payload: any[] = []
    try {
      payload = typeof res.payload === 'string' ? JSON.parse(res.payload) : (res.payload || [])
    } catch {
      payload = []
    }
    // 后端的 snakeToCamel 会递归转换 payload 内部的字段名，
    // 所以这里拿到的是 camelCase：attendanceScore / idCard / longRun ...
    detailRows.value = payload.map((p: any) => {
      const attendanceScore = p.attendanceScore ?? p.attendance_score
      const examScore = p.examScore ?? p.exam_score
      const fitnessScore = p.fitnessScore ?? p.fitness_score
      const longRun = p.longRun ?? p.long_run
      const ropeSkipping = p.ropeSkipping ?? p.rope_skipping
      const longJump = p.longJump ?? p.long_jump
      const ballSports = p.ballSports ?? p.ball_sports
      const martialArts = p.martialArts ?? p.martial_arts
      // 预拼一份纯文本，供列宽测算使用（模板里渲染的是带格式的版本）
      const scoreText = attendanceScore !== undefined
        ? `出勤 ${attendanceScore} / 考试 ${examScore} / 体测 ${fitnessScore} / 合计 ${p.total}`
        : `长跑 ${longRun} / 跳绳 ${ropeSkipping} / 跳远 ${longJump} / 球类 ${ballSports} / 武术 ${martialArts}`
      return {
        name: p.name,
        idCard: p.idCard ?? p.id_card,
        graduationYear: p.graduationYear ?? p.graduation_year,
        attendanceScore, examScore, fitnessScore,
        total: p.total,
        longRun, ropeSkipping, longJump, ballSports, martialArts,
        scoreText,
      }
    })
    detailVisible.value = true
  } catch (err: any) {
    ElMessage.error('加载详情失败：' + (err.message || ''))
  }
}

/** 审核通过 → 发布写入成绩表 */
const approve = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认通过【${row.school}】${row.graduationYear}届${GRADE_LABELS[row.gradeLevel]}的上报？` +
      `通过后将把 ${row.rowCount} 条数据写入成绩表。`,
      '审核通过并发布',
      { type: 'warning', confirmButtonText: '确认发布', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  actioning.value = true
  try {
    const res = await submissionApi.approve(row.id)
    ElMessage.success(res.message || '已发布')
    detailVisible.value = false
    await load()
  } catch (err: any) {
    ElMessage.error('发布失败：' + (err.message || ''))
  } finally {
    actioning.value = false
  }
}

/** 驳回（必须填原因） */
const reject = async (row: any) => {
  let reason = ''
  try {
    const result = await ElMessageBox.prompt('请填写驳回原因，学校将看到该说明', '驳回上报', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：第 12 行身份证号与学籍不符，请核对后重新提交',
      inputValidator: (v: string) => {
        if (!v || !v.trim()) return '请填写驳回原因'
        return true
      },
    })
    reason = result.value
  } catch {
    return
  }

  actioning.value = true
  try {
    await submissionApi.reject(row.id, reason)
    ElMessage.success('已驳回')
    detailVisible.value = false
    await load()
  } catch (err: any) {
    ElMessage.error('驳回失败：' + (err.message || ''))
  } finally {
    actioning.value = false
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
.submission-review-page {
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

  .detail-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 18px 0 10px;
  }

  .reject-reason {
    color: var(--danger);
  }

  .detail-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--border-light);
  }
}
</style>

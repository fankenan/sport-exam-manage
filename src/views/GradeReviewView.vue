<template>
  <div class="grade-review-page">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- Tab 1: 成绩修改 -->
      <el-tab-pane label="成绩修改" name="modify">
        <el-table :data="reconsiderations" border stripe v-loading="loadingRecon" style="width: 100%">
          <el-table-column prop="school" label="申请学校" min-width="180" />
          <el-table-column prop="studentName" label="姓名" :width="100" :min-width="100" />
          <el-table-column prop="idCard" label="身份证号" min-width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="toggleIdCardCheck(row)">
                {{ row.idCard }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="gradeLevel" label="年级" :width="80" :min-width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ gradeLabel(row.gradeLevel) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="申请分数" min-width="200">
            <template #default="{ row }">
              <span v-if="isThreePartGrade(row.gradeLevel)">
                出勤:{{ row.attendanceScore }} 考试:{{ row.examScore }} 体测:{{ row.fitnessScore }} 合计:{{ row.total }}
              </span>
              <span v-else>
                长跑:{{ row.longRun }} 跳绳:{{ row.ropeSkipping }} 跳远:{{ row.longJump }} 球:{{ row.ballSports }} 武:{{ row.martialArts }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="verifyResult" label="校对结果" :width="90" :min-width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.verifyResult ? 'success' : 'danger'" size="small">
                {{ row.verifyResult ? '✅' : '❌' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="证明材料" :width="100" :min-width="100" align="center">
            <template #default="{ row }">
              <el-button v-if="row.credentialId" link type="primary" size="small" @click="downloadCredential(row)">
                查看
              </el-button>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" :width="120" :min-width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'approved'" type="success" size="small">✅ 已修改</el-tag>
              <el-tag v-else-if="row.status === 'rejected'" type="danger" size="small">❌ 已驳回</el-tag>
              <el-tag v-else type="warning" size="small">已提交</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" :width="220" :min-width="220" align="center" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <div style="display: flex; gap: 4px; justify-content: center; flex-wrap: nowrap;">
                  <el-button type="success" size="small" @click="handleApproveRecon(row)">审核同意</el-button>
                  <el-button type="danger" size="small" @click="handleRejectRecon(row)">驳回</el-button>
                </div>
              </template>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-section">
          <el-pagination
            :current-page="reconPage"
            :page-size="reconPageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="reconTotal"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @current-change="onReconPageChange"
            @size-change="onReconSizeChange"
          />
        </div>

        <!-- 身份证号关联成绩弹窗 -->
        <el-dialog v-model="idCheckVisible" title="关联成绩查询" width="800px">
          <div v-loading="loadingIdCheck">
            <div v-if="idCheckResult">
              <div v-if="!idCheckResult.found" style="color: #f56c6c">该身份证号在系统中未找到匹配记录</div>
              <div v-else>
                <div v-for="r in idCheckResult.results" :key="r.grade" style="margin-bottom: 12px">
                  <strong>{{ r.grade }}：</strong>
                  <el-table :data="r.records" border size="small" style="margin-top: 4px">
                    <el-table-column prop="school" label="学校" min-width="150" />
                    <el-table-column prop="name" label="姓名" :width="100" :min-width="100" />
                    <el-table-column label="分数" min-width="300">
                      <template #default="{ row: rec }">
                        <span v-if="isThreePartGrade(r.grade)">
                          出勤:{{ rec.attendance_score }} 考试:{{ rec.exam_score }} 体测:{{ rec.fitness_score }} 合计:{{ rec.total }}
                        </span>
                        <span v-else-if="gradeLabel(r.grade) === '九年级'">
                          长跑:{{ rec.long_run }} 跳绳:{{ rec.rope_skipping }} 跳远:{{ rec.long_jump }} 球:{{ rec.ball_sports }} 武:{{ rec.martial_arts }}
                        </span>
                        <span v-else>
                          七:{{ rec.grade_seven }} 八:{{ rec.grade_eight }} 跑:{{ rec.long_run }} 跳:{{ rec.rope_skipping }} 远:{{ rec.long_jump }} 球:{{ rec.ball_sports }} 武:{{ rec.martial_arts }} 总分:{{ rec.total_score }}
                        </span>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </div>
          </div>
        </el-dialog>

      </el-tab-pane>

      <!-- Tab 3: 重复处理 -->
      <el-tab-pane label="重复处理" name="duplicate">
        <el-table :data="pagedDuplicates" border stripe v-loading="loadingDup" style="width:100%">
          <el-table-column prop="school" label="学校" min-width="150" show-overflow-tooltip />
          <el-table-column prop="name" label="姓名" :width="100" :min-width="100" />
          <el-table-column prop="idCard" label="身份证号" :width="160" :min-width="160" show-overflow-tooltip />
          <el-table-column prop="gradeLevel" label="年级" :width="80" :min-width="80" align="center">
            <template #default="{row}"><el-tag size="small">{{ gradeLabel(row.gradeLevel) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="分数" min-width="260">
            <template #default="{row}">
              <span v-if="isThreePartGrade(row.gradeLevel)">
                出勤:{{row.attendanceScore}}分 考试:{{row.examScore}}分 体测:{{row.fitnessScore}}分 合计:{{row.total}}分
              </span>
              <span v-else>长跑:{{row.longRun}} 跳绳:{{row.ropeSkipping}} 跳远:{{row.longJump}} 球:{{row.ballSports}} 武:{{row.martialArts}}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" :width="80" :min-width="80" show-overflow-tooltip />
          <el-table-column label="操作" :width="230" :min-width="230" align="center">
            <template #default="{row}">
              <el-button type="primary" size="small" @click="editDuplicate(row)">编辑</el-button>
              <el-button type="success" size="small" @click="submitDuplicate(row)">提交</el-button>
              <el-button type="danger" size="small" @click="deleteDuplicate(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-section">
          <el-pagination
            :current-page="dupPage"
            :page-size="dupPageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="duplicateData.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @current-change="onDupPageChange"
            @size-change="onDupSizeChange"
          />
        </div>

        <el-dialog v-model="dupEditVisible" title="编辑重复数据" width="600px">
          <el-form :model="dupForm" label-width="100px">
            <el-form-item label="学校"><el-input v-model="dupForm.school" /></el-form-item>
            <el-form-item label="姓名"><el-input v-model="dupForm.name" /></el-form-item>
            <template v-if="isThreePartGrade(dupForm.gradeLevel)">
              <el-form-item label="出勤率"><el-input-number v-model="dupForm.attendanceScore" :min="0" :max="100" :precision="1" /></el-form-item>
              <el-form-item label="体育考试"><el-input-number v-model="dupForm.examScore" :min="0" :max="100" :precision="1" /></el-form-item>
              <el-form-item label="体测"><el-input-number v-model="dupForm.fitnessScore" :min="0" :max="100" :precision="1" /></el-form-item>
              <el-form-item label="合计"><el-input-number v-model="dupForm.total" :min="0" :max="100" :precision="1" /></el-form-item>
            </template>
            <template v-else>
              <el-form-item label="长跑"><el-input-number v-model="dupForm.longRun" :min="0" :max="100" /></el-form-item>
              <el-form-item label="跳绳"><el-input-number v-model="dupForm.ropeSkipping" :min="0" :max="100" /></el-form-item>
              <el-form-item label="跳远"><el-input-number v-model="dupForm.longJump" :min="0" :max="100" /></el-form-item>
              <el-form-item label="球类"><el-input-number v-model="dupForm.ballSports" :min="0" :max="100" /></el-form-item>
              <el-form-item label="武术"><el-input-number v-model="dupForm.martialArts" :min="0" :max="100" /></el-form-item>
            </template>
            <el-form-item label="备注"><el-input v-model="dupForm.remark" /></el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="dupEditVisible=false">取消</el-button>
            <el-button type="primary" @click="saveDuplicate">保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <!-- Tab 2: 校对异常（只读） -->
      <el-tab-pane label="校对异常" name="anomaly">
        <el-table :data="anomalyData" border stripe v-loading="loadingAnomaly" style="width: 100%">
          <el-table-column prop="_grade" label="年级" :width="80" :min-width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ row._grade }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="school" label="学校" min-width="150" />
          <el-table-column prop="name" label="姓名" :width="100" :min-width="100" />
          <el-table-column prop="identityId" label="身份ID" min-width="180" />
          <el-table-column prop="graduationYear" label="毕业年份" :width="100" :min-width="100" align="center" />
          <el-table-column prop="attendanceScore" label="出勤率" :width="80" :min-width="80" align="center" />
          <el-table-column prop="examScore" label="体育考试" :width="90" :min-width="90" align="center" />
          <el-table-column prop="fitnessScore" label="体测" :width="80" :min-width="80" align="center" />
          <el-table-column prop="total" label="合计" :width="80" :min-width="80" align="center" />
          <el-table-column prop="totalVerify" label="校对合计" :width="90" :min-width="90" align="center" />
          <el-table-column label="校对结果" :width="90" :min-width="90" align="center">
            <template #default>
              <el-tag type="danger" size="small">❌</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" :width="80" :min-width="80" show-overflow-tooltip />
        </el-table>

        <div class="pagination-section">
          <el-pagination
            :current-page="anomalyPage"
            :page-size="anomalyPageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="anomalyTotal"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @current-change="onAnomalyPageChange"
            @size-change="onAnomalySizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { reconsiderationApi, credentialApi, dataApi } from '@/api'
import { useGradeStore } from '@/stores/grade'

const gradeStore = useGradeStore()

const activeTab = ref('modify')

/**
 * 年级键值统一：
 * - 复核申请表返回的是英文键（seven / eight / nine）
 * - 身份证关联成绩返回的是中文名（七年级 / 八年级 / 九年级 / 中招）
 * 这里统一做一次归一化，避免两套键值混用。
 */
const GRADE_LABELS: Record<string, string> = {
  seven: '七年级',
  eight: '八年级',
  nine: '九年级',
  admission: '中招',
  '七年级': '七年级',
  '八年级': '八年级',
  '九年级': '九年级',
  '中招': '中招',
}

const gradeLabel = (g: string) => GRADE_LABELS[g] || g || '-'

/** 七、八年级为「出勤 + 考试 + 体测」三项制，其余（九年级 / 中招）为分项制 */
const isThreePartGrade = (g: string) => {
  const label = GRADE_LABELS[g] || g
  return label === '七年级' || label === '八年级'
}

// ===== Tab 1: 成绩修改（服务端分页） =====
const reconsiderations = ref<any[]>([])
const loadingRecon = ref(false)
const reconTotal = ref(0)
const reconPage = ref(1)
const reconPageSize = ref(20)

const loadReconsiderations = async () => {
  loadingRecon.value = true
  try {
    const res = await reconsiderationApi.getList({
      page: reconPage.value,
      pageSize: reconPageSize.value,
    })
    reconsiderations.value = res?.list || []
    reconTotal.value = res?.total || 0
  } catch (e: any) {
    reconsiderations.value = []
    reconTotal.value = 0
    ElMessage.error(e?.message || '加载复核申请列表失败')
  } finally {
    loadingRecon.value = false
  }
}

const onReconPageChange = (page: number) => {
  reconPage.value = page
  loadReconsiderations()
}

const onReconSizeChange = (size: number) => {
  reconPageSize.value = size
  reconPage.value = 1
  loadReconsiderations()
}

const loadingIdCheck = ref(false)
const idCheckVisible = ref(false)
const idCheckResult = ref<any>(null)

const toggleIdCardCheck = async (row: any) => {
  idCheckVisible.value = true
  loadingIdCheck.value = true
  idCheckResult.value = null
  try {
    idCheckResult.value = await reconsiderationApi.checkIdCard(row.idCard)
  } catch (e: any) {
    idCheckResult.value = null
    ElMessage.error(e?.message || '查询关联成绩失败')
  } finally {
    loadingIdCheck.value = false
  }
}

const downloadCredential = async (row: any) => {
  try {
    await credentialApi.download(row.credentialId, row.credentialName || '证明材料')
  } catch (e: any) {
    ElMessage.error(e?.message || '证明材料下载失败')
  }
}

const handleApproveRecon = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认通过"${row.studentName}"的复核申请？通过后申请中的分数将写回正式成绩表。`,
      '审核确认',
      { confirmButtonText: '通过', cancelButtonText: '取消', type: 'info' }
    )
  } catch {
    return // 用户取消
  }

  try {
    const res = await reconsiderationApi.approve(row.id)
    ElMessage.success(
      res?.updated > 0
        ? `已通过，成绩已更新（回写 ${res.updated} 条）`
        : '已通过（未找到对应成绩记录）'
    )
    // 审批会把分数写回成绩表，重新加载复核列表与成绩（校对异常）列表
    await loadReconsiderations()
    await loadAnomalies()
    // 前端缓存的成绩可能是旧值，清空后由各页面重新拉取
    gradeStore.clearCache()
  } catch (e: any) {
    ElMessage.error(e?.message || '审核失败')
  }
}

const handleRejectRecon = async (row: any) => {
  let reason = ''
  try {
    const prompt = await ElMessageBox.prompt(
      `请填写驳回"${row.studentName}"复核申请的原因，原因将记录到申请备注中。`,
      '驳回申请',
      {
        confirmButtonText: '确认驳回',
        cancelButtonText: '取消',
        inputPlaceholder: '例如：证明材料与申请分数不一致，请补充后重新提交',
        inputValidator: (value: string) => (value && value.trim() ? true : '请填写驳回原因'),
        type: 'warning',
      }
    )
    reason = prompt?.value || ''
  } catch {
    return // 用户取消
  }

  try {
    await reconsiderationApi.reject(row.id, reason)
    ElMessage.success('已驳回')
    await loadReconsiderations()
  } catch (e: any) {
    ElMessage.error(e?.message || '驳回失败')
  }
}

// ===== Tab 3: 重复处理（服务端返回全量，前端分页） =====
const duplicateData = ref<any[]>([])
const loadingDup = ref(false)
const dupEditVisible = ref(false)
const dupForm = ref<any>({})
const editingDupId = ref<number | null>(null)
const dupPage = ref(1)
const dupPageSize = ref(20)

const pagedDuplicates = computed(() => {
  const start = (dupPage.value - 1) * dupPageSize.value
  return duplicateData.value.slice(start, start + dupPageSize.value)
})

const loadDuplicates = async () => {
  loadingDup.value = true
  try {
    const list = await dataApi.getDuplicates()
    duplicateData.value = Array.isArray(list) ? list : []
  } catch (e: any) {
    duplicateData.value = []
    ElMessage.error(e?.message || '加载重复数据失败')
  } finally {
    loadingDup.value = false
  }
}

// 重复数据为前端分页，翻页时不需要重新请求
const onDupPageChange = (page: number) => {
  dupPage.value = page
}

const onDupSizeChange = (size: number) => {
  dupPageSize.value = size
  dupPage.value = 1
}

const editDuplicate = (row: any) => {
  editingDupId.value = row.id
  dupForm.value = { ...row }
  dupEditVisible.value = true
}

const saveDuplicate = async () => {
  if (!editingDupId.value) return
  try {
    await dataApi.updateDuplicate(editingDupId.value, dupForm.value)
    ElMessage.success('保存成功')
    dupEditVisible.value = false
    await loadDuplicates()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  }
}

const submitDuplicate = async (row: any) => {
  try {
    await ElMessageBox.confirm('确认提交到正式成绩表？', '确认', { type: 'info' })
  } catch {
    return // 用户取消
  }
  try {
    await dataApi.submitDuplicate(row.id)
    ElMessage.success('已提交')
    await loadDuplicates()
  } catch (e: any) {
    ElMessage.error(e?.message || '提交失败')
  }
}

const deleteDuplicate = async (row: any) => {
  try {
    await ElMessageBox.confirm('确认删除？', '确认', { type: 'warning' })
  } catch {
    return // 用户取消
  }
  try {
    await dataApi.deleteDuplicate(row.id)
    ElMessage.success('已删除')
    await loadDuplicates()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
  }
}

// ===== Tab 2: 校对异常（服务端分页） =====
const anomalyData = ref<any[]>([])
const loadingAnomaly = ref(false)
const anomalyTotal = ref(0)
const anomalyPage = ref(1)
const anomalyPageSize = ref(20)

const loadAnomalies = async () => {
  loadingAnomaly.value = true
  try {
    const [seven, eight] = await Promise.all([
      dataApi.page('grade_seven', {
        page: anomalyPage.value,
        pageSize: anomalyPageSize.value,
        verifyResult: '0',
      }),
      dataApi.page('grade_eight', {
        page: anomalyPage.value,
        pageSize: anomalyPageSize.value,
        verifyResult: '0',
      }),
    ])
    anomalyData.value = [
      ...(seven?.list || []).map((r: any) => ({ ...r, _grade: '七年级' })),
      ...(eight?.list || []).map((r: any) => ({ ...r, _grade: '八年级' })),
    ]
    anomalyTotal.value = (seven?.total || 0) + (eight?.total || 0)
  } catch (e: any) {
    anomalyData.value = []
    anomalyTotal.value = 0
    ElMessage.error(e?.message || '加载校对异常数据失败')
  } finally {
    loadingAnomaly.value = false
  }
}

const onAnomalyPageChange = (page: number) => {
  anomalyPage.value = page
  loadAnomalies()
}

const onAnomalySizeChange = (size: number) => {
  anomalyPageSize.value = size
  anomalyPage.value = 1
  loadAnomalies()
}

const handleTabChange = () => {
  if (activeTab.value === 'modify') {
    reconPage.value = 1
    loadReconsiderations()
  } else if (activeTab.value === 'anomaly') {
    anomalyPage.value = 1
    loadAnomalies()
  } else if (activeTab.value === 'duplicate') {
    dupPage.value = 1
    loadDuplicates()
  }
}

onMounted(() => {
  loadReconsiderations()
})
</script>

<style scoped lang="scss">
.grade-review-page {
  @include page-container;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  padding-left: 4px;
  border-left: 3px solid var(--primary);
  padding-left: 8px;
}

.expand-content {
  padding: 12px 24px;
  background: var(--bg-surface);
}

.pagination-section {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>

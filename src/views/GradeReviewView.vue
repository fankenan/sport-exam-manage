<template>
  <div class="grade-review-page">
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- Tab 1: 成绩修改 -->
      <el-tab-pane label="成绩修改" name="modify">
        <el-table :data="reconsiderations" border stripe v-loading="loadingRecon" style="width: 100%">
          <el-table-column prop="school" label="申请学校" min-width="180" />
          <el-table-column prop="student_name" label="姓名" width="100" />
          <el-table-column prop="id_card" label="身份证号" min-width="180">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="toggleIdCardCheck(row)">
                {{ row.id_card }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="grade_level" label="年级" width="80" align="center">
            <template #default="{ row }">
              <el-tag size="small">{{ gradeLabel(row.grade_level) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="申请分数" min-width="200">
            <template #default="{ row }">
              <span v-if="row.grade_level === 'seven' || row.grade_level === 'eight'">
                出勤:{{ row.attendance_score }} 考试:{{ row.exam_score }} 体测:{{ row.fitness_score }} 合计:{{ row.total }}
              </span>
              <span v-else>
                长跑:{{ row.long_run }} 跳绳:{{ row.rope_skipping }} 跳远:{{ row.long_jump }} 球:{{ row.ball_sports }} 武:{{ row.martial_arts }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="verify_result" label="校对结果" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.verify_result ? 'success' : 'danger'" size="small">
                {{ row.verify_result ? '✅' : '❌' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="证明材料" width="100" align="center">
            <template #default="{ row }">
              <el-button v-if="row.credential_id" link type="primary" size="small" @click="downloadCredential(row.credential_id)">
                查看
              </el-button>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'approved'" type="success" size="small">✅ 已修改</el-tag>
              <el-tag v-else-if="row.status === 'rejected'" type="danger" size="small">❌ 已驳回</el-tag>
              <el-tag v-else type="warning" size="small">已提交</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" align="center" fixed="right">
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
                    <el-table-column prop="name" label="姓名" width="100" />
                    <el-table-column label="分数" min-width="300">
                      <template #default="{ row: rec }">
                        <span v-if="r.grade !== '九年级' && r.grade !== '中招'">
                          出勤:{{ rec.attendance_score }} 考试:{{ rec.exam_score }} 体测:{{ rec.fitness_score }} 合计:{{ rec.total }}
                        </span>
                        <span v-else-if="r.grade === '九年级'">
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
        <el-table :data="duplicateData" border stripe v-loading="loadingDup" style="width:100%">
          <el-table-column prop="school" label="学校" min-width="150" show-overflow-tooltip />
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="idCard" label="身份证号" width="160" show-overflow-tooltip />
          <el-table-column prop="gradeLevel" label="年级" width="80" align="center">
            <template #default="{row}"><el-tag size="small">{{ gradeLabel(row.gradeLevel) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="分数" min-width="260">
            <template #default="{row}">
              <span v-if="row.gradeLevel==='seven'||row.gradeLevel==='eight'">
                出勤:{{row.attendanceScore}}分 考试:{{row.examScore}}分 体测:{{row.fitnessScore}}分 合计:{{row.total}}分
              </span>
              <span v-else>长跑:{{row.longRun}} 跳绳:{{row.ropeSkipping}} 跳远:{{row.longJump}} 球:{{row.ballSports}} 武:{{row.martialArts}}</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" width="80" show-overflow-tooltip />
          <el-table-column label="操作" width="230" align="center">
            <template #default="{row}">
              <el-button type="primary" size="small" @click="editDuplicate(row)">编辑</el-button>
              <el-button type="success" size="small" @click="submitDuplicate(row)">提交</el-button>
              <el-button type="danger" size="small" @click="deleteDuplicate(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-dialog v-model="dupEditVisible" title="编辑重复数据" width="600px">
          <el-form :model="dupForm" label-width="100px">
            <el-form-item label="学校"><el-input v-model="dupForm.school" /></el-form-item>
            <el-form-item label="姓名"><el-input v-model="dupForm.name" /></el-form-item>
            <template v-if="dupForm.gradeLevel==='seven'||dupForm.gradeLevel==='eight'">
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
          <el-table-column prop="school" label="学校" min-width="150" />
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="identityId" label="身份ID" min-width="180" />
          <el-table-column prop="graduationYear" label="毕业年份" width="100" align="center" />
          <el-table-column prop="attendanceScore" label="出勤率" width="80" align="center" />
          <el-table-column prop="examScore" label="体育考试" width="90" align="center" />
          <el-table-column prop="fitnessScore" label="体测" width="80" align="center" />
          <el-table-column prop="total" label="合计" width="80" align="center" />
          <el-table-column prop="totalVerify" label="校对合计" width="90" align="center" />
          <el-table-column label="校对结果" width="90" align="center">
            <template #default>
              <el-tag type="danger" size="small">❌</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" width="80" show-overflow-tooltip />
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { reconsiderationApi, credentialApi } from '@/api'
import { dataApi } from '@/api'

const activeTab = ref('modify')
const reconsiderations = ref<any[]>([])
const anomalyData = ref<any[]>([])
const loadingRecon = ref(false)
const loadingAnomaly = ref(false)
const loadingIdCheck = ref(false)
const idCheckVisible = ref(false)
const idCheckResult = ref<any>(null)

const gradeLabel = (g: string) => ({ seven: '七年级', eight: '八年级', nine: '九年级' }[g] || g)

const loadReconsiderations = async () => {
  loadingRecon.value = true
  try { reconsiderations.value = await reconsiderationApi.getList() } catch { /* ignore */ }
  loadingRecon.value = false
}

const loadAnomalies = async () => {
  loadingAnomaly.value = true
  try {
    const [seven, eight] = await Promise.all([
      dataApi.page('grade_seven', { pageSize: 10000, verifyResult: '0' }),
      dataApi.page('grade_eight', { pageSize: 10000, verifyResult: '0' })
    ])
    anomalyData.value = [
      ...(seven.list || []).map((r: any) => ({ ...r, _grade: '七年级' })),
      ...(eight.list || []).map((r: any) => ({ ...r, _grade: '八年级' }))
    ]
  } catch { /* ignore */ }
  loadingAnomaly.value = false
}

const toggleIdCardCheck = async (row: any) => {
  idCheckVisible.value = true
  loadingIdCheck.value = true
  idCheckResult.value = null
  try { idCheckResult.value = await reconsiderationApi.checkIdCard(row.id_card) } catch { /* ignore */ }
  loadingIdCheck.value = false
}

const downloadCredential = async (id: number) => {
  try {
    const token = localStorage.getItem('token')
    const resp = await fetch(credentialApi.getDownloadUrl(id), {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!resp.ok) throw new Error('下载失败')
    const blob = await resp.blob()
    const disposition = resp.headers.get('content-disposition')
    let filename = 'download'
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (match) filename = decodeURIComponent(match[1].replace(/['"]/g, ''))
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  } catch { /* ignore */ }
}

const handleApproveRecon = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认标记"${row.student_name}"的复核申请为已处理？`, '审核确认', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'info'
    })
    await reconsiderationApi.approve(row.id)
    ElMessage.success('已标记为已处理')
    await loadReconsiderations()
  } catch { /* cancelled */ }
}

const handleRejectRecon = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认驳回"${row.student_name}"的复核申请？`, '驳回确认', {
      confirmButtonText: '确认驳回', cancelButtonText: '取消', type: 'warning'
    })
    await reconsiderationApi.reject(row.id)
    ElMessage.success('已驳回')
    await loadReconsiderations()
  } catch { /* cancelled */ }
}

// ===== 重复处理 =====
const duplicateData = ref<any[]>([])
const loadingDup = ref(false)
const dupEditVisible = ref(false)
const dupForm = ref<any>({})
const editingDupId = ref<number | null>(null)

const loadDuplicates = async () => {
  loadingDup.value = true
  try { duplicateData.value = await dataApi.getDuplicates() } catch { /* ignore */ }
  loadingDup.value = false
}
const editDuplicate = (row: any) => {
  editingDupId.value = row.id; dupForm.value = { ...row }; dupEditVisible.value = true
}
const saveDuplicate = async () => {
  if (!editingDupId.value) return
  try { await dataApi.updateDuplicate(editingDupId.value, dupForm.value); ElMessage.success('保存成功'); dupEditVisible.value = false; loadDuplicates() }
  catch (e: any) { ElMessage.error(e.message || '保存失败') }
}
const submitDuplicate = async (row: any) => {
  try { await ElMessageBox.confirm('确认提交到正式成绩表？', '确认', { type: 'info' }); await dataApi.submitDuplicate(row.id); ElMessage.success('已提交'); loadDuplicates() }
  catch { /* cancelled */ }
}
const deleteDuplicate = async (row: any) => {
  try { await ElMessageBox.confirm('确认删除？', '确认', { type: 'warning' }); await dataApi.deleteDuplicate(row.id); ElMessage.success('已删除'); loadDuplicates() }
  catch { /* cancelled */ }
}

const handleTabChange = () => {
  if (activeTab.value === 'modify') {
    loadReconsiderations()
  } else if (activeTab.value === 'anomaly') {
    loadAnomalies()
  } else if (activeTab.value === 'duplicate') {
    loadDuplicates()
  }
}

onMounted(() => {
  loadReconsiderations()
})
</script>

<style scoped lang="scss">
.grade-review-page {
  padding: 0;
  min-height: 100%;
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
</style>

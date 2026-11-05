<template>
  <div class="reconsideration-page">
    <el-alert
      v-if="!isSchoolUser"
      type="info"
      show-icon
      :closable="false"
      title="管理员账号无法提交复核申请"
      style="margin-bottom: 16px"
    >
      <div class="alert-body">
        管理员可在下方查看全校的复核申请；如需审批通过或驳回，请前往
        <router-link to="/grade-review">成绩审核</router-link>
        页面处理。
      </div>
    </el-alert>

    <el-tabs v-model="activeTab">
      <!-- Tab 1: 申请列表 -->
      <el-tab-pane label="申请列表" name="list">
        <el-table :data="myList" border stripe v-loading="loadingList" style="width: 100%">
          <el-table-column prop="school" label="学校" min-width="160" show-overflow-tooltip />
          <el-table-column prop="studentName" label="学生姓名" :width="100" :min-width="100" />
          <el-table-column prop="idCard" label="身份证号" min-width="180" />
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
          <el-table-column label="状态" :width="120" :min-width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'approved'" type="success" size="small">已审核</el-tag>
              <el-tag v-else-if="row.status === 'rejected'" type="danger" size="small">已驳回</el-tag>
              <el-tag v-else type="warning" size="small">已提交</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column prop="createdAt" label="提交时间" :width="160" :min-width="160" align="center">
            <template #default="{ row }">
              {{ formatTime(row.createdAt) }}
            </template>
          </el-table-column>
        </el-table>

        <!-- 管理员查看的是全校申请，走服务端分页 -->
        <div v-if="!isSchoolUser" class="pagination-section">
          <el-pagination
            :current-page="listPage"
            :page-size="listPageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="listTotal"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @current-change="onListPageChange"
            @size-change="onListSizeChange"
          />
        </div>
      </el-tab-pane>

      <!-- Tab 2: 提交申请（仅学校账号可用） -->
      <el-tab-pane v-if="isSchoolUser" label="提交申请" name="submit">
        <el-card style="max-width: 720px">
          <el-alert
            v-if="!authStore.userSchoolName"
            type="error"
            show-icon
            :closable="false"
            title="当前账号未绑定学校，无法提交复核申请"
            style="margin-bottom: 16px"
          />

          <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
            <el-form-item label="学校">
              <el-input :model-value="authStore.userSchoolName" disabled placeholder="未绑定学校" />
            </el-form-item>
            <el-form-item label="学生姓名" prop="studentName">
              <el-input v-model="form.studentName" placeholder="请输入学生姓名" />
            </el-form-item>
            <el-form-item label="身份证号" prop="idCard">
              <el-input v-model="form.idCard" placeholder="请输入身份证号" />
            </el-form-item>
            <el-form-item label="年级" prop="gradeLevel">
              <el-select v-model="form.gradeLevel" placeholder="请选择年级" style="width: 100%" @change="handleGradeChange">
                <el-option label="七年级" value="seven" />
                <el-option label="八年级" value="eight" />
                <el-option label="九年级" value="nine" />
              </el-select>
            </el-form-item>

            <template v-if="isThreePartGrade(form.gradeLevel)">
              <el-form-item label="出勤率成绩"><el-input-number v-model="form.attendanceScore" :min="0" :max="100" :precision="1" style="width: 100%" @change="autoVerify" /></el-form-item>
              <el-form-item label="体育考试成绩"><el-input-number v-model="form.examScore" :min="0" :max="100" :precision="1" style="width: 100%" @change="autoVerify" /></el-form-item>
              <el-form-item label="体测成绩"><el-input-number v-model="form.fitnessScore" :min="0" :max="100" :precision="1" style="width: 100%" @change="autoVerify" /></el-form-item>
              <el-form-item label="合计成绩"><el-input-number v-model="form.total" :min="0" :max="100" :precision="1" style="width: 100%" @change="autoVerify" /></el-form-item>
              <el-form-item label="校对结果" v-if="verifyInfo !== null">
                <el-tag v-if="verifyInfo.pass" type="success" size="large">✅ 校对正确 (合计={{ verifyInfo.totalVerify }})</el-tag>
                <el-tag v-else type="danger" size="large">❌ 校对异常 (合计={{ verifyInfo.totalVerify }}，差值{{ verifyInfo.diff > 0 ? '+' : '' }}{{ verifyInfo.diff }})</el-tag>
              </el-form-item>
            </template>

            <template v-if="form.gradeLevel === 'nine'">
              <el-form-item label="长跑"><el-input-number v-model="form.longRun" :min="0" :max="100" :precision="1" style="width: 100%" /></el-form-item>
              <el-form-item label="跳绳"><el-input-number v-model="form.ropeSkipping" :min="0" :max="100" :precision="1" style="width: 100%" /></el-form-item>
              <el-form-item label="跳远"><el-input-number v-model="form.longJump" :min="0" :max="100" :precision="1" style="width: 100%" /></el-form-item>
              <el-form-item label="足(篮)球"><el-input-number v-model="form.ballSports" :min="0" :max="100" :precision="1" style="width: 100%" /></el-form-item>
              <el-form-item label="武术"><el-input-number v-model="form.martialArts" :min="0" :max="100" :precision="1" style="width: 100%" /></el-form-item>
            </template>

            <el-form-item label="证明材料">
              <el-upload ref="uploadRef" :auto-upload="false" :limit="1" accept=".pdf,.jpg,.jpeg,.png" :on-change="handleFileChange" :on-remove="handleFileRemove" drag>
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">拖拽或点击上传 PDF/图片</div>
              </el-upload>
            </el-form-item>

            <el-form-item label="备注说明">
              <el-input v-model="form.remark" type="textarea" rows="3" placeholder="可选" />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="handleSubmit">提交申请</el-button>
              <el-button @click="resetForm">重置</el-button>
              <div v-if="submitHint" class="submit-hint">{{ submitHint }}</div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { reconsiderationApi } from '@/api'

const authStore = useAuthStore()
const activeTab = ref('list')

/** 学校账号才能提交复核申请；管理员进来只看列表 */
const isSchoolUser = computed(() => authStore.isSchoolUser)

// ===== 申请列表 =====
const myList = ref<any[]>([])
const loadingList = ref(false)
const listTotal = ref(0)
const listPage = ref(1)
const listPageSize = ref(20)

const loadMyList = async () => {
  loadingList.value = true
  try {
    if (isSchoolUser.value) {
      const list = await reconsiderationApi.getMyList()
      myList.value = Array.isArray(list) ? list : []
      listTotal.value = myList.value.length
    } else {
      const res = await reconsiderationApi.getList({
        page: listPage.value,
        pageSize: listPageSize.value,
      })
      myList.value = res?.list || []
      listTotal.value = res?.total || 0
    }
  } catch (e: any) {
    myList.value = []
    listTotal.value = 0
    ElMessage.error(e?.message || '加载复核申请列表失败')
  } finally {
    loadingList.value = false
  }
}

const onListPageChange = (page: number) => {
  listPage.value = page
  loadMyList()
}

const onListSizeChange = (size: number) => {
  listPageSize.value = size
  listPage.value = 1
  loadMyList()
}

const GRADE_LABELS: Record<string, string> = {
  seven: '七年级',
  eight: '八年级',
  nine: '九年级',
}

const gradeLabel = (g: string) => GRADE_LABELS[g] || g || '-'

/** 七、八年级为「出勤 + 考试 + 体测」三项制 */
const isThreePartGrade = (g: string) => g === 'seven' || g === 'eight'

const formatTime = (t: string) => t ? t.replace('T', ' ').substring(0, 19) : ''

// ===== 提交申请 =====
const formRef = ref()
const uploadRef = ref()
const submitting = ref(false)
const uploadedFile = ref<File | null>(null)
const verifyInfo = ref<{ pass: boolean; totalVerify: number; diff: number } | null>(null)

const form = reactive({
  studentName: '', idCard: '', gradeLevel: '' as string,
  attendanceScore: undefined as number | undefined,
  examScore: undefined as number | undefined,
  fitnessScore: undefined as number | undefined,
  total: undefined as number | undefined,
  longRun: undefined as number | undefined,
  ropeSkipping: undefined as number | undefined,
  longJump: undefined as number | undefined,
  ballSports: undefined as number | undefined,
  martialArts: undefined as number | undefined,
  remark: ''
})

const rules = {
  studentName: [{ required: true, message: '请输入学生姓名', trigger: 'blur' }],
  idCard: [{ required: true, message: '请输入身份证号', trigger: 'blur' }],
  gradeLevel: [{ required: true, message: '请选择年级', trigger: 'change' }],
}

const autoVerify = () => {
  if (!isThreePartGrade(form.gradeLevel)) return
  const att = form.attendanceScore || 0; const exam = form.examScore || 0
  const fit = form.fitnessScore || 0; const tot = form.total || 0
  const totalVerify = parseFloat((att + exam + fit).toFixed(1))
  verifyInfo.value = { pass: Math.abs(tot - totalVerify) < 0.1, totalVerify, diff: parseFloat((tot - totalVerify).toFixed(1)) }
}

const canSubmit = computed(() => {
  if (!authStore.userSchoolName) return false
  if (!form.studentName || !form.idCard || !form.gradeLevel) return false
  if (isThreePartGrade(form.gradeLevel)) return verifyInfo.value?.pass === true && uploadedFile.value !== null
  return uploadedFile.value !== null
})

/** 提交按钮禁用原因提示，避免用户不知道为什么点不了 */
const submitHint = computed(() => {
  if (!authStore.userSchoolName) return '当前账号未绑定学校，无法提交复核申请'
  if (!form.studentName) return '请先填写学生姓名'
  if (!form.idCard) return '请先填写身份证号'
  if (!form.gradeLevel) return '请先选择年级'
  if (isThreePartGrade(form.gradeLevel) && verifyInfo.value?.pass !== true) {
    return '七、八年级需填写完整分数并通过校对（合计 = 出勤 + 考试 + 体测）后才能提交'
  }
  if (!uploadedFile.value) return '请上传证明材料后再提交'
  return ''
})

const handleGradeChange = () => { verifyInfo.value = null }
const handleFileChange = (file: any) => { uploadedFile.value = file.raw }
const handleFileRemove = () => { uploadedFile.value = null }

const handleSubmit = async () => {
  if (!formRef.value) return

  // 未绑定学校的账号不允许提交
  if (!authStore.userSchoolName) {
    ElMessage.warning('当前账号未绑定学校，无法提交复核申请')
    return
  }

  // Element Plus 的 validate 需要用 Promise 形式等待结果
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const result = await reconsiderationApi.submit({
      school: authStore.userSchoolName, studentName: form.studentName,
      idCard: form.idCard, gradeLevel: form.gradeLevel,
      attendanceScore: form.attendanceScore, examScore: form.examScore,
      fitnessScore: form.fitnessScore, total: form.total,
      longRun: form.longRun, ropeSkipping: form.ropeSkipping,
      longJump: form.longJump, ballSports: form.ballSports,
      martialArts: form.martialArts, remark: form.remark
    })
    if (uploadedFile.value && result.id) {
      await reconsiderationApi.uploadCredential(result.id, uploadedFile.value)
    }
    ElMessage.success('复核申请已提交')
    resetForm()
    activeTab.value = 'list'
    await loadMyList()
  } catch (e: any) {
    ElMessage.error(e?.message || '提交失败')
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  form.studentName = ''; form.idCard = ''; form.gradeLevel = ''
  form.attendanceScore = undefined; form.examScore = undefined; form.fitnessScore = undefined; form.total = undefined
  form.longRun = undefined; form.ropeSkipping = undefined; form.longJump = undefined; form.ballSports = undefined; form.martialArts = undefined
  form.remark = ''
  uploadedFile.value = null; verifyInfo.value = null
  uploadRef.value?.clearFiles()
}

onMounted(() => { loadMyList() })
</script>

<style scoped lang="scss">
.reconsideration-page {
  @include page-container;
}

.alert-body {
  font-size: 13px;
  line-height: 1.6;
}

.pagination-section {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.submit-hint {
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted);
}
</style>

<template>
  <div class="reconsideration-page">
    <el-tabs v-model="activeTab">
      <!-- Tab 1: 申请列表 -->
      <el-tab-pane label="申请列表" name="list">
        <el-table :data="myList" border stripe v-loading="loadingList" style="width: 100%">
          <el-table-column prop="student_name" label="学生姓名" width="100" />
          <el-table-column prop="id_card" label="身份证号" min-width="180" />
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
          <el-table-column label="状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.status === 'approved'" type="success" size="small">已审核</el-tag>
              <el-tag v-else-if="row.status === 'rejected'" type="danger" size="small">已驳回</el-tag>
              <el-tag v-else type="warning" size="small">已提交</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column prop="created_at" label="提交时间" width="160" align="center">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- Tab 2: 提交申请 -->
      <el-tab-pane label="提交申请" name="submit">
        <el-card style="max-width: 720px">
          <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
            <el-form-item label="学校">
              <el-input :model-value="authStore.userSchoolName" disabled />
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

            <template v-if="form.gradeLevel === 'seven' || form.gradeLevel === 'eight'">
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
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { reconsiderationApi } from '@/api'

const authStore = useAuthStore()
const activeTab = ref('list')

// ===== 申请列表 =====
const myList = ref<any[]>([])
const loadingList = ref(false)
const loadMyList = async () => {
  loadingList.value = true
  try { myList.value = await reconsiderationApi.getMyList() } catch { /* ignore */ }
  loadingList.value = false
}

const gradeLabel = (g: string) => ({ seven: '七年级', eight: '八年级', nine: '九年级' }[g] || g)
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
  if (form.gradeLevel !== 'seven' && form.gradeLevel !== 'eight') return
  const att = form.attendanceScore || 0; const exam = form.examScore || 0
  const fit = form.fitnessScore || 0; const tot = form.total || 0
  const totalVerify = parseFloat((att + exam + fit).toFixed(1))
  verifyInfo.value = { pass: Math.abs(tot - totalVerify) < 0.1, totalVerify, diff: parseFloat((tot - totalVerify).toFixed(1)) }
}

const canSubmit = computed(() => {
  if (!form.studentName || !form.idCard || !form.gradeLevel) return false
  if (form.gradeLevel === 'seven' || form.gradeLevel === 'eight') return verifyInfo.value?.pass === true && uploadedFile.value !== null
  return uploadedFile.value !== null
})

const handleGradeChange = () => { verifyInfo.value = null }
const handleFileChange = (file: any) => { uploadedFile.value = file.raw }
const handleFileRemove = () => { uploadedFile.value = null }

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
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
      ElMessage.error(e.message || '提交失败')
    } finally {
      submitting.value = false
    }
  })
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
.reconsideration-page { padding: 0; min-height: 100%; }
</style>

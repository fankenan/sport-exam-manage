<template>
  <div class="grade-verify-page">
    <div class="search-section">
        <el-input
          v-model="searchName"
          placeholder="输入学生姓名"
          clearable
          style="width: 200px"
        >
          <template #prefix>
            <el-icon><User /></el-icon>
          </template>
        </el-input>

        <el-input
          v-model="searchIdCard"
          placeholder="输入身份证号"
          clearable
          style="width: 220px; margin-left: 12px"
        >
          <template #prefix>
            <el-icon><Document /></el-icon>
          </template>
        </el-input>

        <el-button type="primary" style="margin-left: 12px" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button type="default" style="margin-left: 8px" @click="resetSearch">
          重置
        </el-button>
      </div>

      <div v-if="hasSearched" class="results-section">
        <el-tabs v-model="activeTab" >
          <el-tab-pane label="七年级" name="seven">
            <div v-if="searchResults.seven.length === 0" class="empty-text">
              未找到七年级数据
            </div>
            <div v-else>
              <el-table
                :data="searchResults.seven"
                border
                stripe
                style="width: 100%"
                :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }"
              >
                <el-table-column prop="school" label="学校" min-width="180" />
                <el-table-column prop="name" label="姓名" width="100" align="center" />
                <el-table-column prop="idCard" label="身份证" min-width="180" />
                <el-table-column prop="identityId" label="身份ID" min-width="180" />
                <el-table-column prop="graduationYear" label="毕业年份" width="100" align="center" />
                <el-table-column prop="attendanceScore" label="出勤率成绩" width="100" align="center" />
                <el-table-column prop="examScore" label="体育考试成绩" width="110" align="center" />
                <el-table-column prop="fitnessScore" label="体测成绩" width="90" align="center" />
                <el-table-column prop="total" label="合计" width="80" align="center" />
                <el-table-column prop="totalVerify" label="合计校对" width="100" align="center" />
                <el-table-column prop="verifyResult" label="校对结果" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.verifyResult ? 'success' : 'danger'" size="small">
                      {{ row.verifyResult ? '✅' : '❌' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="remark" label="备注" width="80" show-overflow-tooltip />
                <el-table-column label="操作" width="200" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="handleEdit(row, 'seven')">
                      修改
                    </el-button>
                    <el-button type="success" link size="small" @click="handleSave(row, 'seven')">
                      保存
                    </el-button>
                    <el-button type="warning" link size="small" @click="handleUploadCredential(row, 'seven')">
                      修改凭证
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="八年级" name="eight">
            <div v-if="searchResults.eight.length === 0" class="empty-text">
              未找到八年级数据
            </div>
            <div v-else>
              <el-table
                :data="searchResults.eight"
                border
                stripe
                style="width: 100%"
                :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }"
              >
                <el-table-column prop="school" label="学校" min-width="180" />
                <el-table-column prop="name" label="姓名" width="100" align="center" />
                <el-table-column prop="idCard" label="身份证" min-width="180" />
                <el-table-column prop="identityId" label="身份ID" min-width="180" />
                <el-table-column prop="graduationYear" label="毕业年份" width="100" align="center" />
                <el-table-column prop="attendanceScore" label="出勤率成绩" width="100" align="center" />
                <el-table-column prop="examScore" label="体育考试成绩" width="110" align="center" />
                <el-table-column prop="fitnessScore" label="体测成绩" width="90" align="center" />
                <el-table-column prop="total" label="合计" width="80" align="center" />
                <el-table-column prop="totalVerify" label="合计校对" width="100" align="center" />
                <el-table-column prop="verifyResult" label="校对结果" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.verifyResult ? 'success' : 'danger'" size="small">
                      {{ row.verifyResult ? '✅' : '❌' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="200" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="handleEdit(row, 'eight')">
                      修改
                    </el-button>
                    <el-button type="success" link size="small" @click="handleSave(row, 'eight')">
                      保存
                    </el-button>
                    <el-button type="warning" link size="small" @click="handleUploadCredential(row, 'eight')">
                      修改凭证
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="九年级" name="nine">
            <div v-if="searchResults.nine.length === 0" class="empty-text">
              未找到九年级数据
            </div>
            <div v-else>
              <el-table
                :data="searchResults.nine"
                border
                stripe
                style="width: 100%"
                :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }"
              >
                <el-table-column prop="school" label="学校" min-width="180" />
                <el-table-column prop="name" label="姓名" width="100" align="center" />
                <el-table-column prop="idCard" label="身份证" min-width="180" />
                <el-table-column prop="identityId" label="身份ID" min-width="180" />
                <el-table-column prop="graduationYear" label="毕业年份" width="100" align="center" />
                <el-table-column prop="longRun" label="长跑" width="80" align="center" />
                <el-table-column prop="ropeSkipping" label="跳绳" width="80" align="center" />
                <el-table-column prop="longJump" label="跳远" width="80" align="center" />
                <el-table-column prop="ballSports" label="足(篮)球" width="90" align="center" />
                <el-table-column prop="martialArts" label="武术" width="80" align="center" />
                <el-table-column label="操作" width="200" align="center" fixed="right">
                  <template #default="{ row }">
                    <el-button type="primary" link size="small" @click="handleEdit(row, 'nine')">
                      修改
                    </el-button>
                    <el-button type="success" link size="small" @click="handleSave(row, 'nine')">
                      保存
                    </el-button>
                    <el-button type="warning" link size="small" @click="handleUploadCredential(row, 'nine')">
                      修改凭证
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

    <el-dialog
      v-model="editDialogVisible"
      title="修改成绩"
      width="600px"
    >
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
        <el-button type="default" @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="credentialDialogVisible"
      title="上传修改凭证"
      width="500px"
    >
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
        <el-button type="default" @click="credentialDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="saveCredential">确认上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, User, Document, UploadFilled } from '@element-plus/icons-vue'
import { useGradeStore, type GradeSevenData, type GradeEightData, type GradeNineData } from '@/stores/grade'
import { credentialApi } from '@/api'

const gradeStore = useGradeStore()

const searchName = ref('')
const searchIdCard = ref('')
const hasSearched = ref(false)
const activeTab = ref('seven')

const searchResults = reactive({
  seven: [] as GradeSevenData[],
  eight: [] as GradeEightData[],
  nine: [] as GradeNineData[]
})

const editDialogVisible = ref(false)
const credentialDialogVisible = ref(false)
const editForm = ref<any>({})
const editGrade = ref<'seven' | 'eight' | 'nine'>('seven')
const editingId = ref('')
const credentialFile = ref<File | null>(null)
const credentialRow = ref<any>(null)
const credentialGrade = ref<'seven' | 'eight' | 'nine'>('seven')

const handleSearch = () => {
  if (!searchName.value && !searchIdCard.value) {
    ElMessage.warning('请输入姓名或身份证号')
    return
  }
  
  const keyword = searchName.value || searchIdCard.value
  const results = gradeStore.searchByNameOrIdCard(keyword)
  
  searchResults.seven = results.seven
  searchResults.eight = results.eight
  searchResults.nine = results.nine
  
  hasSearched.value = true
  
  if (results.seven.length === 0 && results.eight.length === 0 && results.nine.length === 0) {
    ElMessage.info('未找到相关数据')
  }
}

const resetSearch = () => {
  searchName.value = ''
  searchIdCard.value = ''
  hasSearched.value = false
  searchResults.seven = []
  searchResults.eight = []
  searchResults.nine = []
}

const handleEdit = (row: any, grade: 'seven' | 'eight' | 'nine') => {
  editingId.value = row.id
  editForm.value = { ...row }
  editGrade.value = grade
  editDialogVisible.value = true
}

const saveEdit = () => {
  if (editingId.value && editForm.value) {
    if (editGrade.value === 'seven') {
      gradeStore.updateGradeSevenData(editingId.value, {
        attendanceScore: editForm.value.attendanceScore,
        examScore: editForm.value.examScore,
        fitnessScore: editForm.value.fitnessScore,
        total: editForm.value.total,
        remark: editForm.value.remark
      })
    } else if (editGrade.value === 'eight') {
      gradeStore.updateGradeEightData(editingId.value, {
        attendanceScore: editForm.value.attendanceScore,
        examScore: editForm.value.examScore,
        fitnessScore: editForm.value.fitnessScore,
        total: editForm.value.total,
        remark: editForm.value.remark
      })
    } else if (editGrade.value === 'nine') {
      gradeStore.updateGradeNineData(editingId.value, {
        longRun: editForm.value.longRun,
        ropeSkipping: editForm.value.ropeSkipping,
        longJump: editForm.value.longJump,
        ballSports: editForm.value.ballSports,
        martialArts: editForm.value.martialArts,
        remark: editForm.value.remark
      })
    }
    
    ElMessage.success('修改成功')
    editDialogVisible.value = false
    handleSearch()
  }
}

const handleSave = (row: any, grade: 'seven' | 'eight' | 'nine') => {
  editingId.value = row.id
  editForm.value = { ...row }
  editGrade.value = grade
  
  if (grade === 'seven') {
    gradeStore.updateGradeSevenData(row.id, {
      attendanceScore: row.attendanceScore,
      examScore: row.examScore,
      fitnessScore: row.fitnessScore,
      total: row.total,
      remark: row.remark
    })
  } else if (grade === 'eight') {
    gradeStore.updateGradeEightData(row.id, {
      attendanceScore: row.attendanceScore,
      examScore: row.examScore,
      fitnessScore: row.fitnessScore,
      total: row.total,
      remark: row.remark
    })
  } else if (grade === 'nine') {
    gradeStore.updateGradeNineData(row.id, {
      longRun: row.longRun,
      ropeSkipping: row.ropeSkipping,
      longJump: row.longJump,
      ballSports: row.ballSports,
      martialArts: row.martialArts,
      remark: row.remark
    })
  }
  
  ElMessage.success('保存成功')
}

const handleUploadCredential = (row: any, grade: 'seven' | 'eight' | 'nine') => {
  credentialRow.value = row
  credentialGrade.value = grade
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
  try {
    await credentialApi.upload(
      credentialGrade.value,
      credentialRow.value.id,
      credentialFile.value
    )
    ElMessage.success('凭证上传成功')
    credentialDialogVisible.value = false
  } catch (err: any) {
    ElMessage.error(err.message || '凭证上传失败')
  }
}
</script>

<style scoped lang="scss">
.grade-verify-page {
  padding: 0;
  background: var(--bg-page);
  min-height: 100%;

  :deep(.el-card) {
    border-radius: 24px;
    border: 1px solid var(--border-light);
    background: var(--bg-card);
    color: var(--text-primary);
  }

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

  :deep(.el-tabs--border-card) {
    border-radius: 12px;
    border: 1px solid var(--border-light);
    background: var(--bg-card);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 18px;
  }

  .search-section {
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .results-section {
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
}
</style>

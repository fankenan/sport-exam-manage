<template>
  <div class="material-upload-page">
    <div class="filter-section">
        <div v-if="authStore.isSchoolUser" style="margin-bottom: 12px;">
          <el-tag type="primary" size="large">当前学校：{{ authStore.userSchoolName }}</el-tag>
        </div>
        <el-select
          v-model="selectedYear"
          placeholder="选择毕业年份"
          style="width: 180px"
          @change="handleYearChange"
        >
          <el-option
            v-for="year in availableYears"
            :key="year"
            :label="year"
            :value="year"
          />
        </el-select>
      </div>

      <div v-if="selectedYear" class="schools-section">
        <el-divider content-position="left">
          <el-icon><School /></el-icon>
          {{ selectedYear }}年毕业学校列表
        </el-divider>
        
        <el-table
          :data="paginatedSchools"
          border
          stripe
          style="width: 100%"
          :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }"
        >
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="学校名称" min-width="250" />
          <el-table-column label="材料状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="getMaterialStatus(row).type" size="small">
                {{ getMaterialStatus(row).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="上传时间" width="160" align="center">
            <template #default="{ row }">
              {{ getMaterialInfo(row).uploadTime || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="文件名称" min-width="200">
            <template #default="{ row }">
              {{ getMaterialInfo(row).fileName || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" align="center" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" @click="handleUpload(row)">
                <el-icon><Upload /></el-icon>
                上传
              </el-button>
              <el-button type="success"
                size="small" 
                :disabled="!hasMaterial(row)"
                @click="handleDownload(row)"
              >
                <el-icon><Download /></el-icon>
                下载
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-section">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :page-sizes="[50, 100, 200]"
            :total="schoolsList.length"
            layout="total, sizes, prev, pager, next, jumper"
            background
          />
        </div>
      </div>

      <div v-else class="empty-section">
        <el-empty description="请先选择毕业年份" />
      </div>

    <el-dialog
      v-model="uploadDialogVisible"
      title="上传过程性材料"
      width="600px"
    >
      <div v-if="selectedSchool" class="upload-info">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="学校名称">{{ selectedSchool.name }}</el-descriptions-item>
          <el-descriptions-item label="毕业年份">{{ selectedYear }}</el-descriptions-item>
        </el-descriptions>
      </div>
      
      <el-alert
        title="请上传PDF格式文件或ZIP格式压缩包"
        type="info"
        :closable="false"
        show-icon
        style="margin: 16px 0"
      />
      
      <el-upload
        class="material-upload"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :show-file-list="true"
        accept=".pdf,.zip"
        :limit="1"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">
          <em>点击上传</em> 或拖拽文件到此处
        </div>
        <div class="upload-tip">
          支持 PDF、ZIP 格式，文件大小不超过 50MB
        </div>
      </el-upload>
      
      <template #footer>
        <el-button type="default" @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="confirmUpload">
          确认上传
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { School, Upload, Download, UploadFilled } from '@element-plus/icons-vue'
import { useGradeStore } from '@/stores/grade'
import { useAuthStore } from '@/stores/auth'
import { materialApi } from '@/api'

const gradeStore = useGradeStore()
const authStore = useAuthStore()

const selectedYear = ref('')
const currentPage = ref(1)
const pageSize = ref(50)
const uploadDialogVisible = ref(false)
const selectedSchool = ref<any>(null)
const uploadFile = ref<File | null>(null)
const uploading = ref(false)

const schoolsList = ref<Array<{name: string; id: string}>>([])
const materialMap = ref<Record<string, any>>({})

const availableYears = computed(() => {
  const years = new Set<string>()
  gradeStore.gradeSevenList.forEach(item => years.add(item.graduationYear))
  gradeStore.gradeEightList.forEach(item => years.add(item.graduationYear))
  gradeStore.gradeNineList.forEach(item => years.add(item.graduationYear))
  return Array.from(years).sort()
})

const paginatedSchools = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return schoolsList.value.slice(start, end)
})

const handleYearChange = async (year: string) => {
  if (year) {
    loadSchools(year)
    await loadMaterials(year)
  }
}

const loadSchools = (year: string) => {
  const schools = new Set<string>()

  gradeStore.gradeSevenList
    .filter(item => item.graduationYear === year)
    .forEach(item => schools.add(item.school))

  gradeStore.gradeEightList
    .filter(item => item.graduationYear === year)
    .forEach(item => schools.add(item.school))

  gradeStore.gradeNineList
    .filter(item => item.graduationYear === year)
    .forEach(item => schools.add(item.school))

  // 学校用户只能看到自己的学校
  let schoolArray = Array.from(schools)
  if (authStore.isSchoolUser && authStore.userSchoolName) {
    schoolArray = schoolArray.filter(s => s === authStore.userSchoolName)
  }

  schoolsList.value = schoolArray.map((name, index) => ({
    name,
    id: `school_${year}_${index}`
  }))

  currentPage.value = 1
}

const loadMaterials = async (year: string) => {
  try {
    const list: any[] = await materialApi.getList(year)
    const map: Record<string, any> = {}
    list.forEach((item: any) => {
      map[item.school] = {
        id: item.id,
        fileName: item.file_name,
        fileSize: item.file_size,
        uploadTime: item.created_at,
        uploadedBy: item.uploaded_by
      }
    })
    materialMap.value = map
  } catch (err) {
    console.error('加载材料列表失败:', err)
  }
}

const getMaterialStatus = (school: any) => {
  const info = materialMap.value[school.name]
  return info
    ? { type: 'success' as const, text: '已上传' }
    : { type: 'info' as const, text: '未上传' }
}

const getMaterialInfo = (school: any) => {
  const info = materialMap.value[school.name]
  if (info) {
    return {
      uploadTime: info.uploadTime || '-',
      fileName: info.fileName || '-'
    }
  }
  return { uploadTime: '', fileName: '' }
}

const hasMaterial = (school: any) => {
  return !!materialMap.value[school.name]
}

const handleUpload = (row: any) => {
  selectedSchool.value = row
  uploadFile.value = null
  uploadDialogVisible.value = true
}

const handleFileChange = (file: any) => {
  if (file.raw) {
    uploadFile.value = file.raw
  }
}

const confirmUpload = async () => {
  if (!uploadFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }

  uploading.value = true
  try {
    await materialApi.upload(
      selectedSchool.value.name,
      selectedYear.value,
      uploadFile.value
    )
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    // 刷新材料列表
    await loadMaterials(selectedYear.value)
  } catch (err: any) {
    ElMessage.error(err.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

const handleDownload = (row: any) => {
  const info = materialMap.value[row.name]
  if (info && info.id) {
    const token = localStorage.getItem('token')
    const url = materialApi.getDownloadUrl(info.id)
    // 使用 fetch + blob 下载（需要带 token）
    fetch(url, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error('下载失败')
        return res.blob()
      })
      .then(blob => {
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = info.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(link.href)
        ElMessage.success('下载成功')
      })
      .catch(() => {
        ElMessage.error('下载失败')
      })
  }
}

onMounted(async () => {
  await gradeStore.loadFromStorage()
})
</script>

<style scoped lang="scss">
.material-upload-page {
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

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 18px;
  }

  .filter-section {
    margin-bottom: 20px;
  }

  .schools-section {
    .pagination-section {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
  }

  .empty-section {
    padding: 60px 0;
  }

  .upload-info {
    margin-bottom: 16px;
  }

  .material-upload {
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

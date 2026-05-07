<template>
  <div class="system-manage-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>系统管理</span>
          <div class="header-actions">
            <el-button type="danger" @click="handleClearAllData">
              <el-icon><Delete /></el-icon>
              清除所有数据
            </el-button>
            <el-button type="primary" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon>
              新增管理员
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="adminList"
        border
        stripe
        style="width: 100%"
        :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="username" label="用户名" min-width="150" />
        <el-table-column prop="role" label="角色" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="primary" size="small">{{ row.role === 'admin' ? '管理员' : '普通用户' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180" align="center" />
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button type="warning" link size="small" @click="handleResetPassword(row)">
              重置密码
            </el-button>
            <el-button type="danger"
              link
              size="small" 
              :disabled="row.username === 'admin'"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="showAddDialog"
      title="新增管理员"
      width="500px"
    >
      <el-form
        ref="addFormRef"
        :model="addForm"
        :rules="addRules"
        label-width="100px"
      >
        <el-form-item label="用户名" prop="username">
          <el-input v-model="addForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input 
            v-model="addForm.password" 
            type="password" 
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input 
            v-model="addForm.confirmPassword" 
            type="password" 
            placeholder="请再次输入密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAdd">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showEditDialog"
      title="编辑管理员"
      width="500px"
    >
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="100px"
      >
        <el-form-item label="用户名">
          <el-input v-model="editForm.username" disabled />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input 
            v-model="editForm.newPassword" 
            type="password" 
            placeholder="请输入新密码（留空则不修改）"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input 
            v-model="editForm.confirmPassword" 
            type="password" 
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleUpdate">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showResetDialog"
      title="重置密码"
      width="500px"
    >
      <el-form
        ref="resetFormRef"
        :model="resetForm"
        :rules="resetRules"
        label-width="100px"
      >
        <el-form-item label="用户名">
          <el-input v-model="resetForm.username" disabled />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input 
            v-model="resetForm.newPassword" 
            type="password" 
            placeholder="请输入新密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input 
            v-model="resetForm.confirmPassword" 
            type="password" 
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="default" @click="showResetDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="confirmReset">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useGradeStore } from '@/stores/grade'

interface Admin {
  id: number
  username: string
  password: string
  role: 'admin' | 'user'
  createdAt: string
}

const authStore = useAuthStore()
const gradeStore = useGradeStore()

const adminList = ref<Admin[]>([])
const submitting = ref(false)

const showAddDialog = ref(false)
const addFormRef = ref()
const addForm = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule: any, value: string, callback: any) => {
  if (value !== addForm.value.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const validateEditConfirmPassword = (rule: any, value: string, callback: any) => {
  if (editForm.value.newPassword && value !== editForm.value.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const validateResetConfirmPassword = (rule: any, value: string, callback: any) => {
  if (value !== resetForm.value.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const addRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 20, message: '长度在 6 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const showEditDialog = ref(false)
const editFormRef = ref()
const editForm = ref({
  id: 0,
  username: '',
  newPassword: '',
  confirmPassword: ''
})

const editRules = {
  confirmPassword: [
    { validator: validateEditConfirmPassword, trigger: 'blur' }
  ]
}

const showResetDialog = ref(false)
const resetFormRef = ref()
const resetForm = ref({
  id: 0,
  username: '',
  newPassword: '',
  confirmPassword: ''
})

const resetRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 20, message: '长度在 6 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateResetConfirmPassword, trigger: 'blur' }
  ]
}

const loadAdmins = async () => {
  try {
    const admins = await authStore.getAdmins()
    adminList.value = admins.map((a: any) => ({
      id: a.id,
      username: a.username,
      password: '',
      role: a.role || 'admin',
      createdAt: formatDateTime(a.createdAt || a.created_at)
    }))
  } catch {
    ElMessage.error('加载管理员列表失败')
  }
}

const formatDateTime = (val: any): string => {
  if (!val) return '-'
  if (typeof val === 'string') return val
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    const h = String(val.getHours()).padStart(2, '0')
    const min = String(val.getMinutes()).padStart(2, '0')
    const s = String(val.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}:${s}`
  }
  return String(val)
}

const handleAdd = async () => {
  if (!addFormRef.value) return

  await addFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      submitting.value = true
      try {
        await authStore.addAdmin(addForm.value.username, addForm.value.password)
        ElMessage.success('新增成功')
        showAddDialog.value = false
        addForm.value = { username: '', password: '', confirmPassword: '' }
        await loadAdmins()
      } catch (error: any) {
        ElMessage.error(error.message || '新增失败')
      }
      submitting.value = false
    }
  })
}

const handleEdit = (row: Admin) => {
  editForm.value = {
    id: row.id,
    username: row.username,
    newPassword: '',
    confirmPassword: ''
  }
  showEditDialog.value = true
}

const handleUpdate = async () => {
  if (!editFormRef.value) return

  await editFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      submitting.value = true
      try {
        if (editForm.value.newPassword) {
          await authStore.updateAdmin(editForm.value.id, { password: editForm.value.newPassword })
        }
        ElMessage.success('修改成功')
        showEditDialog.value = false
      } catch (error: any) {
        ElMessage.error(error.message || '修改失败')
      }
      submitting.value = false
    }
  })
}

const handleResetPassword = (row: Admin) => {
  resetForm.value = {
    id: row.id,
    username: row.username,
    newPassword: '',
    confirmPassword: ''
  }
  showResetDialog.value = true
}

const confirmReset = async () => {
  if (!resetFormRef.value) return

  await resetFormRef.value.validate(async (valid: boolean) => {
    if (valid) {
      submitting.value = true
      try {
        await authStore.updateAdmin(resetForm.value.id, { password: resetForm.value.newPassword })
        ElMessage.success('密码重置成功')
        showResetDialog.value = false
      } catch (error: any) {
        ElMessage.error(error.message || '重置失败')
      }
      submitting.value = false
    }
  })
}

const handleDelete = (row: Admin) => {
  ElMessageBox.confirm(
    `确定要删除管理员 "${row.username}" 吗？`,
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(async () => {
    try {
      await authStore.deleteAdmin(row.id)
      ElMessage.success('删除成功')
      await loadAdmins()
    } catch (error: any) {
      ElMessage.error(error.message || '删除失败')
    }
  })
}

const handleClearAllData = () => {
  ElMessageBox.confirm(
    '此操作将清除所有成绩数据（七年级、八年级、九年级、中招体育成绩），不可恢复！',
    '⚠️ 危险操作确认',
    {
      confirmButtonText: '确认清除',
      cancelButtonText: '取消',
      type: 'error',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => {
    ElMessageBox.prompt(
      '请输入"确认清除"以执行此操作',
      '最终确认',
      {
        confirmButtonText: '执行清除',
        cancelButtonText: '取消',
        type: 'warning',
        inputPattern: /^确认清除$/,
        inputErrorMessage: '请输入"确认清除"'
      }
    ).then(async () => {
      try {
        const { dataApi } = await import('@/api')
        await dataApi.clear()
        gradeStore.gradeSevenList = []
        gradeStore.gradeEightList = []
        gradeStore.gradeNineList = []
        gradeStore.admissionList = []
        ElMessage.success('所有数据已清除')
      } catch (error: any) {
        ElMessage.error(error.message || '清除失败')
      }
    })
  }).catch(() => {})
}

onMounted(() => {
  loadAdmins()
})
</script>

<style scoped lang="scss">
.system-manage-page {
  padding: 24px;
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

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 18px;
  }
}
</style>

<template>
  <div class="system-manage-page">
    <div class="page-toolbar">
      <div class="header-actions">
        <el-button type="danger" @click="handleClearAllData">
          <el-icon><Delete /></el-icon>
          清除所有数据
        </el-button>
        <el-button type="primary" @click="showAddDialog = true">
          <el-icon><Plus /></el-icon>
          新增管理员
        </el-button>
        <el-button type="success" :disabled="!canEnableAllSchools" @click="handleEnableAllSchools">
          <el-icon><CircleCheck /></el-icon>
          一键启用
        </el-button>
        <el-button type="danger" :disabled="!canDisableAllSchools" @click="handleDisableAllSchools">
          <el-icon><CircleClose /></el-icon>
          一键禁用
        </el-button>
        <span class="school-status">{{ schoolStatusText }}</span>
      </div>
    </div>

    <!-- 学校端导出权限 -->
    <div v-loading="loadingExportSettings" class="export-permission-card">
      <div class="card-header">
        <span>学校端导出权限</span>
        <el-button type="primary" size="small" :loading="savingExportTables" @click="handleSaveExportTables">
          <el-icon><Check /></el-icon>
          保存
        </el-button>
      </div>
      <p class="card-hint">
        勾选后，学校账号才能在对应的成绩列表页看到并使用「导出Excel」按钮；未勾选的成绩表，学校端的导出按钮会被隐藏（服务端导出接口同样会拦截，属于强制校验）。
        管理员可随时取消勾选，学校端下次打开页面即失效。
      </p>
      <el-checkbox-group v-if="exportableTables.length" v-model="schoolExportTables" class="export-table-list">
        <el-checkbox v-for="table in exportableTables" :key="table" :label="table" :value="table">
          {{ exportTableLabels[table] || table }}
        </el-checkbox>
      </el-checkbox-group>
      <p v-else class="card-hint">暂无可配置的成绩表</p>
    </div>

    <el-table
      :data="adminList"
      border
      stripe
      v-loading="loadingAdmins"
      style="width: 100%"
      :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }"
    >
      <el-table-column type="index" label="序号" :width="60" :min-width="60" align="center" />
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column prop="role" label="角色" min-width="200" align="center">
        <template #default="{ row }">
          <el-tag v-if="!row.schoolId" type="primary" size="small">管理员</el-tag>
          <el-tag v-else type="success" size="small">学校用户 - {{ row.schoolName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" :width="170" :min-width="170" align="center" />
      <el-table-column label="操作" min-width="240" align="center" fixed="right">
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
            placeholder="请输入密码（至少 8 位）"
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
        <el-form-item label="关联学校">
          <el-select v-model="addForm.schoolId" placeholder="不选则为管理员" clearable style="width: 100%">
            <el-option
              v-for="s in schoolOptions"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
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
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="只有填写新密码才会提交修改"
          description="未填写新密码时「确定」按钮不可用，避免出现「修改成功」但实际未写入的情况。"
        />
      </el-form>
      <template #footer>
        <el-button type="default" @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!editForm.newPassword" @click="handleUpdate">确定</el-button>
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
            placeholder="请输入新密码（至少 8 位）"
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
import { ref, computed, onMounted } from 'vue'
import { Plus, Delete, CircleCheck, CircleClose, Check } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useGradeStore } from '@/stores/grade'
import { schoolApi, authApi, dataApi, settingsApi, registrationApi } from '@/api'

interface Admin {
  id: number
  username: string
  password: string
  role: 'admin' | 'user' | 'school'
  schoolId: number | null
  schoolName: string | null
  createdAt: string
}

const authStore = useAuthStore()
const gradeStore = useGradeStore()

interface SchoolOption { id: number; name: string }
const schoolOptions = ref<SchoolOption[]>([])

const adminList = ref<Admin[]>([])
const loadingAdmins = ref(false)
const submitting = ref(false)

// ===== 学校账号启用状态（以服务端为准） =====
const schoolsEnabled = ref(false)
const schoolAccountTotal = ref(0)
const schoolAccountEnabled = ref(0)
const schoolStatusLoaded = ref(false)

const schoolStatusText = computed(() => {
  if (!schoolStatusLoaded.value) return '学校账号状态：加载中…'
  if (!schoolAccountTotal.value) return '学校账号状态：暂无学校账号'
  return schoolsEnabled.value
    ? `学校账号状态：全部启用（${schoolAccountEnabled.value}/${schoolAccountTotal.value}）`
    : `学校账号状态：存在停用账号（${schoolAccountEnabled.value}/${schoolAccountTotal.value}）`
})

/** 只有存在被停用的学校账号时，「一键启用」才有意义 */
const canEnableAllSchools = computed(() => schoolStatusLoaded.value && !schoolsEnabled.value)
/** 只有全部启用时，「一键禁用」才有意义 */
const canDisableAllSchools = computed(() => schoolStatusLoaded.value && schoolsEnabled.value)

// ===== 学校端导出权限 =====
// 学校账号只能导出这里勾选授权的成绩表；服务端导出接口会做同样的强校验。
const loadingExportSettings = ref(false)
const savingExportTables = ref(false)
/** 管理员授权给学校账号的可导出表 */
const schoolExportTables = ref<string[]>([])
/** 全部可导出的表（白名单） */
const exportableTables = ref<string[]>([])
/** 表 id → 中文名称 */
const exportTableLabels = ref<Record<string, string>>({})

const loadExportSettings = async () => {
  loadingExportSettings.value = true
  try {
    const res = await settingsApi.getAll()
    exportableTables.value = Array.isArray(res?.exportableTables) ? res.exportableTables : []
    schoolExportTables.value = Array.isArray(res?.schoolExportTables) ? res.schoolExportTables : []
    exportTableLabels.value = res?.labels && typeof res.labels === 'object' ? res.labels : {}
  } catch (e: any) {
    ElMessage.error(e?.message || '加载导出权限设置失败')
  } finally {
    loadingExportSettings.value = false
  }
}

const handleSaveExportTables = async () => {
  savingExportTables.value = true
  try {
    await settingsApi.setSchoolExportTables(schoolExportTables.value)
    ElMessage.success('导出权限已保存')
    await loadExportSettings()
  } catch (e: any) {
    ElMessage.error(e?.message || '保存导出权限失败')
  } finally {
    savingExportTables.value = false
  }
}

const loadSchoolsStatus = async () => {
  try {
    const res = await authApi.getSchoolsStatus()
    schoolsEnabled.value = !!res?.allEnabled
    schoolAccountTotal.value = res?.total || 0
    schoolAccountEnabled.value = res?.enabled || 0
    schoolStatusLoaded.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || '加载学校账号状态失败')
  }
}

const handleEnableAllSchools = async () => {
  try {
    await ElMessageBox.confirm('确认启用所有学校账号？', '启用确认', {
      confirmButtonText: '启用', cancelButtonText: '取消', type: 'info'
    })
  } catch {
    return // 用户取消
  }
  try {
    await authApi.toggleAllSchools(true)
    await loadSchoolsStatus()
    ElMessage.success('所有学校账号已启用')
  } catch (e: any) {
    ElMessage.error(e?.message || '启用失败')
  }
}

const handleDisableAllSchools = async () => {
  try {
    await ElMessageBox.confirm('确认禁用所有学校账号？禁用后学校将无法登录。', '禁用确认', {
      confirmButtonText: '禁用', cancelButtonText: '取消', type: 'warning'
    })
  } catch {
    return // 用户取消
  }
  try {
    await authApi.toggleAllSchools(false)
    await loadSchoolsStatus()
    ElMessage.success('所有学校账号已禁用')
  } catch (e: any) {
    ElMessage.error(e?.message || '禁用失败')
  }
}

const showAddDialog = ref(false)
const addFormRef = ref()
const addForm = ref({
  username: '',
  password: '',
  confirmPassword: '',
  schoolId: null as number | null
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
    { min: 8, max: 20, message: '长度在 8 到 20 个字符', trigger: 'blur' }
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
  newPassword: [
    { min: 8, max: 20, message: '长度在 8 到 20 个字符', trigger: 'blur' }
  ],
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
    { min: 8, max: 20, message: '长度在 8 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateResetConfirmPassword, trigger: 'blur' }
  ]
}

const loadAdmins = async () => {
  loadingAdmins.value = true
  try {
    // authApi.getAdmins 失败时会抛错，这里必须能区分「加载失败」与「空列表」
    const admins = await authStore.getAdmins()
    adminList.value = (Array.isArray(admins) ? admins : []).map((a: any) => ({
      id: a.id,
      username: a.username,
      password: '',
      role: a.role || 'admin',
      schoolId: a.schoolId || null,
      schoolName: a.schoolName || null,
      createdAt: formatDateTime(a.createdAt || a.created_at)
    }))
  } catch (e: any) {
    adminList.value = []
    ElMessage.error(e?.message || '加载管理员列表失败')
  } finally {
    loadingAdmins.value = false
  }
}

const loadSchools = async () => {
  try {
    const list = await schoolApi.getList()
    schoolOptions.value = Array.isArray(list) ? list : []
  } catch (e: any) {
    ElMessage.error(e?.message || '加载学校列表失败')
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

  const valid = await addFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await authStore.addAdmin(addForm.value.username, addForm.value.password, addForm.value.schoolId)
    ElMessage.success('新增成功')
    showAddDialog.value = false
    addForm.value = { username: '', password: '', confirmPassword: '', schoolId: null }
    await loadAdmins()
  } catch (error: any) {
    ElMessage.error(error.message || '新增失败')
  } finally {
    submitting.value = false
  }
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

  // 没有填写新密码时不做任何写入，也不提示「修改成功」
  if (!editForm.value.newPassword) {
    ElMessage.warning('请输入新密码后再提交')
    return
  }

  const valid = await editFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await authStore.updateAdmin(editForm.value.id, { password: editForm.value.newPassword })
    ElMessage.success('密码修改成功')
    showEditDialog.value = false
    editForm.value = { id: 0, username: '', newPassword: '', confirmPassword: '' }
  } catch (error: any) {
    ElMessage.error(error.message || '修改失败')
  } finally {
    submitting.value = false
  }
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

  const valid = await resetFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await authStore.updateAdmin(resetForm.value.id, { password: resetForm.value.newPassword })
    ElMessage.success('密码重置成功')
    showResetDialog.value = false
    resetForm.value = { id: 0, username: '', newPassword: '', confirmPassword: '' }
  } catch (error: any) {
    ElMessage.error(error.message || '重置失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (row: Admin) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除管理员 "${row.username}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
  } catch {
    return // 用户取消
  }
  try {
    await authStore.deleteAdmin(row.id)
    ElMessage.success('删除成功')
    await loadAdmins()
  } catch (error: any) {
    ElMessage.error(error.message || '删除失败')
  }
}

/** 统计当前数据量，用于清空前提示影响范围（成绩表 + 九年级报名名单） */
const countGradeRows = async () => {
  const [seven, eight, nine, admission, regs] = await Promise.all([
    dataApi.page('grade_seven', { page: 1, pageSize: 1 }),
    dataApi.page('grade_eight', { page: 1, pageSize: 1 }),
    dataApi.page('grade_nine', { page: 1, pageSize: 1 }),
    dataApi.page('admission', { page: 1, pageSize: 1 }),
    registrationApi.getList({ page: 1, pageSize: 1 }),
  ])
  return {
    grades: (seven?.total || 0) + (eight?.total || 0) + (nine?.total || 0) + (admission?.total || 0),
    registrations: regs?.total || 0,
  }
}

/** 清空全部成绩数据时必须逐字输入的确认短语 */
const CLEAR_CONFIRM_PHRASE = '确认清除全部成绩数据'

const handleClearAllData = async () => {
  let total = { grades: 0, registrations: 0 }
  try {
    total = await countGradeRows()
  } catch (e: any) {
    ElMessage.error(e?.message || '统计成绩数据失败，已取消清空操作')
    return
  }

  try {
    await ElMessageBox.confirm(
      `此操作将清除所有成绩数据（七年级、八年级、九年级、中招体育成绩，当前共 ${total.grades} 条）`
      + `以及九年级报名名单（${total.registrations} 人），不可恢复！`,
      '⚠️ 危险操作确认',
      {
        confirmButtonText: '确认清除',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    )
  } catch {
    return // 用户取消
  }

  // 第二道关：必须逐字输入确认短语，否则不会执行清除
  try {
    await ElMessageBox.prompt(
      `请在下方输入「${CLEAR_CONFIRM_PHRASE}」以执行清除操作（必须一字不差）`,
      '最终确认',
      {
        confirmButtonText: '执行清除',
        cancelButtonText: '取消',
        type: 'warning',
        inputPlaceholder: CLEAR_CONFIRM_PHRASE,
        inputValidator: (value: string) => {
          if (value === CLEAR_CONFIRM_PHRASE) return true
          return `输入不匹配，请输入「${CLEAR_CONFIRM_PHRASE}」`
        },
        inputErrorMessage: `请输入「${CLEAR_CONFIRM_PHRASE}」`,
      }
    )
  } catch {
    return // 用户取消或短语校验未通过
  }

  try {
    await dataApi.clear()
    gradeStore.clearCache()
    ElMessage.success('所有数据已清除')
  } catch (error: any) {
    ElMessage.error(error?.message || '清除失败')
  }
}

onMounted(() => {
  loadAdmins()
  loadSchools()
  loadSchoolsStatus()
  loadExportSettings()
})
</script>

<style scoped lang="scss">
.system-manage-page {
  @include page-container;

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

  .page-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 12px;

    .header-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
  }

  .school-status {
    font-size: 12px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
    padding-left: 4px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
    font-weight: 600;
    font-size: 18px;
  }

  .export-permission-card {
    @include card-surface;
    padding: 16px 20px;
    margin-bottom: $page-gap;

    .card-header {
      font-size: 16px;
      margin-bottom: 8px;
    }

    .card-hint {
      margin: 0 0 12px;
      font-size: 12px;
      line-height: 1.7;
      color: var(--text-muted);
    }

    .export-table-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 24px;

      :deep(.el-checkbox) {
        margin-right: 0;
      }
    }
  }
}
</style>

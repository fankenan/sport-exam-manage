<template>
  <div class="school-manage-page">
    <div class="page-header">
      <h2>学校管理</h2>
      <p class="desc">维护学校列表，用于关联学校账号</p>
    </div>

    <div class="toolbar">
      <el-input
        v-model="newSchoolName"
        placeholder="输入学校名称"
        style="width: 300px"
        @keyup.enter="handleAdd"
      />
      <el-button type="primary" @click="handleAdd" :loading="adding">
        添加学校
      </el-button>
    </div>

    <el-table
      :data="schools"
      border
      stripe
      v-loading="loading"
      style="width: 100%; margin-top: 16px"
      :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700 }"
    >
      <el-table-column type="index" label="序号" width="80" align="center" />
      <el-table-column prop="name" label="学校名称" min-width="300" show-overflow-tooltip>
        <template #default="{ row }">
          <template v-if="row.editing">
            <el-input v-model="row.editName" size="small" @keyup.enter="handleUpdate(row)" />
          </template>
          <template v-else>
            {{ row.name }}
          </template>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="200" align="center">
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" align="center">
        <template #default="{ row }">
          <template v-if="row.editing">
            <el-button type="success" size="small" @click="handleUpdate(row)">保存</el-button>
            <el-button size="small" @click="row.editing = false">取消</el-button>
          </template>
          <template v-else>
            <el-button type="primary" link size="small" @click="startEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { schoolApi } from '@/api'

interface SchoolItem {
  id: number
  name: string
  created_at: string
  editing?: boolean
  editName?: string
}

const schools = ref<SchoolItem[]>([])
const newSchoolName = ref('')
const loading = ref(false)
const adding = ref(false)

const loadSchools = async () => {
  loading.value = true
  try {
    schools.value = await schoolApi.getList()
  } catch {
    ElMessage.error('获取学校列表失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = async () => {
  const name = newSchoolName.value.trim()
  if (!name) {
    ElMessage.warning('请输入学校名称')
    return
  }
  adding.value = true
  try {
    await schoolApi.add(name)
    ElMessage.success('添加成功')
    newSchoolName.value = ''
    await loadSchools()
  } catch (e: any) {
    ElMessage.error(e.message || '添加失败')
  } finally {
    adding.value = false
  }
}

const startEdit = (row: SchoolItem) => {
  row.editing = true
  row.editName = row.name
}

const handleUpdate = async (row: SchoolItem) => {
  const newName = (row.editName || '').trim()
  if (!newName) {
    ElMessage.warning('学校名称不能为空')
    return
  }
  try {
    await schoolApi.update(row.id, newName)
    ElMessage.success('更新成功')
    await loadSchools()
  } catch (e: any) {
    ElMessage.error(e.message || '更新失败')
  }
}

const handleDelete = async (row: SchoolItem) => {
  try {
    await ElMessageBox.confirm(`确定要删除学校"${row.name}"吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    await schoolApi.delete(row.id)
    ElMessage.success('删除成功')
    await loadSchools()
  } catch (e: any) {
    if (e !== 'cancel' && e.message) {
      ElMessage.error(e.message || '删除失败')
    }
  }
}

const formatTime = (t: string) => {
  if (!t) return ''
  return t.replace('T', ' ').substring(0, 19)
}

onMounted(() => loadSchools())
</script>

<style scoped lang="scss">
.school-manage-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 16px;
  h2 { margin: 0 0 4px; font-size: 20px; }
  .desc { margin: 0; color: var(--text-muted); font-size: 14px; }
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>

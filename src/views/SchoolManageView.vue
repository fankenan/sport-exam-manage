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
      :data="pagedSchools"
      border
      stripe
      v-loading="loading"
      style="width: 100%; margin-top: 16px"
      :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700 }"
    >
      <el-table-column type="index" label="序号" :width="80" :min-width="80" align="center" />
      <el-table-column prop="name" label="学校名称" min-width="300" show-overflow-tooltip>
        <template #default="{ row }">
          <template v-if="editingId === row.id">
            <el-input v-model="editName" size="small" @keyup.enter="handleUpdate(row)" />
          </template>
          <template v-else>
            {{ row.name }}
          </template>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" :width="200" :min-width="200" align="center">
        <template #default="{ row }">
          {{ formatTime(row.createdAt) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" :width="200" :min-width="200" align="center">
        <template #default="{ row }">
          <template v-if="editingId === row.id">
            <el-button type="success" size="small" @click="handleUpdate(row)">保存</el-button>
            <el-button size="small" @click="cancelEdit">取消</el-button>
          </template>
          <template v-else>
            <el-button type="primary" link size="small" @click="startEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-section">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="schools.length"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { schoolApi } from '@/api'

interface SchoolItem {
  id: number
  name: string
  createdAt: string
}

const schools = ref<SchoolItem[]>([])
const newSchoolName = ref('')
const loading = ref(false)
const adding = ref(false)

// 编辑状态用独立的 id 记录，不直接修改接口返回的数据
const editingId = ref<number | null>(null)
const editName = ref('')

// 分页（前端分页）
const currentPage = ref(1)
const pageSize = ref(20)

const pagedSchools = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return schools.value.slice(start, start + pageSize.value)
})

const onPageChange = (page: number) => {
  currentPage.value = page
}

const onSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
}

const loadSchools = async () => {
  loading.value = true
  try {
    const list = await schoolApi.getList()
    schools.value = Array.isArray(list) ? list : []
    // 删除后当前页可能越界，这里做一次纠正
    const maxPage = Math.max(1, Math.ceil(schools.value.length / pageSize.value))
    if (currentPage.value > maxPage) currentPage.value = maxPage
  } catch (e: any) {
    schools.value = []
    ElMessage.error(e?.message || '获取学校列表失败')
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
    ElMessage.error(e?.message || '添加失败')
  } finally {
    adding.value = false
  }
}

const startEdit = (row: SchoolItem) => {
  editingId.value = row.id
  editName.value = row.name
}

const cancelEdit = () => {
  editingId.value = null
  editName.value = ''
}

const handleUpdate = async (row: SchoolItem) => {
  const newName = editName.value.trim()
  if (!newName) {
    ElMessage.warning('学校名称不能为空')
    return
  }
  try {
    await schoolApi.update(row.id, newName)
    ElMessage.success('更新成功')
    cancelEdit()
    await loadSchools()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

const handleDelete = async (row: SchoolItem) => {
  try {
    await ElMessageBox.confirm(`确定要删除学校"${row.name}"吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    // 'cancel'（取消按钮）与 'close'（右上角 X）都视为取消，不报错
    return
  }
  try {
    await schoolApi.delete(row.id)
    ElMessage.success('删除成功')
    await loadSchools()
  } catch (e: any) {
    ElMessage.error(e?.message || '删除失败')
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
  @include page-container;
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

.pagination-section {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>

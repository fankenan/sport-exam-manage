<template>
  <el-table :data="logs" size="small" style="width:100%">
    <el-table-column prop="operator" label="操作人" width="80" />
    <el-table-column label="类型" width="70">
      <template #default="{ row }">
        <el-tag :type="row.operation_type === 'create' ? 'success' : row.operation_type === 'delete' ? 'danger' : 'warning'" size="small">
          {{ row.operation_type === 'create' ? '导入' : row.operation_type === 'delete' ? '删除' : '修改' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="created_at" label="时间" width="150">
      <template #default="{ row }">{{ (row.created_at || '').substring(0, 19).replace('T', ' ') }}</template>
    </el-table-column>
    <el-table-column label="详情" min-width="200" show-overflow-tooltip>
      <template #default="{ row }">
        {{ formatSummary(row.details) }}
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { logApi } from '@/api'

const logs = ref<any[]>([])

const formatSummary = (d: any) => {
  if (!d) return '-'
  try { if (typeof d === 'string') d = JSON.parse(d) } catch { return String(d) }
  return d.summary || d.targetId || JSON.stringify(d).substring(0, 80)
}

onMounted(async () => {
  try {
    const res = await logApi.getList({ page: 1, pageSize: 8 })
    logs.value = res.list || []
  } catch { /* ignore */ }
})
</script>

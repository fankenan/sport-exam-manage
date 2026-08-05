<template>
  <div class="school-stats">
    <el-table :data="stats" border stripe size="small" max-height="360" style="width: 100%">
      <el-table-column type="index" label="#" width="50" align="center" />
      <el-table-column prop="school" label="学校名称" min-width="180" show-overflow-tooltip />
      <el-table-column prop="total" label="上报人数" width="100" align="center" sortable />
      <el-table-column prop="anomalyCount" label="校对异常" width="100" align="center" sortable>
        <template #default="{ row }">
          <span :style="{ color: row.anomalyCount > 0 ? '#f56c6c' : '#67c23a', fontWeight: 'bold' }">
            {{ row.anomalyCount }}
          </span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
defineProps<{ stats: Array<{ school: string; total: number; anomalyCount: number }> }>()
</script>

<style scoped lang="scss">
.school-stats {
  padding: 0;
}
</style>

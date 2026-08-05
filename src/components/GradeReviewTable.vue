<template>
  <div>
    <el-table
      :data="tableData"
      border
      stripe
      v-loading="loading"
      style="width: 100%"
      :header-cell-style="{ background: 'var(--bg-surface)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }"
    >
      <el-table-column type="index" label="序号" width="60" align="center" fixed />
      <el-table-column prop="school" label="学校" min-width="180" show-overflow-tooltip fixed />
      <el-table-column prop="name" label="姓名" width="100" align="center" fixed />
      <el-table-column prop="identityId" label="身份ID" min-width="180" show-overflow-tooltip />
      <el-table-column prop="graduationYear" label="毕业年份" width="100" align="center" />
      <template v-if="grade !== 'nine'">
        <el-table-column prop="attendanceScore" label="出勤率成绩" width="100" align="center" />
        <el-table-column prop="examScore" label="体育考试成绩" width="110" align="center" />
        <el-table-column prop="fitnessScore" label="体测成绩" width="90" align="center" />
        <el-table-column prop="total" label="合计" width="80" align="center" />
      </template>
      <template v-else>
        <el-table-column prop="longRun" label="长跑" width="80" align="center" />
        <el-table-column prop="ropeSkipping" label="跳绳" width="80" align="center" />
        <el-table-column prop="longJump" label="跳远" width="80" align="center" />
        <el-table-column prop="ballSports" label="足(篮)球" width="90" align="center" />
        <el-table-column prop="martialArts" label="武术" width="80" align="center" />
      </template>
      <el-table-column prop="remark" label="备注" width="80" show-overflow-tooltip />
      <el-table-column prop="reviewStatus" label="审核状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.reviewStatus === 'approved'" type="success" size="small">已通过</el-tag>
          <el-tag v-else-if="row.reviewStatus === 'rejected'" type="danger" size="small">已驳回</el-tag>
          <el-tag v-else type="info" size="small">待审核</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reviewRemark" label="审核备注" min-width="120" show-overflow-tooltip />
      <el-table-column label="操作" width="180" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="success" link size="small" @click="$emit('approve', row)">
            通过
          </el-button>
          <el-button type="danger" link size="small" @click="$emit('reject', row)">
            驳回
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-section">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[50, 100, 200]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="$emit('pageChange', $event)"
        @size-change="$emit('sizeChange', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  grade: 'seven' | 'eight' | 'nine'
  tableData: any[]
  loading: boolean
  currentPage: number
  pageSize: number
  total: number
}>()

defineEmits<{
  approve: [row: any]
  reject: [row: any]
  pageChange: [page: number]
  sizeChange: [size: number]
}>()
</script>

<style scoped lang="scss">
.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>

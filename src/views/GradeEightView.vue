<template>
  <GradeListView
    title="八年级成绩列表"
    grade="eight"
    :columns="columns"
    export-file-name="八年级成绩"
    export-sheet-name="八年级成绩"
  />
</template>

<script setup lang="ts">
import GradeListView, { type ColumnConfig } from '@/components/GradeListView.vue'

const columns: ColumnConfig[] = [
  { prop: 'school', label: '学校', showOverflowTooltip: true, fixed: true },
  { prop: 'name', label: '姓名', width: '100', align: 'center', fixed: true },
  { prop: 'identityId', label: '身份ID', showOverflowTooltip: true },
  { prop: 'graduationYear', label: '毕业年份', width: '100', align: 'center' },
  { prop: 'grade', label: '年级', width: '80', align: 'center' },
  { prop: 'attendanceScore', label: '出勤率成绩', width: '100', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'examScore', label: '体育考试成绩', width: '110', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'fitnessScore', label: '体测成绩', width: '90', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'total', label: '合计', width: '80', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'totalVerify', label: '合计校对', width: '100', align: 'center' },
  { prop: 'verifyResult', label: '校对结果', width: '90', align: 'center' },
  { prop: 'remark', label: '备注', width: '80', showOverflowTooltip: true },
]
</script>

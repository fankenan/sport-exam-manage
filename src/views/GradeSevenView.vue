<template>
  <GradeListView
    title="七年级成绩列表"
    grade="seven"
    :columns="columns"
    export-file-name="七年级成绩"
    export-sheet-name="七年级成绩"
    :export-map-fn="exportMapFn"
  />
</template>

<script setup lang="ts">
import GradeListView, { type ColumnConfig } from '@/components/GradeListView.vue'

const columns: ColumnConfig[] = [
  { prop: 'school', label: '学校', minWidth: '180', showOverflowTooltip: true, fixed: true },
  { prop: 'name', label: '姓名', width: '100', align: 'center', fixed: true },
  { prop: 'identityId', label: '身份ID', minWidth: '180', showOverflowTooltip: true },
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

const exportMapFn = (item: any) => ({
  '学校': item.school,
  '姓名': item.name,
  '身份ID': item.identityId,
  '毕业年份': item.graduationYear,
  '年级': item.grade,
  '出勤率成绩': item.attendanceScore,
  '体育考试成绩': item.examScore,
  '体测成绩': item.fitnessScore,
  '合计': item.total,
  '合计校对': item.totalVerify,
  '校对结果': item.verifyResult ? '✅' : '❌',
  '备注': item.remark
})
</script>

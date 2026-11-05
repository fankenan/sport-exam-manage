<template>
  <GradeListView
    title="九年级成绩列表"
    grade="nine"
    :columns="columns"
    export-file-name="九年级成绩"
    export-sheet-name="九年级成绩"
    importable
  />
</template>

<script setup lang="ts">
import GradeListView, { type ColumnConfig } from '@/components/GradeListView.vue'

const columns: ColumnConfig[] = [
  { prop: 'school', label: '学校', showOverflowTooltip: true, fixed: true },
  { prop: 'name', label: '姓名', width: '100', align: 'center', fixed: true },
  { prop: 'identityId', label: '身份ID', showOverflowTooltip: true },
  { prop: 'studentNumber', label: '报名序号', width: '110', align: 'center' },
  { prop: 'graduationYear', label: '毕业年份', width: '100', align: 'center' },
  { prop: 'grade', label: '年级', width: '80', align: 'center' },
  { prop: 'longRun', label: '长跑', width: '80', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'ropeSkipping', label: '跳绳', width: '80', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'longJump', label: '跳远', width: '80', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'ballSports', label: '足(篮)球', width: '90', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'martialArts', label: '武术', width: '80', align: 'center', editable: true, editMin: 0, editMax: 100, editPrecision: 1 },
  { prop: 'remark', label: '备注', width: '80', showOverflowTooltip: true },
]
</script>

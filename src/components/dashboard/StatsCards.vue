<template>
  <el-row :gutter="16" class="stats-cards">
    <el-col :xs="12" :sm="6" v-for="card in cards" :key="card.label">
      <div class="stat-card" :style="{ borderLeftColor: card.color }">
        <div class="stat-label">{{ card.label }}</div>
        <div class="stat-value">{{ card.value }}</div>
        <div class="stat-sub" v-if="card.sub">{{ card.sub }}</div>
      </div>
    </el-col>
  </el-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  gradeSevenCount: number
  gradeEightCount: number
  gradeNineCount: number
  admissionCount: number
  schoolCount: number
}
const props = defineProps<Props>()

const cards = computed(() => [
  { label: '七年级人数', value: props.gradeSevenCount, color: '#3b82f6', sub: '' },
  { label: '八年级人数', value: props.gradeEightCount, color: '#22c55e', sub: '' },
  { label: '九年级人数', value: props.gradeNineCount, color: '#f59e0b', sub: '' },
  { label: '涉及学校', value: props.schoolCount, color: '#8b5cf6', sub: `中招考生 ${props.admissionCount} 人` },
])
</script>

<style scoped lang="scss">
.stats-cards { margin-bottom: 4px; }
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left: 3px solid;
  border-radius: var(--radius-md);
  padding: 16px 20px;
  margin-bottom: 12px;
  transition: box-shadow 0.15s;
  &:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
}
.stat-label { font-size: 12px; color: var(--text-muted); font-weight: 500; }
.stat-value { font-size: 28px; font-weight: 700; color: var(--text-primary); margin: 4px 0; line-height: 1.1; }
.stat-sub { font-size: 11px; color: var(--text-muted); }
</style>

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
import { CHART_COLORS } from './chartTheme'

interface Props {
  gradeSevenCount: number
  gradeEightCount: number
  gradeNineCount: number
  admissionCount: number
  schoolCount: number
}
const props = defineProps<Props>()

const nf = (n: number) => (n ?? 0).toLocaleString('zh-CN')

const cards = computed(() => [
  { label: '七年级人数', value: nf(props.gradeSevenCount), color: CHART_COLORS.primary, sub: '' },
  { label: '八年级人数', value: nf(props.gradeEightCount), color: CHART_COLORS.success, sub: '' },
  { label: '九年级人数', value: nf(props.gradeNineCount), color: CHART_COLORS.warning, sub: '' },
  {
    label: '涉及学校',
    value: nf(props.schoolCount),
    color: CHART_COLORS.violet,
    sub: `中招考生 ${nf(props.admissionCount)} 人`,
  },
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
  transition: box-shadow 0.15s, transform 0.15s;

  &:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 4px 0;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.stat-sub { font-size: 11px; color: var(--text-muted); }
</style>

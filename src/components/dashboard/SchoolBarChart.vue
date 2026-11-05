<template>
  <v-chart :option="option" style="height:380px" autoresize />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { CHART_COLORS } from './chartTheme'

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

interface Props { schools: string[]; averages: number[] }
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: {
    trigger: 'axis' as const,
    axisPointer: { type: 'shadow' as const },
    formatter: (p: any) => `${p[0].name}<br/>平均分 ${Number(p[0].value).toFixed(1)}`,
  },
  grid: { left: 120, right: 44, top: 12, bottom: 24 },
  xAxis: {
    type: 'value' as const,
    max: 100,
    axisLabel: { formatter: '{value}分', fontSize: 11 },
    splitLine: { lineStyle: { color: 'var(--border-light)' } },
  },
  yAxis: {
    type: 'category' as const,
    data: props.schools,
    axisLabel: { width: 104, overflow: 'truncate' as const, fontSize: 12 },
    inverse: true,
  },
  series: [{
    type: 'bar' as const,
    data: props.averages,
    barMaxWidth: 22,
    itemStyle: {
      borderRadius: [0, 5, 5, 0],
      color: {
        type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 0,
        colorStops: [
          { offset: 0, color: CHART_COLORS.primary },
          { offset: 1, color: CHART_COLORS.cyan },
        ],
      },
    },
    label: { show: true, position: 'right' as const, formatter: '{c}', fontSize: 11 },
  }],
}))
</script>

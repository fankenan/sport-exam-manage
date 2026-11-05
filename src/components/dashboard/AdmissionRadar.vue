<template>
  <v-chart :option="option" style="height:300px" autoresize />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { CHART_COLORS, paletteAt } from './chartTheme'

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

interface Props {
  longRun: number; ropeSkipping: number; longJump: number
  ballSports: number; martialArts: number
}
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { left: 40, right: 24, top: 16, bottom: 24, containLabel: true },
  xAxis: {
    type: 'category' as const,
    data: ['长跑', '跳绳', '跳远', '足(篮)球', '武术'],
    axisLabel: { fontSize: 11 },
    axisLine: { lineStyle: { color: 'var(--border)' } },
  },
  yAxis: {
    type: 'value' as const,
    max: 20,
    axisLabel: { fontSize: 10 },
    splitLine: { lineStyle: { color: 'var(--border-light)' } },
  },
  series: [{
    type: 'bar' as const,
    data: [
      props.longRun, props.ropeSkipping, props.longJump, props.ballSports, props.martialArts,
    ].map((value, i) => ({ value, itemStyle: { color: paletteAt(i) } })),
    barWidth: '46%',
    itemStyle: { borderRadius: [5, 5, 0, 0] },
  }],
}))
</script>

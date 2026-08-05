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

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

interface Props {
  longRun: number; ropeSkipping: number; longJump: number
  ballSports: number; martialArts: number
}
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { left: '8%', right: '8%', top: 16, bottom: 16, containLabel: true },
  xAxis: {
    type: 'category' as const,
    data: ['长跑', '跳绳', '跳远', '足(篮)球', '武术'],
    axisLabel: { fontSize: 11 },
  },
  yAxis: {
    type: 'value' as const,
    max: 20,
    axisLabel: { fontSize: 10 },
  },
  series: [{
    type: 'bar',
    data: [
      { value: props.longRun, itemStyle: { color: '#00c6ff' } },
      { value: props.ropeSkipping, itemStyle: { color: '#8b5cf6' } },
      { value: props.longJump, itemStyle: { color: '#6366f1' } },
      { value: props.ballSports, itemStyle: { color: '#06b6d4' } },
      { value: props.martialArts, itemStyle: { color: '#a855f7' } },
    ],
    barWidth: '50%',
    itemStyle: { borderRadius: [4, 4, 0, 0] },
  }]
}))
</script>

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

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

interface Props { schools: string[]; averages: number[] }
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>平均分: ${p[0].value.toFixed(1)}` },
  grid: { left: 120, right: 30, top: 10, bottom: 20 },
  xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}分' } },
  yAxis: { type: 'category', data: props.schools, axisLabel: { width: 100, overflow: 'truncate' }, inverse: true },
  series: [{
    type: 'bar',
    data: props.averages,
    itemStyle: { borderRadius: [0, 4, 4, 0], color: '#3b82f6' },
    barMaxWidth: 24,
    label: { show: true, position: 'right', formatter: '{c}' }
  }]
}))
</script>

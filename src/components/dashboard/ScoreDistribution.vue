<template>
  <v-chart :option="option" style="height:280px" autoresize />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer])

interface Props { scores: number[] }
const props = defineProps<Props>()

const option = computed(() => {
  const bins = ['0-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100']
  const counts = new Array(10).fill(0)
  props.scores.forEach(s => {
    if (s >= 100) counts[9]++
    else if (s < 0) return
    else counts[Math.floor(s / 10)]++
  })
  return {
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}分: ${p[0].value} 人` },
    grid: { left: 40, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: bins, axisLabel: { rotate: 45, fontSize: 11 } },
    yAxis: { type: 'value', name: '人数' },
    series: [{
      type: 'bar',
      data: counts,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#93c5fd' }] }
      },
      barMaxWidth: 32,
    }]
  }
})
</script>

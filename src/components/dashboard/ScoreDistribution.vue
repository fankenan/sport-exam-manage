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

interface Props {
  /** 服务端算好的分箱直方图：[{ label: '0-10', count: 12 }, ...] */
  bins: Array<{ label: string; count: number }>
}
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: { trigger: 'axis' as const, formatter: (p: any) => `${p[0].name}分：${p[0].value} 人` },
  grid: { left: 48, right: 20, top: 16, bottom: 36 },
  xAxis: {
    type: 'category' as const,
    data: props.bins.map(b => b.label),
    axisLabel: { rotate: 40, fontSize: 11 },
    axisLine: { lineStyle: { color: 'var(--border)' } },
  },
  yAxis: {
    type: 'value' as const,
    name: '人数',
    nameTextStyle: { color: 'var(--text-muted)', fontSize: 11 },
    axisLabel: { fontSize: 11 },
    splitLine: { lineStyle: { color: 'var(--border-light)' } },
  },
  series: [{
    type: 'bar' as const,
    data: props.bins.map(b => b.count),
    barMaxWidth: 32,
    itemStyle: {
      borderRadius: [4, 4, 0, 0],
      color: {
        type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: 'var(--accent)' },
          { offset: 1, color: 'var(--accent-light)' },
        ],
      },
    },
  }],
}))
</script>

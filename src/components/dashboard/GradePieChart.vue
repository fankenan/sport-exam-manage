<template>
  <v-chart :option="option" style="height:280px" autoresize />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([PieChart, TitleComponent, TooltipComponent, LegendComponent, CanvasRenderer])

interface Props { seven: number; eight: number; nine: number }
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie',
    radius: ['45%', '72%'],
    center: ['50%', '45%'],
    avoidLabelOverlap: false,
    itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
    label: { show: true, formatter: '{b}\n{d}%' },
    data: [
      { value: props.seven, name: '七年级', itemStyle: { color: '#3b82f6' } },
      { value: props.eight, name: '八年级', itemStyle: { color: '#22c55e' } },
      { value: props.nine, name: '九年级', itemStyle: { color: '#f59e0b' } },
    ]
  }]
}))
</script>

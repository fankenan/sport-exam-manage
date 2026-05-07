<template>
  <v-chart :option="option" style="height:260px" autoresize />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([PieChart, TooltipComponent, CanvasRenderer])

interface Props { passed: number; failed: number }
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} 人 ({d}%)' },
  series: [{
    type: 'pie',
    radius: ['55%', '75%'],
    center: ['50%', '50%'],
    label: { show: true, formatter: '{b}\n{d}%' },
    data: [
      { value: props.passed, name: '校对通过', itemStyle: { color: '#22c55e' } },
      { value: props.failed, name: '校对未通过', itemStyle: { color: '#ef4444' } },
    ]
  }]
}))
</script>

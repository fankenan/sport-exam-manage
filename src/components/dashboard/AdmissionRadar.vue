<template>
  <v-chart :option="option" style="height:300px" autoresize />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { RadarChart } from 'echarts/charts'
import { RadarComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([RadarChart, RadarComponent, TooltipComponent, CanvasRenderer])

interface Props {
  longRun: number; ropeSkipping: number; longJump: number
  ballSports: number; martialArts: number
}
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: {},
  radar: {
    center: ['50%', '50%'],
    radius: '65%',
    indicator: [
      { name: '长跑', max: 100 },
      { name: '跳绳', max: 100 },
      { name: '跳远', max: 100 },
      { name: '足(篮)球', max: 100 },
      { name: '武术', max: 100 },
    ]
  },
  series: [{
    type: 'radar',
    data: [{
      value: [props.longRun, props.ropeSkipping, props.longJump, props.ballSports, props.martialArts],
      name: '平均分',
      areaStyle: { color: 'rgba(59,130,246,0.15)' },
      lineStyle: { color: '#3b82f6', width: 2 },
      itemStyle: { color: '#3b82f6' },
    }]
  }]
}))
</script>

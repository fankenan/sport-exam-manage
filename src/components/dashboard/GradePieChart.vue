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
import { CHART_COLORS } from './chartTheme'

use([PieChart, TitleComponent, TooltipComponent, LegendComponent, CanvasRenderer])

interface Props { seven: number; eight: number; nine: number }
const props = defineProps<Props>()

const option = computed(() => ({
  tooltip: { trigger: 'item' as const, formatter: '{b}: {c} 人 ({d}%)' },
  legend: { bottom: 0, textStyle: { fontSize: 12 } },
  series: [{
    type: 'pie' as const,
    radius: ['45%', '72%'],
    center: ['50%', '44%'],
    avoidLabelOverlap: false,
    itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
    label: { show: true, formatter: '{b}\n{d}%' },
    data: [
      { value: props.seven, name: '七年级', itemStyle: { color: CHART_COLORS.primary } },
      { value: props.eight, name: '八年级', itemStyle: { color: CHART_COLORS.success } },
      { value: props.nine, name: '九年级', itemStyle: { color: CHART_COLORS.warning } },
    ],
  }],
}))
</script>

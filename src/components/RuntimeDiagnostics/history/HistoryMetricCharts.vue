<template>
  <div class="history-chart-shell"><div class="history-chart-grid" :class="{ 'history-chart-grid--compact': compact }">
    <HistoryMetricChart v-for="chart in charts" :key="chart.key" :chart="chart" :range="extent" :compact="compact" :tooltip-formatter="tooltipFormatter" @ready="instance => register(chart.key, instance)" @dispose="instance => unregister(chart.key, instance)">
      <template v-if="$slots.readings" #readings="scope"><slot name="readings" v-bind="scope" /></template>
    </HistoryMetricChart>
  </div></div>
</template>
<script setup lang="ts">
import { toRef, type PropType } from 'vue'
import type { MetricChart, TimeWindow } from '../types'
import HistoryMetricChart from './HistoryMetricChart.vue'
import { useLinkedHistoryCharts } from './useLinkedHistoryCharts'
const props = defineProps({ charts: { type: Array as PropType<MetricChart[]>, default: () => [] }, range: { type: Object as PropType<TimeWindow>, default: undefined }, compact: { type: Boolean, default: false }, tooltipFormatter: { type: Function as PropType<(parameters: unknown) => string>, default: undefined } })
const emit = defineEmits<{ (event: 'range-change', range: TimeWindow): void }>()
const { register, unregister, extent } = useLinkedHistoryCharts(toRef(props, 'charts'), toRef(props, 'range'), range => emit('range-change', range))
</script>
<style scoped>
.history-chart-shell { container:history-charts / inline-size; min-width:0; }
.history-chart-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }.history-chart-grid--compact { gap:12px; }
@media(max-width:640px) { .history-chart-grid:not(.history-chart-grid--compact) { grid-template-columns:minmax(0,1fr); gap:8px; } }
/* 两列各至少 266px，按组件实际宽度响应拖动缩放，而非只看视口。 */
@container history-charts (width < 544px) { .history-chart-grid--compact { grid-template-columns:minmax(0,1fr); } }
</style>

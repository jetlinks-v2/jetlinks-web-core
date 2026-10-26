<template>
  <div class="history-chart-grid">
    <section v-for="chart in charts" :key="chart.key" :data-metric-chart="chart.key">
      <div class="history-chart-heading"><strong>{{ chart.label }}</strong><a-tooltip v-if="chart.description" :title="chart.description"><InfoCircleOutlined :aria-label="chart.description" /></a-tooltip></div>
      <div class="history-chart" tabindex="0" @mouseenter="activeToolboxChart = chart.key" @mouseleave="activeToolboxChart = undefined" @focusin="activeToolboxChart = chart.key" @focusout="activeToolboxChart = undefined"><Echarts v-if="hasData(chart)" :option="chartOptions(chart)" :library="library" renderer="svg" @ready="instance => register(chart.key, instance)" @dispose="instance => unregister(chart.key, instance)" /><a-empty v-else :description="t('runtimeDiagnostics.empty')" :image="Empty.PRESENTED_IMAGE_SIMPLE" /></div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ref, toRef, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { Empty, theme } from 'ant-design-vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { LineChart } from 'echarts/charts'
import { AxisPointerComponent, DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import Echarts from '../../Echarts/Echarts.vue'
import type { MetricChart, TimeWindow } from '../types'
import { useLinkedHistoryCharts } from './useLinkedHistoryCharts'
const props = defineProps({ charts: { type: Array as PropType<MetricChart[]>, default: () => [] }, range: { type: Object as PropType<TimeWindow>, default: undefined } })
const emit = defineEmits<{ (event: 'range-change', range: TimeWindow): void }>()
const { t } = useI18n(), { token } = theme.useToken()
const library = [LineChart, GridComponent, TooltipComponent, LegendComponent, AxisPointerComponent, DataZoomComponent, ToolboxComponent]
const { register, unregister, extent } = useLinkedHistoryCharts(toRef(props, 'charts'), toRef(props, 'range'), range => emit('range-change', range))
const activeToolboxChart = ref<string>()
const hasData = (chart: MetricChart) => chart.series.some(series => series.samples.some(point => point.value !== undefined))
function chartOptions(chart: MetricChart) {
  const formatValue = (value: number) => Number.isFinite(value) ? chart.formatValue?.(value) ?? `${value}${chart.unit ?? ''}` : '—'
  const palette = [token.value.colorPrimary, token.value.colorSuccess, token.value.colorWarning, token.value.colorInfo]
  return {
    animation: false, textStyle: { fontFamily: token.value.fontFamily, fontSize: 12 }, color: palette, tooltip: { trigger: 'axis', valueFormatter: formatValue }, axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: { left: 8, right: 12, top: 30, bottom: 42, containLabel: true },
    legend: { bottom: 0, type: 'scroll', itemWidth: 10, itemHeight: 10, icon: 'circle', textStyle: { color: token.value.colorTextSecondary, fontSize: 12 } },
    // 缩放是低频动作，默认不占用读趋势的标题行；鼠标或键盘进入图表后仍保留原生工具能力。
    toolbox: { show: activeToolboxChart.value === chart.key, right: 0, top: -4, feature: { dataZoom: { yAxisIndex: 'none', title: { zoom: t('runtimeDiagnostics.zoomRange'), back: t('runtimeDiagnostics.restoreRange') } } } },
    dataZoom: [{ id: 'window', type: 'inside', filterMode: 'none', zoomOnMouseWheel: 'ctrl' }],
    xAxis: { type: 'time', min: extent.value?.from, max: extent.value?.to, splitNumber: 4, axisPointer: { snap: false }, axisLabel: { color: token.value.colorTextSecondary, fontSize: 12, hideOverlap: true, margin: 10 }, axisLine: { lineStyle: { color: token.value.colorBorder } } },
    yAxis: { type: 'value', min: 0, max: chart.max, minInterval: chart.minInterval, axisLabel: { formatter: formatValue, color: token.value.colorTextSecondary, fontSize: 12 }, splitLine: { lineStyle: { color: token.value.colorSplit } } },
    series: chart.series.map((series, index) => ({ name: series.label, type: 'line', showSymbol: false, connectNulls: false, lineStyle: { width: 2, color: palette[index % palette.length] }, itemStyle: { color: palette[index % palette.length] }, data: series.samples.map(point => [point.timestamp, point.value ?? null]) })),
  }
}
</script>
<style scoped>
.history-chart-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.history-chart-grid section { min-width:0; padding-top:8px; border-top:1px solid var(--line); }
.history-chart-heading { display:flex; align-items:center; gap:6px; font-size:var(--fs-sm,13px); }
.history-chart-heading :deep(.anticon) { color:var(--ink-3); }
.history-chart { height:200px; min-width:0; outline:0; }.history-chart:focus-visible { outline:2px solid var(--ant-color-primary,#1677ff); outline-offset:2px; }
.history-chart :deep(.ant-empty) { padding-block:20px; margin:0; }
@media(max-width:640px) { .history-chart-grid { grid-template-columns:minmax(0,1fr); gap:8px; } }
.history-chart-heading strong { font-weight:500; }
</style>

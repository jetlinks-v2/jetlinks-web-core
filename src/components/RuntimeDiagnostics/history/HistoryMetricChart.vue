<template>
  <section :data-metric-chart="chart.key" :class="{ 'history-panel--compact': compact }">
    <div class="history-chart-heading"><strong>{{ chart.label }}<small v-if="compact && chart.unit"> {{ chart.unit }}</small></strong><a-tooltip v-if="chart.description" :title="chart.description"><InfoCircleOutlined :aria-label="chart.description" /></a-tooltip>
      <div v-if="compact" class="history-chart-readings"><slot name="readings" :chart="chart"><span v-for="series in chart.series" :key="series.key" :title="series.samples.at(-1) ? t('runtimeDiagnostics.updatedAt', { time: new Date(series.samples.at(-1)!.timestamp).toLocaleString() }) : undefined"><b>{{ reading(series.samples.at(-1)?.value) }}</b><small>{{ series.label }}</small></span></slot></div>
    </div>
    <div class="history-chart" tabindex="0" @mouseenter="toolbox = true" @mouseleave="toolbox = false" @focusin="toolbox = true" @focusout="toolbox = false"><Echarts v-if="hasData" :key="topology" :option="option" :data-option="dataOption" defer-offscreen :library="library" renderer="svg" @ready="instance => emit('ready', instance)" @dispose="instance => emit('dispose', instance)" /><a-empty v-else :description="t('runtimeDiagnostics.empty')" :image="Empty.PRESENTED_IMAGE_SIMPLE" /></div>
  </section>
</template>
<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { Empty, theme } from 'ant-design-vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import type { ECharts } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { AxisPointerComponent, DataZoomComponent, GridComponent, LegendComponent, ToolboxComponent, TooltipComponent } from 'echarts/components'
import Echarts from '../../Echarts/Echarts.vue'
import type { MetricChart, TimeWindow } from '../types'
const props = defineProps({ chart: { type: Object as PropType<MetricChart>, required: true }, range: { type: Object as PropType<TimeWindow>, default: undefined }, compact: { type: Boolean, default: false }, tooltipFormatter: { type: Function as PropType<(parameters: unknown) => string>, default: undefined } })
const emit = defineEmits<{ (event: 'ready' | 'dispose', instance: ECharts): void }>()
const { t } = useI18n(), { token } = theme.useToken(), toolbox = ref(false)
const library = [LineChart, GridComponent, TooltipComponent, LegendComponent, AxisPointerComponent, DataZoomComponent, ToolboxComponent]
type Definition = Omit<MetricChart, 'series'> & { series: Array<Omit<MetricChart['series'][number], 'samples'>> }
// 样本变化不重建坐标、图例与工具配置；保留图例选择和缩放，常规更新只提交流式数据。
const definition = computed<Definition>(previous => {
  const { key, label, unit, max, minInterval, formatValue, formatTime } = props.chart
  const series = props.chart.series.map(({ key, label, color, lineType }) => ({ key, label, color, lineType }))
  if (previous && previous.key === key && previous.label === label && previous.unit === unit && previous.max === max && previous.minInterval === minInterval && previous.formatValue === formatValue && previous.formatTime === formatTime && previous.series.length === series.length && series.every((item, index) => Object.keys(item).every(key => item[key as keyof typeof item] === previous.series[index][key as keyof typeof item]))) return previous
  return { key, label, unit, max, minInterval, formatValue, formatTime, series }
})
const topology = computed(() => JSON.stringify(definition.value.series.map(series => series.key)))
const hasData = computed(() => props.chart.series.some(series => series.samples.some(point => point.value !== undefined)))
/** 末点缺测保持未知；不把历史最大值或较早读数伪装成当前值。 */
function reading(value?: number) { return value === undefined ? '—' : props.chart.formatValue?.(value) ?? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) }
const option = computed(() => {
  const chart = definition.value
  const formatValue = (value: number) => Number.isFinite(value) ? chart.formatValue?.(value) ?? `${value}${chart.unit ?? ''}` : '—'
  const palette = [token.value.colorPrimary, token.value.colorSuccess, token.value.colorWarning, token.value.colorInfo]
  return {
    animation: false, textStyle: { fontFamily: token.value.fontFamily, fontSize: 12 }, color: palette,
    // 紧凑提示只读且不接管鼠标，避免小绘图区被浮层遮住后收不到移出事件。
    tooltip: { trigger: 'axis', confine: true, enterable: false, hideDelay: props.compact ? 0 : undefined, valueFormatter: formatValue, formatter: props.tooltipFormatter, extraCssText: props.compact ? 'box-sizing:border-box;max-width:min(260px,100%);max-height:100%;overflow:hidden;white-space:normal;' : undefined },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: { left: 8, right: 12, top: props.compact ? 27 : 30, bottom: props.compact ? 8 : 42, containLabel: true },
    legend: { top: props.compact ? 0 : undefined, bottom: props.compact ? undefined : 0, type: 'scroll', itemWidth: 10, itemHeight: props.compact ? 2 : 10, icon: props.compact ? 'rect' : 'circle', textStyle: { color: token.value.colorTextSecondary, fontSize: props.compact ? 11 : 12 } },
    toolbox: { show: toolbox.value, right: 0, top: -4, feature: { dataZoom: { yAxisIndex: 'none', title: { zoom: t('runtimeDiagnostics.zoomRange'), back: t('runtimeDiagnostics.restoreRange') } } } },
    dataZoom: [{ id: 'window', type: 'inside', filterMode: 'none', zoomOnMouseWheel: 'ctrl' }],
    xAxis: { type: 'time', splitNumber: props.compact ? 2 : 4, axisPointer: { snap: false, label: { formatter: chart.formatTime ? (parameters: { value: number }) => chart.formatTime!(parameters.value) : undefined } }, axisLabel: { formatter: chart.formatTime, color: token.value.colorTextSecondary, fontSize: props.compact ? 10 : 12, hideOverlap: true, margin: 8 }, axisLine: { lineStyle: { color: token.value.colorBorder } } },
    yAxis: { type: 'value', min: 0, max: chart.max, minInterval: chart.minInterval, splitNumber: props.compact ? 2 : 5, axisLabel: { formatter: formatValue, color: token.value.colorTextSecondary, fontSize: props.compact ? 10 : 12 }, splitLine: { lineStyle: { color: token.value.colorSplit } } },
    series: chart.series.map((series, index) => ({ id: series.key, name: series.label, type: 'line', showSymbol: false, connectNulls: false, lineStyle: { width: props.compact ? 1.6 : 2, color: series.color ?? palette[index % palette.length], type: series.lineType ?? 'solid' }, itemStyle: { color: series.color ?? palette[index % palette.length] } })),
  }
})
const dataOption = computed(() => ({ xAxis: { min: props.range?.from, max: props.range && props.range.from === props.range.to ? props.range.to + 30000 : props.range?.to }, series: props.chart.series.map(series => ({ id: series.key, showSymbol: series.samples.length === 1, symbolSize: 4, data: series.samples.map(point => [point.timestamp, point.value ?? null]) })) }))
</script>
<style scoped>
section { min-width:0; padding-top:8px; border-top:1px solid var(--line); }
.history-chart-heading { display:flex; align-items:center; gap:6px; font-size:var(--fs-sm,13px); }.history-chart-heading strong { font-weight:500; }.history-chart-heading :deep(.anticon) { color:var(--ink-3); }
.history-chart { height:200px; min-width:0; overflow:hidden; outline:0; }.history-chart:focus-visible { outline:2px solid var(--ant-color-primary,#1677ff); outline-offset:2px; }.history-chart :deep(.ant-empty) { padding-block:20px; margin:0; }
.history-panel--compact { padding:8px 10px 4px; border:1px solid var(--line); border-radius:var(--radius-sm,4px); }
.history-panel--compact .history-chart-heading { align-items:baseline; flex-wrap:wrap; gap:2px 6px; font-size:12px; min-height:22px; }
.history-chart-heading small { color:var(--ink-3); font-size:10px; font-weight:400; }
.history-chart-readings { display:flex; flex:1; justify-content:flex-end; flex-wrap:wrap; gap:2px 10px; min-width:0; }.history-chart-readings :slotted(span),.history-chart-readings span { display:inline-flex; align-items:baseline; gap:4px; white-space:nowrap; }
.history-chart-readings b,.history-chart-readings :deep(b) { font-size:14px; font-weight:600; font-variant-numeric:tabular-nums; }.history-chart-readings :deep(small) { color:var(--ink-3); font-size:10px; font-weight:400; }
.history-panel--compact .history-chart { height:120px; }
</style>

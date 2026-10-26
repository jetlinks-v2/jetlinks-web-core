<template>
  <div class="device-observation-chart">
    <div class="device-observation-plot">
      <Echarts :option="option" :events="chartEvents" :library="library" renderer="svg" @ready="instance => emit('ready', instance)" @dispose="instance => emit('dispose', instance)" />
      <span v-if="!hasPoint" class="device-observation-chart-waiting" role="status">{{ t(`runtimeDiagnostics.deviceSessions.${waitingKey}`) }}</span>
    </div>
    <div class="device-observation-chart-units"><span v-for="(key, index) in ['flowAxis', 'messagesAxis', 'pendingAxis']" :key="key" :style="{ color: axisColors[index] }">{{ t(`runtimeDiagnostics.deviceSessions.${key}`) }}</span></div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { theme } from 'ant-design-vue'
import { escape } from 'lodash-es'
import type { ECharts } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { AxisPointerComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import Echarts from '../../Echarts/Echarts.vue'
import { deviceObservationPoints, deviceObservationPointAt, deviceObservationMetrics, deviceObservationMetricColors as colors, formatDeviceObservationValue, type DeviceObservationEntry, type DeviceObservationMetric } from './observation'
import type { TimeWindow } from '../types'
const props = defineProps<{ entry: DeviceObservationEntry; metrics: DeviceObservationMetric[]; range?: TimeWindow; paused?: boolean }>()
const emit = defineEmits<{ (event: 'update:metrics', value: DeviceObservationMetric[]): void; (event: 'ready' | 'dispose', instance: ECharts): void }>()
const { t, locale } = useI18n(), { token } = theme.useToken()
const library = [LineChart, AxisPointerComponent, GridComponent, LegendComponent, TooltipComponent]
const points = computed(() => deviceObservationPoints(props.entry.history))
const hasPoint = computed(() => points.value.some(point => props.metrics.some(metric => point[metric] !== undefined)))
const waitingKey = computed(() => !props.metrics.length ? 'selectMetrics' : props.paused ? 'trendPaused' : props.entry.state.status === 'empty' ? 'trendNoSessions' : props.entry.history.filter(sample => !sample.interrupted).length > 1 ? 'metricsUnavailable' : 'waitingTrend')
const axisColors = [token.value.colorTextSecondary, colors.messages, colors.pending]
const label = (metric: string) => t(`runtimeDiagnostics.deviceSessions.metric.${metric}`)
function selectLegend(value: unknown) {
  if (!value || typeof value !== 'object' || !('selected' in value) || !value.selected || typeof value.selected !== 'object') return
  const selected = value.selected as Record<string, unknown>
  emit('update:metrics', deviceObservationMetrics.filter(metric => typeof selected[metric] === 'boolean' ? selected[metric] : props.metrics.includes(metric)))
}
const chartEvents = { legendselectchanged: selectLegend }
/** 四项始终来自同一个真实帧；图例仅控制曲线，缺测保留未知。联动时不拿远处旧帧冒充当前数据。 */
function tooltip(value: unknown) {
  const params = (Array.isArray(value) ? value : [value]) as { value?: unknown; axisValue?: unknown }[]
  const time = params.map(param => typeof param?.axisValue === 'number' ? param.axisValue : Array.isArray(param?.value) ? param.value[0] : undefined).find(value => typeof value === 'number')
  if (typeof time !== 'number' || !Number.isFinite(time)) return ''
  const point = deviceObservationPointAt(points.value, time)
  const rows = deviceObservationMetrics.map(metric => {
    const amount = point?.[metric], unit = t(`runtimeDiagnostics.deviceSessions.${metric === 'messages' ? 'messagesUnit' : 'pendingUnit'}`)
    const formatted = amount === undefined ? '—' : formatDeviceObservationValue(amount, metric, locale.value, unit)
    return `<div style="display:flex;justify-content:space-between;gap:16px"><span>${escape(label(metric))}</span><b>${escape(formatted)}</b></div>`
  }).join('')
  const timestamp = new Date(point?.sampledAt ?? time).toLocaleTimeString(locale.value, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
  const ellipsis = 'display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'
  return `<div style="max-width:260px;white-space:normal">${escape(timestamp)}<div style="margin-top:6px"><strong style="${ellipsis}">${escape(props.entry.label)}</strong><small style="${ellipsis}">${escape(props.entry.id)}</small>${rows}</div></div>`
}
const option = computed(() => {
  const flow = props.metrics.includes('receive') || props.metrics.includes('send'), messages = props.metrics.includes('messages'), pending = props.metrics.includes('pending')
  return {
    animation: false, textStyle: { fontFamily: token.value.fontFamily, fontSize: 12, color: token.value.colorTextSecondary },
    grid: { top: 8, right: 46, bottom: 48, left: 8, containLabel: true },
    legend: { bottom: 0, left: 0, right: 0, icon: 'rect', itemWidth: 14, itemHeight: 2, itemGap: 10, data: [...deviceObservationMetrics], formatter: label, selected: Object.fromEntries(deviceObservationMetrics.map(metric => [metric, props.metrics.includes(metric)])), textStyle: { color: token.value.colorTextSecondary, fontSize: 12 } },
    tooltip: { trigger: 'axis', renderMode: 'html', formatter: tooltip, appendTo: 'body', confine: true, enterable: false, extraCssText: 'max-width:calc(100% - 16px);white-space:normal;pointer-events:none;' },
    xAxis: { type: 'time', show: hasPoint.value, min: props.range?.from ?? points.value[0]?.sampledAt, max: props.range?.to ?? (points.value.at(-1)?.sampledAt ?? 0) + 1000, splitNumber: 3, axisPointer: { snap: false }, axisLabel: { formatter: '{HH}:{mm}:{ss}', hideOverlap: true, color: token.value.colorTextSecondary }, axisLine: { lineStyle: { color: token.value.colorBorder } }, axisTick: { show: false }, splitLine: { show: false } },
    // 流量、消息速率与当前数量分别缩放，三个单位不共享数值轴；隐藏指标时显式清除轴位残留。
    yAxis: [flow, messages, pending].map((selected, index) => ({ id: `axis-${index}`, type: 'value', show: hasPoint.value && selected, min: 0, name: '', position: index === 0 ? 'left' : 'right', offset: index === 2 ? 44 : 0, splitNumber: 3, minInterval: index === 2 ? 1 : undefined,
      axisLabel: { formatter: (value: number) => value.toLocaleString(locale.value, { notation: 'compact', maximumFractionDigits: 1 }), color: axisColors[index] },
      splitLine: { show: index === (flow ? 0 : messages ? 1 : 2), lineStyle: { type: 'dashed', color: token.value.colorSplit } },
    })),
    series: deviceObservationMetrics.map(metric => ({ id: metric, name: metric, type: 'line', yAxisIndex: metric === 'messages' ? 1 : metric === 'pending' ? 2 : 0, showSymbol: points.value.filter(point => point[metric] !== undefined).length < 2, symbolSize: 5, connectNulls: false, smooth: false,
      itemStyle: { color: colors[metric] }, lineStyle: { width: 2, type: metric === 'pending' ? 'dashed' : 'solid' }, data: points.value.map(point => [point.sampledAt, point[metric] ?? null]),
    })),
  }
})
</script>
<style scoped>
.device-observation-chart { height:280px; display:flex; flex-direction:column; min-width:0; }
.device-observation-plot { position:relative; flex:1; min-height:0; }
.device-observation-chart-units { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; font-size:var(--fs-caption,12px); text-align:center; padding-top:2px; }
.device-observation-chart-waiting { position:absolute; inset:0 0 48px; display:flex; align-items:center; justify-content:center; pointer-events:none; color:var(--ink-2); font-size:var(--fs-caption,12px); padding:12px; text-align:center; }
</style>

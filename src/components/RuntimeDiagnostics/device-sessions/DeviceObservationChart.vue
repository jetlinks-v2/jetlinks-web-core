<template>
  <div class="device-observation-chart">
    <Echarts :key="JSON.stringify(entries.map(entry => entry.id))" :option="option" :events="chartEvents" :library="library" renderer="svg" />
    <span v-if="!hasPoint" class="device-observation-chart-waiting" role="status">{{ t(`runtimeDiagnostics.deviceSessions.${waitingKey}`) }}</span>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { theme } from 'ant-design-vue'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import Echarts from '../../Echarts/Echarts.vue'
import { deviceObservationPoints, deviceObservationColors, formatDeviceObservationValue, type DeviceObservationEntry, type DeviceObservationMetric } from './observation'
const props = defineProps<{ entries: DeviceObservationEntry[]; metric: DeviceObservationMetric; paused?: boolean }>()
const { t, locale } = useI18n(), { token } = theme.useToken()
const library = [LineChart, GridComponent, LegendComponent, TooltipComponent]
const points = computed(() => props.entries.map(entry => deviceObservationPoints(entry.history)))
const hasPoint = computed(() => points.value.some(history => history.some(point => point[props.metric] !== undefined)))
const sampleTimes = computed(() => points.value.flatMap(history => history.map(point => point.sampledAt)))
const waitingKey = computed(() => props.paused ? 'trendPaused' : props.entries.every(entry => entry.state.status === 'empty') ? 'trendNoSessions' : props.entries.some(entry => entry.history.filter(sample => !sample.interrupted).length > 1) ? 'metricsUnavailable' : 'waitingTrend')
const unit = computed(() => props.metric === 'receive' || props.metric === 'send' ? 'B/s' : t(`runtimeDiagnostics.deviceSessions.${props.metric === 'messages' ? 'messagesUnit' : 'pendingUnit'}`))
const selectedById = ref<Record<string, boolean>>({})
const displayName = (entry: DeviceObservationEntry) => entry.label === entry.id ? entry.id : `${entry.label} · ${entry.id}`
function selectLegend(value: unknown) {
  if (!value || typeof value !== 'object' || !('selected' in value) || !value.selected || typeof value.selected !== 'object') return
  const selected = value.selected as Record<string, unknown>
  selectedById.value = { ...selectedById.value, ...Object.fromEntries(props.entries.filter(entry => typeof selected[displayName(entry)] === 'boolean').map(entry => [entry.id, selected[displayName(entry)] === true])) }
}
const chartEvents = { legendselectchanged: selectLegend }
watch(() => JSON.stringify(props.entries.map(entry => entry.id)), () => { selectedById.value = Object.fromEntries(Object.entries(selectedById.value).filter(([id]) => props.entries.some(entry => entry.id === id))) })
const option = computed(() => ({
  animation: false, textStyle: { fontFamily: token.value.fontFamily, fontSize: 12, color: token.value.colorTextSecondary }, grid: { top: 16, right: 20, bottom: 52, left: 54, containLabel: true },
  legend: { type: 'scroll', bottom: 0, icon: 'rect', itemWidth: 16, itemHeight: 2, data: props.entries.map(displayName), selected: Object.fromEntries(props.entries.map(entry => [displayName(entry), selectedById.value[entry.id] !== false])) },
  tooltip: { trigger: 'axis', renderMode: 'richText', valueFormatter: (value: unknown) => typeof value === 'number' ? formatDeviceObservationValue(value, props.metric, locale.value, unit.value) : '—', confine: true },
  xAxis: { type: 'time', show: hasPoint.value, min: sampleTimes.value.length ? Math.min(...sampleTimes.value) : undefined, max: sampleTimes.value.length ? Math.max(...sampleTimes.value) + 1000 : undefined, splitNumber: 3, axisLabel: { formatter: '{HH}:{mm}:{ss}', hideOverlap: true, color: token.value.colorTextSecondary }, axisLine: { lineStyle: { color: token.value.colorBorder } }, axisTick: { show: false }, splitLine: { show: false } },
  yAxis: { type: 'value', show: hasPoint.value, min: 0, name: props.metric === 'receive' || props.metric === 'send' ? '' : unit.value, axisLabel: { formatter: (value: number) => props.metric === 'receive' || props.metric === 'send' ? formatDeviceObservationValue(value, props.metric, locale.value, unit.value) : value.toLocaleString(locale.value, { maximumFractionDigits: 1 }), color: token.value.colorTextSecondary }, minInterval: props.metric === 'pending' ? 1 : undefined, splitLine: { lineStyle: { type: 'dashed', color: token.value.colorSplit } } },
  series: props.entries.map((entry, index) => ({ id: entry.id, name: entry.label === entry.id ? entry.id : `${entry.label} · ${entry.id}`, type: 'line', showSymbol: points.value[index].filter(point => point[props.metric] !== undefined).length < 2, symbolSize: 5, connectNulls: false, smooth: false,
    itemStyle: { color: entry.color ?? deviceObservationColors[index % deviceObservationColors.length] }, lineStyle: { width: 2 },
    data: points.value[index].map(point => [point.sampledAt, point[props.metric] ?? null]) })),
}))
</script>
<style scoped>
.device-observation-chart { height:252px; position:relative; min-width:0; }.device-observation-chart-waiting { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; color:var(--ink-2); font-size:var(--fs-caption,12px); padding:24px; text-align:center; }
</style>

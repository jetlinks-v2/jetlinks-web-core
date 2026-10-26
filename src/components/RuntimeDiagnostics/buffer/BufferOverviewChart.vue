<template>
  <section class="buffer-overview-chart" :style="{ '--buffer-error': token.colorError }">
    <header class="buffer-chart-heading">
      <div class="buffer-chart-title"><strong>{{ t('runtimeDiagnostics.bufferQueues') }}</strong><a-tooltip :overlay-style="{ maxWidth: 'min(360px, calc(100vw - 24px))' }" :trigger="['hover', 'focus']"><template #title><div class="buffer-help"><p>{{ t('runtimeDiagnostics.bufferCollectionInfo') }}</p><p>{{ t('runtimeDiagnostics.bufferBacklogInfo') }}</p><p>{{ t('runtimeDiagnostics.bufferThroughputInfo') }}</p><p>{{ t('runtimeDiagnostics.bufferStatsInfo') }}</p><p>{{ scopeLabel }} · {{ coverage }}</p></div></template><InfoCircleOutlined tabindex="0" :aria-label="t('runtimeDiagnostics.bufferCollectionInfo')" /></a-tooltip></div>
      <div class="buffer-reading"><span>{{ t('runtimeDiagnostics.queue.pending') }}</span><strong>{{ numberText(pending) }}</strong><small>{{ t('runtimeDiagnostics.items') }}</small></div>
      <div class="buffer-reading"><span>{{ t('runtimeDiagnostics.bufferWriteShort') }}</span><strong>{{ numberText(currentRate?.writtenRate) }}</strong><small>{{ t('runtimeDiagnostics.bufferItemsPerSecond') }}</small></div>
      <div class="buffer-reading"><span>{{ t('runtimeDiagnostics.bufferAttemptShort') }}</span><strong>{{ numberText(currentRate?.attemptedRate) }}</strong><small>{{ t('runtimeDiagnostics.bufferItemsPerSecond') }}</small></div>
      <span v-if="dead !== undefined && dead > 0" class="buffer-retained">{{ t('runtimeDiagnostics.bufferRetainedCount', { count: numberText(dead) }) }}</span>
      <div class="buffer-heading-actions">
        <a-popover ref="optionsPopover" :open="optionsOpen" placement="bottomRight" trigger="click" @open-change="setOptionsOpen">
          <template #content>
            <div class="buffer-chart-options" tabindex="-1" @keydown.esc.stop="closeOptions(true)">
              <a-segmented size="small" :value="selection.grouping" :options="groupingOptions" :aria-label="t('runtimeDiagnostics.bufferGrouping')" @change="selectGrouping" />
              <a-divider />
              <a-tooltip :title="t('runtimeDiagnostics.bufferScaleInfo')"><a-segmented size="small" :value="selection.scale" :options="scaleOptions" @change="selectScale" /></a-tooltip>
              <a-divider />
              <a-space direction="vertical" :size="2">
                <template v-if="perQueue"><a-button size="small" type="text" block @click="selectAll">{{ t('runtimeDiagnostics.bufferLegendAll') }}</a-button><a-button size="small" type="text" block @click="invertSelection">{{ t('runtimeDiagnostics.bufferLegendInverse') }}</a-button></template>
                <a-button size="small" type="text" block @click="openSettings">{{ t('runtimeDiagnostics.bufferCollectionSettings') }}</a-button>
              </a-space>
            </div>
          </template>
          <a-button ref="optionsTrigger" class="buffer-options-trigger" size="small" type="text" :title="t('runtimeDiagnostics.bufferMoreOptions')" :aria-label="t('runtimeDiagnostics.bufferMoreOptions')" :aria-expanded="optionsOpen" @keydown="onOptionsKeydown"><MoreOutlined /></a-button>
        </a-popover>
      </div>
    </header>
    <div v-if="['loading', 'error', 'forbidden', 'unsupported'].includes(resetState.status)" class="buffer-reset-status" :class="{ 'is-error': resetState.status !== 'loading' }" role="status">{{ resetState.status === 'loading' ? t('runtimeDiagnostics.bufferResetting') : resetState.message || t('runtimeDiagnostics.failed') }}</div>
    <div class="buffer-history-chart"><div class="buffer-series-key"><span v-for="metric in seriesMetrics" :key="metric.key"><i :class="{ 'is-dashed': metric.lineType === 'dashed', 'is-dotted': metric.lineType === 'dotted', 'has-area': metric.key === 'pending' }" :style="{ color: perQueue && metric.key !== 'dead' ? undefined : metricColor(metric.key) }" />{{ metric.label }}</span><span class="buffer-axis-key">{{ t('runtimeDiagnostics.bufferCountAndRate') }}</span></div><Echarts :key="chartKey" class="buffer-chart-canvas" :option="option" :events="chartEvents" :library="library" renderer="svg" /><span v-if="!hasData || !hasLine" class="buffer-history-waiting" :class="{ 'is-collecting': hasData }" role="status"><ClockCircleOutlined v-if="scopeNames.length" />{{ t(!scopeNames.length ? 'runtimeDiagnostics.bufferNoQueuesSelected' : hasData ? 'runtimeDiagnostics.bufferCollectingSamples' : 'runtimeDiagnostics.waitingBufferSamples') }}</span></div>
    <BufferQueueDetails :queues="queues" :history="history" :scope-key="selectionKey" :coverage="coverage" :reset-access="resetAccess" :reset-state="resetState" @inspect="value => emit('inspect', value)" @reset="value => emit('reset', value)" />
  </section>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onDeactivated, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { theme } from 'ant-design-vue'
import { ClockCircleOutlined, InfoCircleOutlined, MoreOutlined } from '@ant-design/icons-vue'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { escape } from 'lodash-es'
import Echarts from '../../Echarts/Echarts.vue'
import type { ActionAccess, BufferDisplayConfig, BufferHistorySample, ViewState } from '../types'
import type { runtimeBeanOverview } from '../utils'
import { createVisiblePopupFocus } from '../popupFocus'
import BufferQueueDetails from './BufferQueueDetails.vue'
import { bufferOverviewPoints, bufferObjectLabel, bufferThroughputPoints, bufferTooltipHtml } from './history'
import { bufferAxisValue, bufferPlotValue, bufferQuantityTotal, normalizeBufferConfig } from './presentation'
type BufferQueue = ReturnType<typeof runtimeBeanOverview>['buffers'][number]
type BufferMetric = 'pending' | 'writtenRate' | 'attemptedRate' | 'dead'
interface SeriesMetric { key: BufferMetric; label: string; axis: number; lineType: 'solid' | 'dotted' | 'dashed' }
const props = defineProps({ queues: { type: Array as PropType<BufferQueue[]>, default: () => [] }, history: { type: Array as PropType<BufferHistorySample[]>, default: () => [] }, config: { type: Object as PropType<BufferDisplayConfig>, default: undefined }, resetAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) }, resetState: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) } })
const emit = defineEmits<{ (event: 'update:config', value: BufferDisplayConfig): void; (event: 'reset' | 'inspect', objectName: string): void; (event: 'settings'): void }>()
const { t } = useI18n(), { token } = theme.useToken()
const library = [LineChart, GridComponent, TooltipComponent, LegendComponent]
const queueNames = computed(() => props.queues.map(queue => queue.objectName))
// 当前身份集合稳定排序后互斥分配；刷新、列表重排和图例选择不会产生 hash 碰撞或换色。
const queueColors = computed(() => {
  const palette = [token.value.colorPrimary, token.value.colorSuccess, token.value.colorWarning, token.value.purple, token.value.cyan]
  return new Map([...new Set(queueNames.value)].sort().map((name, index) => [name, palette[index % palette.length]]))
})
const selection = ref<BufferDisplayConfig>(normalizeBufferConfig(props.config, queueNames.value))
const explicitSelection = ref(props.config?.visibleObjectNames !== undefined || !!props.config?.objectName)
watch(() => props.config, value => { explicitSelection.value = value?.visibleObjectNames !== undefined || !!value?.objectName; selection.value = normalizeBufferConfig(value, queueNames.value) }, { deep: true })
/** 视图 / 刻度切换不应把隐式全选固定成旧身份集合；显式空数组仍表示主动全关。 */
function configure(patch: Partial<BufferDisplayConfig>) {
  if (patch.visibleObjectNames !== undefined || patch.objectName !== undefined) explicitSelection.value = true
  selection.value = normalizeBufferConfig({ ...selection.value, ...patch }, queueNames.value)
  const config = { ...selection.value }
  if (!explicitSelection.value) { delete config.visibleObjectNames; delete config.objectName }
  emit('update:config', config)
}
watch(queueNames, names => {
  if (!explicitSelection.value) selection.value = normalizeBufferConfig({ ...selection.value, objectName: undefined, visibleObjectNames: undefined }, names)
})
const perQueue = computed(() => selection.value.grouping === 'queues')
const visibleQueues = computed(() => props.queues.filter(queue => !perQueue.value || selection.value.visibleObjectNames?.includes(queue.objectName)))
const scopeNames = computed(() => visibleQueues.value.map(queue => queue.objectName))
const selectionKey = computed(() => JSON.stringify([selection.value.grouping, selection.value.visibleObjectNames, queueNames.value]))
const scopeLabel = computed(() => perQueue.value ? t('runtimeDiagnostics.bufferSelectedScope', { count: visibleQueues.value.length, total: props.queues.length }) : t('runtimeDiagnostics.bufferAggregateScope', { count: props.queues.length }))
const coverage = computed(() => t('runtimeDiagnostics.bufferPendingCoverage', { count: visibleQueues.value.filter(queue => queue.pending !== undefined).length, total: visibleQueues.value.length }))
const pending = computed(() => bufferQuantityTotal(visibleQueues.value, 'pending')), dead = computed(() => bufferQuantityTotal(visibleQueues.value, 'dead'))
const currentRate = computed(() => bufferThroughputPoints(props.history, scopeNames.value).at(-1))
const numberText = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 2 })
const groupingOptions = computed(() => [{ value: 'aggregate', label: t('runtimeDiagnostics.bufferAggregate') }, { value: 'queues', label: t('runtimeDiagnostics.bufferByQueue') }])
const scaleOptions = computed(() => [{ value: 'linear', label: t('runtimeDiagnostics.bufferLinearScale') }, { value: 'compressed', label: t('runtimeDiagnostics.bufferCompressedScale') }])
function selectScale(value: unknown) { if (value === 'linear' || value === 'compressed') configure({ scale: value }) }
function selectGrouping(value: unknown) { if (value === 'aggregate' || value === 'queues') configure({ grouping: value }) }
const unavailableSelection = () => selection.value.visibleObjectNames?.filter(name => !queueNames.value.includes(name)) ?? []
function selectAll() { configure({ visibleObjectNames: [...unavailableSelection(), ...queueNames.value] }) }
function invertSelection() { configure({ visibleObjectNames: [...unavailableSelection(), ...queueNames.value.filter(name => !selection.value.visibleObjectNames?.includes(name))] }) }
function selectLegend(params: unknown) {
  if (!perQueue.value || !params || typeof params !== 'object' || !('selected' in params) || !params.selected || typeof params.selected !== 'object') return
  const selected = params.selected as Record<string, unknown>
  // 暂时不在快照中的期望身份仍保留；图例操作只改变当前可见身份。
  configure({ visibleObjectNames: [...unavailableSelection(), ...queueNames.value.filter(name => Object.hasOwn(selected, name) && selected[name] === true)] })
}
const chartEvents = { legendselectchanged: selectLegend, legendselectall: selectLegend, legendinverseselect: selectLegend }
const optionsOpen = ref(false), optionsTrigger = ref<{ $el: HTMLElement }>(), optionsPopover = ref<{ getPopupDomNode?: () => HTMLElement }>(), popupFocus = createVisiblePopupFocus()
function focusOptions() { popupFocus.focus({ getPopup: () => optionsPopover.value?.getPopupDomNode?.(), isActive: () => optionsOpen.value }) }
function setOptionsOpen(open: boolean) { optionsOpen.value = open; if (open) focusOptions(); else popupFocus.cancel() }
function closeOptions(restore = false) { setOptionsOpen(false); if (restore) optionsTrigger.value?.$el.focus() }
function onOptionsKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); closeOptions(true) }
  if (event.key === 'ArrowDown' || event.key === 'Tab' && optionsOpen.value && !event.shiftKey) { event.preventDefault(); setOptionsOpen(true) }
}
function openSettings() { closeOptions(); emit('settings') }
if (getCurrentInstance()) { onDeactivated(() => closeOptions()); onBeforeUnmount(() => closeOptions()) }
/** 聚合使用当前汇总的相同身份集合；历史缺成员不能悄悄变成较小的总量。 */
const queuePoints = computed(() => (perQueue.value ? props.queues.map(queue => ({ name: queue.objectName, scope: queue.objectName })) : [{ name: t('runtimeDiagnostics.bufferAllQueues'), scope: scopeNames.value }]).map(queue => ({
  name: queue.name, points: bufferOverviewPoints(props.history, queue.scope),
})))
const points = computed(() => queuePoints.value[0]?.points ?? [])
const hasFailures = computed(() => queuePoints.value.some(queue => (!perQueue.value || scopeNames.value.includes(queue.name)) && queue.points.some(point => point.dead !== undefined && point.dead > 0)))
// 旧 view 偏好继续随其他设置保存；合图的指标集合不再由旧堆积/吞吐模式裁剪。
const seriesMetrics = computed<SeriesMetric[]>(() => [
  { key: 'pending', label: t('runtimeDiagnostics.queue.pending'), axis: 0, lineType: 'solid' },
  { key: 'writtenRate', label: t('runtimeDiagnostics.bufferWriteRate'), axis: 1, lineType: perQueue.value ? 'dotted' : 'solid' },
  { key: 'attemptedRate', label: t('runtimeDiagnostics.bufferAttemptRate'), axis: 1, lineType: 'dashed' },
  ...(hasFailures.value ? [{ key: 'dead' as const, label: t('runtimeDiagnostics.bufferRetainedFailures'), axis: 0, lineType: 'solid' as const }] : []),
])
const hasData = computed(() => queuePoints.value.some(queue => (!perQueue.value || scopeNames.value.includes(queue.name)) && queue.points.some(point => seriesMetrics.value.some(metric => point[metric.key] !== undefined))))
const hasLine = computed(() => queuePoints.value.some(queue => (!perQueue.value || scopeNames.value.includes(queue.name)) && queue.points.some((point, index, points) => index > 0 && point.sampledAt !== points[index - 1].sampledAt && seriesMetrics.value.some(metric => point[metric.key] !== undefined && points[index - 1][metric.key] !== undefined))))
// ECharts 默认合并系列，身份或分组改变时重建以移除旧系列；采样和刻度仍保留实例。
const chartKey = computed(() => JSON.stringify([selection.value.grouping, [...queueNames.value].sort(), hasFailures.value, queuePoints.value.filter(queue => queue.points.some(point => point.dead !== undefined && point.dead > 0)).map(queue => queue.name).sort()]))
function metricColor(key: BufferMetric) { return key === 'pending' ? token.value.colorPrimary : key === 'dead' ? token.value.colorError : token.value.colorSuccess }
function tooltip(params: unknown) {
  const first: unknown = Array.isArray(params) ? params[0] : params
  if (!first || typeof first !== 'object' || !('axisValue' in first) || typeof first.axisValue !== 'number') return ''
  return bufferTooltipHtml(props.history, first.axisValue, { queue: t('runtimeDiagnostics.bufferName'), aggregate: scopeLabel.value, pending: t('runtimeDiagnostics.queue.pending'), dead: t('runtimeDiagnostics.bufferRetainedFailures'), items: t('runtimeDiagnostics.items'), writtenRate: t('runtimeDiagnostics.bufferWriteRate'), attemptedRate: t('runtimeDiagnostics.bufferAttemptRate'), itemsPerSecond: t('runtimeDiagnostics.bufferItemsPerSecond') }, { ...selection.value, visibleObjectNames: scopeNames.value, combined: true })
}
const option = computed(() => ({
  animation: false, textStyle: { fontFamily: token.value.fontFamily, fontSize: 12 },
  legend: {
    show: perQueue.value, id: 'buffer-queues', type: 'scroll', top: 0, left: 0, right: 0, itemWidth: 16, itemHeight: 2, icon: 'rect',
    data: queueNames.value, selected: Object.fromEntries(queueNames.value.map(name => [name, selection.value.visibleObjectNames?.includes(name) ?? false])),
    formatter: (name: string) => { const label = bufferObjectLabel(name); return label.length > 24 ? `${label.slice(0, 23)}…` : label },
    tooltip: { show: true, formatter: (params: { name: string }) => escape(params.name) },
    textStyle: { fontSize: 12, color: token.value.colorTextSecondary }, pageTextStyle: { fontSize: 12, color: token.value.colorTextSecondary },
  },
  tooltip: { trigger: 'axis', renderMode: 'html', confine: true, enterable: true, textStyle: { fontSize: 12 }, formatter: tooltip },
  grid: { left: 4, right: 4, top: perQueue.value ? 42 : 24, bottom: 4, containLabel: true },
  xAxis: { show: hasData.value && points.value.length > 1, type: 'time', min: points.value[0]?.sampledAt, max: points.value.at(-1)?.sampledAt, splitNumber: 3, axisLabel: { fontSize: 12, color: token.value.colorTextSecondary, hideOverlap: true, formatter: (value: number) => new Date(value).toLocaleTimeString([], { hour12: false }) }, axisLine: { lineStyle: { color: token.value.colorBorder } }, axisTick: { show: false } },
  yAxis: [0, 1].map(axis => ({ show: hasData.value, type: 'value', position: axis ? 'right' : 'left', name: t(axis ? 'runtimeDiagnostics.bufferItemsPerSecond' : 'runtimeDiagnostics.items'), nameTextStyle: { fontSize: 12, color: token.value.colorTextSecondary }, min: 0, minInterval: axis || selection.value.scale === 'compressed' ? undefined : 1, splitNumber: 3, axisLabel: { fontSize: 12, color: token.value.colorTextSecondary, formatter: (value: number) => bufferAxisValue(value, selection.value.scale).toLocaleString(undefined, { maximumFractionDigits: 2, notation: 'compact' }) }, splitLine: { show: !axis, lineStyle: { color: token.value.colorSplit } } })),
  series: queuePoints.value.flatMap(queue => seriesMetrics.value.filter(metric => metric.key !== 'dead' || queue.points.some(point => point.dead !== undefined && point.dead > 0)).map(metric => {
    const color = metric.key === 'dead' ? token.value.colorError : perQueue.value ? queueColors.value.get(queue.name) : metricColor(metric.key)
    return {
      id: JSON.stringify([queue.name, metric.key]), name: queue.name, type: 'line', yAxisIndex: metric.axis, showSymbol: metric.key === 'dead', symbol: 'circle', symbolSize: (value: number[]) => metric.key === 'dead' && value[1] > 0 ? 5 : 0, connectNulls: false,
      itemStyle: { color }, lineStyle: { color, width: metric.key === 'writtenRate' ? 1.5 : 2, type: metric.lineType }, areaStyle: metric.key === 'pending' ? { opacity: perQueue.value ? 0.04 : 0.08, color } : undefined,
      data: queue.points.map(point => [point.sampledAt, bufferPlotValue(point[metric.key], selection.value.scale)]),
    }
  })),
}))
</script>
<style scoped>
.buffer-overview-chart { min-width:0; container-type:inline-size; }.buffer-chart-heading,.buffer-heading-actions { display:flex; flex-wrap:wrap; align-items:center; gap:6px 16px; font-size:var(--fs-caption,12px); min-height:26px; }.buffer-chart-title { display:inline-flex; align-items:center; gap:6px; }.buffer-chart-title > strong { color:var(--ink-1); font-size:var(--fs-body,14px); font-weight:600; }.buffer-chart-title > :deep(.anticon),.buffer-heading-actions :deep(.anticon) { font-size:14px; }.buffer-chart-title > :deep(.anticon) { color:var(--ink-2); }.buffer-heading-actions { gap:4px; margin-inline-start:auto; }
.buffer-chart-options { min-width:150px; }.buffer-chart-options :deep(.ant-divider) { margin:6px 0; }
.buffer-reading { display:inline-flex; align-items:baseline; gap:5px; white-space:nowrap; color:var(--ink-2); }.buffer-reading > strong { color:var(--ink-1); font-size:var(--fs-16,16px); line-height:1.3; font-weight:600; font-variant-numeric:tabular-nums; }.buffer-reading > small { font-size:inherit; }.buffer-retained { color:var(--buffer-error); }
.buffer-reset-status { margin-block:3px; font-size:var(--fs-caption,12px); color:var(--ink-3); }.buffer-reset-status.is-error { color:var(--buffer-error); }
.buffer-series-key { display:flex; flex:0 0 auto; flex-wrap:wrap; gap:4px 14px; min-height:18px; pointer-events:none; font-size:var(--fs-caption,12px); color:var(--ink-2); }.buffer-series-key span { display:inline-flex; align-items:center; gap:5px; }.buffer-series-key i { width:16px; border-top:2px solid currentColor; }.buffer-series-key i.is-dashed { border-top-style:dashed; }.buffer-series-key i.is-dotted { border-top-style:dotted; }.buffer-series-key i.has-area { height:7px; background:color-mix(in srgb,currentColor 8%,transparent); }.buffer-series-key .buffer-axis-key { margin-inline-start:auto; color:var(--ink-3); }
.buffer-history-chart { display:flex; flex-direction:column; height:240px; margin-top:8px; min-width:0; position:relative; }.buffer-chart-canvas { flex:1 1 0; min-height:0; }.buffer-history-waiting { display:flex; justify-content:center; align-items:center; gap:6px; position:absolute; inset:62px 0 0; pointer-events:none; color:var(--ink-3); font-size:var(--fs-caption,12px); }
.buffer-history-waiting.is-collecting { inset:auto 0 8px; }.buffer-help p { margin:0 0 8px; }.buffer-help p:last-child { margin:0; }
@container (max-width:600px) { .buffer-chart-heading { gap:6px 12px; }.buffer-heading-actions { gap:2px; } }
</style>

<template>
  <DiagnosticsState :state="state" @retry="emit('refresh')">
    <div v-if="$slots.summary" class="diagnostics-toolbar"><slot name="summary" /></div>
    <slot name="metrics"><a-descriptions :column="{ xs: 1, sm: 2, lg: 4 }" size="small">
      <a-descriptions-item v-for="metric in metrics" :key="metric.key" :label="metric.label"><strong>{{ metric.value ?? '—' }}</strong> {{ metric.value === undefined ? '' : metric.unit }}<small v-if="metric.detail" class="diagnostics-metric-detail">{{ metric.detail }}</small></a-descriptions-item>
    </a-descriptions></slot>
    <div class="diagnostics-compact-toolbar history-toolbar" :class="{ 'history-toolbar--compact': compact }">
      <strong>{{ t(compact ? 'runtimeDiagnostics.systemResources' : 'runtimeDiagnostics.history') }}</strong>
      <a-select v-if="options.length" size="small" :value="activeMetric" :options="options" @change="value => emit('metric', String(value))" />
      <span class="history-actions"><slot name="time"><HistoryRangeControl v-if="range" :range="range" @change="changeRange" /></slot>
        <a-tooltip :title="t('runtimeDiagnostics.refresh')"><a-button size="small" type="text" :loading="historyState.status === 'loading'" :aria-label="t('runtimeDiagnostics.refresh')" @click="emit('refresh')"><template #icon><ReloadOutlined /></template></a-button></a-tooltip>
        <span v-if="!compact && historyState.sampledAt" class="history-sampled">{{ t('runtimeDiagnostics.updatedAt', { time: new Date(historyState.sampledAt).toLocaleTimeString() }) }}</span>
        <a-button v-if="compact && initialChartKeys.length && charts.length > primaryCharts.length" type="link" size="small" class="history-expand" :aria-expanded="expanded" @click="toggleExpanded">{{ t(expanded ? 'runtimeDiagnostics.lessMetrics' : 'runtimeDiagnostics.moreMetrics') }}</a-button></span>
      <a-button v-if="beforeZoom" size="small" @click="restore">{{ t('runtimeDiagnostics.restoreRange') }}</a-button>
    </div>
    <DiagnosticsState :state="historyState" @retry="emit('refresh')"><HistoryMetricCharts :charts="displayCharts" :compact="compact" :range="range" @range-change="zoom" /></DiagnosticsState>
    <slot :expanded="expanded" />
  </DiagnosticsState>
</template>
<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { ReloadOutlined } from '@ant-design/icons-vue'
import DiagnosticsState from './DiagnosticsState.vue'
import HistoryMetricCharts from './history/HistoryMetricCharts.vue'
import HistoryRangeControl from './history/HistoryRangeControl.vue'
import type { MetricValue, MetricSample, MetricChart, TimeWindow, ViewState } from './types'
const props = defineProps({
  metrics: { type: Array as PropType<MetricValue[]>, default: () => [] }, samples: { type: Array as PropType<MetricSample[]>, default: () => [] },
  charts: { type: Array as PropType<MetricChart[]>, default: () => [] }, range: { type: Object as PropType<TimeWindow>, default: undefined },
  compact: { type: Boolean, default: false }, initialChartKeys: { type: Array as PropType<string[]>, default: () => [] },
  chartCapacity: { type: Number, default: undefined },
  expanded: { type: Boolean, default: undefined },
  activeMetric: { type: String, default: '' }, options: { type: Array as PropType<Array<{ label: string; value: string }>>, default: () => [] },
  state: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) }, historyState: { type: Object as PropType<ViewState>, default: () => ({ status: 'ready' }) },
})
const emit = defineEmits<{ (event: 'refresh'): void; (event: 'metric', value: string): void; (event: 'range-change', range: TimeWindow): void; (event: 'update:expanded', value: boolean): void }>()
const { t } = useI18n()
const beforeZoom = ref<TimeWindow>()
const localExpanded = ref(false), expanded = computed(() => props.expanded ?? localExpanded.value)
function toggleExpanded() { const next = !expanded.value; localExpanded.value = next; emit('update:expanded', next) }
const primaryCharts = computed(() => props.charts.filter(chart => props.initialChartKeys.includes(chart.key)))
// 宿主可按空间增加已有图表；基础图与手动展开独立，尺寸变化不改变展开状态或触发查询。
const compactCharts = computed(() => props.charts.filter((chart, index) => props.initialChartKeys.includes(chart.key) || index < (props.chartCapacity ?? 0)))
// 展开仅改变已有历史的展示集合，不触发查询或更改时间范围。
const displayCharts = computed<MetricChart[]>(() => props.charts.length ? props.compact && props.initialChartKeys.length && !expanded.value ? compactCharts.value : props.charts : [{ key: 'metric', label: props.options.find(option => option.value === props.activeMetric)?.label ?? '', series: [{ key: 'metric', label: props.activeMetric, samples: props.samples }] }])
/** 缩放只改变查询范围；首次缩放保留原范围供一键恢复。 */
function zoom(range: TimeWindow) { if (!beforeZoom.value && props.range) beforeZoom.value = { ...props.range }; emit('range-change', range) }
function changeRange(range: TimeWindow) { beforeZoom.value = undefined; emit('range-change', range) }
function restore() { if (beforeZoom.value) { const range = beforeZoom.value; beforeZoom.value = undefined; emit('range-change', range) } }
</script>
<style scoped>
.history-toolbar { padding-top:4px; }.history-toolbar > strong { margin-inline-end:4px; font-size:var(--fs-body,14px); font-weight:600; }.history-actions { display:inline-flex; align-items:center; gap:4px; margin-inline-start:auto; min-width:0; }.history-sampled { color:var(--ink-3); font-size:12px; white-space:nowrap; }
.history-expand { padding-inline:4px; height:auto; font-size:12px; }.history-toolbar--compact .history-actions { flex-wrap:wrap; }
</style>

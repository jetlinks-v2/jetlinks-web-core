<template>
  <section class="buffer-observation-history">
    <div class="buffer-history-context"><span>{{ t('runtimeDiagnostics.bufferHistoryWindow', { from: clock(windowStart), to: clock(recording.snapshot.sampledAt), zone: recording.snapshot.zoneId }) }}</span><a-tooltip :title="t('runtimeDiagnostics.bufferHistoryInfo')" :trigger="['hover', 'focus']" :overlay-style="{ maxWidth: 'min(440px, calc(100vw - 32px))' }"><InfoCircleOutlined tabindex="0" :aria-label="t('runtimeDiagnostics.bufferHistoryInfo')" /></a-tooltip></div>
    <nav class="buffer-history-metrics" :aria-label="t('runtimeDiagnostics.bufferHistoryMetric')"><a-tabs v-model:active-key="metric" size="small" :tab-bar-gutter="16"><a-tab-pane v-for="key in available" :key="key" :tab="label(key)" /></a-tabs></nav>
    <HistoryMetricCharts :charts="charts" />
    <BufferObservationStats :observation="recording.snapshot" :recording="recording" />
  </section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import HistoryMetricCharts from '../history/HistoryMetricCharts.vue'
import BufferObservationStats from './BufferObservationStats.vue'
import type { MetricChart, MetricSample } from '../types'
import { availableBufferObservationMetrics, type BufferObservationMetric, type BufferObservationRecording } from './observation'
import { bufferObservationUnitKey } from './presentation'
const props = defineProps<{ recording: BufferObservationRecording }>()
const { t } = useI18n()
const metric = ref<BufferObservationMetric>('WrittenRate')
const label = (key: BufferObservationMetric) => t(`runtimeDiagnostics.bufferObservation.${key}`)
const unit = (key: BufferObservationMetric) => t(bufferObservationUnitKey(key))
const available = computed(() => availableBufferObservationMetrics(props.recording.snapshot))
watch(available, keys => { if (!keys.includes(metric.value)) metric.value = keys[0] }, { immediate: true })
const clock = (value: number) => value > 0 ? new Date(value).toLocaleString(undefined, { timeZone: props.recording.snapshot.zoneId, hour12: false }) : '—'
const windowStart = computed(() => {
  const first = props.recording.points[0]
  return Math.max(props.recording.snapshot.statisticsStartTime, first ? first.time - (props.recording.hour ? 0 : first.windowMillis) : 0)
})
const charts = computed<MetricChart[]>(() => {
  const samples = (peak: boolean): MetricSample[] => props.recording.points.flatMap((point, index, points) => {
    const previous = points[index - 1], gap = previous && point.time - previous.time > (props.recording.hour ? 60_000 : 2000)
    return [...(gap ? [{ timestamp: previous.time + 1 }] : []), { timestamp: point.time, value: peak ? point.peaks[metric.value]?.value : point.values[metric.value] }]
  })
  return [{ key: 'buffer-observation', label: label(metric.value), unit: unit(metric.value),
    series: [{ key: 'average', label: t('runtimeDiagnostics.bufferHistoryAverage'), samples: samples(false) },
      ...(props.recording.hour ? [{ key: 'peak', label: t('runtimeDiagnostics.bufferHistoryPeak'), samples: samples(true) }] : [])] }]
})
</script>
<style scoped>
.buffer-observation-history { min-width:0; }
.buffer-history-context { display:flex; align-items:baseline; gap:8px; margin-block:8px; color:var(--ink-3); font-size:var(--fs-caption,12px); line-height:1.6; }.buffer-history-context > span { min-width:0; }.buffer-history-context :deep(.anticon) { flex-shrink:0; }
.buffer-history-metrics { min-width:0; }.buffer-history-metrics :deep(.ant-tabs-nav) { margin:0; }.buffer-history-metrics :deep(.ant-tabs-tab) { padding-block:6px; font-size:var(--fs-caption,12px); }
.buffer-observation-history :deep(.history-chart-grid) { grid-template-columns:minmax(0,1fr); }
</style>

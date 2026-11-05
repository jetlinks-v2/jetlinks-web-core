<template>
  <section class="buffer-observation-stats">
    <p class="buffer-stats-meta">{{ t('runtimeDiagnostics.bufferStatsAsOf', { sampledAt: clock(observation.sampledAt), since: clock(observation.statisticsStartTime), zone: observation.zoneId }) }} <a-tag v-if="!observation.fresh" color="warning">{{ t('runtimeDiagnostics.bufferSampleStale') }}</a-tag></p>
    <a-table :columns="columns" :data-source="rows" :pagination="false" row-key="metric" size="small" :scroll="{ x: recording ? 680 : 500 }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'metric'"><span class="buffer-stats-metric">{{ t(`runtimeDiagnostics.bufferObservation.${record.metric}`) }}<small class="buffer-stats-unit">{{ unit(record.metric) }}</small></span></template>
        <template v-else-if="column.key === 'current'">{{ number(record.current) }}</template>
        <template v-else-if="column.key === 'range' || column.key === 'today'"><span class="buffer-stats-peak"><span>{{ number(record[column.key]?.value) }}</span><span v-if="record[column.key]" class="buffer-stats-time" :title="clock(record[column.key].time)">{{ peakClock(record[column.key].time) }}</span></span></template>
      </template>
    </a-table>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { availableBufferObservationMetrics, bufferObservationRangePeaks, type BufferObservation, type BufferObservationMetric, type BufferObservationRecording } from './observation'
import { bufferObservationUnitKey } from './presentation'
const props = defineProps<{ observation: BufferObservation; recording?: BufferObservationRecording }>()
const { t, locale } = useI18n()
const unit = (metric: BufferObservationMetric) => t(bufferObservationUnitKey(metric))
const numberFormat = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 2 }))
const clockFormat = computed(() => new Intl.DateTimeFormat(locale.value, { timeZone: props.observation.zoneId, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
const peakClockFormat = computed(() => new Intl.DateTimeFormat(locale.value, { timeZone: props.observation.zoneId, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }))
const number = (value: number | undefined) => value === undefined ? '—' : numberFormat.value.format(value)
const clock = (time: number) => time > 0 ? clockFormat.value.format(time) : '—'
const peakClock = (time: number) => time > 0 ? peakClockFormat.value.format(time) : '—'
const rangePeaks = computed(() => props.recording ? bufferObservationRangePeaks(props.recording) : {})
const rows = computed(() => availableBufferObservationMetrics(props.observation).map(metric => ({ metric,
  current: !props.observation.fresh && metric.endsWith('Rate') ? undefined : props.observation.values[metric],
  range: rangePeaks.value[metric], today: props.observation.todayPeaks[metric],
})))
const columns = computed(() => [
  { key: 'metric', title: t('runtimeDiagnostics.bufferHistoryMetric'), width: 160 },
  { key: 'current', title: t('runtimeDiagnostics.bufferSnapshotValue'), width: 90, align: 'right' as const },
  ...(props.recording ? [{ key: 'range', title: t('runtimeDiagnostics.bufferRangePeak'), align: 'right' as const }] : []),
  { key: 'today', title: t('runtimeDiagnostics.bufferHistoryTodayPeak'), align: 'right' as const },
])
</script>
<style scoped>
.buffer-stats-meta { margin:8px 0; color:var(--ink-3); font-size:var(--fs-caption,12px); }
.buffer-stats-metric,.buffer-stats-peak { display:flex; flex-wrap:wrap; align-items:baseline; gap:2px 8px; }.buffer-stats-peak { justify-content:flex-end; font-variant-numeric:tabular-nums; }
.buffer-stats-unit,.buffer-stats-time { color:var(--ink-3); font-size:var(--fs-caption,12px); font-weight:400; }.buffer-stats-time { white-space:nowrap; }
.buffer-observation-stats :deep(.ant-table-cell) { padding:6px 8px; font-size:var(--fs-caption,12px); line-height:20px; }
</style>

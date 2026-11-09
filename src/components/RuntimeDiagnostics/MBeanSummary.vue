<template>
  <template v-if="buffers[0]">
    <BufferQueueDetail :buffer="buffers[0]" :show-observation="!recording" :show-operations="bean.operations.length > 0" @request-section="section => emit('request-section', section)" />
    <a-collapse v-if="historyRanges.length" v-model:active-key="historyOpen" ghost>
      <a-collapse-panel key="history" :header="t('runtimeDiagnostics.bufferHistoryTitle')">
        <div class="buffer-mbean-period" role="group" :aria-label="t('runtimeDiagnostics.bufferHistoryTitle')"><a-button v-for="range in historyRanges" :key="range.value" :type="historyRange === range.value ? 'link' : 'text'" :aria-pressed="historyRange === range.value" size="small" @click="historyRange = range.value">{{ range.label }}</a-button></div>
        <template v-if="historyOpen.length"><BufferObservationHistory v-if="recording" :recording="recording" /><a-empty v-else :description="t('runtimeDiagnostics.noMonitoringData')" /></template>
      </a-collapse-panel>
    </a-collapse>
  </template>
  <component v-else-if="specialized" :is="specialized" :bean="bean" />
  <MBeanSemanticMetrics v-else-if="semanticMetrics.length" :metrics="semanticMetrics" />
  <a-descriptions v-else :column="{ xs: 1, sm: 2, lg: 3 }" size="small">
    <a-descriptions-item v-for="attribute in fields" :key="attribute.name" :label="t(`runtimeDiagnostics.bean.${attribute.name}`, attribute.name)">
      <template v-if="attribute.memory"><strong>{{ formatValue(attribute.value) }}</strong><a-progress v-if="attribute.memory.max > 0" :percent="Math.min(100, attribute.memory.used / attribute.memory.max * 100)" :show-info="false" size="small" /></template>
      <CodeBlock v-else-if="attribute.value !== null && typeof attribute.value === 'object'" :content="formatValue(attribute.value)" variant="light" />
      <span v-else>{{ formatValue(attribute.value) }}</span>
    </a-descriptions-item>
  </a-descriptions>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../CodeBlock/index.vue'
import BufferQueueDetail from './buffer/BufferQueueDetail.vue'
import type { MBeanDescriptor } from './types'
import { formatValue, runtimeBeanOverview } from './utils'
import { mbeanSummaryFields } from './registry'
import { mbeanSemanticMetrics } from './mbean/semantic'
import MBeanSemanticMetrics from './mbean/MBeanSemanticMetrics.vue'
import { readBufferObservationRecording } from './buffer/observation'
const BufferObservationHistory = defineAsyncComponent(() => import('./buffer/BufferObservationHistory.vue'))
const props = defineProps({ bean: { type: Object as PropType<MBeanDescriptor>, required: true } })
const emit = defineEmits<{ (event: 'request-section', section: 'operations'): void }>()
const { t } = useI18n()
const buffers = computed(() => runtimeBeanOverview([props.bean]).buffers)
const historyOpen = ref<string[]>([]), historyRange = ref<'recent' | 'hour'>('recent')
const historyRanges = computed(() => [
  { value: 'recent' as const, attribute: 'RecentHistory', label: t('runtimeDiagnostics.bufferHistoryRecentShort') },
  { value: 'hour' as const, attribute: 'HourHistory', label: t('runtimeDiagnostics.bufferHistoryHourShort') },
].filter(range => props.bean.attributes.some(attribute => attribute.name === range.attribute && attribute.available)))
watch(historyRanges, ranges => { if (ranges.length && !ranges.some(range => range.value === historyRange.value)) historyRange.value = ranges[0].value }, { immediate: true })
// 仅在展开时解析本次手动读取的历史；展示层不请求 API、不建立额外轮询。
const recording = computed(() => historyOpen.value.length ? readBufferObservationRecording(props.bean, historyRange.value === 'hour') : undefined)
watch(() => props.bean.objectName, () => { historyOpen.value = []; historyRange.value = historyRanges.value[0]?.value ?? 'recent' })
const specializedViews = {
  DeviceSessionManager: defineAsyncComponent(() => import('./mbean/DeviceSessionSummary.vue')),
  EventBus: defineAsyncComponent(() => import('./mbean/EventBusSummary.vue')),
  SpringMessageBroker: defineAsyncComponent(() => import('./mbean/SpringBrokerSummary.vue')),
}
const specialized = computed(() => props.bean.domain === 'org.jetlinks' ? specializedViews[props.bean.type as keyof typeof specializedViews] : undefined)
const semanticMetrics = computed(() => mbeanSemanticMetrics(props.bean))
interface SummaryField { name: string; value: unknown; memory?: { used: number; max: number } }
const fields = computed<SummaryField[]>(() => mbeanSummaryFields(props.bean).flatMap<SummaryField>(name => {
  const attribute = props.bean.attributes.find(item => item.name === name && item.available)
  if (!attribute) return []
  if (props.bean.type === 'NettyAllocator' && name === 'Metrics' && attribute.value && typeof attribute.value === 'object') {
    const metrics = attribute.value as Record<string, unknown>
    return ['allocatorType', 'allocatorDirectUsed', 'allocatorHeapUsed', 'jvmDirectUsed', 'jvmDirectMax', 'pooledDirectPinned'].filter(key => metrics[key] !== undefined).map(key => ({
      name: key, value: typeof metrics[key] === 'number' ? Number(metrics[key]) < 0 ? '—' : `${(Number(metrics[key]) / 1048576).toFixed(1)} MiB` : metrics[key], memory: undefined,
    }))
  }
  const memory = attribute.value as { used?: number; max?: number } | undefined
  const value = /MemoryUsage$/.test(name) && typeof memory?.used === 'number'
    ? `${(memory.used / 1048576).toFixed(1)} MiB${typeof memory.max === 'number' && memory.max > 0 ? ` / ${(memory.max / 1048576).toFixed(1)} MiB` : ''}`
    : /^(StartTime|LastSuccessTime|LastCleanupTime|ErrorTime)$/.test(name) && Number(attribute.value) > 0 ? new Date(Number(attribute.value)).toLocaleString()
    : name === 'L1HitRatio' && typeof attribute.value === 'number' ? `${(attribute.value * 100).toFixed(1)}%`
    : attribute.value
  return [{ ...attribute, value, memory: /MemoryUsage$/.test(name) && typeof memory?.used === 'number' ? { used: memory.used, max: memory.max ?? -1 } : undefined }]
}))
</script>
<style scoped>
.buffer-mbean-period { display:flex; gap:4px; }.buffer-mbean-period :deep(.ant-btn) { padding-inline:6px; font-size:var(--fs-caption,12px); }
</style>

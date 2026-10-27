<template>
  <MBeanSemanticMetrics :metrics="metrics" />
  <div v-if="hasBuffer" class="event-capacity">
    <span>{{ t('runtimeDiagnostics.mbeanSummary.bufferCapacity') }}</span><strong>{{ capacity.used ?? '—' }} / {{ capacity.limit ?? '—' }}</strong>
    <a-progress v-if="capacity.percent !== undefined" :percent="capacity.percent" :show-info="false" size="small" />
  </div>
  <a-collapse v-if="error" ghost class="event-error"><a-collapse-panel key="latest" :header="t('runtimeDiagnostics.mbeanSummary.latestError')"><pre>{{ error }}</pre></a-collapse-panel></a-collapse>
  <p v-else-if="error === ''" class="event-no-error">{{ t('runtimeDiagnostics.mbeanSummary.noErrorRecord') }}</p>
  <div v-if="options.length" class="event-query">
    <a-select v-model:value="queryId" :options="options" :disabled="context?.busy.value" :aria-label="t('runtimeDiagnostics.mbeanSummary.queryType')" />
    <a-input v-if="queryId === 'eventSubscribers'" v-model:value="topic" :placeholder="t('runtimeDiagnostics.mbeanSummary.topic')" :disabled="disabled" @press-enter="query" />
    <a-input-number v-else v-model:value="limit" :min="1" :max="200" :precision="0" :disabled="disabled" :aria-label="t('runtimeDiagnostics.mbeanSummary.limit')" />
    <a-button type="primary" :disabled="disabled || (queryId === 'eventSubscribers' && !topic.trim())" :loading="context?.busy.value" :title="context?.access.value.reason" @click="query">{{ t('runtimeDiagnostics.mbeanSummary.query') }}</a-button>
  </div>
  <MBeanQueryResult :queries="['eventSubscribers', 'structuredSubscriptions']"><template #default="{ result }">
    <a-table v-if="records(result)" :data-source="records(result)!" :columns="columns(result)" :pagination="false" :scroll="{ x: 'max-content', y: 360 }" size="small" :row-key="(_record: unknown, index?: number) => index ?? 0">
      <template #bodyCell="{ column, record }"><span>{{ cellValue(record, column.dataIndex) }}</span></template>
      <template #expandedRowRender="{ record }"><CodeBlock :content="formatValue(record)" variant="light" /></template>
    </a-table>
    <CodeBlock v-else :content="formatValue(result)" variant="light" />
  </template></MBeanQueryResult>
</template>
<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../../CodeBlock/index.vue'
import type { MBeanDescriptor, MBeanQueryId } from '../types'
import { formatValue } from '../utils'
import { useMBeanRendererContext } from './context'
import { mbeanAttributeValue, mbeanBufferCapacity, mbeanErrorRecord, mbeanResultRecords, mbeanSemanticMetrics } from './semantic'
import MBeanSemanticMetrics from './MBeanSemanticMetrics.vue'
import MBeanQueryResult from './MBeanQueryResult.vue'
const props = defineProps({ bean: { type: Object as PropType<MBeanDescriptor>, required: true } })
const { t } = useI18n(), context = useMBeanRendererContext()
const queryId = ref<MBeanQueryId>('eventSubscribers'), topic = ref(''), limit = ref<number | undefined>(20)
const metrics = computed(() => mbeanSemanticMetrics(props.bean)), capacity = computed(() => mbeanBufferCapacity(props.bean))
const hasBuffer = computed(() => props.bean.attributes.some(item => item.available && ['StructuredBufferedEventCount', 'StructuredBufferedEventLimit'].includes(item.name)))
const error = computed(() => mbeanErrorRecord(mbeanAttributeValue(props.bean, 'StructuredLastError')))
const options = computed(() => (context?.availableQueries.value ?? []).filter(id => id === 'eventSubscribers' || id === 'structuredSubscriptions').map(value => ({ value, label: t(`runtimeDiagnostics.mbeanSummary.${value}`) })))
const disabled = computed(() => !context?.access.value.allowed || context.busy.value)
watch(options, value => { if (!value.some(item => item.value === queryId.value) && value[0]) queryId.value = value[0].value }, { immediate: true })
function query() { if (!disabled.value) void context?.query(queryId.value, [queryId.value === 'eventSubscribers' ? topic.value : String(limit.value ?? '')]) }
const records = mbeanResultRecords
function columns(value: unknown) {
  const rows = records(value) ?? [], keys = [...new Set(rows.flatMap(row => Object.keys(row)))]
  const preferred = ['subscriber', 'id', 'clusterServerId', 'topics', 'topic', 'priority', 'buffered', 'requested', 'in', 'out', 'error', 'dropped']
  const visible = [...preferred.filter(key => keys.includes(key)), ...keys.filter(key => !preferred.includes(key))].slice(0, 10)
  return visible.map(key => ({ title: t(`runtimeDiagnostics.mbeanSummary.event.${key}`, key), dataIndex: key, key }))
}
function cell(value: unknown) { return typeof value === 'number' && value < 0 ? '—' : Array.isArray(value) ? value.map(formatValue).join(', ') : formatValue(value) }
function cellValue(record: Record<string, unknown>, key: unknown) { return cell(typeof key === 'string' ? record[key] : undefined) }
</script>
<style scoped>
.event-capacity { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-block:12px; }
.event-capacity > span { color:var(--ink-3); font-size:12px; }.event-capacity :deep(.ant-progress) { flex:1; min-width:120px; max-width:360px; margin:0; }
.event-error { margin-block:8px; }.event-error :deep(.ant-collapse-header) { padding:4px 0; color:var(--ink-3); font-size:12px; }.event-error pre { white-space:pre-wrap; overflow-wrap:anywhere; max-height:200px; overflow:auto; }
.event-no-error { color:var(--ink-3); font-size:12px; margin-block:8px; }
.event-query { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }.event-query :deep(.ant-select) { min-width:155px; }.event-query :deep(.ant-input) { flex:1; min-width:160px; max-width:380px; }
</style>

<template>
  <div v-if="available.length" class="broker-query">
    <a-button v-if="available.includes('brokerAll')" type="primary" :disabled="disabled" :loading="context?.busy.value" :title="context?.access.value.reason" @click="context?.query('brokerAll', [])">{{ t('runtimeDiagnostics.mbeanSummary.loadListeners') }}</a-button>
    <a-input v-model:value="name" :placeholder="t('runtimeDiagnostics.mbeanSummary.listenerName')" :disabled="context?.busy.value" @press-enter="queryName" />
    <a-button v-if="available.includes('brokerByName')" :type="available.includes('brokerAll') ? 'default' : 'primary'" :disabled="disabled || !name.trim()" :title="context?.access.value.reason" @click="queryName">{{ t('runtimeDiagnostics.mbeanSummary.query') }}</a-button>
    <a-tooltip :title="t('runtimeDiagnostics.mbeanSummary.listenerTimingHint')"><InfoCircleOutlined /></a-tooltip>
  </div>
  <MBeanQueryResult :queries="['brokerAll', 'brokerByName']"><template #default="{ result }">
    <template v-if="records(result)">
      <div class="broker-result-toolbar"><span>{{ t('runtimeDiagnostics.mbeanSummary.listenerCount', { count: filtered(result).length }) }}</span><a-input v-model:value="filter" allow-clear :placeholder="t('runtimeDiagnostics.mbeanSummary.filterListeners')" /></div>
      <a-empty v-if="!filtered(result).length" :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="t('runtimeDiagnostics.noMatches')" />
      <div v-else class="broker-list">
        <div v-for="(listener, index) in filtered(result)" :key="`${listener.name}-${index}`" class="broker-listener">
          <div class="broker-listener-heading"><strong>{{ formatValue(listener.name) }}</strong><a-tag v-if="typeof listener.enabled === 'boolean'" :color="listener.enabled ? 'green' : 'default'">{{ t(`runtimeDiagnostics.mbeanSummary.${listener.enabled ? 'enabled' : 'disabled'}`) }}</a-tag><span v-if="slowCalls(listener.summary)">{{ t('runtimeDiagnostics.mbeanSummary.slowCalls') }} {{ slowCalls(listener.summary)!.percent.toFixed(1) }}%</span><span>{{ t('runtimeDiagnostics.mbeanSummary.terminalCalls') }} {{ count(listener.total) }}</span></div>
          <p class="broker-topic">{{ Array.isArray(listener.topic) ? listener.topic.map(formatValue).join(', ') : formatValue(listener.topic) }}</p>
          <template v-if="slowCalls(listener.summary)">
            <div class="broker-distribution" role="img" :aria-label="timingLabel(listener.summary)"><a-tooltip v-for="bucket in buckets(listener.summary)" :key="bucket.label" :title="`${bucket.label}: ${bucket.count} (${bucket.percent.toFixed(1)}%)`"><span v-if="bucket.percent" :style="{ width: `${bucket.percent}%` }" :class="{ 'broker-slow': bucket.label === '>1000 ms' }" /></a-tooltip></div>
            <div class="broker-buckets"><span v-for="bucket in buckets(listener.summary)" :key="bucket.label">{{ bucket.label }} <b>{{ bucket.count }}</b></span></div>
          </template>
          <CodeBlock v-else-if="!buckets(listener.summary) && listener.summary !== undefined" :content="formatValue(listener.summary)" variant="light" />
        </div>
      </div>
    </template>
    <CodeBlock v-else :content="formatValue(result)" variant="light" />
  </template></MBeanQueryResult>
</template>
<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { Empty } from 'ant-design-vue'
import { InfoCircleOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import CodeBlock from '../../CodeBlock/index.vue'
import { formatValue } from '../utils'
import { useMBeanRendererContext } from './context'
import type { MBeanDescriptor } from '../types'
import { brokerTimingBuckets, brokerSlowCalls, brokerListenerRows, nonnegativeNumber } from './semantic'
import MBeanQueryResult from './MBeanQueryResult.vue'
defineProps({ bean: { type: Object as PropType<MBeanDescriptor>, required: true } })
const { t } = useI18n(), context = useMBeanRendererContext(), name = ref(''), filter = ref('')
const available = computed(() => context?.availableQueries.value ?? []), disabled = computed(() => !context?.access.value.allowed || context.busy.value)
const records = brokerListenerRows, buckets = brokerTimingBuckets, slowCalls = brokerSlowCalls
function queryName() { if (name.value.trim()) void context?.query('brokerByName', [name.value]) }
function filtered(value: unknown) { return brokerListenerRows(value, filter.value) ?? [] }
function count(value: unknown) { return nonnegativeNumber(value) === undefined ? '—' : String(value) }
function timingLabel(value: unknown) { return (buckets(value) ?? []).map(bucket => `${bucket.label}: ${bucket.count}`).join(', ') }
</script>
<style scoped>
.broker-query,.broker-result-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }.broker-query :deep(.ant-input) { flex:1; min-width:160px; max-width:360px; }
.broker-query > .anticon,.broker-result-toolbar { color:var(--ink-3); font-size:var(--fs-caption,12px); }.broker-result-toolbar { justify-content:space-between; margin-bottom:8px; }.broker-result-toolbar :deep(.ant-input-affix-wrapper) { max-width:260px; }
.broker-list { max-height:430px; overflow:auto; scrollbar-gutter:stable; }.broker-listener { padding:12px 0; border-bottom:1px solid var(--line); }
.broker-listener-heading { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }.broker-listener-heading strong { overflow-wrap:anywhere; }.broker-listener-heading > span:last-child,.broker-topic { color:var(--ink-3); font-size:var(--fs-caption,12px); }.broker-topic { margin:4px 0 8px; overflow-wrap:anywhere; }
.broker-distribution { display:flex; height:8px; background:var(--bg-sunken); border-radius:4px; overflow:hidden; }.broker-distribution span { height:100%; background:var(--primary-color); opacity:.7; border-inline-end:1px solid var(--bg-base); }.broker-distribution .broker-slow { background:var(--warning); opacity:1; }
.broker-buckets { display:flex; flex-wrap:wrap; gap:4px 12px; margin-top:6px; font-size:var(--fs-caption,12px); color:var(--ink-3); }.broker-buckets b { color:var(--ink); font-weight:500; }
</style>

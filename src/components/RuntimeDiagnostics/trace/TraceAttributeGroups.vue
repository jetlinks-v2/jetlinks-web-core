<template>
  <div v-if="groups.length" class="trace-attributes">
    <component :is="group.key === 'runtime' ? 'details' : 'section'" v-for="group in groups" :key="group.key" class="trace-attribute-group" :class="{ 'trace-attribute-group--technical': group.key === 'runtime' }" :data-trace-group="group.key" :open="group.key === 'runtime' ? technicalOpen : undefined" @toggle="group.key === 'runtime' ? toggleTechnical($event) : undefined">
      <summary v-if="group.key === 'runtime'" class="trace-attribute-title">{{ t($slots.technical ? 'runtimeDiagnostics.traceIdentity' : 'runtimeDiagnostics.traceTechnicalAttributes') }} <span v-if="!$slots.technical">{{ group.entries.length }}</span></summary>
      <div v-else-if="group.entries.length > 1" class="trace-attribute-title">{{ t(`runtimeDiagnostics.traceAttributeGroup.${group.key}`) }}</div>
      <dl v-if="group.entries.length" class="trace-attribute-grid">
        <template v-for="entry in group.entries" :key="entry.key">
          <dt :title="entry.key">{{ attributeLabel(entry.key) }}</dt>
          <dd :data-trace-attribute="entry.key" :class="{ 'trace-attribute-focused': focusedKey === entry.key, 'trace-attribute-result': ['http.response.status_code', 'http.status_code'].includes(entry.key) }">
            <div class="trace-attribute-value">
              <a-typography-text :copyable="{ text: formatValue(entry.value) }">{{ valuePreview(entry.value) }}</a-typography-text>
              <a-button v-if="expandable(entry.value)" type="link" size="small" :aria-expanded="expanded.has(entry.key)" @click="toggle(entry.key)">{{ t(expanded.has(entry.key) ? 'runtimeDiagnostics.collapseAttribute' : 'runtimeDiagnostics.expandAttribute') }}</a-button>
            </div>
            <pre v-if="expanded.has(entry.key)" class="trace-attribute-content">{{ formatValue(entry.value) }}</pre>
          </dd>
        </template>
      </dl>
      <slot v-if="group.key === 'runtime'" name="technical" />
    </component>
  </div>
</template>
<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatValue } from '../utils'
import { formatTraceAttribute, groupTraceAttributes } from '../tracePresentation'
const props = defineProps<{ attributes?: Record<string, unknown>; focusedKey?: string; focusRevision?: number }>()
const { t, locale } = useI18n()
const slots = getCurrentInstance()?.slots ?? {}
// 链路标识与运行环境共用一个技术信息入口，避免连续的同义折叠标题。
const groups = computed(() => {
  const values = groupTraceAttributes(props.attributes)
  if (!slots.technical) return values
  return [...values.filter(group => group.key !== 'runtime'), values.find(group => group.key === 'runtime') ?? { key: 'runtime' as const, entries: [] }]
}), expanded = ref(new Set<string>()), technicalOpen = ref(false)
watch(() => props.attributes, () => { expanded.value = new Set() })
// 每次证据定位都重新展开目标，包含用户手动收起后再次点击同一入口。
watch(() => [props.focusedKey, props.focusRevision, props.attributes] as const, () => {
  const key = props.focusedKey
  if (key && expandable(props.attributes?.[key])) expanded.value = new Set([...expanded.value, key])
  if (key && groups.value.find(group => group.key === 'runtime')?.entries.some(entry => entry.key === key)) technicalOpen.value = true
}, { immediate: true })
function expandable(value: unknown) { const text = formatValue(value); return typeof value === 'object' && value !== null || text.length > 160 || text.includes('\n') }
function valuePreview(value: unknown) {
  if (typeof value === 'boolean') return t(value ? 'runtimeDiagnostics.traceTrue' : 'runtimeDiagnostics.traceFalse')
  const text = formatTraceAttribute(value, locale.value)
  return expandable(value) ? `${text.replace(/\s+/g, ' ').slice(0, 160)}${text.length > 160 ? '…' : ''}` : text
}
function attributeLabel(key: string) {
  const labels: Record<string, string> = {
    'request.action': 'traceBusinessAction',
    'user.name': 'traceBusinessOperator',
    'user.username': 'traceBusinessAccount',
    'request.ip': 'traceBusinessSourceIp',
    'client.address': 'traceBusinessSourceIp',
    'net.peer.ip': 'traceBusinessSourceIp',
    'http.response.status_code': 'traceField.responseStatus', 'http.status_code': 'traceField.responseStatus',
    'http.request.method': 'traceField.requestMethod', 'http.method': 'traceField.requestMethod',
    'url.full': 'traceField.requestUrl', 'http.url': 'traceField.requestUrl', 'url.path': 'traceField.requestPath', 'http.target': 'traceField.requestPath',
    'server.address': 'traceField.serverAddress', 'server.port': 'traceField.serverPort',
    'network.protocol.name': 'traceField.protocol', 'network.protocol.version': 'traceField.protocolVersion',
    'db.system': 'traceField.databaseSystem', 'db.system.name': 'traceField.databaseSystem',
    'db.name': 'traceField.databaseName', 'db.namespace': 'traceField.databaseName',
    'db.operation': 'traceField.databaseOperation', 'db.operation.name': 'traceField.databaseOperation',
    'db.statement': 'traceField.sql', 'db.query.text': 'traceField.sql', sql: 'traceField.sql',
    'flux-next-count': 'traceField.outputCount', 'thread.name': 'traceField.threadName', 'thread.id': 'traceField.threadId',
    'code.function': 'traceField.function', 'code.function.name': 'traceField.function', 'code.namespace': 'traceField.namespace',
    'user.id': 'traceField.userId', 'user.type': 'traceField.userType',
    'exception.type': 'traceField.exceptionType', 'exception.message': 'traceField.exceptionMessage', 'exception.stacktrace': 'traceField.exceptionStack',
  }
  const label = labels[key]
  return label ? t(`runtimeDiagnostics.${label}`) : key
}
function toggleTechnical(event: Event) { technicalOpen.value = (event.currentTarget as HTMLDetailsElement).open }
function toggle(key: string) { const next = new Set(expanded.value); next.has(key) ? next.delete(key) : next.add(key); expanded.value = next }
</script>
<style scoped>
.trace-attributes { min-width:0; container-type:inline-size; }
.trace-attribute-group { min-width:0; }
.trace-attribute-group + .trace-attribute-group { margin-top:var(--space-2,8px); padding-top:var(--space-2,8px); border-top:1px solid var(--line); }
.trace-attribute-title { font-size:var(--fs-sm,13px); font-weight:600; color:var(--ink-2); margin-bottom:var(--space-1,4px); }
.trace-attribute-group--technical > summary { cursor:pointer; list-style-position:inside; }.trace-attribute-group--technical > summary::-webkit-details-marker { color:var(--ink-3); }
.trace-attribute-title > span { margin-inline-start:var(--space-1,4px); color:var(--ink-3); font-weight:normal; }
.trace-attribute-grid { display:grid; grid-template-columns:minmax(100px,160px) minmax(0,1fr); gap:var(--space-1,4px) var(--space-3,12px); margin:0; font-size:var(--fs-sm,13px); line-height:1.6; }
.trace-attribute-grid dt { color:var(--ink-2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-block:2px; }
.trace-attribute-grid dd { margin:0; min-width:0; overflow-wrap:anywhere; padding-block:2px; }
.trace-attribute-value { display:flex; flex-wrap:wrap; align-items:baseline; gap:2px var(--space-2,8px); min-width:0; }
.trace-attribute-value :deep(.ant-typography) { min-width:0; max-width:100%; margin:0; overflow-wrap:anywhere; }
.trace-attribute-value :deep(.ant-btn) { font-size:var(--fs-12,12px); padding:0; height:auto; line-height:inherit; }
.trace-attribute-content { max-height:260px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; margin:var(--space-1,4px) 0 0; padding:var(--space-1,4px) var(--space-2,8px); background:var(--bg-sunken); color:var(--ink-2); font:inherit; font-family:monospace; }
.trace-attribute-focused { background:var(--accent-soft); border-radius:var(--r-1,3px); }
.trace-attribute-result :deep(.ant-typography) { font-weight:600; color:var(--ink-1); }
.trace-attribute-group--technical :deep(.span-identity) { margin-top:var(--space-2,8px); }
@container(max-width:480px) { .trace-attribute-grid { grid-template-columns:minmax(0,1fr); row-gap:0; }.trace-attribute-grid dt { padding-bottom:0; }.trace-attribute-grid dd { padding-bottom:var(--space-2,8px); } }
</style>

<template>
  <section class="span-details" :aria-label="t('runtimeDiagnostics.spanDetails')">
    <div class="span-heading"><time v-if="startedAt">{{ startedAt }}</time><span v-else>{{ t('runtimeDiagnostics.unknownTime') }}</span><span>{{ t('runtimeDiagnostics.duration') }} <strong :title="durationNanos === undefined ? undefined : `${durationNanos} ns`">{{ durationLabel }}</strong></span><a-space wrap class="span-actions"><a-tooltip :title="nodeHint" :trigger="['hover', 'focus']"><span :tabindex="canNode ? -1 : 0" :aria-label="nodeHint"><a-button type="link" size="small" :disabled="!canNode" @click="node">{{ t('runtimeDiagnostics.viewNode') }}</a-button></span></a-tooltip><a-tooltip :title="logsHint" :trigger="['hover', 'focus']"><span :tabindex="canLogs ? -1 : 0" :aria-label="logsHint"><a-button type="link" size="small" :disabled="!canLogs" @click="logs">{{ t('runtimeDiagnostics.relatedLogs') }}</a-button></span></a-tooltip></a-space><a-button v-if="closable" type="text" size="small" :aria-label="t('runtimeDiagnostics.closeDetails')" @click="emit('close')"><template #icon><CloseOutlined /></template></a-button></div>
    <div ref="body" class="span-evidence-body">
      <section v-if="exceptions.length" data-trace-section="exception">
        <div v-for="(event, index) in exceptions" :key="index" class="span-exception">
          <div class="span-exception-summary"><strong v-if="event.attributes?.['exception.type']">{{ event.attributes['exception.type'] }}</strong><span>{{ event.attributes?.['exception.message'] ?? event.name }}</span><small v-if="event.epochNanos">{{ formatTraceTimestamp(event.epochNanos, locale) ?? t('runtimeDiagnostics.unknownTime') }}</small></div>
          <a-button v-if="event.attributes?.['exception.stacktrace']" type="link" size="small" :aria-expanded="stacks.has(index)" @click="toggleStack(index)">{{ t(stacks.has(index) ? 'runtimeDiagnostics.collapseStack' : 'runtimeDiagnostics.expandErrorStack') }}</a-button>
          <CodeBlock v-if="stacks.has(index)" :content="formatValue(event.attributes?.['exception.stacktrace'])" variant="light" copyable :copy-title="t('runtimeDiagnostics.copyStack')" :wrap="false" />
          <TraceAttributeGroups v-if="otherExceptionAttributes(event)" :attributes="otherExceptionAttributes(event)" />
        </div>
      </section>
      <section class="span-attributes" data-trace-section="attributes">
        <TraceAttributeGroups :attributes="span.attributes" :focused-key="focus?.attributeKey" :focus-revision="focus?.revision">
          <template #technical>
            <dl class="span-identity">
              <dt>Trace ID</dt><dd><a-typography-text copyable>{{ span.traceId }}</a-typography-text></dd>
              <dt>Span ID</dt><dd><a-typography-text copyable>{{ span.id }}</a-typography-text></dd>
              <template v-if="span.parentId"><dt>Parent Span ID</dt><dd><a-typography-text copyable>{{ span.parentId }}</a-typography-text></dd></template>
              <dt>{{ t('runtimeDiagnostics.node') }}</dt><dd><a-typography-text v-if="span.nodeId" copyable>{{ span.nodeId }}</a-typography-text><span v-else>{{ t('runtimeDiagnostics.unknownNode') }}</span></dd>
              <template v-if="span.app"><dt>{{ t('runtimeDiagnostics.instrumentationScope') }}</dt><dd><a-typography-text copyable>{{ span.app }}</a-typography-text></dd></template>
              <dt>{{ t('runtimeDiagnostics.startNanos') }}</dt><dd><a-typography-text copyable>{{ span.startNanos || '—' }}</a-typography-text></dd>
              <dt>{{ t('runtimeDiagnostics.traceEndNanos') }}</dt><dd><a-typography-text copyable>{{ span.endNanos || '—' }}</a-typography-text></dd>
            </dl>
          </template>
        </TraceAttributeGroups>
      </section>
      <section v-if="regularEvents.length" data-trace-section="events" class="span-events">
        <div class="span-section-title">{{ t('runtimeDiagnostics.events') }} ({{ regularEvents.length }})</div>
        <div v-for="(event, index) in regularEvents" :key="index" class="span-event"><div class="span-event-heading"><strong>{{ event.name }}</strong><a-typography-text v-if="event.epochNanos" :copyable="{ text: event.epochNanos }" :title="`${event.epochNanos} ns`">{{ formatTraceTimestamp(event.epochNanos, locale) ?? t('runtimeDiagnostics.unknownTime') }}</a-typography-text><small v-if="offset(event)">+{{ offset(event) }}</small></div><TraceAttributeGroups :attributes="event.attributes" /></div>
      </section>
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloseOutlined } from '@ant-design/icons-vue'
import CodeBlock from '../CodeBlock/index.vue'
import TraceAttributeGroups from './trace/TraceAttributeGroups.vue'
import { formatValue, nanosBetween } from './utils'
import { defaultTraceEvidence, exceptionEvents, formatTraceDuration, formatTraceTimestamp, traceNanosecondDelta, type TraceDetailFocus } from './tracePresentation'
import type { ActionAccess, TraceEvent, TraceSpan } from './types'
const props = withDefaults(defineProps<{ span: TraceSpan; focus?: TraceDetailFocus; logAccess?: ActionAccess; nodeAccess?: ActionAccess; closable?: boolean }>(), { logAccess: () => ({ allowed: false }), nodeAccess: () => ({ allowed: false }), closable: false })
const emit = defineEmits<{ (event: 'logs' | 'node', span: TraceSpan): void; (event: 'close'): void }>()
const { t, locale } = useI18n()
const body = ref<HTMLElement>(), exceptions = computed(() => exceptionEvents(props.span)), regularEvents = computed(() => props.span.events?.filter(event => event.name !== 'exception') ?? [])
const durationNanos = computed(() => traceNanosecondDelta(props.span.startNanos, props.span.endNanos))
const canNode = computed(() => props.nodeAccess.allowed && !!props.span.nodeId), canLogs = computed(() => props.logAccess.allowed && !!props.span.nodeId)
const nodeHint = computed(() => !props.span.nodeId ? t('runtimeDiagnostics.traceNodeUnavailable') : canNode.value ? t('runtimeDiagnostics.viewNode') : props.nodeAccess.reason || t('runtimeDiagnostics.forbidden'))
const logsHint = computed(() => !props.span.nodeId ? t('runtimeDiagnostics.traceNodeUnavailable') : canLogs.value ? t('runtimeDiagnostics.relatedLogs') : props.logAccess.reason || t('runtimeDiagnostics.forbidden'))
const durationLabel = computed(() => formatTraceDuration(nanosBetween(props.span.startNanos, props.span.endNanos), locale.value) ?? t('runtimeDiagnostics.unknownTime'))
const startedAt = computed(() => formatTraceTimestamp(props.span.startNanos, locale.value))
const stacks = ref(new Set<number>())
watch(() => [props.span.traceId, props.span.id, props.span.app].join('\0'), () => { stacks.value = new Set() }, { immediate: true })
watch(() => [props.focus?.revision, props.span.traceId, props.span.id], async () => {
  const kind = props.focus?.kind ?? defaultTraceEvidence(props.span)
  if (kind === 'exception') { const index = exceptions.value.findIndex(event => !!event.attributes?.['exception.stacktrace']); if (index >= 0) stacks.value = new Set([...stacks.value, index]) }
  await nextTick()
  const attribute = props.focus?.attributeKey
  const target = attribute ? Array.from(body.value?.querySelectorAll<HTMLElement>('.span-attributes [data-trace-attribute]') ?? []).find(element => element.dataset.traceAttribute === attribute)
    : ['database', 'network', 'runtime'].includes(kind) ? body.value?.querySelector<HTMLElement>(`.span-attributes [data-trace-group="${kind}"]`) : body.value?.querySelector<HTMLElement>(`[data-trace-section="${kind}"]`)
  if (target && body.value) body.value.scrollTop += target.getBoundingClientRect().top - body.value.getBoundingClientRect().top
}, { immediate: true })
function otherExceptionAttributes(event: TraceEvent) { const values = Object.fromEntries(Object.entries(event.attributes ?? {}).filter(([key]) => !['exception.type', 'exception.message', 'exception.stacktrace'].includes(key))); return Object.keys(values).length ? values : undefined }
function toggleStack(index: number) { const next = new Set(stacks.value); next.has(index) ? next.delete(index) : next.add(index); stacks.value = next }
function offset(event: TraceEvent) { return event.epochNanos ? formatTraceDuration(nanosBetween(props.span.startNanos, event.epochNanos), locale.value) : undefined }
function logs() { if (canLogs.value) emit('logs', props.span) }
function node() { if (canNode.value) emit('node', props.span) }
</script>
<style scoped>
.span-details { min-width:0; overflow-wrap:anywhere; color:var(--ink-1); }
.span-heading,.span-event-heading { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-2,8px); }
.span-heading { font-size:var(--fs-12,12px); margin-bottom:var(--space-2,8px); }.span-heading time,.span-event-heading time,.span-event-heading small { color:var(--ink-2); }
.span-actions { margin-inline-start:auto; }
.span-details :deep(.ant-typography) { min-width:0; overflow-wrap:anywhere; }
.span-evidence-body { max-height:420px; overflow:auto; overscroll-behavior:contain; padding-inline-end:var(--space-1,4px); }
.span-details :deep(.code-block) { max-height:260px; overflow:auto; margin-block:var(--space-1,4px); }
.span-exception { padding-block:var(--space-1,4px); }.span-exception-summary { display:flex; flex-wrap:wrap; align-items:baseline; gap:var(--space-2,8px); color:var(--danger); }
.span-exception-summary small { color:var(--ink-2); }.span-exception > .ant-btn { padding-inline:0; }.span-event { padding-block:var(--space-2,8px); border-bottom:1px solid var(--line); }
.span-event:last-child { border-bottom:0; }.span-section-title { font-size:var(--fs-sm,13px); color:var(--ink-2); font-weight:600; }.span-events { margin-top:var(--space-2,8px); }
.span-identity { display:grid; grid-template-columns:minmax(100px,160px) minmax(0,1fr) minmax(100px,160px) minmax(0,1fr); gap:var(--space-1,4px) var(--space-3,12px); margin:var(--space-2,8px) 0 0; font-size:var(--fs-sm,13px); line-height:1.6; }
.span-identity dt { color:var(--ink-2); font-size:var(--fs-12,12px); white-space:nowrap; }
.span-identity dd { min-width:0; margin:0; overflow-wrap:anywhere; }
@container(max-width:720px) { .span-identity { grid-template-columns:minmax(100px,160px) minmax(0,1fr); } }
@container(max-width:480px) { .span-identity { grid-template-columns:minmax(0,1fr); row-gap:0; }.span-identity dd { padding-bottom:var(--space-2,8px); } }
</style>

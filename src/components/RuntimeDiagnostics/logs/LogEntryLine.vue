<template>
  <div class="log-entry" :class="{ 'log-entry-wrap': wrap }">
    <time class="log-time" :title="entry.time">{{ logTimeLabel(entry.time ?? '') }}</time>
    <span class="log-level" :class="levelClass">{{ entry.level }}</span>
    <div class="log-content">
      <div class="log-entry-main"><a-tooltip v-if="entry.thread" :title="entry.thread"><span class="log-thread">[{{ entry.thread }}]</span></a-tooltip><span class="log-message"><template v-for="(part, index) in parts" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></span></div>
      <div v-if="preview.collapsible || view.stack" class="log-expansion-actions"><a-button v-if="preview.collapsible" class="log-stack-toggle" size="small" type="link" :aria-expanded="messageOpen" @click="toggleMessage">{{ t(messageOpen ? 'runtimeDiagnostics.collapseMessage' : 'runtimeDiagnostics.expandMessage') }}</a-button><a-button v-if="view.stack" class="log-stack-toggle" size="small" type="link" :aria-expanded="stackOpen" @click="toggleStack">{{ stackOpen ? t('runtimeDiagnostics.collapseStack') : t('runtimeDiagnostics.stackLines', { count: view.stack.split('\n').length }) }}</a-button></div>
      <pre v-if="view.stack && stackOpen" class="log-stack" :class="{ 'log-stack-nowrap': !wrap }"><template v-for="(part, index) in stackParts" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template></pre>
    </div>
    <div class="log-entry-actions"><a-button size="small" type="text" :title="t('runtimeDiagnostics.logDetails')" :aria-label="t('runtimeDiagnostics.logDetails')" :aria-expanded="expanded" @click="emit('inspect')"><FileTextOutlined /></a-button><a-button v-if="entry.traceId" type="link" size="small" :disabled="!traceAccess.allowed" :title="traceAccess.reason || entry.traceId" @click="trace">{{ t('runtimeDiagnostics.trace') }}</a-button></div>
    <LogEntryDetails v-if="expanded" class="log-expanded-content" :entry="entry" :query="query" :wrap="wrap" />
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import { FileTextOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import LogEntryDetails from './LogEntryDetails.vue'
import type { ActionAccess, LogEntry } from '../types'
import { logHighlight, logMessagePreview, logPresentation, logTimeLabel } from './presentation'
const props = defineProps({ entry: { type: Object as PropType<LogEntry>, required: true }, query: { type: String, default: '' }, wrap: { type: Boolean, default: true }, expanded: { type: Boolean, default: false }, activeMatch: { type: Boolean, default: false }, traceAccess: { type: Object as PropType<ActionAccess>, default: () => ({ allowed: false }) } })
const emit = defineEmits<{ (event: 'trace', traceId: string): void; (event: 'inspect' | 'reading'): void }>()
const { t } = useI18n()
const stackOpen = ref(false), messageOpen = ref(false)
const view = computed(() => logPresentation(props.entry))
const preview = computed(() => logMessagePreview(view.value.message, messageOpen.value))
const levelClass = computed(() => /^(ERROR|FATAL)$/.test(props.entry.level ?? '') ? 'log-level-error' : props.entry.level === 'WARN' ? 'log-level-warning' : props.entry.level === 'INFO' ? 'log-level-info' : '')
const parts = computed(() => logHighlight(preview.value.text, props.query))
const stackParts = computed(() => logHighlight(view.value.stack, props.query))
watch([() => props.query, () => props.activeMatch], ([query, active]) => {
  if (!active || !query) return
  if (view.value.stack.toLowerCase().includes(query.toLowerCase())) stackOpen.value = true
  if (view.value.message.toLowerCase().includes(query.toLowerCase())) messageOpen.value = true
}, { immediate: true })
function toggleStack() { emit('reading'); stackOpen.value = !stackOpen.value }
function toggleMessage() { emit('reading'); messageOpen.value = !messageOpen.value }
function trace() { if (props.traceAccess.allowed && props.entry.traceId) emit('trace', props.entry.traceId) }
</script>
<style scoped>
.log-entry { display:grid; grid-template-columns:96px 44px minmax(0,1fr) auto; gap:8px; min-width:0; width:100%; font:var(--fs-sm,13px)/var(--lh-relaxed,1.65) var(--font-mono,monospace); align-items:start; }
.log-time { color:var(--ink-3); white-space:nowrap; font-size:var(--fs-caption,12px); overflow:hidden; text-overflow:ellipsis; }
.log-level { font-size:var(--fs-caption,12px); font-weight:600; }.log-level-error { color:var(--diagnostic-log-error); }.log-level-warning { color:var(--diagnostic-log-warning); }.log-level-info { color:var(--diagnostic-log-info); }
.log-content { min-width:0; }.log-entry-main { display:flex; gap:8px; align-items:baseline; }
.log-thread { display:block; width:110px; flex:none; color:var(--ink-3); font-size:var(--fs-caption,12px); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.log-message { flex:1; min-width:0; white-space:pre; overflow:auto; }
.log-entry-wrap .log-message { white-space:pre-wrap; overflow-wrap:anywhere; overflow:visible; }
.log-entry-actions { display:flex; align-items:center; white-space:nowrap; }.log-entry-actions :deep(.ant-btn) { padding-inline:4px; height:22px; }
.log-stack-toggle { display:block; padding-inline:0; height:22px; font-size:var(--fs-caption,12px); }
.log-expansion-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.log-stack { margin:4px 0; color:var(--ink-2); font:inherit; font-size:var(--fs-caption,12px); white-space:pre-wrap; overflow-wrap:anywhere; }.log-stack-nowrap { white-space:pre; overflow:auto; overflow-wrap:normal; }
.log-expanded-content { grid-column:1 / -1; }
.log-entry mark { color:inherit; background:var(--diagnostic-log-highlight); border-radius:2px; }
@container(max-width:900px) { .log-thread { display:none; } }
@container(max-width:600px) { .log-entry { grid-template-columns:96px 44px minmax(0,1fr) auto; gap:5px; }.log-time { font-size:var(--fs-caption,12px); }.log-entry-actions { flex-direction:column; } }
</style>

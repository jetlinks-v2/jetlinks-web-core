<template>
  <section ref="root" class="trace-viewer">
    <DiagnosticsState :state="displayState" @retry="emit('refresh')">
      <div v-if="rows.length" class="trace-controls"><div class="trace-summary">
        <strong>{{ formatTraceDuration(summary.duration, locale) ?? t('runtimeDiagnostics.unknownTime') }}</strong>
        <span>{{ t('runtimeDiagnostics.returnedSpans', { count: rows.length }) }}</span>
        <span>{{ summary.nodes }} {{ t('runtimeDiagnostics.nodes') }}</span>
        <a-tag :color="summary.exceptions ? 'error' : undefined">{{ summary.exceptions ? t('runtimeDiagnostics.exceptionSpans', { count: summary.exceptions }) : t('runtimeDiagnostics.noRecordedException') }}</a-tag>
        <a-tooltip v-if="summary.malformed" :title="t('runtimeDiagnostics.traceStructureHint')"><a-tag color="warning">{{ t('runtimeDiagnostics.structuralSpans', { count: summary.malformed }) }}</a-tag></a-tooltip>
        <a-tooltip :title="t('runtimeDiagnostics.observedTraceHint')"><InfoCircleOutlined class="trace-info" tabindex="0" :aria-label="t('runtimeDiagnostics.observedRange')" /></a-tooltip>
      </div>
      <div class="trace-toolbar">
        <a-input-search v-if="searchOpen" ref="searchInput" v-model:value="search" size="small" :placeholder="t('runtimeDiagnostics.traceFind')" allow-clear @search="nextMatch" @keydown.esc.stop.prevent="closeSearch" />
        <a-tooltip :title="t('runtimeDiagnostics.traceFind')"><a-button ref="searchButton" type="text" size="small" :aria-expanded="searchOpen" :aria-label="t('runtimeDiagnostics.traceFind')" @click="toggleSearch"><template #icon><SearchOutlined /></template></a-button></a-tooltip>
        <a-tooltip v-if="search" :title="matches.length ? t('runtimeDiagnostics.nextMatch') : t('runtimeDiagnostics.noMatches')" :trigger="['hover', 'focus']"><span :tabindex="matches.length ? -1 : 0" :aria-label="matches.length ? t('runtimeDiagnostics.nextMatch') : t('runtimeDiagnostics.noMatches')"><a-button type="text" size="small" :disabled="!matches.length" @click="nextMatch">{{ t('runtimeDiagnostics.nextMatch') }} ({{ matches.length }})</a-button></span></a-tooltip>
        <a-tooltip :title="summary.exceptions ? t('runtimeDiagnostics.nextException') : t('runtimeDiagnostics.noRecordedException')" :trigger="['hover', 'focus']"><span :tabindex="summary.exceptions ? -1 : 0" :aria-label="summary.exceptions ? t('runtimeDiagnostics.nextException') : t('runtimeDiagnostics.noRecordedException')"><a-button type="text" size="small" :disabled="!summary.exceptions" @click="nextException">{{ t('runtimeDiagnostics.nextException') }}</a-button></span></a-tooltip>
        <a-tooltip v-if="slowCalls.length" :title="slowCallsHint" :trigger="['hover', 'focus']"><a-button type="text" size="small" @click="nextSlowCall">{{ t('runtimeDiagnostics.traceSlowCalls') }}</a-button></a-tooltip>
        <a-tooltip v-else :title="slowCallsHint" :trigger="['hover', 'focus']"><span class="trace-slow-action" tabindex="0" :aria-label="slowCallsHint"><a-button type="text" size="small" disabled>{{ t('runtimeDiagnostics.traceSlowCalls') }}</a-button></span></a-tooltip>
        <a-button type="text" size="small" @click="toggleAll">{{ t(collapsed.size ? 'runtimeDiagnostics.expandAll' : 'runtimeDiagnostics.collapseAll') }}</a-button>
      </div></div>
      <a-empty v-if="!rows.length" :image="Empty.PRESENTED_IMAGE_SIMPLE"><template #description><div class="trace-empty"><strong>{{ t('runtimeDiagnostics.noTraceRecords') }}</strong><span>{{ t('runtimeDiagnostics.noTraceRecordsHint') }}</span></div></template></a-empty>
      <div v-else class="trace-content">
        <TraceWaterfall :rows="visible" :all-rows="rows" :summary="summary" :collapsed="collapsed" :selected-key="selected?.key" :matched-keys="matchedKeys" :focus-node="focusNode" @toggle="toggle" @select="toggleDetails" @evidence="choose">
          <template #details="{ span }"><TraceSpanDetails :span="span" :focus="detailFocus?.key === span.key ? detailFocus : undefined" :log-access="logAccess" :node-access="nodeAccess" closable @close="emit('select', undefined)" @logs="emit('logs', $event)" @node="emit('node', $event)" /></template>
        </TraceWaterfall>
      </div>
    </DiagnosticsState>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { InfoCircleOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Empty } from 'ant-design-vue'
import DiagnosticsState from './DiagnosticsState.vue'
import TraceWaterfall from './TraceWaterfall.vue'
import TraceSpanDetails from './TraceSpanDetails.vue'
import { traceRows } from './utils'
import { defaultTraceEvidence, exceptionEvents, formatTraceDuration, summarizeTrace, traceEvidenceAttributeKey, traceSlowCalls, visibleTraceRows, type TraceDetailFocus, type TraceEvidenceKind } from './tracePresentation'
import type { TraceRow, TraceSpan, TraceNodeStatus, ViewState, ActionAccess } from './types'
// 覆盖相关旧 props 只保留调用兼容，不根据列表接口推断集群覆盖或节点发现成功。
const props = withDefaults(defineProps<{ active?: boolean; spans?: TraceSpan[]; nodeStatuses?: TraceNodeStatus[]; discoveryStatus?: string; complete?: boolean; selectedId?: string; focusNode?: string; state?: ViewState; logAccess?: ActionAccess; nodeAccess?: ActionAccess }>(), {
  active: true, spans: () => [], nodeStatuses: () => [], selectedId: '', focusNode: '', state: () => ({ status: 'ready' }), logAccess: () => ({ allowed: false }), nodeAccess: () => ({ allowed: false }),
})
const emit = defineEmits<{ (event: 'refresh'): void; (event: 'select', span?: TraceSpan): void; (event: 'logs' | 'node', span: TraceSpan): void }>()
const { t, locale } = useI18n()
const root = ref<HTMLElement>(), search = ref(''), searchOpen = ref(false), searchInput = ref<{ focus?: () => void }>(), searchButton = ref<{ focus?: () => void }>(), collapsed = ref(new Set<string>())
const detailFocus = ref<TraceDetailFocus & { key: string }>()
let focusRevision = 0
const rows = computed(() => traceRows(props.spans))
// 空查询有专用下一步提示；其他状态继续交给 DiagnosticsState 的权限和错误契约。
const displayState = computed<ViewState>(() => props.state.status === 'empty' ? { ...props.state, status: 'ready' } : props.state)
const summary = computed(() => summarizeTrace(rows.value))
const selected = computed(() => rows.value.find(span => span.key === props.selectedId) ?? (rows.value.filter(span => span.id === props.selectedId).length === 1 ? rows.value.find(span => span.id === props.selectedId) : undefined))
const matches = computed(() => search.value.trim() ? rows.value.filter(span => `${span.name} ${span.nodeId ?? ''} ${span.app ?? ''} ${span.id}`.toLowerCase().includes(search.value.trim().toLowerCase())) : [])
const matchedKeys = computed(() => new Set(matches.value.map(row => row.key)))
const visible = computed(() => visibleTraceRows(rows.value, collapsed.value))
const slowCalls = computed(() => traceSlowCalls(rows.value))
const slowCallsHint = computed(() => t(slowCalls.value.length ? 'runtimeDiagnostics.traceSlowCallsHint' : rows.value.length === 1 ? 'runtimeDiagnostics.traceOnlySpanHint' : 'runtimeDiagnostics.traceNoSlowChildrenHint'))
let previousTraceId = '', previousSelectedKey = ''
watch(() => props.spans[0]?.traceId, traceId => { if (traceId && traceId !== previousTraceId) { collapsed.value = new Set(); search.value = ''; searchOpen.value = false; previousSelectedKey = ''; previousTraceId = traceId } }, { immediate: true })
watch(searchOpen, async open => { if (open) { await nextTick(); searchInput.value?.focus?.() } })
// URL 回显与工具栏定位共用展开规则，首次带 Span 定位也可见。
watch(selected, row => { if (row && row.key !== previousSelectedKey) { if (detailFocus.value?.key !== row.key) focusDetails(row); reveal(row); locate(row) }; previousSelectedKey = row?.key ?? '' }, { immediate: true })
function reveal(row: TraceRow) {
  const byKey = new Map(rows.value.map(item => [item.key, item])), next = new Set(collapsed.value)
  let parent = row.parentKey
  while (parent) { next.delete(parent); parent = byKey.get(parent)?.parentKey }
  collapsed.value = next
}
function focusDetails(row: TraceRow, kind = defaultTraceEvidence(row), attributeKey?: string) { detailFocus.value = { key: row.key, kind, attributeKey: attributeKey ?? traceEvidenceAttributeKey(row, kind), revision: ++focusRevision } }
function choose(row: TraceRow, kind?: TraceEvidenceKind, attributeKey?: string) {
  focusDetails(row, kind, attributeKey)
  reveal(row); emit('select', row)
  locate(row)
}
function locate(row: TraceRow) { nextTick(() => { if (!props.active) return; const target = Array.from(root.value?.querySelectorAll<HTMLElement>('[data-span-key]') ?? []).find(element => element.dataset.spanKey === row.key); target?.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }) }
function toggleDetails(row: TraceRow) { if (selected.value?.key === row.key) emit('select', undefined); else choose(row) }
function move(candidates: TraceRow[]) { if (!candidates.length) return; const index = candidates.findIndex(row => row.key === selected.value?.key); choose(candidates[(index + 1) % candidates.length]) }
function nextMatch() { move(matches.value) }
function nextException() { move(rows.value.filter(row => exceptionEvents(row).length > 0)) }
/** 复用选中与展开规则，搜索仅高亮，不改变耗时比较范围或各页签状态。 */
function nextSlowCall() { move(slowCalls.value) }
function toggle(key: string) { const next = new Set(collapsed.value); next.has(key) ? next.delete(key) : next.add(key); collapsed.value = next }
function toggleAll() { collapsed.value = collapsed.value.size ? new Set() : new Set(rows.value.map(row => row.parentKey).filter((key): key is string => !!key)) }
function toggleSearch() { searchOpen.value ? closeSearch() : searchOpen.value = true }
function closeSearch() { searchOpen.value = false; nextTick(() => searchButton.value?.focus?.()) }
</script>
<style scoped>
.trace-viewer { min-width:0; }
.trace-controls { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-2,8px); margin-bottom:var(--space-2,8px); }
.trace-summary,.trace-toolbar { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-2,8px); }
.trace-summary { font-size:var(--fs-12,12px); color:var(--ink-2); }
.trace-summary > strong { font-size:var(--fs-14,14px); color:var(--ink-1); font-weight:600; }
.trace-summary :deep(.ant-tag) { margin:0; font-size:var(--fs-12,12px); line-height:20px; }
.trace-info { color:var(--ink-3); cursor:help; }
.trace-toolbar { margin-inline-start:auto; }
.trace-toolbar .ant-input-search { width:min(100%,200px); }.trace-empty { display:grid; gap:4px; color:var(--ink-3); font-size:12px; }.trace-empty strong { color:var(--ink-1); font-size:13px; }
.trace-toolbar > span:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:var(--r-1,3px); }
.trace-content { min-width:0; }
@media(max-width:640px) { .trace-toolbar { margin-inline-start:0; } }
</style>

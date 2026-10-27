<template>
  <a-table class="trace-waterfall" table-layout="fixed" :columns="columns" :data-source="rows" row-key="key" size="small" :pagination="false" :scroll="{ x: 560, y: 620 }" :custom-row="rowProps" :expanded-row-keys="selectedKey ? [selectedKey] : []" :show-expand-column="false">
    <template #headerCell="{ column }"><div v-if="column.key === 'duration'" ref="axis" class="trace-axis"><span>0 ms</span><span>{{ formatTraceDuration(summary.duration, locale) ?? '—' }}</span></div></template>
    <template #bodyCell="{ column, record }">
      <div v-if="column.key === 'name'" class="trace-operation" :style="rowIndent(record as TraceRow)">
        <a-button v-if="parents.has(record.key)" type="text" size="small" class="trace-toggle" :aria-label="t(collapsed.has(record.key) ? 'runtimeDiagnostics.expandSpan' : 'runtimeDiagnostics.collapseSpan')" @click.stop="emit('toggle', record.key)"><component :is="collapsed.has(record.key) ? RightOutlined : DownOutlined" /></a-button><span v-else class="trace-toggle-space" />
        <div class="trace-label">
          <span class="trace-name" :class="{ 'trace-name--selected': selectedKey === record.key }" :title="record.name">{{ record.name }}</span>
          <div v-if="record.source || record.nodeId || record.app || traceRowSummary(record as TraceRow).length" class="trace-meta">
            <span v-if="record.source" class="trace-source" :title="t('runtimeDiagnostics.traceEdgeSource', { source: record.source.label })"><CloudServerOutlined aria-hidden="true" /><span>{{ t('runtimeDiagnostics.traceEdgeSource', { source: record.source.label }) }}</span></span>
            <span v-if="record.nodeId || record.app" class="trace-node" :title="record.nodeId || record.app" :aria-label="`${t('runtimeDiagnostics.node')}: ${record.nodeId || record.app}`"><span v-if="record.nodeId" class="trace-node-dot" :class="`trace-node-dot--${nodeColorIndex(record.nodeId)}`" /><span class="trace-node-name">{{ record.nodeId || record.app }}</span></span>
            <a-button v-for="item in traceRowSummary(record as TraceRow)" :key="item.type" type="text" size="small" class="trace-summary-item" :class="`trace-summary-item--${item.type}`" :title="summaryLabel(item)" :aria-label="summaryLabel(item)" @click.stop="emit('evidence', record as TraceRow, item.kind, item.attributeKey)"><component :is="summaryIcons[item.type]" class="trace-summary-icon" aria-hidden="true" /><span class="trace-summary-text">{{ summaryText(item) }}</span></a-button>
          </div>
        </div>
        <a-tooltip v-if="record.missingParent || record.ambiguousParent || record.cyclic || record.duplicate" :title="structuralHint(record as TraceRow)"><a-tag color="warning" class="trace-structure">!</a-tag></a-tooltip>
      </div>
      <a-tooltip v-else-if="column.key === 'duration'" :trigger="['hover', 'focus']" :overlay-style="{ pointerEvents: 'none' }" :title="timeHint(record as TraceRow)">
        <div class="trace-time" :class="{ 'trace-time--stacked': labelPlacement(record as TraceRow).position === 'above', 'trace-time--selected': selectedKey === record.key }" tabindex="0" :aria-label="timeHint(record as TraceRow)" @keydown.enter.prevent.stop="emit('select', record as TraceRow)" @keydown.space.prevent.stop="emit('select', record as TraceRow)">
          <span v-if="traceBar(record as TraceRow, summary)" class="trace-bar" :class="{ 'trace-bar--error': exceptionEvents(record as TraceRow).length }" :style="barStyle(record as TraceRow)" />
          <span v-if="labelPlacement(record as TraceRow).position !== 'hidden'" class="trace-time-text" :style="{ left: `${labelPlacement(record as TraceRow).left}px` }">{{ formatTraceDuration(record.duration, locale) }}</span>
        </div>
      </a-tooltip>
    </template>
    <template #expandedRowRender="{ record }"><div class="trace-inline-details" :style="rowIndent(record as TraceRow)" :data-span-details="record.key"><slot name="details" :span="record" /></div></template>
  </a-table>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloudServerOutlined, ThunderboltOutlined, UserOutlined, GlobalOutlined, WarningOutlined, DatabaseOutlined, ApiOutlined, ExportOutlined, TagsOutlined, FieldTimeOutlined, RightOutlined, DownOutlined } from '@ant-design/icons-vue'
import { exceptionEvents, formatTraceDuration, nodeColorIndex, summarizeTrace, traceBar, traceDurationLabel, traceRowSummary, traceNanosecondDelta, type TraceRowSummary, type TraceEvidenceKind } from './tracePresentation'
import { nanosBetween } from './utils'
import type { TraceRow } from './types'
const props = defineProps<{ rows: TraceRow[]; allRows: TraceRow[]; summary: ReturnType<typeof summarizeTrace>; collapsed: ReadonlySet<string>; selectedKey?: string; matchedKeys: ReadonlySet<string>; focusNode?: string }>()
const emit = defineEmits<{ (event: 'select', value: TraceRow): void; (event: 'toggle', key: string): void; (event: 'evidence', value: TraceRow, kind: TraceEvidenceKind, attributeKey?: string): void }>()
const { t, locale } = useI18n()
const axis = ref<HTMLElement>(), axisWidth = ref(0), font = ref('12px sans-serif')
let observer: ResizeObserver | undefined, measure: CanvasRenderingContext2D | null = null
onMounted(() => {
  measure = document.createElement('canvas').getContext('2d')
  const resize = () => { if (axis.value) { axisWidth.value = axis.value.clientWidth; const style = getComputedStyle(axis.value); font.value = `${style.fontSize} ${style.fontFamily}` } }
  resize(); observer = new ResizeObserver(resize); if (axis.value) observer.observe(axis.value)
})
onBeforeUnmount(() => observer?.disconnect())
const parents = computed(() => new Set(props.allRows.map(row => row.parentKey).filter(Boolean)))
const columns = computed(() => [{ key: 'name', title: t('runtimeDiagnostics.operation'), width: '46%' }, { key: 'duration', title: t('runtimeDiagnostics.duration'), width: '54%' }])
/** 行名与展开正文共用树缩进；详情另留出相同的折叠按钮轨道。 */
function rowIndent(row: TraceRow) { return { '--trace-tree-indent': `${Math.max(0, Math.min(row.depth, 12)) * 12}px` } }
function barStyle(row: TraceRow) {
  const bar = traceBar(row, props.summary)
  if (!bar) return {}
  return { left: `${bar.left}%`, width: `${bar.width}%` }
}
function labelPlacement(row: TraceRow) {
  const text = formatTraceDuration(row.duration, locale.value) ?? '—'
  if (measure) measure.font = font.value
  return traceDurationLabel(traceBar(row, props.summary), axisWidth.value, measure?.measureText(text).width ?? text.length * 7)
}
function timeHint(row: TraceRow) {
  const duration = traceNanosecondDelta(row.startNanos, row.endNanos), offset = traceNanosecondDelta(props.summary.start, row.startNanos)
  const exact = (formatted: string | undefined, nanos: string | undefined) => nanos === undefined ? t('runtimeDiagnostics.unknownTime') : `${formatted ?? t('runtimeDiagnostics.unknownTime')} (${nanos} ns)`
  return `${t('runtimeDiagnostics.traceInclusiveDuration')}: ${exact(formatTraceDuration(row.duration, locale.value), duration)}\n${t('runtimeDiagnostics.traceStartOffset')}: ${exact(props.summary.start ? formatTraceDuration(nanosBetween(props.summary.start, row.startNanos), locale.value) : undefined, offset)}`
}
const summaryIcons = { action: ThunderboltOutlined, actor: UserOutlined, sourceIp: GlobalOutlined, exception: WarningOutlined, sql: DatabaseOutlined, http: ApiOutlined, output: ExportOutlined, attributes: TagsOutlined, events: FieldTimeOutlined }
function summaryLabel(evidence: TraceRowSummary): string {
  if (['action', 'actor', 'sourceIp'].includes(evidence.type)) return `${t(`runtimeDiagnostics.traceContext.${evidence.type}`)}: ${evidence.fullText ?? evidence.text}`
  if (evidence.type === 'sql') return `SQL · ${evidence.text?.replace(/\s+/g, ' ')}`
  if (evidence.type === 'http') return evidence.text ?? ''
  if (evidence.type === 'exception') return evidence.text || t('runtimeDiagnostics.exceptionRecorded')
  if (evidence.type === 'output') return t('runtimeDiagnostics.traceOutputCount', { count: evidence.count })
  return `${t(`runtimeDiagnostics.${evidence.type}`)} ${evidence.count}`
}
function summaryText(item: TraceRowSummary): string {
  if (item.type === 'exception') return t('runtimeDiagnostics.traceExceptionShort')
  if (item.type === 'sql') return 'SQL'
  if (item.type === 'http') return item.text?.replace(/^HTTP /, '') ?? ''
  if (item.count !== undefined) return String(item.count)
  return item.shortText ?? item.text ?? ''
}
function structuralHint(row: TraceRow) { return (['missingParent', 'ambiguousParent', 'cyclic', 'duplicate'] as const).filter(key => row[key]).map(key => t(`runtimeDiagnostics.traceStructure.${key}`)).join(' · ') }
function rowProps(row: TraceRow) { return {
  tabindex: 0, 'aria-selected': props.selectedKey === row.key, 'aria-expanded': props.selectedKey === row.key,
  class: { 'trace-row-selected': props.selectedKey === row.key, 'trace-row-match': props.matchedKeys.has(row.key), 'trace-row-node-focus': !!props.focusNode && row.nodeId === props.focusNode },
  'data-span-key': row.key, onClick: () => emit('select', row), onKeydown: (event: KeyboardEvent) => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); emit('select', row) } },
} }
</script>
<style scoped>
.trace-waterfall { --trace-cell-padding:var(--space-2,8px); --trace-toggle-size:20px; --trace-label-gap:var(--space-1,4px); min-width:0; container-type:inline-size; }
.trace-waterfall :deep(.ant-table-thead > tr > th) { background:var(--bg-sunken) !important; color:var(--ink-1); }
.trace-waterfall :deep(.ant-table-tbody > tr[data-span-key] > td.ant-table-cell) { padding-inline:var(--trace-cell-padding); }
.trace-operation,.trace-node { display:flex; align-items:center; gap:var(--trace-label-gap); min-width:0; }
.trace-operation { padding-inline-start:var(--trace-tree-indent,0px); }
.trace-name { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; line-height:1.4; font-size:var(--fs-body,14px); font-weight:500; }.trace-label { display:grid; min-width:0; width:100%; gap:2px; }
.trace-name--selected { overflow:visible; text-overflow:clip; white-space:normal; overflow-wrap:anywhere; font-weight:600; }
.trace-toggle { flex:none; padding-inline:2px; width:var(--trace-toggle-size); }
.trace-toggle-space { width:var(--trace-toggle-size); flex:none; }
.trace-structure { margin:0; line-height:16px; padding-inline:4px; }
.trace-axis { display:flex; justify-content:space-between; font-size:var(--fs-12,12px); font-weight:normal; color:var(--ink-3); }
.trace-time { position:relative; min-width:0; min-height:24px; overflow:hidden; border-inline-start:1px solid var(--line); background:repeating-linear-gradient(90deg,transparent 0,transparent calc(25% - 1px),var(--line) 25%); }
.trace-bar { position:absolute; top:50%; transform:translateY(-50%); height:20px; max-width:100%; border-radius:var(--r-1,3px); background:var(--accent-soft); box-shadow:inset 0 0 0 1px var(--accent); }
.trace-bar--error { background:var(--danger-bg); box-shadow:inset 0 0 0 1px var(--danger); }
.trace-time-text { position:absolute; top:50%; transform:translateY(-50%); z-index:1; max-width:100%; overflow:hidden; text-overflow:ellipsis; font-size:var(--fs-12,12px); line-height:20px; white-space:nowrap; color:var(--ink-1); }
.trace-time--stacked { min-height:44px; }.trace-time--stacked .trace-bar { top:32px; }.trace-time--stacked .trace-time-text { top:0; transform:none; }
.trace-waterfall :deep(.trace-row-selected > td) { vertical-align:top; }.trace-time--selected .trace-bar { top:10px; }.trace-time--selected .trace-time-text { top:0; transform:none; }
.trace-time:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
.trace-meta { display:flex; flex-wrap:wrap; align-items:center; gap:2px var(--space-2,8px); min-width:0; font-size:var(--fs-12,12px); color:var(--ink-2); }
.trace-source { display:inline-flex; align-items:center; gap:4px; max-width:min(100%,220px); min-width:0; color:var(--accent); }
.trace-source > :first-child { flex-shrink:0; }
.trace-source > span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.trace-node { max-width:min(28ch,100%); flex:none; }.trace-node-name { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.trace-meta :deep(.trace-summary-item) { display:inline-flex; align-items:center; gap:var(--space-1,4px); flex:0 1 auto; min-width:0; max-width:100%; height:20px; line-height:20px; padding:0; color:var(--ink-2); font-size:inherit; }
.trace-summary-icon { flex:none; font-size:var(--fs-12,12px); }.trace-summary-text { min-width:0; max-width:18ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.trace-summary-item--actor .trace-summary-text { max-width:12ch; }.trace-summary-item--sourceIp .trace-summary-text { max-width:18ch; }
.trace-meta :deep(.trace-summary-item--exception) { color:var(--danger); }.trace-summary-item--exception .trace-summary-text { max-width:10ch; }
.trace-meta :deep(.trace-summary-item:hover),.trace-meta :deep(.trace-summary-item:focus-visible) { color:var(--accent); }
.trace-node-dot { width:7px; height:7px; border-radius:50%; flex:none; background:var(--accent); }
.trace-node-dot--1 { background:var(--success); }.trace-node-dot--2 { background:var(--warning); }.trace-node-dot--3 { background:var(--accent-magenta); }.trace-node-dot--4 { background:var(--info); }.trace-node-dot--5 { background:var(--ink-3); }
.trace-waterfall :deep(tbody tr[data-span-key]) { cursor:pointer; }
/* 精确到展开单元格以覆盖 Ant small/middle 的 tbody padding，避免再次叠加详情缩进。 */
.trace-waterfall :deep(.ant-table-tbody > tr.ant-table-expanded-row > td.ant-table-cell) { background:var(--accent-soft) !important; padding:0; }
/* 整个展开区随横向滚动留在视口内，内容起点沿用所在行的名称轨道。 */
.trace-inline-details { position:sticky; inset-inline-start:0; box-sizing:border-box; min-width:0; max-width:100%; width:min(100%,100cqw); padding-block:var(--space-1,4px) var(--space-3,12px); padding-inline:calc(var(--trace-cell-padding) + var(--trace-tree-indent,0px) + var(--trace-toggle-size) + var(--trace-label-gap)) var(--trace-cell-padding); }
.trace-waterfall :deep(.trace-row-selected > td) { background:var(--accent-soft) !important; border-bottom-color:transparent; }
.trace-waterfall :deep(.trace-row-match:not(.trace-row-selected) > td),.trace-waterfall :deep(.trace-row-node-focus:not(.trace-row-selected) > td) { background:var(--warning-bg); }
.trace-waterfall :deep(tbody tr:focus) { outline:2px solid var(--accent); outline-offset:-2px; }
</style>

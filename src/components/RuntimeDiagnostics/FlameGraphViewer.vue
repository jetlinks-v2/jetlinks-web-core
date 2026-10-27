<template>
  <section ref="viewer" class="flame-viewer" :class="{ 'flame-viewer--embedded': embedded }" @keydown="navigateKeyboard">
    <div class="flame-toolbar diagnostics-compact-toolbar">
      <template v-if="layout.total"><a-input-search v-model:value="search" class="flame-search" size="small" :placeholder="t('runtimeDiagnostics.flameSearch')" allow-clear />
      <a-tooltip :title="t('runtimeDiagnostics.resetFocus')"><span><a-button type="text" size="small" :disabled="!layout.focus" :aria-label="t('runtimeDiagnostics.resetFocus')" @click="focus = undefined"><ReloadOutlined /></a-button></span></a-tooltip>
      <span class="flame-meta">{{ layout.total.toLocaleString() }} {{ t('runtimeDiagnostics.samples') }} · {{ t('runtimeDiagnostics.matchedFrames', { count: layout.matched }) }}</span>
      <div class="flame-navigation">
        <a-tooltip :title="t('runtimeDiagnostics.flameNavigation.back')"><a-button type="text" size="small" :disabled="!focus" :aria-label="t('runtimeDiagnostics.flameNavigation.back')" @click="back"><ArrowUpOutlined /></a-button></a-tooltip>
        <a-tooltip :title="t('runtimeDiagnostics.flameNavigation.zoomOut')"><a-button type="text" size="small" :disabled="zoom <= 1" :aria-label="t('runtimeDiagnostics.flameNavigation.zoomOut')" @click="changeZoom(zoom / 1.5)"><MinusOutlined /></a-button></a-tooltip>
        <a-button type="text" size="small" class="flame-zoom" :title="t('runtimeDiagnostics.flameNavigation.fit')" @click="fit">{{ Math.round(zoom * 100) }}%</a-button>
        <a-tooltip :title="t('runtimeDiagnostics.flameNavigation.zoomIn')"><a-button type="text" size="small" :disabled="zoom >= 16" :aria-label="t('runtimeDiagnostics.flameNavigation.zoomIn')" @click="changeZoom(zoom * 1.5)"><PlusOutlined /></a-button></a-tooltip>
        <a-tooltip :title="t('runtimeDiagnostics.flameNavigation.compact')"><a-button type="text" size="small" :class="{ 'is-active': compact }" :aria-label="t('runtimeDiagnostics.flameNavigation.compact')" :aria-pressed="compact" @click="compact = !compact"><CompressOutlined /></a-button></a-tooltip>
        <a-tooltip :title="t('runtimeDiagnostics.flameNavigation.fullscreen')"><a-button type="text" size="small" :aria-label="t('runtimeDiagnostics.flameNavigation.fullscreen')" @click="toggleFullscreen"><FullscreenOutlined /></a-button></a-tooltip>
        <a-tooltip :title="t('runtimeDiagnostics.flameNavigation.shortcuts')" :trigger="['hover', 'focus']"><InfoCircleOutlined tabindex="0" :aria-label="t('runtimeDiagnostics.flameNavigation.shortcuts')" /></a-tooltip>
      </div>
      <a-popover :open="detailsOpen" trigger="click" placement="bottomRight" @open-change="onDetailsOpen">
        <template #content><div class="flame-sampling-details" tabindex="-1" @keydown.esc.stop="closeDetails()"><div>{{ t('runtimeDiagnostics.sampleRange') }}: {{ time(snapshot?.startedAt) }} → {{ time(snapshot?.sampledAt) }}</div><div>{{ t('runtimeDiagnostics.inclusiveSamplesHint') }}</div><slot name="sampling-details" /></div></template>
        <a-button ref="detailsTrigger" type="text" size="small" :aria-expanded="detailsOpen" @keydown.esc.prevent="closeDetails()">{{ t('runtimeDiagnostics.samplingDetails') }}</a-button>
      </a-popover></template>
    </div>
    <slot v-if="!layout.total" name="empty"><a-empty :description="t('runtimeDiagnostics.noFlameSamples')" /></slot>
    <template v-else>
      <!-- SVG 文本与属性由共用生成器逐项转义，在线/离线图形保持一致。 -->
      <div ref="canvas" class="flame-canvas" tabindex="0" role="group" :aria-label="t('runtimeDiagnostics.flameNavigation.canvas')" @wheel="wheelZoom" @scroll="rememberViewport" @click="chooseFrame" @keydown="chooseFrame" v-html="svg" />
      <div class="flame-groups" :aria-label="t('runtimeDiagnostics.operationGroups')">
        <a-checkable-tag v-for="value in categories" :key="value" :checked="category === value" @change="category = value">{{ t(`runtimeDiagnostics.flameCategory.${value}`) }}</a-checkable-tag>
        <a-tooltip :title="t('runtimeDiagnostics.platformFrameHint')"><span class="flame-platform">◆ {{ t('runtimeDiagnostics.platformHotspot') }}</span></a-tooltip>
      </div>
      <div class="flame-insights" role="note" :aria-label="insightLabels.samplingHints">
        <div v-for="insight in analysis.insights" :key="insight.kind" class="flame-insight"><InfoCircleOutlined aria-hidden="true" /><span :title="samplingRule">{{ formatFlameInsight(insight, analysis, insightLabels) }}</span><a-button v-if="insight.frameKey" type="link" size="small" @click="locateInsight(insight.frameKey)">{{ insightLabels.locate }}</a-button></div>
      </div>
      <div v-if="focusedName" class="flame-focus">{{ t('runtimeDiagnostics.focusedFrame') }}: {{ focusedName }}</div>
      <component :is="embedded ? 'details' : 'div'" :class="{ 'flame-hotspot-details': embedded }"><summary v-if="embedded">{{ t('runtimeDiagnostics.hotspotDetails') }} <small>{{ hotspots.length }}</small></summary><a-empty v-if="!hotspots.length" :description="t('runtimeDiagnostics.noMatchingFrames')" /><FlameHotspots v-else :analysis="analysis" :rows="hotspots" :category="category" @focus="focus = $event" /></component>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onScopeDispose, ref, watch } from 'vue'
import { ArrowUpOutlined, CompressOutlined, FullscreenOutlined, InfoCircleOutlined, MinusOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { buildFlameLayout, compactFlameLayout, captureFlameViewport, renderFlameSvg, restoreFlameViewport, type FlameCategory, type FlameViewportAnchor } from './flameGraph'
import { analyzeFlameLayout, selectFlameHotspots } from './flame/analysis'
import { formatFlameInsight, formatFlameMessage, localizedFlameLabels } from './flame/presentation'
import FlameHotspots from './flame/FlameHotspots.vue'
import type { JfrSnapshot } from './types'
const props = withDefaults(defineProps<{ snapshot?: JfrSnapshot; platformPrefixes?: string[]; minimumSamples?: number; active?: boolean; embedded?: boolean }>(), { platformPrefixes: () => ['org.jetlinks.'], minimumSamples: 100, active: true })
const { t } = useI18n()
const search = ref(''), category = ref<FlameCategory>('all'), focus = ref<string>(), detailsOpen = ref(false)
const canvas = ref<HTMLElement>(), detailsTrigger = ref<{ $el?: HTMLButtonElement }>()
const canvasWidth = ref(720)
const viewer = ref<HTMLElement>(), zoom = ref(1), compact = ref(true), expandedLibrary = ref(new Set<string>())
const focusHistory: Array<string | undefined> = []
let anchor: FlameViewportAnchor = { bottom: 0, left: 0 }, activated = true, restoring = true, revision = 0, observer: ResizeObserver | undefined
const categories: FlameCategory[] = ['all', 'network', 'platform', 'gc', 'reactive', 'other']
// 分析只读全量报告树，不能用当前搜索 / 分类 / 聚焦后的子集生成采样结论。
const fullLayout = computed(() => buildFlameLayout(props.snapshot?.flameGraph ?? [], { platformPrefixes: props.platformPrefixes }))
const analysis = computed(() => analyzeFlameLayout(fullLayout.value, props.minimumSamples))
const insightLabels = computed(() => localizedFlameLabels(t))
const samplingRule = computed(() => formatFlameMessage(insightLabels.value.sampleRule, { minimum: analysis.value.minimum }))
const layout = computed(() => buildFlameLayout(props.snapshot?.flameGraph ?? [], { search: search.value, category: category.value, focus: focus.value, platformPrefixes: props.platformPrefixes }))
const visualLayout = computed(() => compact.value && !search.value ? compactFlameLayout(layout.value, expandedLibrary.value) : layout.value)
const svg = computed(() => renderFlameSvg(visualLayout.value, { samples: t('runtimeDiagnostics.samples'), platform: t('runtimeDiagnostics.platformHotspot') }, canvasWidth.value))
const focusedName = computed(() => layout.value.focus ? layout.value.cells[0]?.name : '')
const hotspots = computed(() => selectFlameHotspots(analysis.value, new Set(layout.value.cells.filter(cell => cell.matched).map(cell => cell.key))))
/** 提示可定位全量帧，清除可能挡住目标的搜索 / 分组；普通热点聚焦保留当前筛选。 */
function locateInsight(key: string) { if (analysis.value.byKey.has(key)) { search.value = ''; category.value = 'all'; focus.value = key } }
// 累计快照按身份路径恢复聚焦，消失的帧回到全量，避免复用错误索引。
watch(() => layout.value.focus, value => { if (focus.value && !value) focus.value = undefined })
const visibleCanvas = () => activated && canvas.value?.isConnected && canvas.value.clientWidth > 0 && canvas.value.clientHeight > 0
/** 只记录有效布局，隐藏时浏览器归零的滚动位置不能覆盖当前阅读现场。 */
function rememberViewport() {
  if (!restoring && visibleCanvas() && canvas.value) anchor = captureFlameViewport(canvas.value)
}
/** Vue 更新后再应用定位；隐藏容器等待尺寸恢复，不使用延时猜测图形何时可见。 */
async function positionViewport() {
  restoring = true
  const current = ++revision
  await nextTick()
  if (current !== revision || !visibleCanvas() || !canvas.value) return
  const position = restoreFlameViewport(canvas.value, anchor)
  canvas.value.scrollTop = position.top; canvas.value.scrollLeft = position.left
  restoring = false
}
function resetViewport() { anchor = { bottom: 0, left: 0 }; void positionViewport() }
/** 图形最小宽度保留本地横向阅读，宽容器按真实尺寸排版，不缩放文字或调用层高。 */
function resizeViewport() {
  if (!visibleCanvas() || !canvas.value) return
  canvasWidth.value = Math.max(720, canvas.value.clientWidth) * zoom.value
  void positionViewport()
}
watch(svg, () => { rememberViewport(); void positionViewport() }, { flush: 'pre' })
watch(() => props.snapshot?.startedAt, () => { focus.value = undefined; focusHistory.length = 0; expandedLibrary.value = new Set(); zoom.value = 1; closeDetails(false); resizeViewport(); resetViewport() }, { flush: 'sync' })
watch(() => props.active, active => { if (!active) closeDetails(false) })
watch(() => layout.value.focus, () => resetViewport(), { flush: 'sync' })
watch(() => layout.value.total > 0, hasSamples => { if (!hasSamples) resetViewport() })
watch(canvas, element => {
  observer?.disconnect(); observer = undefined
  if (element && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resizeViewport)
    observer.observe(element)
  }
  if (element) resizeViewport()
}, { flush: 'post' })
onDeactivated(() => { closeDetails(false); rememberViewport(); activated = false; restoring = true; revision++ })
onActivated(() => { activated = true; void positionViewport() })
onScopeDispose(() => { activated = false; revision++; observer?.disconnect() })
function chooseFrame(event: MouseEvent | KeyboardEvent) {
  if (event instanceof KeyboardEvent && !['Enter', ' '].includes(event.key)) return
  const expandKey = event.target instanceof Element ? event.target.closest('[data-expand-key]')?.getAttribute('data-expand-key') : null
  if (expandKey) { event.preventDefault(); const next = new Set(expandedLibrary.value); if (next.has(expandKey)) next.delete(expandKey); else next.add(expandKey); expandedLibrary.value = next; return }
  const target = event.target instanceof Element ? event.target.closest('[data-frame-key]') : null
  const key = target?.getAttribute('data-frame-key')
  if (key) { event.preventDefault(); focusHistory.push(focus.value); focus.value = key }
}
function back() { focus.value = focusHistory.pop() }
function fit() { focusHistory.length = 0; focus.value = undefined; changeZoom(1) }
/** 仅缩放横向宽度，字号和层高固定；以视口中心或鼠标位置为锚点。 */
function changeZoom(value: number, cursor?: number) {
  const next = Math.max(1, Math.min(16, value))
  if (next === zoom.value || !canvas.value) return
  rememberViewport()
  const offset = cursor ?? canvas.value.clientWidth / 2
  anchor = { ...anchor, left: Math.max(0, (canvas.value.scrollLeft + offset) * next / zoom.value - offset) }
  restoring = true; zoom.value = next; canvasWidth.value = Math.max(720, canvas.value.clientWidth) * next
}
function wheelZoom(event: WheelEvent) { if ((event.ctrlKey || event.metaKey) && canvas.value) { event.preventDefault(); changeZoom(zoom.value * (event.deltaY < 0 ? 1.2 : 1 / 1.2), event.clientX - canvas.value.getBoundingClientRect().left) } }
function navigateKeyboard(event: KeyboardEvent) {
  if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable=true]')) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (['+', '='].includes(event.key)) { event.preventDefault(); changeZoom(zoom.value * 1.5) }
  else if (event.key === '-') { event.preventDefault(); changeZoom(zoom.value / 1.5) }
  else if (event.key === '0') { event.preventDefault(); fit() }
  else if (event.key === 'Escape' && focus.value) { event.preventDefault(); back() }
}
function toggleFullscreen() { if (typeof document === 'undefined') return; if (document.fullscreenElement === viewer.value) void document.exitFullscreen?.(); else void viewer.value?.requestFullscreen?.().catch(() => {}) }
function onDetailsOpen(open: boolean) { detailsOpen.value = open }
function closeDetails(returnFocus = true) {
  detailsOpen.value = false
  if (returnFocus) detailsTrigger.value?.$el?.focus()
}
function time(value?: number) { return value === undefined || !Number.isFinite(value) ? '—' : new Date(value).toLocaleString() }
</script>
<style scoped>
.flame-viewer { min-width:0; --flame-network:color-mix(in srgb,var(--info) 26%,var(--bg)); --flame-platform:color-mix(in srgb,var(--success) 30%,var(--bg)); --flame-platform-stroke:var(--success); --flame-gc:color-mix(in srgb,var(--accent-magenta) 28%,var(--bg)); --flame-reactive:color-mix(in srgb,var(--warning) 35%,var(--bg)); --flame-other:color-mix(in srgb,var(--ink-3) 22%,var(--bg)); --flame-border:var(--bg); --flame-text:var(--ink-1); }
.flame-viewer:fullscreen { background:var(--bg); padding:16px; overflow:auto; }
.flame-viewer:fullscreen .flame-canvas { max-height:calc(100vh - 220px); }
.flame-navigation { display:flex; align-items:center; gap:2px; margin-inline-start:auto; }
.flame-navigation .is-active { color:var(--accent); background:var(--accent-soft); }
.flame-zoom { font-size:12px; min-width:48px; font-variant-numeric:tabular-nums; }
.flame-toolbar { display:flex; flex-wrap:wrap; gap:var(--space-2,8px); align-items:center; margin-bottom:var(--space-2,8px); }
.flame-search { flex:1 1 180px; min-width:140px; max-width:320px; }
.flame-toolbar :deep(.flame-search) { width:auto; }
.flame-meta { color:var(--ink-2); font-size:var(--fs-12,12px); }
.flame-focus { color:var(--ink-3); font-size:var(--fs-12,12px); }
.flame-meta { white-space:nowrap; }
.flame-sampling-details { display:grid; gap:4px; max-width:min(420px,calc(100vw - 32px)); }
.flame-canvas { border:1px solid var(--line); border-radius:var(--r-2,6px); overflow:scroll; scrollbar-gutter:stable; scrollbar-width:auto; overflow-anchor:none; max-height:clamp(280px,48vh,560px); }
.flame-viewer--embedded .flame-canvas { max-height:clamp(240px,32vh,360px); }
.flame-viewer--embedded:fullscreen .flame-canvas { max-height:calc(100vh - 220px); }
.flame-hotspot-details { margin-top:8px; min-width:0; }
.flame-hotspot-details > summary { cursor:pointer; color:var(--ink-2); font-size:12px; padding-block:4px; }
.flame-hotspot-details > summary small { color:var(--ink-3); margin-inline-start:4px; }
.flame-canvas::-webkit-scrollbar { width:10px; height:10px; }
.flame-canvas::-webkit-scrollbar-thumb { border:2px solid var(--bg); border-radius:6px; background:var(--ink-3); }
.flame-canvas::-webkit-scrollbar-track { background:var(--bg-sunken); }
.flame-canvas :deep(svg) { display:block; min-width:720px; }
.flame-canvas :deep(g[role=button]) { cursor:pointer; }
.flame-canvas :deep(g:focus rect) { stroke:var(--accent); stroke-width:2px; }
.flame-groups { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-1,4px); padding-block:var(--space-2,8px); }
.flame-platform { color:var(--success); font-size:var(--fs-12,12px); }
.flame-groups > span:last-child { margin-inline-start:auto; }
.flame-insights { margin-bottom:8px; color:var(--ink-2); font-size:12px; }
.flame-insight { display:flex; align-items:baseline; gap:6px; overflow-wrap:anywhere; }
.flame-insight > span:nth-child(2) { flex:1; min-width:0; }
.flame-insight > .ant-btn { padding:0; height:auto; font-size:12px; white-space:nowrap; }
.flame-focus { overflow-wrap:anywhere; margin-bottom:var(--space-2,8px); }
</style>

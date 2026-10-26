<template>
  <section class="flame-viewer">
    <div class="flame-toolbar diagnostics-compact-toolbar">
      <template v-if="layout.total"><a-input-search v-model:value="search" class="flame-search" size="small" :placeholder="t('runtimeDiagnostics.flameSearch')" allow-clear />
      <a-tooltip :title="t('runtimeDiagnostics.resetFocus')"><span><a-button type="text" size="small" :disabled="!layout.focus" :aria-label="t('runtimeDiagnostics.resetFocus')" @click="focus = undefined"><ReloadOutlined /></a-button></span></a-tooltip>
      <span class="flame-meta">{{ layout.total.toLocaleString() }} {{ t('runtimeDiagnostics.samples') }} · {{ t('runtimeDiagnostics.matchedFrames', { count: layout.matched }) }}</span>
      <a-popover :open="detailsOpen" trigger="click" placement="bottomRight" @open-change="onDetailsOpen">
        <template #content><div class="flame-sampling-details" tabindex="-1" @keydown.esc.stop="closeDetails()"><div>{{ t('runtimeDiagnostics.sampleRange') }}: {{ time(snapshot?.startedAt) }} → {{ time(snapshot?.sampledAt) }}</div><div>{{ t('runtimeDiagnostics.inclusiveSamplesHint') }}</div><slot name="sampling-details" /></div></template>
        <a-button ref="detailsTrigger" type="text" size="small" :aria-expanded="detailsOpen" @keydown.esc.prevent="closeDetails()">{{ t('runtimeDiagnostics.samplingDetails') }}</a-button>
      </a-popover></template>
    </div>
    <slot v-if="!layout.total" name="empty"><a-empty :description="t('runtimeDiagnostics.noFlameSamples')" /></slot>
    <template v-else>
      <!-- SVG 文本与属性由共用生成器逐项转义，在线/离线图形保持一致。 -->
      <div ref="canvas" class="flame-canvas" @scroll="rememberViewport" @click="chooseFrame" @keydown="chooseFrame" v-html="svg" />
      <div class="flame-groups" :aria-label="t('runtimeDiagnostics.operationGroups')">
        <a-checkable-tag v-for="value in categories" :key="value" :checked="category === value" @change="category = value">{{ t(`runtimeDiagnostics.flameCategory.${value}`) }}</a-checkable-tag>
        <a-tooltip :title="t('runtimeDiagnostics.platformFrameHint')"><span class="flame-platform">◆ {{ t('runtimeDiagnostics.platformHotspot') }}</span></a-tooltip>
      </div>
      <div class="flame-insights" role="note" :aria-label="insightLabels.samplingHints">
        <div v-for="insight in analysis.insights" :key="insight.kind" class="flame-insight"><InfoCircleOutlined aria-hidden="true" /><span :title="samplingRule">{{ formatFlameInsight(insight, analysis, insightLabels) }}</span><a-button v-if="insight.frameKey" type="link" size="small" @click="locateInsight(insight.frameKey)">{{ insightLabels.locate }}</a-button></div>
      </div>
      <div v-if="focusedName" class="flame-focus">{{ t('runtimeDiagnostics.focusedFrame') }}: {{ focusedName }}</div>
      <a-empty v-if="!hotspots.length" :description="t('runtimeDiagnostics.noMatchingFrames')" />
      <FlameHotspots v-else :analysis="analysis" :rows="hotspots" :category="category" @focus="focus = $event" />
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onScopeDispose, ref, watch } from 'vue'
import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { buildFlameLayout, captureFlameViewport, renderFlameSvg, restoreFlameViewport, type FlameCategory, type FlameViewportAnchor } from './flameGraph'
import { analyzeFlameLayout, selectFlameHotspots } from './flame/analysis'
import { formatFlameInsight, formatFlameMessage, localizedFlameLabels } from './flame/presentation'
import FlameHotspots from './flame/FlameHotspots.vue'
import type { JfrSnapshot } from './types'
const props = withDefaults(defineProps<{ snapshot?: JfrSnapshot; platformPrefixes?: string[]; minimumSamples?: number; active?: boolean }>(), { platformPrefixes: () => ['org.jetlinks.'], minimumSamples: 100, active: true })
const { t } = useI18n()
const search = ref(''), category = ref<FlameCategory>('all'), focus = ref<string>(), detailsOpen = ref(false)
const canvas = ref<HTMLElement>(), detailsTrigger = ref<{ $el?: HTMLButtonElement }>()
const canvasWidth = ref(720)
let anchor: FlameViewportAnchor = { bottom: 0, left: 0 }, activated = true, restoring = true, revision = 0, observer: ResizeObserver | undefined
const categories: FlameCategory[] = ['all', 'network', 'platform', 'gc', 'reactive', 'other']
// 分析只读全量报告树，不能用当前搜索 / 分类 / 聚焦后的子集生成采样结论。
const fullLayout = computed(() => buildFlameLayout(props.snapshot?.flameGraph ?? [], { platformPrefixes: props.platformPrefixes }))
const analysis = computed(() => analyzeFlameLayout(fullLayout.value, props.minimumSamples))
const insightLabels = computed(() => localizedFlameLabels(t))
const samplingRule = computed(() => formatFlameMessage(insightLabels.value.sampleRule, { minimum: analysis.value.minimum }))
const layout = computed(() => buildFlameLayout(props.snapshot?.flameGraph ?? [], { search: search.value, category: category.value, focus: focus.value, platformPrefixes: props.platformPrefixes }))
const svg = computed(() => renderFlameSvg(layout.value, { samples: t('runtimeDiagnostics.samples'), platform: t('runtimeDiagnostics.platformHotspot') }, canvasWidth.value))
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
  canvasWidth.value = Math.max(720, canvas.value.clientWidth)
  void positionViewport()
}
watch(svg, () => { rememberViewport(); void positionViewport() }, { flush: 'pre' })
watch(() => props.snapshot?.startedAt, () => { focus.value = undefined; closeDetails(false); resetViewport() }, { flush: 'sync' })
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
  const target = event.target instanceof Element ? event.target.closest('[data-frame-key]') : null
  const key = target?.getAttribute('data-frame-key')
  if (key) { event.preventDefault(); focus.value = key }
}
function onDetailsOpen(open: boolean) { detailsOpen.value = open }
function closeDetails(returnFocus = true) {
  detailsOpen.value = false
  if (returnFocus) detailsTrigger.value?.$el?.focus()
}
function time(value?: number) { return value === undefined || !Number.isFinite(value) ? '—' : new Date(value).toLocaleString() }
</script>
<style scoped>
.flame-viewer { min-width:0; --flame-network:var(--info-bg); --flame-platform:var(--success-bg); --flame-platform-stroke:var(--success); --flame-gc:color-mix(in srgb,var(--accent-magenta) 20%,var(--bg)); --flame-reactive:var(--warning-bg); --flame-other:var(--bg-sunken); --flame-text:var(--ink-1); }
.flame-toolbar { display:flex; flex-wrap:wrap; gap:var(--space-2,8px); align-items:center; margin-bottom:var(--space-2,8px); }
.flame-search { flex:1 1 180px; min-width:140px; max-width:320px; }
.flame-toolbar :deep(.flame-search) { width:auto; }
.flame-meta { color:var(--ink-2); font-size:var(--fs-12,12px); }
.flame-focus { color:var(--ink-3); font-size:var(--fs-12,12px); }
.flame-meta { white-space:nowrap; }
.flame-sampling-details { display:grid; gap:4px; max-width:min(420px,calc(100vw - 32px)); }
.flame-canvas { border:1px solid var(--line); border-radius:var(--r-2,6px); overflow:auto; overflow-anchor:none; max-height:clamp(240px,40vh,480px); }
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

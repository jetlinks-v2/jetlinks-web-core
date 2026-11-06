<template>
  <div class="template-graph-shell" :style="{ '--metric-node-width': `${templateGraphLayout.nodeWidth}px`, '--metric-node-height': `${templateGraphLayout.nodeHeight}px` }">
  <div class="template-graph__toolbar">
    <div class="template-graph__time"><slot name="clock"><small v-if="simulationPreview?.time !== undefined" role="status"><AIcon type="ClockCircleOutlined" />{{ t('flowTime') }} · {{ sampleDate(simulationPreview?.time).replace('T',' ') }}</small></slot></div>
    <nav :aria-label="t('canvasTools')">
      <a-button type="text" size="small" :disabled="scale <= .2" :title="t('canvasZoomOut')" :aria-label="t('canvasZoomOut')" @click="zoom(scale / 1.2)"><AIcon type="MinusOutlined" /></a-button>
      <a-button type="text" size="small" class="template-graph__percent" :title="t('canvasReset')" @click="zoom(1)">{{ percent }}</a-button>
      <a-button type="text" size="small" :disabled="scale >= 2" :title="t('canvasZoomIn')" :aria-label="t('canvasZoomIn')" @click="zoom(scale * 1.2)"><AIcon type="PlusOutlined" /></a-button>
      <a-button type="text" size="small" :title="t('canvasFit')" :aria-label="t('canvasFit')" @click="fit"><AIcon type="CompressOutlined" /></a-button>
      <a-tooltip :title="t('canvasShortcuts')"><a-button type="text" size="small" :aria-label="t('canvasShortcuts')"><AIcon type="QuestionCircleOutlined" /></a-button></a-tooltip>
    </nav>
  </div>
  <div ref="viewport" class="template-graph" :class="{ 'is-grabbable':space, 'is-dragging':dragging }" tabindex="0" :aria-label="t('relations')" aria-keyshortcuts="Delete Backspace Escape + - 0 1" @click.capture="captureClick" @click="clickBackground" @keydown="keydown" @focusout="focusout" @pointerdown.capture="down" @pointermove="pan" @pointerup="end" @pointercancel="cancel" @lostpointercapture="end">
    <div v-if="!template.inputDefinitions.length || !template.definitions.length" class="template-graph__start">
      <a-button v-if="!template.inputDefinitions.length && addKinds.includes('input')" data-add-root="input" type="text" size="small" @click="addRoot('input', $event)"><AIcon type="PlusOutlined" />{{ t('addInput') }}</a-button>
      <a-button v-if="!template.definitions.length && addKinds.includes('rule')" data-add-root="rule" type="text" size="small" @click="addRoot('rule', $event)"><AIcon type="PlusOutlined" />{{ t('addCalculation') }}</a-button>
    </div>
    <a-empty v-if="!graph.nodes.length" :description="t('emptyDesign')" />
    <div v-else class="template-graph__extent" :style="{ width: `${graph.width * scale}px`, height: `${graph.height * scale}px` }">
    <div class="template-graph__canvas" :style="{ width: `${graph.width}px`, height: `${graph.height}px`, transform:`scale(${scale})` }">
      <div v-for="level in graph.levels" :key="level.level" class="template-graph__heading" :style="{ top: `${level.y}px` }">
        <span>{{ t(level.kind === 'input' ? 'inputs' : level.kind === 'output' ? 'outputs' : level.kind === 'mixed' ? 'graphCalculationAndOutput' : 'calculation') }}</span>
        <a-button v-if="level.kind === 'input' && addKinds.includes('input') || (level.kind === 'rule' || level.kind === 'mixed') && addKinds.includes('rule')" class="template-graph__root-add" :data-add-root="level.kind === 'input' ? 'input' : 'rule'" type="text" size="small" :aria-label="t(level.kind === 'input' ? 'addInput' : 'addCalculation')" :title="t(level.kind === 'input' ? 'addInput' : 'addCalculation')" @click="addRoot(level.kind === 'input' ? 'input' : 'rule', $event)"><AIcon type="PlusOutlined" /></a-button>
      </div>
      <div v-for="group in groups" :key="group.key" class="template-graph__time-group" :style="{ left: `${group.x}px`, top: `${group.y}px`, width: `${group.width}px` }"><span><AIcon type="ClockCircleOutlined" /> {{ group.label }}</span></div>
      <svg class="template-graph__connections" :viewBox="`0 0 ${graph.width} ${graph.height}`" aria-hidden="true">
        <defs>
          <marker :id="arrowId" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L7,4 L1,7" /></marker>
          <marker :id="`${arrowId}-selected`" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="template-graph__selected-arrow" d="M1,1 L7,4 L1,7" /></marker>
        </defs>
        <path v-for="edge in graph.edges" :key="edge.key" class="template-graph__edge" :class="{ active: edge.source === active || edge.target === active, linked: relatedEdges.has(edge.key), referenced: edge.source === previewKey || edge.target === previewKey }" :d="edge.path" :marker-end="`url(#${arrowId}${relatedEdges.has(edge.key) ? '-selected' : ''})`" />
        <path v-for="edge in selectedEdges" :key="`flow-${edge.key}`" class="template-graph__flow" :d="edge.path" />
      </svg>
      <div v-for="node in graph.nodes" :key="node.key" class="template-graph__item" :class="{ 'menu-open': openNode === node.key }" :style="{ left: `${node.x}px`, top: `${node.y}px` }"
        @focusin="focused = node.key" @focusout="focused = undefined">
      <button type="button" :data-node="node.key"
        class="template-graph__node" :class="[node.kind, { selected: selected && nodeKey(selected) === node.key, referenced: node.key === previewKey }]"
        :aria-label="`${t(node.kind === 'input' ? 'inputs' : node.kind === 'rule' ? 'calculation' : 'outputs')} · ${node.label || t('unnamedOutput')} · ${summaries[node.key].text} · ${simulationPreview ? previewValue(node) + ' · ' + previewState(node.key) : summaries[node.key].detail}`"
        :aria-pressed="!!selected && nodeKey(selected) === node.key"
        @click="emit('select', node, $event.currentTarget as HTMLButtonElement)">
        <span class="template-graph__name"><AIcon :type="summaries[node.key].icon" /><b>{{ node.label || t('unnamedOutput') }}</b><AIcon v-if="summaries[node.key].condition" type="FilterOutlined" :title="`${t('applicability')}：${summaries[node.key].condition}`" /></span>
        <slot name="node-summary" :node="node" :summary="summaries[node.key]">
        <span class="template-graph__meaning" :title="summaries[node.key].text">
          <TemplateFormulaDisplay v-if="summaries[node.key].expression" :template="template" :rule="template.definitions[node.index] as TemplateRule" :expression="summaries[node.key].expression!" :calculators="calculators" compact />
          <span v-else>{{ summaries[node.key].text }}</span>
        </span>
        <small :title="summaries[node.key].detail">{{ summaries[node.key].detail }}</small>
        </slot>
      </button>
      <div v-if="simulationPreview" class="template-graph__trial" :style="{ pointerEvents:node.kind === 'input' ? 'auto' : 'none' }">
        <slot v-if="node.kind === 'input'" name="input-sample" :node="node"><span>{{ previewValue(node) }}</span></slot>
        <template v-else><b :title="previewValue(node)">{{ previewValue(node) }}</b><small>{{ previewUnit(node) }}</small><small class="template-graph__state" :title="previewState(node.key)">{{ previewState(node.key) }}</small><small v-if="(simulationPreview.nodes[node.key]?.alternatives.length || 0) > 1">+{{ simulationPreview.nodes[node.key].alternatives.length - 1 }}</small></template>
      </div>
      <a-dropdown v-if="node.kind !== 'output' && nextActions.length" :trigger="['click']" @open-change="openNode = $event ? node.key : undefined">
        <button type="button" class="template-graph__node-add" :data-add-from="node.key" :aria-label="t('addAfterNode', { name:node.label || t('unnamedOutput') })" :title="t('addAfterNode', { name:node.label || t('unnamedOutput') })" @click="rememberAddTrigger"><AIcon type="PlusOutlined" /></button>
        <template #overlay><a-menu @click="addFromNode(node, $event)"><a-menu-item v-for="action in nextActions" :key="action.kind"><AIcon :type="action.icon" />{{ t(action.label) }}</a-menu-item></a-menu></template>
      </a-dropdown>
      </div>
    </div>
    </div>
  </div>
  <small v-if="overflow" class="template-graph__scroll-hint"><AIcon type="SwapOutlined" />{{ t('scrollRelations') }}</small>
  </div>
</template>
<script setup lang="ts">
import { computed, inject, ref, useId } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useCanvasViewport } from '../../../hooks/useCanvasViewport'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../messages'
import { nodeKey, relatedGraphEdges, templateGraph, templateGraphLayout, type TemplateNode, type TemplateRule } from './designer'
import { graphNodeSummary, graphTimeGroups } from './graphPresentation'
import TemplateFormulaDisplay from './formula/TemplateFormulaDisplay.vue'
import { metricDurationText } from '../presentation'
import { sampleDate } from './simulation'
import { simulationMeaning, type SimulationPreview } from './simulationPreview'
import { semanticValueText } from '../valueSemantics'
import type { MetricCalculatorDescriptor, MetricTemplate } from '../types'
import { metricCalculatorsKey } from '../calculatorContext'
const props = withDefaults(defineProps<{ template: MetricTemplate; selected?: TemplateNode; preview?: TemplateNode; calculators?: MetricCalculatorDescriptor[]; addKinds?: TemplateNode['kind'][]; simulationPreview?:SimulationPreview }>(), { addKinds: () => [] })
const emit = defineEmits<{ (event: 'select', node: TemplateNode, trigger: HTMLButtonElement): void; (event: 'add', kind: TemplateNode['kind'], trigger: HTMLButtonElement, source?: TemplateNode): void; (event: 'background'): void; (event:'request-remove'):void }>()
const { t, locale } = useI18n({ useScope: 'local', messages: metricMessages })
const arrowId = `metric-arrow-${useId()}`
const graph = computed(() => templateGraph(props.template))
const sharedCalculators = inject(metricCalculatorsKey, undefined)
const groups = computed(() => graphTimeGroups(props.template, graph.value, t))
const summaries = computed(() => Object.fromEntries(graph.value.nodes.map(node => [node.key, graphNodeSummary(props.template, node, t, props.calculators || sharedCalculators?.value)])))
const focused = ref<string>()
const openNode = ref<string>()
let addTrigger: HTMLButtonElement | undefined
const nextActions = computed(() => [
  { kind: 'rule' as const, icon: 'FunctionOutlined', label: 'addNextCalculation' },
  { kind: 'output' as const, icon: 'ExportOutlined', label: 'addOutput' },
].filter(action => props.addKinds.includes(action.kind)))
// 滚动经过节点不切换连线；选中、键盘焦点和显式引用预览保留各自反馈。
const active = computed(() => openNode.value || focused.value || (props.selected && nodeKey(props.selected)))
const relatedEdges = computed(() => relatedGraphEdges(graph.value.edges, props.selected && nodeKey(props.selected)))
const selectedEdges = computed(() => graph.value.edges.filter(edge => relatedEdges.value.has(edge.key)))
const previewKey = computed(() => props.preview && nodeKey(props.preview))
const viewport = ref<HTMLElement>()
const { scale,percent,space,dragging,zoom,fit,keydown,down,move:pan,end,cancel,click:captureClick,focusout } = useCanvasViewport(viewport,graph,{ clear:() => emit('background'),remove:() => emit('request-remove'),blocked:() => !!openNode.value })
const { width } = useElementSize(viewport)
const overflow = computed(() => width.value > 0 && graph.value.width * scale.value > width.value)
function previewValue(node:TemplateNode) {
  const entry = props.simulationPreview?.nodes[nodeKey(node)]?.entry
  if (entry?.value?.status === 'invalid' || entry?.value?.quality?.valid === false) return '—'
  const value = entry?.value ? entry.value.value : entry?.sample?.value
  const meaning = simulationMeaning(props.template,node,entry,props.calculators || sharedCalculators?.value)
  return semanticValueText(value,{ ...meaning, locale:String(locale.value) },t)
}
function previewUnit(node:TemplateNode) {
  const entry = props.simulationPreview?.nodes[nodeKey(node)]?.entry
  const unit = simulationMeaning(props.template,node,entry,props.calculators || sharedCalculators?.value).unit
  return metricDurationText(entry?.value?.value, unit, t) === undefined ? unit : ''
}
function previewState(key:string) {
  const snapshot = props.simulationPreview?.nodes[key]
  return snapshot?.previous ? `${t('trialPrevious')} · ${sampleDate(snapshot.entry?.time).slice(11)}` : t(snapshot?.state || 'awaitSimulation')
}
function addRoot(kind: TemplateNode['kind'], event: Event) { emit('add', kind, event.currentTarget as HTMLButtonElement) }
function rememberAddTrigger(event: Event) { addTrigger = event.currentTarget as HTMLButtonElement }
/** 只响应图内空白；节点、添加入口和菜单不改变属性面板上下文。 */
function clickBackground(event: MouseEvent) {
  if (!(event.target as Element).closest('button, [role="menu"], .template-graph__item')) { viewport.value?.focus({ preventScroll:true }); emit('background') }
}
function addFromNode(node: TemplateNode, { key }: { key: string | number }) {
  const kind = key as TemplateNode['kind']
  if (addTrigger && props.addKinds.includes(kind)) emit('add', kind, addTrigger, { kind:node.kind, index:node.index })
}
/** 显式定位只滚动图的内部视口，不移动页面和右侧属性。 */
function locate(node: TemplateNode) {
  const target = viewport.value?.querySelector<HTMLButtonElement>(`[data-node="${nodeKey(node)}"]`)
  if (!target || !viewport.value) return
  const area = viewport.value.getBoundingClientRect()
  const bounds = target.getBoundingClientRect()
  viewport.value.scrollBy({ left:bounds.left - area.left - (area.width - bounds.width) / 2, top:bounds.top - area.top - (area.height - bounds.height) / 2, behavior:'smooth' })
  target.focus({ preventScroll:true })
}
defineExpose({ locate })
</script>
<style scoped>
.template-graph { min-width:0; min-height:0; width:100%; flex:1; overflow:auto; outline:none; overscroll-behavior:contain }
.template-graph:focus-visible { outline:1px solid var(--accent); outline-offset:-1px }
.template-graph.is-grabbable,.template-graph.is-grabbable :deep(*) { cursor:grab !important; user-select:none }
.template-graph.is-dragging,.template-graph.is-dragging :deep(*) { cursor:grabbing !important }
.template-graph__toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:32px; flex:none; flex-wrap:wrap }
.template-graph__toolbar nav { display:flex; align-items:center; margin-left:auto }
.template-graph__toolbar :deep(.ant-btn) { color:var(--ink-3); padding-inline:6px; font-size:11px }
.template-graph__percent { min-width:52px; font-variant-numeric:tabular-nums }
.template-graph-shell { display:flex; flex:1; flex-direction:column; min-width:0; min-height:0 }
.template-graph__time { display:block; min-width:0; font-size:11px; color:var(--ink-3) }
.template-graph__scroll-hint { display:flex; align-items:center; justify-content:flex-end; gap:6px; padding-top:6px; color:var(--ink-3); font-size:var(--fs-12,12px) }
.template-graph__extent { position:relative; margin:0 auto }
.template-graph__canvas { position:absolute; left:0; top:0; transform-origin:0 0 }
.template-graph__start { display:flex; align-items:center; gap:8px }
.template-graph__start :deep(.ant-btn) { color:var(--ink-3); font-size:12px }
.template-graph__connections { position:absolute; inset:0; width:100%; height:100%; pointer-events:none }
.template-graph__edge,.template-graph__connections marker path { fill:none; stroke:var(--ink-4); stroke-width:1.3 }
.template-graph__edge.active { stroke:var(--accent); stroke-width:2 }
.template-graph__edge.linked { stroke:var(--accent); stroke-width:1.3; stroke-opacity:.28 }
.template-graph__connections marker .template-graph__selected-arrow { stroke:var(--accent); stroke-opacity:.6 }
.template-graph__edge.referenced { stroke:var(--accent); stroke-width:2; stroke-opacity:1; stroke-dasharray:5 4 }
.template-graph__flow { fill:none; stroke:var(--accent); stroke-width:1.8; stroke-linecap:round; stroke-dasharray:4 20; animation:metric-dependency-flow 1.6s linear infinite }
@keyframes metric-dependency-flow { to { stroke-dashoffset:-24 } }
@media(prefers-reduced-motion:reduce) { .template-graph__flow { display:none } .template-graph__edge.linked { stroke-opacity:.8 } }
.template-graph__heading { position:absolute; left:0; right:0; display:flex; align-items:center; gap:var(--space-3,12px); color:var(--ink-3); font-size:var(--fs-12,12px); pointer-events:none }
.template-graph__heading::after { content:''; flex:1; border-top:1px solid var(--line) }
.template-graph__root-add { width:24px; height:24px; padding:0; color:var(--ink-3); pointer-events:auto }
.template-graph__time-group { position:absolute; height:calc(var(--metric-node-height) + 26px); border:1px dashed var(--line); border-radius:var(--r-2,6px); pointer-events:none }
.template-graph__time-group>span { position:absolute; top:-9px; left:8px; padding:0 4px; background:var(--bg-sunken); color:var(--ink-3); font-size:var(--fs-12,12px); line-height:18px }
.template-graph__item { position:absolute; width:var(--metric-node-width); height:var(--metric-node-height) }
.template-graph__node { width:100%; height:100%; display:flex; flex-direction:column; gap:2px; border:1px solid var(--line); border-radius:var(--r-2,6px); background:var(--panel-background); color:var(--ink-2); padding:8px 12px 40px; cursor:pointer; text-align:left; box-sizing:border-box }
.template-graph__node-add { position:absolute; top:100%; left:calc(50% - 12px); display:grid; place-items:center; width:24px; height:24px; padding:0; border:1px solid var(--line); border-radius:50%; background:var(--panel-background); color:var(--ink-3); cursor:pointer; opacity:0; pointer-events:none }
.template-graph__item:hover .template-graph__node-add,.template-graph__item:focus-within .template-graph__node-add,.template-graph__item.menu-open .template-graph__node-add { opacity:1; pointer-events:auto }
.template-graph__node-add:hover,.template-graph__node-add:focus-visible { color:var(--accent); border-color:var(--accent); outline:2px solid var(--accent-soft) }
@media(hover:none) { .template-graph__node-add { opacity:1; pointer-events:auto } }
.template-graph__name { display:flex; align-items:center; gap:var(--space-2,8px); min-width:0; width:100%; height:20px }
.template-graph__name b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500; font-size:var(--fs-13,13px) }
.template-graph__name>:first-child { flex:none; color:var(--ink-3) }
.template-graph__meaning { display:flex; align-items:center; width:100%; height:30px; min-width:0; overflow:hidden; font-size:var(--fs-12,12px) }
.template-graph__meaning>span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.template-graph__trial { position:absolute; left:1px; right:1px; bottom:1px; display:flex; align-items:center; gap:5px; height:32px; padding:0 10px; border-top:1px solid var(--line); font-variant-numeric:tabular-nums; color:var(--ink-2) }
.template-graph__trial b { flex:none; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; font-weight:500 }
.template-graph__trial small { color:var(--ink-3); font-size:10px }
.template-graph__state { margin-left:auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.template-graph__node small { display:block; width:100%; min-height:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink-3); font-size:var(--fs-12,12px); line-height:14px }
.template-graph__node.rule { background:var(--accent-soft) }
.template-graph__node.output { border-width:2px }
.template-graph__node:hover,.template-graph__node.selected,.template-graph__node:focus-visible { border-color:var(--accent); outline:2px solid var(--accent-soft) }
.template-graph__node.referenced { outline:2px dashed var(--accent); outline-offset:4px }
</style>

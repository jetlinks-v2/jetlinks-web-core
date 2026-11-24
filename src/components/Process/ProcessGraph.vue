<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCanvasViewport } from '../../hooks/useCanvasViewport'
import { expressionText } from '../Expression/display'
import { processGraph, processEdgePath } from './graph'
import { findProcessStep, insertProcessStep, processLanes, removeProcessStep, updateProcess } from './model'
import ProcessPathMenu from './ProcessPathMenu.vue'
import { processMessages } from './messages'
import type { ProcessStep, ProcessTemplate } from './types'
const props = defineProps<{ template: ProcessTemplate; selected?: string; readonly?: boolean; active?: string[] }>()
const emit = defineEmits<{ change:[value:ProcessTemplate]; select:[id?:string] }>()
const { t } = useI18n({useScope:'local',messages:processMessages})
const viewport = ref<HTMLElement>(), menuOpen = ref(false), arrow = `process-${useId().replaceAll(':','')}`
const graph = computed(() => processGraph(props.template,props.readonly))
const paths = computed(() => graph.value.edges.map(edge => ({...edge,path:processEdgePath(edge,graph.value.nodes)})))
const steps = computed(() => Object.fromEntries(graph.value.nodes.filter(node => node.role === 'step').map(node => [node.stepId,findProcessStep(props.template.root,node.stepId)!])))
const {scale,percent,space,dragging,zoom,fit,keydown,down,move,end,cancel,click,focusout} = useCanvasViewport(viewport,graph,{
  clear:() => emit('select'),
  remove:() => { if (!props.readonly && props.selected && props.selected !== props.template.root.id) emit('change',removeProcessStep(props.template,props.selected)) },
  blocked:() => menuOpen.value,
})
function insert(parent:string,lane:string,index:number,type:ProcessStep['type']) {
  const next = insertProcessStep(props.template,parent,lane,index,type)
  const added = processLanes(findProcessStep(next.root,parent)!).find(item => item.key === lane)?.steps[index]
  emit('change',next)
  if (added) emit('select',added.id)
}
function name(id:string) {
  const step = steps.value[id]
  return props.template.stepNames[id] || (id === props.template.root.id ? props.template.name : '')
    || (step?.type === 'action' ? props.template.actions[step.action]?.name : '') || t(step?.type || 'steps')
}
function summary(id:string) {
  const step = steps.value[id]
  if (step?.type === 'wait' || step?.type === 'branch') return expressionText(step.condition.expression,node => props.template.inputs[node.id]?.name || (node.id === 'steps' ? props.template.stepNames[node.path[0]] : node.id))
  if (step?.type === 'delay') return t('durationSummary',{seconds:step.durationMillis / 1000})
  if (step?.type === 'repeat') return t('repeatSummary',{count:step.count})
  if (step?.type === 'end') return t(step.outcome)
  if (step?.type === 'scope' && step.executionPermit) return t('executionPermit')
  return t(step?.type || 'steps')
}
function branch(id:string, remove?:number) {
  emit('change',updateProcess(props.template,id,step => {
    if (step.type !== 'parallel') return
    if (remove === undefined) step.branches.push([])
    else if (step.branches.length > 2) step.branches.splice(remove,1)
  }))
}
</script>
<template>
  <div class="process-graph-shell">
    <nav :aria-label="t('canvasTools')"><a-button type="text" class="process-graph__settings" @click="emit('select',template.root.id)">{{ t('runSettings') }}</a-button><a-button type="text" :aria-label="t('zoomOut')" @click="zoom(scale / 1.2)">−</a-button><a-button type="text" @click="zoom(1)">{{ percent }}</a-button><a-button type="text" :aria-label="t('zoomIn')" @click="zoom(scale * 1.2)">+</a-button><a-button type="text" @click="fit()">{{ t('fit') }}</a-button></nav>
    <div ref="viewport" class="process-graph" :class="{'is-grabbable':space,'is-dragging':dragging}" tabindex="0" :aria-label="t('steps')" @keydown="keydown" @focusout="focusout" @click.capture="click" @pointerdown.capture="down" @pointermove="move" @pointerup="end" @pointercancel="cancel" @lostpointercapture="end">
      <div class="process-graph__extent" :style="{width:graph.width * scale + 'px',height:graph.height * scale + 'px'}">
        <div class="process-graph__canvas" :style="{width:graph.width + 'px',height:graph.height + 'px',transform:`scale(${scale})`}">
          <svg class="process-graph__edges" :viewBox="`0 0 ${graph.width} ${graph.height}`" aria-hidden="true"><defs><marker :id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L7,4 L1,7" /></marker></defs><path v-for="edge in paths" :key="edge.key" :d="edge.path" :class="{'is-exception':edge.dashed,'is-loop':edge.loop}" :marker-end="`url(#${arrow})`" /></svg>
          <div v-for="node in graph.nodes" :key="node.key" class="process-graph__item" :class="`process-graph__item--${node.role}`" :style="{left:node.x+'px',top:node.y+'px',width:node.width+'px',height:node.height+'px'}">
            <ProcessPathMenu v-if="node.role === 'insert'" :label="t(node.width > 24 ? 'addStep' : 'add')" :compact="node.width === 24" @open="value => menuOpen = value" @choose="insert(node.stepId,node.lane!,node.index!,$event)" />
            <template v-else-if="node.role === 'step'">
              <button type="button" :data-node="node.stepId" class="process-graph__node" :class="{'is-selected':selected === node.stepId,'is-active':active?.includes(node.stepId)}" :aria-pressed="selected === node.stepId" @click="emit('select',node.stepId)"><strong>{{ name(node.stepId) }}</strong><span>{{ summary(node.stepId) }}</span></button>
              <a-button v-if="!readonly && steps[node.stepId]?.type === 'parallel'" size="small" type="text" class="process-graph__branch-add" :aria-label="t('addParallelBranch')" @click="branch(node.stepId)">+</a-button>
            </template>
            <span v-else class="process-graph__label" :class="{'is-join':node.role === 'join'}">{{ t(node.label!) }}<template v-if="node.label === 'parallelBranch'"> {{ Number(node.lane) + 1 }}<a-popconfirm v-if="!readonly" :title="t('removeParallelBranch')" @confirm="branch(node.stepId,Number(node.lane))"><a-button type="text" size="small" :disabled="(steps[node.stepId] as Extract<ProcessStep,{type:'parallel'}>).branches.length <= 2" :aria-label="t('removeParallelBranch')">×</a-button></a-popconfirm></template></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.process-graph-shell { display:flex; flex-direction:column; height:640px; min-height:400px; min-width:0; border:1px solid var(--ant-color-border-secondary,#e8e8e8); background:var(--ant-color-fill-quaternary,#fafafa); border-radius:6px }
nav { display:flex; justify-content:flex-end; border-bottom:1px solid var(--ant-color-border-secondary,#e8e8e8); background:var(--ant-color-bg-container,#fff) }
.process-graph__settings { margin-right:auto }
.process-graph { flex:1; overflow:auto; min-height:0; overscroll-behavior:contain; outline-offset:-2px }.process-graph__extent { position:relative; margin:0 auto }.process-graph__canvas { position:absolute; transform-origin:0 0 }
.process-graph__edges { position:absolute; inset:0; width:100%; height:100%; pointer-events:none }.process-graph__edges path { fill:none; stroke:var(--ant-color-text-tertiary,#8c8c8c); stroke-width:1.4 }.process-graph__edges .is-exception { stroke-dasharray:5 4 }.process-graph__edges .is-loop { stroke:var(--ant-color-primary,#1677ff) }
.process-graph__item { position:absolute; display:flex; align-items:center; justify-content:center; min-width:0 }.process-graph__node { width:100%; height:100%; display:grid; align-content:center; gap:7px; text-align:left; padding:10px 14px; border:1px solid var(--ant-color-border,#d9d9d9); border-radius:6px; background:var(--ant-color-bg-container,#fff); color:var(--ant-color-text,#262626); cursor:pointer }
.process-graph__node strong,.process-graph__node span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }.process-graph__node strong { font-weight:500 }.process-graph__node span { font-size:12px; color:var(--ant-color-text-secondary,#595959) }.process-graph__node.is-selected { border-color:var(--ant-color-primary,#1677ff); outline:1px solid var(--ant-color-primary,#1677ff) }.process-graph__node.is-active { border-inline-start:4px solid var(--ant-color-success,#52c41a) }
.process-graph__label { font-size:12px; color:var(--ant-color-text-secondary,#595959); background:var(--ant-color-bg-container,#fff); padding:2px 8px; border-radius:3px }.process-graph__label.is-join { border-block-start:2px solid var(--ant-color-border,#d9d9d9) }.process-graph__branch-add { position:absolute; right:3px; top:3px }.process-graph.is-grabbable { cursor:grab }.process-graph.is-dragging { cursor:grabbing }
</style>

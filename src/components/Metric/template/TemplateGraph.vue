<template>
  <div class="template-graph" :aria-label="t('relations')">
    <a-empty v-if="!graph.nodes.length" :description="t('emptyDesign')" />
    <div v-else class="template-graph__canvas" :style="{ width: `${graph.width}px`, height: `${graph.height}px` }">
      <svg :viewBox="`0 0 ${graph.width} ${graph.height}`" aria-hidden="true">
        <path v-for="edge in graph.edges" :key="edge.key" :d="edge.path" />
      </svg>
      <span class="template-graph__heading" :style="{ left: '8px' }">{{ t('inputs') }}</span>
      <span class="template-graph__heading" :style="{ left: '208px' }">{{ t('calculation') }}</span>
      <span class="template-graph__heading" :style="{ left: `${graph.lastColumn * 200 + 8}px` }">{{ t('outputs') }}</span>
      <button v-for="node in graph.nodes" :key="node.key" type="button" :data-node="node.key"
        class="template-graph__node" :class="{ selected: selected && nodeKey(selected) === node.key, calculation: node.kind === 'rule' }"
        :aria-label="`${t(node.kind === 'input' ? 'inputs' : node.kind === 'rule' ? 'calculation' : 'outputs')} · ${node.label || t('unnamedOutput')}`"
        :aria-pressed="!!selected && nodeKey(selected) === node.key" :style="{ left: `${node.x}px`, top: `${node.y}px` }"
        @click="emit('select', node, $event.currentTarget as HTMLButtonElement)">
        <AIcon :type="node.kind === 'input' ? 'ImportOutlined' : node.kind === 'rule' ? 'FunctionOutlined' : 'ExportOutlined'" />
        <span>{{ node.label || t('unnamedOutput') }}</span>
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../messages'
import { nodeKey, templateGraph, type TemplateNode } from './designer'
import type { MetricTemplate } from '../types'
const props = defineProps<{ template: MetricTemplate; selected?: TemplateNode }>()
const emit = defineEmits<{ (event: 'select', node: TemplateNode, trigger: HTMLButtonElement): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const graph = computed(() => templateGraph(props.template))
</script>
<style scoped>
.template-graph { min-width:0; width:100%; overflow:auto; border-bottom:1px solid var(--line); padding:var(--space-3,12px) 0 }
.template-graph__canvas { position:relative; margin:auto }
.template-graph svg { position:absolute; inset:0; width:100%; height:100%; pointer-events:none }
.template-graph path { fill:none; stroke:var(--ink-4,#a6b2c3); stroke-width:1.3 }
.template-graph__heading { position:absolute; top:0; color:var(--ink-3); font-size:var(--fs-12,12px) }
.template-graph__node { position:absolute; width:164px; height:44px; display:flex; align-items:center; gap:var(--space-2,8px); border:1px solid var(--line); border-radius:var(--r-2,6px); background:var(--panel-background,#fff); color:var(--ink-2); padding:0 var(--space-3,12px); cursor:pointer; text-align:left }
.template-graph__node span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap }
.template-graph__node.calculation { background:var(--accent-soft); border-color:var(--line) }
.template-graph__node:hover,.template-graph__node.selected,.template-graph__node:focus-visible { border-color:var(--accent); outline:2px solid var(--accent-soft) }
</style>

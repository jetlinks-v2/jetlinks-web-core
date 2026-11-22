<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDownOutlined, PlusOutlined } from '@ant-design/icons-vue'
import type { ProcessStep, ProcessTemplate } from './types'
import { insertProcessStep, processLanes, updateProcess } from './model'
import { processMessages } from './messages'
const props = defineProps<{ template: ProcessTemplate; parent: ProcessStep; laneKey: string; selected?: string; readonly?: boolean; active?: string[] }>()
const emit = defineEmits<{ change: [value: ProcessTemplate]; select: [id: string] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const steps = computed(() => processLanes(props.parent).find(lane => lane.key === props.laneKey)?.steps || [])
const kinds: ProcessStep['type'][] = ['action', 'wait', 'branch', 'parallel', 'repeat', 'scope', 'end']
function insert(index: number, key: string) { emit('change', insertProcessStep(props.template, props.parent.id, props.laneKey, index, key as ProcessStep['type'])) }
function move(index: number, delta: number) {
  emit('change', updateProcess(props.template, props.parent.id, parent => {
    const lane = processLanes(parent).find(item => item.key === props.laneKey)!.steps
    const [step] = lane.splice(index, 1); lane.splice(index + delta, 0, step)
  }))
}
</script>
<template>
  <div class="process-sequence">
    <template v-for="(step, index) in steps" :key="step.id">
      <div class="process-sequence__connector"><ArrowDownOutlined /></div>
      <section class="process-node" :class="{ 'process-node--selected': selected === step.id, 'process-node--active': active?.includes(step.id) }">
        <div class="process-node__heading">
          <a-button type="text" class="process-node__select" :aria-pressed="selected === step.id" @click="emit('select', step.id)">
            <span class="process-node__kind">{{ t(step.type) }}</span>
            <strong>{{ template.stepNames[step.id] || (step.type === 'action' ? template.actions[step.action]?.name : '') || t(step.type) }}</strong>
          </a-button>
          <a-space v-if="!readonly" size="small"><a-button size="small" type="text" :disabled="index === 0" :aria-label="t('moveUp')" @click="move(index, -1)">↑</a-button><a-button size="small" type="text" :disabled="index === steps.length - 1" :aria-label="t('moveDown')" @click="move(index, 1)">↓</a-button></a-space>
          <a-tag v-if="step.type === 'repeat'">{{ step.count }} ×</a-tag>
          <a-tag v-if="step.type === 'end'">{{ t(step.outcome) }}</a-tag>
        </div>
        <div v-if="processLanes(step).length" class="process-node__lanes" :class="{ 'process-node__lanes--parallel': step.type === 'parallel' || step.type === 'branch' }">
          <div v-for="(lane, laneIndex) in processLanes(step)" :key="lane.key" class="process-node__lane">
            <div class="process-node__lane-title">{{ t(lane.label) }}<span v-if="step.type === 'parallel'"> {{ laneIndex + 1 }}</span><span v-if="lane.key.startsWith('interruptions.')"> {{ Math.floor((laneIndex - 2) / 2) + 1 }}</span></div>
            <ProcessSequence :template="template" :parent="step" :lane-key="lane.key" :selected="selected" :readonly="readonly" :active="active" @change="emit('change', $event)" @select="emit('select', $event)" />
          </div>
        </div>
      </section>
      <a-dropdown v-if="!readonly" :trigger="['click']"><a-button type="text" size="small" class="process-sequence__insert" :aria-label="t('add')"><PlusOutlined /></a-button><template #overlay><a-menu @click="({ key }) => insert(index + 1, String(key))"><a-menu-item v-for="kind in kinds" :key="kind">{{ t(kind) }}</a-menu-item></a-menu></template></a-dropdown>
    </template>
    <a-dropdown v-if="!readonly && !steps.length" :trigger="['click']"><a-button type="dashed" block @click.stop><PlusOutlined />{{ t('add') }}</a-button><template #overlay><a-menu @click="({ key }) => insert(0, String(key))"><a-menu-item v-for="kind in kinds" :key="kind">{{ t(kind) }}</a-menu-item></a-menu></template></a-dropdown>
    <span v-else-if="readonly && !steps.length" class="process-sequence__empty">—</span>
  </div>
</template>
<style scoped>
.process-sequence { display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0; width:100% }
.process-sequence__connector { color:var(--ant-color-text-tertiary); height:20px }.process-sequence__empty { color:var(--ant-color-text-tertiary) }
.process-node { width:100%; border:1px solid var(--ant-color-border-secondary,#e8e8e8); border-radius:8px; background:var(--ant-color-bg-container,#fff); overflow:hidden }
.process-node--selected { border-color:var(--ant-color-primary,#1677ff); box-shadow:0 0 0 1px var(--ant-color-primary,#1677ff) }.process-node--active { border-inline-start:4px solid var(--ant-color-success,#52c41a) }
.process-node__heading { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 8px }.process-node__select { height:auto; text-align:start; min-width:0; flex:1; white-space:normal }
.process-node__select strong { display:block; overflow-wrap:anywhere }.process-node__kind { font-size:12px; color:var(--ant-color-text-secondary) }
.process-node__lanes { display:grid; gap:12px; padding:12px; background:var(--ant-color-fill-quaternary,#fafafa) }.process-node__lanes--parallel { grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr)) }
.process-node__lane { min-width:0; border-inline-start:2px solid var(--ant-color-border-secondary,#e8e8e8); padding-inline-start:10px }.process-node__lane-title { font-size:12px; color:var(--ant-color-text-secondary); padding-block:0 4px }
.process-sequence__insert { color:var(--ant-color-text-tertiary) }
</style>

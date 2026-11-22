<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MathExpressionEditor from '../Expression/MathExpressionEditor.vue'
import { processMessages } from './messages'
import { literal, processId, processReferences, removeProcessStep, updateProcess } from './model'
import type { ProcessStep, ProcessTemplate } from './types'
import type { StructuredExpression } from '../Expression/types'
const props = defineProps<{ template: ProcessTemplate; step: ProcessStep; readonly?: boolean }>()
const emit = defineEmits<{ change: [value: ProcessTemplate] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const context = computed(() => ({ references: processReferences(props.template), functions: [], disabled: props.readonly }))
function patch(values: Record<string, unknown>) { emit('change', updateProcess(props.template, props.step.id, step => Object.assign(step, values))) }
function rename(value: string) { emit('change', { ...props.template, stepNames: { ...props.template.stepNames, [props.step.id]: value } }) }
function chooseAction(action: string) {
  patch({ action, arguments: Object.fromEntries(Object.entries(props.template.actions[action]?.parameters || {}).map(([key, type]) => [key, literal(type === 'number' ? 0 : type === 'boolean' ? false : '')])) })
}
function argument(key: string, value: StructuredExpression) { if (props.step.type === 'action') patch({ arguments: { ...props.step.arguments, [key]: value } }) }
function addInterruption() {
  if (props.step.type === 'scope') patch({ interruptions: [...props.step.interruptions, { id: processId(), priority: props.step.interruptions.length, condition: { expression: literal(false) }, handler: [], onUnavailable: [] }] })
}
function interruption(index: number, values: Record<string, unknown>) {
  if (props.step.type === 'scope') patch({ interruptions: props.step.interruptions.map((item, i) => i === index ? { ...item, ...values } : item) })
}
</script>
<template>
  <a-form layout="vertical" :disabled="readonly" class="process-step-editor">
    <a-form-item :label="t('name')"><a-input :value="template.stepNames[step.id] || ''" @update:value="rename" /></a-form-item>
    <template v-if="step.type === 'action'">
      <a-form-item :label="t('action')"><a-select :value="step.action || undefined" :placeholder="t('choose')" :options="Object.entries(template.actions).map(([value,item]) => ({value,label:item.name || value}))" @update:value="value => chooseAction(String(value))" /></a-form-item>
      <a-form-item v-for="(value,key) in step.arguments" :key="key" :label="String(key)"><MathExpressionEditor :model-value="value" :context="context" :disabled="readonly" @update:model-value="argument(String(key), $event)" /></a-form-item>
    </template>
    <a-form-item v-if="step.type === 'branch' || step.type === 'wait'" :label="t('condition')"><MathExpressionEditor :model-value="step.condition.expression" :context="context" :disabled="readonly" @update:model-value="patch({condition:{expression:$event}})" /></a-form-item>
    <a-form-item v-if="step.type === 'action' || step.type === 'wait'" :label="t('timeout')"><a-input-number :value="step.timeoutMillis / 1000" :min="0.001" @update:value="value => patch({timeoutMillis:Number(value) * 1000})" /></a-form-item>
    <a-form-item v-if="step.type === 'wait'" :label="t('stable')"><a-input-number :value="step.stableMillis / 1000" :min="0" @update:value="value => patch({stableMillis:Number(value) * 1000})" /></a-form-item>
    <a-form-item v-if="step.type === 'repeat'" :label="t('count')"><a-input-number :value="step.count" :min="1" :max="10000" :precision="0" @update:value="value => patch({count:Number(value)})" /></a-form-item>
    <template v-if="step.type === 'end'">
      <a-form-item :label="t('outcome')"><a-select :value="step.outcome" :options="['completed','stopped','interrupted','failed','handed_off'].map(value => ({value,label:t(value)}))" @update:value="value => patch({outcome:value})" /></a-form-item>
      <a-form-item :label="t('reason')"><a-input :value="step.reason" @update:value="value => patch({reason:value})" /></a-form-item>
    </template>
    <a-space v-if="step.type === 'parallel'"><a-button @click="patch({branches:[...step.branches,[]]})">{{ t('add') }}{{ t('parallelBranch') }}</a-button><a-button :disabled="step.branches.length <= 1" @click="patch({branches:step.branches.slice(0,-1)})">{{ t('remove') }}{{ t('parallelBranch') }}</a-button></a-space>
    <template v-if="step.type === 'scope'">
      <a-divider>{{ t('interruption') }}</a-divider>
      <section v-for="(item,index) in step.interruptions" :key="item.id">
        <a-form-item :label="`${t('interruption')} ${index + 1} · ${t('priority')}`"><a-input-number :value="item.priority" :precision="0" @update:value="value => interruption(index,{priority:Number(value)})" /></a-form-item>
        <a-form-item :label="t('condition')"><MathExpressionEditor :model-value="item.condition.expression" :context="context" :disabled="readonly" @update:model-value="interruption(index,{condition:{expression:$event}})" /></a-form-item>
        <a-button danger type="text" @click="patch({interruptions:step.interruptions.filter((_,i)=>i!==index)})">{{ t('remove') }}</a-button>
      </section>
      <a-button block @click="addInterruption">{{ t('addInterruption') }}</a-button>
    </template>
    <a-divider v-if="step.id !== template.root.id" />
    <a-button v-if="step.id !== template.root.id && !readonly" danger block @click="emit('change', removeProcessStep(template,step.id))">{{ t('remove') }}{{ t(step.type) }}</a-button>
  </a-form>
</template>
<style scoped>.process-step-editor :deep(.ant-input-number) { width:100% }</style>

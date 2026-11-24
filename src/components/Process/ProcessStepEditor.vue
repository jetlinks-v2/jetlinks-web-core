<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MathExpressionEditor from '../Expression/MathExpressionEditor.vue'
import { processMessages } from './messages'
import { insertProcessStep, literal, processId, processReferences, processSteps, removeProcessStep, updateProcess } from './model'
import ProcessPathMenu from './ProcessPathMenu.vue'
import type { ProcessStep, ProcessTemplate } from './types'
import type { StructuredExpression } from '../Expression/types'
const props = defineProps<{ template: ProcessTemplate; step: ProcessStep; readonly?: boolean }>()
const emit = defineEmits<{ change: [value: ProcessTemplate] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const context = computed(() => ({ references: processReferences(props.template), functions: [], disabled: props.readonly }))
const actionSteps = computed(() => processSteps(props.template.root).filter(step => step.type === 'action').map(step => ({
  value: step.id, label: props.template.stepNames[step.id] || (step.type === 'action' && props.template.actions[step.action]?.name) || t('action'),
})))
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
function addPath(lane:string,type:ProcessStep['type']) { emit('change',insertProcessStep(props.template,props.step.id,lane,0,type)) }
</script>
<template>
  <section class="process-step-editor" :aria-label="t(step.type)">
    <a-input class="process-step-editor__name" :value="template.stepNames[step.id] || ''" :disabled="readonly" :bordered="false" :placeholder="t(step.type)" :aria-label="t('name')" @update:value="rename" />
    <template v-if="step.type === 'action'">
      <i18n-t keypath="runAction" tag="div" class="process-step-editor__sentence"><template #action><a-select :value="step.action || undefined" :disabled="readonly" :aria-label="t('action')" :placeholder="t('choose')" :options="Object.entries(template.actions).map(([value,item]) => ({value,label:item.name || value}))" @update:value="value => chooseAction(String(value))" /></template></i18n-t>
      <section v-for="(value,key) in step.arguments" :key="key" class="process-step-editor__condition"><span>{{ key }}</span><MathExpressionEditor :model-value="value" :context="context" :disabled="readonly" @update:model-value="argument(String(key), $event)" /></section>
      <ProcessPathMenu v-if="!readonly && !step.onRejected?.length" :label="t('addRejectedHandler')" @choose="addPath('onRejected',$event)" />
    </template>
    <section v-if="step.type === 'branch' || step.type === 'wait'" class="process-step-editor__condition"><span>{{ t('whenTrue') }}</span><MathExpressionEditor :model-value="step.condition.expression" :context="context" :disabled="readonly" @update:model-value="patch({condition:{expression:$event}})" /></section>
    <i18n-t v-if="step.type === 'wait'" keypath="holdFor" tag="div" class="process-step-editor__sentence">
      <template #timing><a-select :value="step.timing || 'continuous'" :disabled="readonly" :aria-label="t('timing')" :options="[{value:'continuous',label:t('continuousHold')},{value:'cumulative',label:t('cumulative')}]" @update:value="value => patch({timing:value})" /></template>
      <template #seconds><a-input-number :value="step.stableMillis / 1000" :disabled="readonly" :aria-label="t('stable')" :min="0" @update:value="value => patch({stableMillis:Number(value) * 1000})" /></template>
    </i18n-t>
    <i18n-t v-if="step.type === 'action' || step.type === 'wait'" keypath="withinSeconds" tag="div" class="process-step-editor__sentence"><template #seconds><a-input-number :value="step.timeoutMillis / 1000" :disabled="readonly" :aria-label="t('timeout')" :min="0.001" @update:value="value => patch({timeoutMillis:Number(value) * 1000})" /></template></i18n-t>
    <a-select v-if="step.type === 'wait'" :value="step.afterAction || undefined" :disabled="readonly" allow-clear :aria-label="t('afterAction')" :placeholder="t('noBarrier')" :options="actionSteps" @update:value="value => patch({afterAction:value || undefined})" />
    <ProcessPathMenu v-if="step.type === 'wait' && !readonly && !step.onUnavailable.length" :label="t('addUnavailableHandler')" @choose="addPath('onUnavailable',$event)" />
    <i18n-t v-if="step.type === 'delay'" keypath="waitSeconds" tag="div" class="process-step-editor__sentence"><template #seconds><a-input-number :value="step.durationMillis / 1000" :disabled="readonly" :aria-label="t('duration')" :min="0.001" @update:value="value => patch({durationMillis:Number(value) * 1000})" /></template></i18n-t>
    <i18n-t v-if="step.type === 'repeat'" keypath="repeatTimes" tag="div" class="process-step-editor__sentence"><template #count><a-input-number :value="step.count" :disabled="readonly" :aria-label="t('count')" :min="1" :max="10000" :precision="0" @update:value="value => patch({count:Number(value)})" /></template></i18n-t>
    <template v-if="step.type === 'end'">
      <a-select :value="step.outcome" :disabled="readonly" :aria-label="t('outcome')" :options="['completed','stopped','interrupted','failed','handed_off'].map(value => ({value,label:t(value)}))" @update:value="value => patch({outcome:value})" />
      <a-input :value="step.reason" :disabled="readonly" :aria-label="t('reason')" :placeholder="t('reason')" @update:value="value => patch({reason:value})" />
    </template>
    <template v-if="step.type === 'scope'">
      <ProcessPathMenu v-if="!readonly && !step.onStop.length" :label="t('addStopHandler')" @choose="addPath('onStop',$event)" />
      <section v-if="step.permit" class="process-step-editor__condition"><span>{{ t('permit') }}</span><MathExpressionEditor :model-value="step.permit.expression" :context="context" :disabled="readonly" @update:model-value="patch({permit:{expression:$event}})" /><a-button v-if="!readonly" type="text" @click="patch({permit:undefined})">{{ t('remove') }}</a-button></section>
      <a-button v-else-if="!readonly" type="text" @click="patch({permit:{expression:literal(false)}})">{{ t('addPermit') }}</a-button>
      <section v-if="step.executionPermit" class="process-step-editor__condition"><span>{{ t('executionPermit') }}</span><MathExpressionEditor :model-value="step.executionPermit.expression" :context="context" :disabled="readonly" @update:model-value="patch({executionPermit:{expression:$event}})" /><a-button v-if="!readonly" type="text" @click="patch({executionPermit:undefined})">{{ t('remove') }}</a-button></section>
      <a-button v-else-if="!readonly" type="text" @click="patch({executionPermit:{expression:literal(false)}})">{{ t('addExecutionPermit') }}</a-button>
      <section v-for="(item,index) in step.interruptions" :key="item.id" class="process-step-editor__condition">
        <span>{{ t('interruption') }} {{ index + 1 }}</span>
        <MathExpressionEditor :model-value="item.condition.expression" :context="context" :disabled="readonly" @update:model-value="interruption(index,{condition:{expression:$event}})" />
        <div class="process-step-editor__sentence"><span>{{ t('priority') }}</span><a-input-number :value="item.priority" :disabled="readonly" :aria-label="t('priority')" :precision="0" @update:value="value => interruption(index,{priority:Number(value)})" /><a-button v-if="!readonly" danger type="text" @click="patch({interruptions:step.interruptions.filter((_,i)=>i!==index)})">{{ t('remove') }}</a-button></div>
        <ProcessPathMenu v-if="!readonly && !item.onUnavailable.length" :label="t('addUnavailableHandler')" @choose="addPath(`interruptions.${index}.onUnavailable`,$event)" />
      </section>
      <a-button v-if="!readonly" type="text" @click="addInterruption">{{ t('addInterruption') }}</a-button>
    </template>
    <a-divider v-if="step.id !== template.root.id" />
    <a-button v-if="step.id !== template.root.id && !readonly" danger block @click="emit('change', removeProcessStep(template,step.id))">{{ t('remove') }}{{ t(step.type) }}</a-button>
  </section>
</template>
<style scoped>
.process-step-editor { display:grid; gap:16px; min-width:0 }.process-step-editor__name { font-size:16px; font-weight:500; padding-inline:0 }
.process-step-editor__sentence { display:flex; align-items:center; gap:6px; flex-wrap:wrap; line-height:2 }.process-step-editor__sentence :deep(.ant-select) { min-width:130px; max-width:100% }
.process-step-editor__sentence :deep(.ant-input-number) { width:90px }.process-step-editor__condition { display:grid; gap:8px; padding-inline-start:12px; border-inline-start:2px solid var(--ant-color-border-secondary,#e8e8e8) }
</style>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ObjectInputValue from '../ObjectOverview/ObjectInputValue.vue'
import ProcessMemberField from './ProcessMemberField.vue'
import { copyProcess } from './model'
import { processMessages } from './messages'
import type { ProcessBinding, ProcessTemplate, ProcessObject, ProcessMember } from './types'
const props = defineProps<{ modelValue: ProcessBinding; template: ProcessTemplate; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: ProcessBinding] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const subjectType = computed(() => props.modelValue.application === 'self' ? props.modelValue.owner.type : props.modelValue.scope?.memberType || 'device')
const patch = (value: Partial<ProcessBinding>) => emit('update:modelValue', { ...props.modelValue, ...value })
function inputMember(id: string) {
  const input = props.modelValue.inputs[id]
  return input ? {provider:input.source.provider === 'metric-results' ? `metric:${input.source.configuration.configId}` : String(input.source.configuration.memberProvider || ''),id:input.member} : undefined
}
function input(id: string, value: { object: ProcessObject; member: ProcessMember }) {
  const { member, object } = value
  patch({ inputs: { ...props.modelValue.inputs, [id]: { member:member.ref.id, maxAgeMillis: props.modelValue.inputs[id]?.maxAgeMillis || 60000,
    source:{...(member.source || {provider:'objects',sourceType:member.ref.kind,configuration:{memberProvider:member.ref.providerId}}),subject:{type:object.type,id:object.id}} } } })
}
function action(id: string, value: { object: ProcessObject; member: ProcessMember }) {
  patch({ actions: { ...props.modelValue.actions, [id]: { provider:'object',object:value.object,capability:value.member.ref.id,parameters:{memberProvider:value.member.ref.providerId} } } })
}
function application(value: ProcessBinding['application']) {
  patch({ application:value, scope:value === 'members' ? {provider:'objects',memberType:'device',depth:'descendants'} : undefined,
    inputs:{},actions:{} })
}
function freshness(id: string, seconds: number) { const next = copyProcess(props.modelValue.inputs); if (next[id]) { next[id].maxAgeMillis = seconds * 1000; patch({inputs:next}) } }
function memberType(value: string) { patch({scope:{...props.modelValue.scope!,memberType:value},inputs:{},actions:{}}) }
</script>
<template>
  <a-form layout="vertical" :disabled="readonly" class="process-binding-editor">
    <a-form-item :label="t('slot')" required><a-input :value="modelValue.slot" :disabled="modelValue.revision > 0" @update:value="slot => patch({slot})" /></a-form-item>
    <a-form-item :label="t('depth')"><a-radio-group :value="modelValue.application" @update:value="application"><a-radio-button value="self">{{ t('self') }}</a-radio-button><a-radio-button value="members">{{ t('members') }}</a-radio-button></a-radio-group></a-form-item>
    <template v-if="modelValue.application === 'members'">
      <a-form-item :label="t('memberType')"><a-input :value="modelValue.scope?.memberType" @update:value="memberType" /></a-form-item>
      <a-form-item :label="t('depth')"><a-select :value="modelValue.scope?.depth" :options="['direct','descendants'].map(value => ({value,label:t(value)}))" @update:value="value => patch({scope:{...modelValue.scope!,depth:String(value)}})" /></a-form-item>
    </template>
    <a-form-item :label="t('enabled')"><a-switch :checked="modelValue.enabled" @update:checked="enabled => patch({enabled:!!enabled})" /></a-form-item>
    <a-collapse ghost><a-collapse-panel key="priority" :header="t('advanced')"><a-form-item :label="t('priority')"><a-input-number :value="modelValue.priority" :precision="0" @update:value="value => patch({priority:Number(value)})" /></a-form-item></a-collapse-panel></a-collapse>
    <h3 v-if="Object.keys(template.inputs).length">{{ t('inputs') }}</h3>
    <section v-for="(declaration,id) in template.inputs" :key="id" class="process-binding-editor__mapping">
      <a-form-item :label="declaration.name || id" required><ProcessMemberField :object="modelValue.inputs[id]?.source.subject" :member="inputMember(String(id))" kind="input" :declaration="declaration" :subject-type="subjectType" :readonly="readonly" @select="input(id,$event)" /></a-form-item>
      <a-form-item :label="t('freshness')"><a-input-number :value="(modelValue.inputs[id]?.maxAgeMillis || 60000) / 1000" :min="0.001" @update:value="value => freshness(id,Number(value))" /></a-form-item>
    </section>
    <h3 v-if="Object.keys(template.actions).length">{{ t('actions') }}</h3>
    <a-form-item v-for="(declaration,id) in template.actions" :key="id" :label="declaration.name || id" required><ProcessMemberField :object="modelValue.actions[id]?.object" :member="modelValue.actions[id] ? {provider:String(modelValue.actions[id].parameters.memberProvider || ''),id:modelValue.actions[id].capability} : undefined" kind="action" :subject-type="subjectType" :readonly="readonly" @select="action(id,$event)" /></a-form-item>
    <h3 v-if="Object.keys(template.parameters).length">{{ t('parameters') }}</h3>
    <a-form-item v-for="(value,id) in template.parameters" :key="id" :label="id"><ObjectInputValue :field="{id,valueType:{type:typeof value === 'number' ? 'double' : typeof value}}" :model-value="modelValue.parameters[id] ?? value" @update:model-value="next => patch({parameters:{...modelValue.parameters,[id]:next}})" /></a-form-item>
  </a-form>
</template>
<style scoped>.process-binding-editor { display:grid; gap:4px }.process-binding-editor h3 { font-size:14px; margin-block:12px }.process-binding-editor__mapping { border-bottom:1px solid var(--ant-color-border-secondary,#eee); margin-bottom:12px }</style>

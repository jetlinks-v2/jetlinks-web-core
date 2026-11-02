<template>
  <div class="metric-declarations">
      <div v-for="(parameter, index) in template.parameterDefinitions" :key="index" class="metric-declarations__row">
        <a-form layout="vertical" :disabled="disabled">
          <a-form-item :label="t('declarationId')"><a-input :value="parameter.id" @update:value="parameterField(index, { id: $event })" /></a-form-item>
          <a-form-item :label="t('label')"><a-input :value="parameter.name" @update:value="parameterField(index, { name: $event })" /></a-form-item>
          <a-form-item :label="t('parameterType')">
            <a-select :value="parameter.valueType?.type || 'string'" :options="parameterTypes"
              @update:value="parameterField(index, { valueType: { ...parameter.valueType, type: String($event) } })" />
          </a-form-item>
          <a-form-item :label="t('editableParameter')">
            <a-switch :checked="parameter.expands?.editable === true"
              @update:checked="parameterField(index, { expands: { ...parameter.expands, editable: $event } })" />
          </a-form-item>
          <a-form-item :label="t('defaultValue')">
            <MetricParameterValue :parameter="parameter"
              :model-value="templateParameterDefault(template, parameter)" @update:model-value="defaultField(parameter.id, $event)" />
          </a-form-item>
        </a-form>
        <a-button v-if="!disabled" type="text" danger @click="remove(index)">{{ t('remove') }}</a-button>
      </div>
    <a-button v-if="!disabled" type="dashed" block @click="add">{{ t('addItem') }}</a-button>
  </div>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MetricParameterValue from '../MetricParameterValue.vue'
import { metricMessages } from '../messages'
import { removeTemplateParameter, templateParameterDefault, updateTemplateParameter } from './parameters'
import type { MetricParameter, MetricTemplate } from '../types'
const props = defineProps<{ template: MetricTemplate; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'update:template', template: MetricTemplate): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const parameterTypes = ['string', 'double', 'int', 'long', 'boolean', 'object', 'array'].map(value => ({ label: value, value }))
function parameterField(index: number, fields: Partial<MetricParameter>) {
  if (props.disabled) return
  emit('update:template', updateTemplateParameter(props.template, index, fields))
}
function defaultField(id: string, value: unknown) {
  if (props.disabled) return
  emit('update:template', { ...props.template, parameters: { ...props.template.parameters, [id]: value } })
}
function remove(index: number) {
  if (!props.disabled) emit('update:template', removeTemplateParameter(props.template, index))
}
function add() {
  const template = props.template
  if (!props.disabled) emit('update:template', { ...template, parameterDefinitions: [...template.parameterDefinitions, { id: '', name: '', valueType: { type: 'double' }, expands: { editable: false } }] })
}
</script>
<style scoped>
.metric-declarations { display:grid; gap:var(--space-3,12px) }
.metric-declarations__row { display:flex; align-items:flex-start; border-bottom:1px solid var(--line); gap:var(--space-2,8px) }
.metric-declarations__row .ant-form { flex:1; display:grid; grid-template-columns:repeat(2,minmax(100px,1fr)); gap:0 var(--space-3,12px) }
@media(max-width:600px) { .metric-declarations__row .ant-form { grid-template-columns:1fr } }
</style>

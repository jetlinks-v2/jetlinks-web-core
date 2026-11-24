<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ObjectInputValue from '../ObjectOverview/ObjectInputValue.vue'
import type { ProcessAction, ProcessInput, ProcessTemplate } from './types'
import { copyProcess, patchProcessAction } from './model'
import { processMessages } from './messages'
const props = defineProps<{ modelValue: ProcessTemplate; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: ProcessTemplate] }>()
const { t } = useI18n({ useScope: 'local', messages: processMessages })
const types = ['boolean', 'number', 'string', 'object'] as const
const newKeys = ref<Record<string, string>>({})
function update(change: (template: ProcessTemplate) => void) { const next = copyProcess(props.modelValue); change(next); emit('update:modelValue', next) }
function add(kind: 'inputs' | 'actions' | 'parameters') {
  const key = newKeys.value[kind]?.trim()
  if (!key || key === 'steps' || key in props.modelValue.inputs || key in props.modelValue.parameters || kind === 'actions' && key in props.modelValue.actions) return
  update(value => {
    if (kind === 'inputs') value.inputs[key] = { name: key, type: 'boolean' }
    if (kind === 'actions') value.actions[key] = { name: key, parameters: {}, completion: 'completed', semanticTypes: [] }
    if (kind === 'parameters') value.parameters[key] = 0
  }); newKeys.value[kind] = ''
}
const input = (key: string, values: Partial<ProcessInput>) => update(value => { value.inputs[key] = { ...value.inputs[key], ...values } })
const action = (key: string, values: Partial<ProcessAction>) => emit('update:modelValue',patchProcessAction(props.modelValue,key,values))
function addArgument(key: string) {
  const id = newKeys.value[key]?.trim()
  if (id && !(id in props.modelValue.actions[key].parameters)) { action(key, { parameters: { ...props.modelValue.actions[key].parameters, [id]: 'number' } }); newKeys.value[key] = '' }
}
const valueType = (value: unknown) => typeof value === 'number' ? 'double' : typeof value
</script>
<template>
  <div class="process-declarations">
    <section v-for="kind in (['inputs','actions','parameters'] as const)" :key="kind">
      <h3>{{ t(kind) }}</h3>
      <a-form layout="vertical" :disabled="readonly">
        <div v-for="(item,key) in modelValue[kind]" :key="key" class="process-declarations__item">
          <header><strong>{{ key }}</strong><a-popconfirm v-if="!readonly" :title="t('remove')" @confirm="update(value => { delete value[kind][key] })"><a-button type="text" danger size="small">{{ t('remove') }}</a-button></a-popconfirm></header>
          <template v-if="kind === 'inputs'">
            <a-form-item :label="t('name')"><a-input :value="modelValue.inputs[key].name" @update:value="name => input(key,{name})" /></a-form-item>
            <div class="process-declarations__row"><a-form-item :label="t('type')"><a-select :value="modelValue.inputs[key].type" :options="types.map(value => ({value,label:t(value)}))" @update:value="value => input(key,{type:value as ProcessInput['type']})" /></a-form-item><a-form-item :label="t('unit')"><a-input :value="modelValue.inputs[key].unit" @update:value="unit => input(key,{unit})" /></a-form-item></div>
            <a-form-item :label="t('semantics')"><a-select mode="tags" :value="modelValue.inputs[key].semantics?.semanticTypes || []" @update:value="value => input(key,{semantics:{...modelValue.inputs[key].semantics,semanticTypes:value as string[]}})" /></a-form-item>
          </template>
          <template v-if="kind === 'actions'">
            <a-form-item :label="t('name')"><a-input :value="modelValue.actions[key].name" @update:value="name => action(key,{name})" /></a-form-item>
            <a-form-item :label="t('completion')"><a-select :value="modelValue.actions[key].completion" :options="['completed','accepted'].map(value => ({value,label:t(value)}))" @update:value="value => action(key,{completion:value as ProcessAction['completion']})" /></a-form-item>
            <a-form-item :label="t('semantics')"><a-select mode="tags" :value="modelValue.actions[key].semanticTypes" @update:value="value => action(key,{semanticTypes:value as string[]})" /></a-form-item>
            <a-form-item v-for="(type,id) in modelValue.actions[key].parameters" :key="id" :label="String(id)"><a-space><a-select style="width:140px" :value="type" :options="types.map(value => ({value,label:t(value)}))" @update:value="value => action(key,{parameters:{...modelValue.actions[key].parameters,[id]:String(value)}})" /><a-button type="text" danger @click="action(key,{parameters:Object.fromEntries(Object.entries(modelValue.actions[key].parameters).filter(([name]) => name !== id))})">{{ t('remove') }}</a-button></a-space></a-form-item>
            <a-space v-if="!readonly"><a-input v-model:value="newKeys[key]" :placeholder="t('parameters')" @press-enter="addArgument(key)" /><a-button @click="addArgument(key)">{{ t('add') }}</a-button></a-space>
          </template>
          <template v-if="kind === 'parameters'">
            <a-form-item :label="t('type')"><a-select :value="typeof item === 'number' ? 'number' : typeof item" :options="types.filter(type => type !== 'object').map(value => ({value,label:t(value)}))" @update:value="type => update(value => { value.parameters[key] = type === 'number' ? 0 : type === 'boolean' ? false : '' })" /></a-form-item>
            <a-form-item :label="t('defaultValue')"><ObjectInputValue :field="{id:key,valueType:{type:valueType(item)}}" :model-value="item" @update:model-value="next => update(value => { value.parameters[key] = next })" /></a-form-item>
          </template>
        </div>
        <a-space v-if="!readonly" class="process-declarations__add"><a-input v-model:value="newKeys[kind]" :placeholder="t('key')" @press-enter="add(kind)" /><a-button :disabled="!newKeys[kind]?.trim()" @click="add(kind)">{{ t('add') }}</a-button></a-space>
      </a-form>
    </section>
  </div>
</template>
<style scoped>
.process-declarations { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr)); gap:24px }.process-declarations section { min-width:0 }.process-declarations h3 { font-size:14px }
.process-declarations__item { border-top:1px solid var(--ant-color-border-secondary,#eee); padding-block:12px }.process-declarations__item header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px }.process-declarations__row { display:grid; grid-template-columns:1fr 1fr; gap:12px }.process-declarations__add { margin-top:12px }
</style>

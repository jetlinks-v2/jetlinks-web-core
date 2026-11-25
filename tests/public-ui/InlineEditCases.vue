<template>
  <section class="fixture-section edit-cases-section">
    <h2>选择与日期</h2>
    <div class="edit-cases">
      <div><p>任务分组</p><Editable v-model:value="group" type="select" :component-props="{ options, defaultOpen: true, 'aria-label': '任务分组' }" /></div>
      <div><p>可见分组</p><Editable v-model:value="visibleGroups" type="select" :component-props="{ options, mode: 'multiple', defaultOpen: true, 'aria-label': '可见分组' }" /></div>
      <div><p>执行日期</p><Editable v-model:value="date" type="date" :component-props="{ valueFormat: 'YYYY-MM-DD', format: 'YYYY-MM-DD', 'aria-label': '执行日期' }" /></div>
      <div><p>统计周期</p><Editable v-model:value="period" type="dateRange" :component-props="{ valueFormat: 'YYYY-MM-DD', format: 'YYYY-MM-DD', 'aria-label': '统计周期' }"><span>{{ period.join(' — ') }}</span></Editable></div>
      <div><p>执行时间</p><Editable v-model:value="time" type="time" :component-props="{ valueFormat: 'HH:mm:ss', format: 'HH:mm:ss', 'aria-label': '执行时间' }" /></div>
      <div><p>处理时段</p><Editable v-model:value="timeRange" type="timeRange" :component-props="{ valueFormat: 'HH:mm:ss', format: 'HH:mm:ss', 'aria-label': '处理时段' }"><span>{{ timeRange.join(' — ') }}</span></Editable></div>
    </div>
  </section>
  <section class="fixture-section">
    <h2>多类型原位编辑</h2>
    <InlineEditForm :groups="groups" :messages="messages" :submit="save" @change="change">
      <template #editor="scope">
        <a-switch v-if="scope.field.key === 'enabled'" :id="scope.inputId" :checked="!!scope.value" :disabled="scope.disabled" :loading="scope.loading" :aria-labelledby="scope.labelId"
          @change="value => { scope.update(value); scope.commit() }" />
        <div v-else class="edit-cases__range" role="group" :aria-labelledby="scope.labelId" @focusout="scope.blur">
          <a-input-number :id="scope.inputId" :value="range(scope.value).min" :disabled="scope.disabled" :status="scope.error ? 'error' : undefined" aria-label="下限" @update:value="scope.update({ ...range(scope.value), min: $event ?? undefined })" />
          <span>—</span>
          <a-input-number :value="range(scope.value).max" :disabled="scope.disabled" :status="scope.error ? 'error' : undefined" aria-label="上限" @update:value="scope.update({ ...range(scope.value), max: $event ?? undefined })" />
        </div>
      </template>
    </InlineEditForm>
    <p class="fixture-counter">分组字段实际提交 {{ writes }} 次</p>
  </section>
  <section class="fixture-section" aria-label="通用表单编辑验收">
    <h2>通用信息表单</h2>
    <FormRenderer :fields="formFields" :layout="formLayout" :values="formValues" :submit="publish" />
    <p class="fixture-counter">通用表单实际保存 {{ publications }} 次</p>
  </section>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Editable from '../../src/components/Editable/index.vue'
import { InlineEditForm, type InlineEditFieldDefinition, type InlineEditGroup, type InlineEditSubmit } from '../../src/components/InlineEditForm'
import FormRenderer from '../../src/components/Form/FormRenderer.vue'
import type { FormField, FormLayout, FormSubmit } from '../../src/components/Form/types'
const options = [{ value: 'operations', label: '运行保障' }, { value: 'service', label: '技术服务' }, { value: 'records', label: '资料管理' }]
const group = ref('operations'), visibleGroups = ref(['operations'])
const date = ref('2026-11-25'), period = ref(['2026-11-01', '2026-11-30'])
const time = ref('09:00:00'), timeRange = ref(['09:00:00', '18:00:00'])
const copy = (value: unknown): unknown => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const draft = reactive<Record<string, unknown>>({ priority: 'normal', retries: 3, notes: '核对完成后记录结果。\n异常时保留处理过程。', enabled: true, limits: { min: 1, max: 10 } })
const saved = reactive<Record<string, unknown>>(copy(draft) as Record<string, unknown>)
const range = (value: unknown) => value as { min?: number; max?: number }
const writes = ref(0)
const messages = { save: '保存', cancel: '取消', empty: '未配置', saving: '保存中', failed: '保存失败，请重试' }
const groups = computed<InlineEditGroup[]>(() => [{ key: 'settings', fields: ([
  { key: 'priority', label: '处理优先级', editor: 'select', options: [{ value: 'normal', label: '普通' }, { value: 'urgent', label: '紧急' }] },
  { key: 'retries', label: '重试次数', editor: 'number', min: 0, max: 10 },
  { key: 'enabled', label: '启用处理', editor: 'custom', displayValue: saved.enabled ? '已启用' : '已停用' },
  { key: 'limits', label: '有效范围', editor: 'custom', displayValue: `${range(saved.limits).min} — ${range(saved.limits).max}` },
  { key: 'notes', label: '处理说明', editor: 'textarea', fullWidth: true },
] satisfies Omit<InlineEditFieldDefinition, 'value' | 'initialValue'>[]).map(field => ({ ...field, value: draft[field.key], initialValue: saved[field.key] })) }])
const change = (key: string, value: unknown) => { draft[key] = copy(value) }
const save: InlineEditSubmit = async (key, value) => {
  writes.value++
  if (key === 'limits') {
    const { min, max } = range(value)
    if (min === undefined || max === undefined || min > max) return { ok: false, error: '请填写完整范围，且下限不能大于上限' }
  }
  saved[key] = copy(value)
  return { ok: true }
}
const formFields: FormField[] = [
  { key:'name', label:'对象名称', type:'text' },
  { key:'enabled', label:'可用状态', type:'boolean' },
  { key:'groups', label:'关联分组', type:'enum', multiple:true, options },
  { key:'date', label:'生效日期', type:'date' },
  { key:'datetime', label:'执行时刻', type:'datetime' },
  { key:'notes', label:'变更说明', type:'textarea' },
]
const formLayout: FormLayout = { version:1, sections:[{id:'record',label:'对象资料',items:formFields.map(field=>({key:field.key,span:field.type==='textarea'?2:1}))}] }
const formValues = ref({name:'冷却回路',enabled:true,groups:['operations'],date:'2026-11-25',datetime:'2026-11-25T09:00:00',notes:'记录本次调整。\n保留现场核对过程。'})
const publications = ref(0)
const publish: FormSubmit = async values => { publications.value++; formValues.value = {...formValues.value,...values}; return {values:formValues.value} }
</script>
<style scoped>
.edit-cases { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--space-5); }
.edit-cases-section { container:inline-edit-cases / inline-size; }
.edit-cases p { margin:0 0 var(--space-2); color:var(--ink-2); font-size:var(--fs-12); }
.edit-cases__range { display:flex; align-items:center; gap:var(--space-2); }
.edit-cases__range > .ant-input-number { min-width:0; flex:1; }
@container inline-edit-cases (max-width:32rem) { .edit-cases { grid-template-columns:minmax(0,1fr); } }
</style>

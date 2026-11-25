<template>
  <section class="fixture-section edit-cases-section">
    <h2>选择与日期</h2>
    <p>此组确认只更新本页的值，不模拟请求。弹层选择、输入草稿与最终确认分别保留各自的操作方式。</p>
    <div class="edit-cases">
      <div><p>采样偏移（秒）</p><Editable v-model:value="interval" type="number" :component-props="{ 'aria-label': '采样偏移' }" /></div>
      <div><p>补充短句（可为空）</p><Editable v-model:value="shortNote" :component-props="{ 'aria-label': '补充短句' }" /></div>
      <div><p>任务分组</p><Editable v-model:value="group" type="select" :component-props="{ options, defaultOpen: true, 'aria-label': '任务分组' }" /></div>
      <div><p>可见分组</p><Editable v-model:value="visibleGroups" type="select" :component-props="{ options, mode: 'multiple', defaultOpen: true, 'aria-label': '可见分组' }" /></div>
      <div><p>检索标签（允许新标签）</p><Editable v-model:value="tags" type="select" :component-props="{ mode: 'tags', 'aria-label': '检索标签' }" /></div>
      <div><p>执行日期</p><Editable v-model:value="date" type="date" :component-props="{ valueFormat: 'YYYY-MM-DD', format: 'YYYY-MM-DD', 'aria-label': '执行日期' }" /></div>
      <div><p>统计周期</p><Editable v-model:value="period" type="dateRange" :component-props="{ valueFormat: 'YYYY-MM-DD', format: 'YYYY-MM-DD', placeholder: ['统计开始日期', '统计结束日期'], 'aria-label': '统计周期' }"><span>{{ period?.join(' — ') || '未设置' }}</span></Editable></div>
      <div><p>执行时间</p><Editable v-model:value="time" type="time" :component-props="{ valueFormat: 'HH:mm:ss', format: 'HH:mm:ss', 'aria-label': '执行时间' }" /></div>
      <div><p>处理时段</p><Editable v-model:value="timeRange" type="timeRange" :component-props="{ valueFormat: 'HH:mm:ss', format: 'HH:mm:ss', placeholder: ['处理开始时间', '处理结束时间'], 'aria-label': '处理时段' }"><span>{{ timeRange?.join(' — ') || '未设置' }}</span></Editable></div>
    </div>
  </section>
  <section class="fixture-section">
    <h2>多类型原位编辑</h2>
    <p>开关和单选代表可直接修改的提醒偏好；范围整体离开后校验，巡检对象在弹窗确认后才接受。此处不执行设备命令。</p>
    <div class="edit-cases__actions"><a-checkbox v-model:checked="disabled">禁用本组编辑（示例）</a-checkbox><a-button :disabled="disabled" @click="details?.editField('manualNote')">编辑维护备注</a-button></div>
    <InlineEditForm ref="details" :groups="groups" :disabled="disabled" :messages="messages" :submit="save" @change="change">
      <template #editor="scope">
        <a-switch v-if="scope.field.key === 'enabled'" :id="scope.inputId" :checked="!!scope.value" :disabled="scope.disabled" :loading="scope.loading" :aria-labelledby="scope.labelId"
          @change="value => { scope.update(value); scope.commit() }" />
        <a-radio-group v-else-if="scope.field.key === 'channel'" :id="scope.inputId" :value="scope.value" :disabled="scope.disabled" role="radiogroup" :aria-labelledby="scope.labelId"
          :options="channels" @change="event => { scope.update(event.target.value); scope.commit() }" />
        <a-modal v-else-if="scope.field.key === 'asset'" open title="选择巡检对象" ok-text="确认对象" cancel-text="取消选择" :confirm-loading="scope.loading" :ok-button-props="{ disabled: scope.disabled }" @ok="scope.commit" @cancel="scope.cancel">
          <p>选择只改变当前草稿，确认后应用到本页；取消保留原对象。</p>
          <a-radio-group :id="scope.inputId" :value="scope.value" :options="assets" :disabled="scope.disabled" role="radiogroup" :aria-labelledby="scope.labelId" @change="event => scope.update(event.target.value)" />
        </a-modal>
        <div v-else class="edit-cases__range" role="group" :aria-labelledby="scope.labelId" @focusout="scope.blur">
          <a-input-number :id="scope.inputId" :value="range(scope.value).min" :disabled="scope.disabled" :status="scope.error ? 'error' : undefined" :aria-describedby="scope.describedBy" aria-label="下限" @update:value="scope.update({ ...range(scope.value), min: $event ?? undefined })" />
          <span>—</span>
          <a-input-number :value="range(scope.value).max" :disabled="scope.disabled" :status="scope.error ? 'error' : undefined" :aria-describedby="scope.describedBy" aria-label="上限" @update:value="scope.update({ ...range(scope.value), max: $event ?? undefined })" />
        </div>
      </template>
    </InlineEditForm>
    <p class="fixture-counter">分组字段模拟请求 {{ writes }} 次（含范围校验拒绝）</p>
  </section>
  <section class="fixture-section" aria-label="通用表单编辑验收">
    <h2>通用信息表单</h2>
    <p>字段内确认只进入表单草稿，顶部“保存”才接受整表修改。</p>
    <a-checkbox v-model:checked="failPublication">模拟下一次整表请求异常</a-checkbox>
    <FormRenderer :fields="formFields" :layout="formLayout" :values="formValues" :validate="validate" :submit="publish">
      <template #value-sampling="{ value }"><span>{{ sampling(value) == null ? '未配置' : `每 ${sampling(value)} 秒采集` }}</span></template>
      <template #editor-sampling="scope"><div class="edit-cases__actions">
        <a-input-number :value="sampling(scope.value) ?? undefined" :min="1" aria-label="采样策略间隔" @update:value="scope.update({ interval: $event })" /><span>秒（本例至少 1 秒）</span>
        <span class="fw-inline-actions"><a-button type="text" size="small" aria-label="放弃采样编辑" title="放弃本次修改" @click="scope.cancel"><CloseOutlined /></a-button><a-button type="text" size="small" aria-label="完成采样编辑" title="完成编辑，尚未整表保存" @click="scope.confirm"><CheckOutlined /></a-button></span>
      </div></template>
    </FormRenderer>
    <p class="fixture-counter">整表模拟请求 {{ publications }} 次，成功 {{ published }} 次</p>
  </section>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons-vue'
import Editable from '../../src/components/Editable/index.vue'
import { InlineEditForm, type InlineEditFieldDefinition, type InlineEditGroup, type InlineEditSubmit } from '../../src/components/InlineEditForm'
import FormRenderer from '../../src/components/Form/FormRenderer.vue'
import type { FormField, FormLayout, FormSubmit, FormValidate } from '../../src/components/Form/types'
const options = [{ value: 'operations', label: '运行保障' }, { value: 'service', label: '技术服务' }, { value: 'records', label: '资料管理' }]
const group = ref('operations'), visibleGroups = ref(['operations'])
const interval = ref(0), shortNote = ref(''), tags = ref(['现场核对'])
const date = ref('2026-11-25'), period = ref<string[] | null>(['2026-11-01', '2026-11-30'])
const time = ref('09:00:00'), timeRange = ref<string[] | null>(['09:00:00', '18:00:00'])
const copy = (value: unknown): unknown => value === undefined ? undefined : JSON.parse(JSON.stringify(value))
const draft = reactive<Record<string, unknown>>({ priority: 'normal', retries: 3, notes: '核对完成后记录结果。\n异常时保留处理过程。', enabled: true, channel: 'inbox', asset: 'pump', limits: { min: 1, max: 10 }, token: '', manualNote: '每月核对一次', recordId: 'REC-001' })
const saved = reactive<Record<string, unknown>>(copy(draft) as Record<string, unknown>)
const range = (value: unknown) => value as { min?: number; max?: number }
const writes = ref(0)
const details = ref<InstanceType<typeof InlineEditForm>>()
const disabled = ref(false), credentialSet = ref(true)
const channels = [{ value:'inbox', label:'站内消息' },{ value:'email', label:'邮件' }]
const assets = [{ value:'pump', label:'循环水泵' },{ value:'valve', label:'回水阀门' }]
const messages = { save: '保存', cancel: '取消', empty: '未配置', saving: '保存中', failed: '保存失败，请重试' }
const groups = computed<InlineEditGroup[]>(() => [{ key: 'settings', fields: ([
  { key: 'priority', label: '处理优先级', editor: 'select', options: [{ value: 'normal', label: '普通' }, { value: 'urgent', label: '紧急' }] },
  { key: 'retries', label: '重试次数', editor: 'number', min: 0, precision: 0 },
  { key: 'enabled', label: '接收处理提醒', editor: 'custom', displayValue: saved.enabled ? '接收' : '不接收' },
  { key: 'channel', label: '提醒方式', editor: 'custom', displayValue: channels.find(item => item.value === saved.channel)?.label },
  { key: 'asset', label: '巡检对象', editor: 'custom', displayValue: assets.find(item => item.value === saved.asset)?.label },
  { key: 'limits', label: '有效范围', editor: 'custom', displayValue: `${range(saved.limits).min} — ${range(saved.limits).max}` },
  { key: 'notes', label: '处理说明', editor: 'textarea', fullWidth: true },
  { key: 'token', label: '示例访问凭据', editor: 'password', secretSet: credentialSet.value, hint: '仅输入虚构值；页面只保留是否设置，确认后清空输入。' },
  { key: 'manualNote', label: '维护备注', editTrigger: 'manual' },
  { key: 'recordId', label: '对象编号', readonly: true },
] satisfies Omit<InlineEditFieldDefinition, 'value' | 'initialValue'>[]).map(field => ({ ...field, value: draft[field.key], initialValue: saved[field.key] })) }])
const change = (key: string, value: unknown) => { draft[key] = copy(value) }
const save: InlineEditSubmit = async (key, value) => {
  writes.value++
  if (key === 'token') { credentialSet.value = true; draft.token = ''; return { ok: true } }
  if (key === 'limits') {
    const { min, max } = range(value)
    if (min === undefined || max === undefined || min > max) return { ok: false, error: '请填写完整范围，且下限不能大于上限' }
  }
  saved[key] = copy(value)
  return { ok: true }
}
const formFields: FormField[] = [
  { key:'name', label:'对象名称', type:'text' },
  { key:'enabled', label:'允许接收提醒', type:'boolean' },
  { key:'retries', label:'失败重试次数', type:'number' },
  { key:'channel', label:'提醒渠道', type:'enum', options: channels },
  { key:'groups', label:'关联分组', type:'enum', multiple:true, options },
  { key:'date', label:'生效日期', type:'date' },
  { key:'datetime', label:'执行时刻', type:'datetime' },
  { key:'notes', label:'变更说明', type:'textarea' },
  { key:'sampling', label:'采样策略', type:'custom', renderer:'sampling' },
  { key:'recordId', label:'固定对象编号', type:'text', readonly:true },
]
const formLayout: FormLayout = { version:1, sections:[{id:'record',label:'对象资料',items:formFields.map(field=>({key:field.key,span:field.type==='textarea'?2:1}))}] }
const formValues = ref({name:'冷却回路',enabled:false,retries:0,channel:'inbox',groups:['operations'],date:'2026-11-25',datetime:'2026-11-25T09:00:00',notes:'记录本次调整。\n保留现场核对过程。',sampling:{interval:30},recordId:'LOOP-001'})
const sampling = (value: unknown) => (value as { interval?: number | null } | undefined)?.interval
const validate: FormValidate = (value, field) => {
  if (field.key !== 'sampling') return
  const interval = sampling(value)
  return typeof interval === 'number' && interval >= 1 ? undefined : '本例采样间隔至少为 1 秒'
}
const publications = ref(0), published = ref(0), failPublication = ref(false)
const publish: FormSubmit = async values => {
  publications.value++
  if (failPublication.value) { failPublication.value = false; throw new Error('模拟整表请求异常，请重试') }
  published.value++; formValues.value = {...formValues.value,...values}; return {values:formValues.value}
}
</script>
<style scoped>
.edit-cases { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--space-5); }
.edit-cases-section { container:inline-edit-cases / inline-size; }
.edit-cases p { margin:0 0 var(--space-2); color:var(--ink-2); font-size:var(--fs-12); }
.edit-cases__range { display:flex; align-items:center; gap:var(--space-2); }
.edit-cases__range > .ant-input-number { min-width:0; flex:1; }
.edit-cases__actions { display:flex; flex-wrap:wrap; align-items:center; gap:var(--space-3); margin-bottom:var(--space-4); }
@container inline-edit-cases (max-width:32rem) { .edit-cases { grid-template-columns:minmax(0,1fr); } }
</style>

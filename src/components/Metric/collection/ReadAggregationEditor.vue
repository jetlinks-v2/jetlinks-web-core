<template>
  <details class="read-policy">
    <summary><AIcon type="ClusterOutlined" /> {{ t('policy') }}<small>{{ policy ? t(policy.defaultOperation) : t('legacy') }}</small></summary>
    <p>{{ t('policyHint') }}</p>
    <a-switch :checked="!!policy" :disabled="disabled" :checked-children="t('enable')" :un-checked-children="t('legacy')" @change="toggle($event as boolean)" />
    <template v-if="policy">
      <TemplateClause icon="TagOutlined" :title="t('semantic')"><Editable type="select" :value="policy.semantic" :component-props="{ options:semantics, disabled, bordered:false, dropdownMatchSelectWidth:false }" @change="changeSemantic($event as ReadSemantic)" /></TemplateClause>
      <a-checkbox v-if="policy.semantic === 'quantity'" :checked="policy.exclusiveContributions" :disabled="disabled" @change="changeExclusive($event.target.checked)">{{ t('exclusive') }}</a-checkbox>
      <small v-if="policy.semantic === 'quantity'">{{ t('exclusiveHint') }}</small>
      <div class="read-policy__operations"><button v-for="item in compatible" :key="item" type="button" :disabled="disabled || item === 'collection'" :class="{ active:policy.operations.includes(item) }" :aria-pressed="policy.operations.includes(item)" @click="toggleOperation(item)"><AIcon :type="policy.operations.includes(item) ? 'CheckOutlined' : 'PlusOutlined'" />{{ t(item) }}</button></div>
      <TemplateClause icon="CalculatorOutlined" :title="t('defaultOperation')"><Editable type="select" :value="policy.defaultOperation" :component-props="{ options:policy.operations.map(value => ({ value, label:t(value), icon:'CalculatorOutlined', description:t('operationHint') })), disabled, bordered:false, dropdownMatchSelectWidth:false }" @change="patch({ defaultOperation:$event as ReadOperation })" /></TemplateClause>
      <TemplateClause icon="BarChartOutlined" :title="t('defaultView')"><Editable type="select" :value="policy.defaultView" :component-props="{ options:['list','bars'].map(value => ({ value, label:t(value), icon:value === 'list' ? 'UnorderedListOutlined' : 'BarChartOutlined', description:t('readOnly') })), disabled, bordered:false }" @change="patch({ defaultView:$event as 'list' | 'bars' })" /></TemplateClause>
    </template>
  </details>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Editable from '../../Editable/index.vue'
import TemplateClause from '../template/TemplateClause.vue'
import { collectionMessages } from './messages'
import { compatibleReadOperations, readPolicy, suggestedReadSemantic, updateReadPolicy } from './aggregationPolicy'
import type { MetricTemplateOutput } from '../types'
import type { MetricReadAggregation, ReadOperation, ReadSemantic } from './types'
const props = defineProps<{ output:MetricTemplateOutput; disabled?:boolean }>()
const emit = defineEmits<{ (event:'patch', value:Record<string,unknown>):void }>()
const { t } = useI18n({ useScope:'local', messages:collectionMessages })
const policy = computed(() => props.output.options?.readAggregation)
const compatible = computed(() => policy.value ? compatibleReadOperations(policy.value.semantic, policy.value.exclusiveContributions) : [])
const semantics = computed(() => (['state','score','duration','quantity','ratio','numeric'] as const).map(value => ({ value, label:t(value), icon:value === 'state' ? 'TagOutlined' : 'CalculatorOutlined', description:t('policyHint') })))
function setPolicy(value?:MetricReadAggregation) { emit('patch', { ...updateReadPolicy(props.output,value), ...(value && value.semantic !== 'state' && !props.output.valueType ? { valueType:'double' } : {}) }) }
function toggle(enabled:boolean) { setPolicy(enabled ? readPolicy(suggestedReadSemantic(props.output)) : undefined) }
function patch(fields:Partial<MetricReadAggregation>) { if (policy.value) setPolicy({ ...policy.value, ...fields }) }
function changeSemantic(value:ReadSemantic) { setPolicy(readPolicy(value)) }
function changeExclusive(value:boolean) {
  if (!policy.value) return
  const operations = policy.value.operations.filter(item => compatibleReadOperations(policy.value!.semantic,value).includes(item))
  patch({ exclusiveContributions:value, operations, defaultOperation:operations.includes(policy.value.defaultOperation) ? policy.value.defaultOperation : 'collection' })
}
function toggleOperation(value:ReadOperation) {
  if (!policy.value) return
  const operations = policy.value.operations.includes(value) ? policy.value.operations.filter(item => item !== value) : [...policy.value.operations,value]
  patch({ operations, defaultOperation:operations.includes(policy.value.defaultOperation) ? policy.value.defaultOperation : 'collection' })
}
</script>
<style scoped>
.read-policy { margin-top:16px; border-top:1px solid var(--border,#f0f0f0); padding-top:12px }
.read-policy summary { cursor:pointer; display:flex; align-items:center; gap:8px }
.read-policy summary small { margin-left:auto; color:var(--ink-3) }
.read-policy p,.read-policy>small { color:var(--ink-3); font-size:12px; line-height:1.6 }
.read-policy__operations { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px }
.read-policy__operations button { display:flex; align-items:center; gap:4px; background:var(--surface-1,#fafafa); border:1px solid var(--border,#f0f0f0); border-radius:4px; padding:4px 8px; cursor:pointer; color:var(--ink-2) }
.read-policy__operations button.active { background:var(--accent-soft,#e6f4ff); border-color:var(--accent,#1677ff); color:var(--accent,#1677ff) }
</style>

<template>
  <div class="node-editor">
    <header class="node-editor__identity">
      <I18nTextEditable class="node-editor__name" :value="name" :placeholder="displayName" :field="nameKey" :label="t('label')" :i18n-messages="templateMessages(template)" :disabled="disabled"
        @update:value="emit('patch', { [node.kind === 'output' ? 'label' : 'name']: $event })" @update:i18n-messages="emit('messages', $event)" />
      <div v-if="node.kind === 'rule'" class="node-editor__method">
        <a-dropdown :trigger="['click']" :disabled="disabled || ruleInvalid">
          <a-button type="text" :disabled="disabled || ruleInvalid" :aria-label="t('calculationMethod')"><AIcon :type="methods.find(item => item.value === kind)?.icon" />{{ t(kind) }}<AIcon type="DownOutlined" /></a-button>
          <template #overlay>
            <a-menu class="node-editor__methods" :selected-keys="[kind]" :aria-label="t('calculationMethod')" @click="chooseKind">
              <a-menu-item v-for="option in methods" :key="option.value" class="node-editor__method-item" :class="{ 'is-current':option.value === kind }" role="menuitemradio" :aria-checked="option.value === kind">
                <div class="node-editor__method-option">
                  <SelectOption :icon="option.icon" :label="option.label" :description="option.description" />
                  <span class="node-editor__method-check" aria-hidden="true"><AIcon v-if="option.value === kind" type="CheckOutlined" /></span>
                </div>
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
      <small class="node-editor__id" :title="declarationId" :aria-label="t('declarationId')">{{ declarationId }}</small>
    </header>
    <TemplateRuleEditor v-if="node.kind === 'rule'" :template="template" :rule="rule" :disabled="disabled" :calculators="calculators" @patch="emit('patch', $event)" @invalid="setRuleInvalid" />
    <TemplateInputEditor v-if="node.kind === 'input'" :input="input" :disabled="disabled" :published="published" @patch="emit('patch', $event)" />
    <template v-else-if="node.kind === 'output'">
      <div class="node-editor__output-source">
        <span>{{ t('outputTake') }}</span>
        <TemplateReference :metric-id="output.metricId" locatable>
          <AIcon :type="sourceSummary?.icon || 'ExportOutlined'" />
          <Editable class="node-editor__output-choice" type="select" :value="output.metricId" :component-props="{ options:sources, disabled:disabled || published, bordered:false, defaultOpen:true, dropdownMatchSelectWidth:false, 'aria-label':t('outputFrom') }" @change="emit('patch', { metricId:$event })" />
        </TemplateReference>
        <span>{{ t('outputAs') }}{{ t('sentenceEnd') }}</span>
      </div>
      <div v-if="sourceNode && sourceSummary" class="node-editor__output-meaning">
        <TemplateFormulaDisplay v-if="sourceSummary.expression && sourceNode.kind === 'rule'" :template="displayTemplate" :rule="template.definitions[sourceNode.index] as TemplateRule" :expression="sourceSummary.expression" :calculators="calculators" />
        <span v-else>{{ sourceSummary.text }}</span>
        <small>{{ sourceSummary.detail }}</small>
      </div>
      <div v-if="output.unit" class="node-editor__output-unit"><span>{{ t('outputUnit') }}</span><Editable class="node-editor__unit-value" :value="output.unit" :component-props="{ disabled:disabled || published, bordered:false, 'aria-label':t('unit') }" @change="emit('patch', { unit:$event })" /></div>
      <div class="node-editor__output-uses">
        <span>{{ t('outputUseFor') }}</span>
        <button type="button" :class="{ enabled:output.persist !== false }" :disabled="disabled || published" :aria-pressed="output.persist !== false" @click="toggleOutput('persist')"><AIcon type="HistoryOutlined" />{{ t('outputHistory') }}<AIcon v-if="output.persist !== false" type="CheckOutlined" /></button>
        <button type="button" :class="{ enabled:output.publish === true }" :disabled="disabled" :aria-pressed="output.publish === true" @click="toggleOutput('publish')"><AIcon type="SendOutlined" />{{ t('outputEvents') }}<AIcon v-if="output.publish === true" type="CheckOutlined" /></button>
      </div>
      <ReadAggregationEditor :output="output" :disabled="disabled || published" @patch="emit('patch', $event)" />
      <TemplateClause icon="ProfileOutlined" :title="t('evidenceRecord')" :hint="t('evidenceRecordHint')">
        <a-switch :checked="output.options?.explain === true" :disabled="disabled" :aria-label="t('evidenceRecord')" @change="emit('patch', { options:{ ...output.options, explain:$event } })" />
      </TemplateClause>
      <details><summary>{{ t('moreSettings') }}</summary>
        <TemplateClause v-if="!output.unit" icon="FontSizeOutlined" :title="t('unit')"><Editable class="node-editor__unit-value" :value="output.unit" :component-props="{ disabled:disabled || published, bordered:false, 'aria-label':t('unit') }" @change="emit('patch', { unit:$event })" /></TemplateClause>
        <TemplateClause icon="NumberOutlined" :title="t('property')"><Editable class="node-editor__source" :value="output.property" :component-props="{ disabled:disabled || published, bordered:false, 'aria-label':t('property') }" @change="emit('patch', { property:$event })" /></TemplateClause>
      </details>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import ReadAggregationEditor from '../collection/ReadAggregationEditor.vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../messages'
import { referenceChoice } from './choices'
import TemplateInputEditor from './TemplateInputEditor.vue'
import TemplateRuleEditor from './TemplateRuleEditor.vue'
import TemplateClause from './TemplateClause.vue'
import I18nTextEditable from '../../I18n/I18nTextEditable.vue'
import Editable from '../../Editable/index.vue'
import SelectOption from '../../SelectOption/index.vue'
import { localizedTemplate, templateMessages } from './text'
import TemplateReference from './TemplateReference.vue'
import TemplateFormulaDisplay from './formula/TemplateFormulaDisplay.vue'
import { graphNodeSummary } from './graphPresentation'
import type { MetricCalculatorDescriptor, MetricTemplate, MetricTemplateInput } from '../types'
import { nodeLabel, type TemplateNode, type TemplateRule } from './designer'
import { calculationKind, calculationFields, type CalculationKind } from './window'
const props = defineProps<{ template: MetricTemplate; node: TemplateNode; disabled?: boolean; published?: boolean; calculators?: MetricCalculatorDescriptor[] }>()
const emit = defineEmits<{ (event: 'patch', fields: Record<string, unknown>): void; (event: 'invalid', value: boolean): void; (event: 'messages', value: Record<string, Record<string, string>>): void }>()
const { t, locale } = useI18n({ useScope: 'local', messages: metricMessages })
const input = computed(() => props.template.inputDefinitions[props.node.index] as MetricTemplateInput & { maxAge?: string; minSamples?: number; defaultValue?: unknown })
const output = computed(() => props.template.outputs[props.node.index])
const rule = computed(() => props.template.definitions[props.node.index] as TemplateRule)
const ruleInvalid = ref(false)
const kind = computed(() => props.node.kind === 'rule' ? calculationKind(rule.value) : 'expression')
const methods = computed(() => [
  { value: 'expression', label: t('expression'), icon: 'FunctionOutlined', description: t('expressionMethodHint') },
  { value: 'statistics', label: t('statistics'), icon: 'BarChartOutlined', description: t('statisticsMethodHint') },
  { value: 'temporal', label: t('temporal'), icon: 'ClockCircleOutlined', description: t('temporalMethodHint') },
  { value: 'calculator', label: t('calculator'), icon: 'CalculatorOutlined', description: t('calculatorMethodHint') },
])
const declarationId = computed(() => String(props.node.kind === 'input' ? input.value.id : props.node.kind === 'rule' ? rule.value.id || '' : output.value.metricId))
const name = computed(() => String(props.node.kind === 'input' ? input.value.name || '' : props.node.kind === 'rule' ? rule.value.name || '' : output.value.label || ''))
const displayName = computed(() => nodeLabel(localizedTemplate(props.template, String(locale.value)), props.node))
const nameKey = computed(() => props.node.kind === 'output' ? `output.${output.value.metricId}.label` : `${props.node.kind}.${props.node.kind === 'input' ? input.value.id : rule.value.id}.name`)
const displayTemplate = computed(() => localizedTemplate(props.template, String(locale.value)))
const sources = computed(() => [...displayTemplate.value.inputDefinitions.map(item => ({ id:item.id, label:item.name || item.id })), ...displayTemplate.value.definitions.map((item, index) => ({ id:String(item.id), label:String(item.name || nodeLabel(displayTemplate.value, { kind:'rule', index })) }))].map(item => referenceChoice(displayTemplate.value, item, t)))
const sourceNode = computed<TemplateNode | undefined>(() => {
  if (props.node.kind !== 'output') return
  const input = props.template.inputDefinitions.findIndex(item => item.id === output.value.metricId)
  if (input >= 0) return { kind:'input', index:input }
  const rule = props.template.definitions.findIndex(item => item.id === output.value.metricId)
  if (rule >= 0) return { kind:'rule', index:rule }
})
const sourceSummary = computed(() => sourceNode.value && graphNodeSummary(displayTemplate.value, sourceNode.value, t, props.calculators))
function toggleOutput(field: 'persist' | 'publish') {
  if (props.disabled || props.published && field === 'persist') return
  emit('patch', { [field]:field === 'persist' ? output.value.persist === false : output.value.publish !== true })
}
function setRuleInvalid(value: boolean) { ruleInvalid.value = value; emit('invalid', value) }
function changeKind(value: CalculationKind) { if (!props.disabled && !ruleInvalid.value && value !== kind.value) emit('patch', calculationFields(value)) }
function chooseKind({ key }: { key: string | number }) { changeKind(key as CalculationKind) }
</script>
<style scoped>
.node-editor { min-width:0; font-size:var(--fs-14,14px) }
.node-editor__identity { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:4px 12px; margin-bottom:var(--space-4,16px) }
.node-editor__name { min-width:0 }
.node-editor__method { width:120px; height:32px; color:var(--ink-3) }
.node-editor__method > .ant-btn { width:100%; height:32px; font-size:12px; color:var(--ink-3); padding:0 8px }
.node-editor__method-option { display:grid; grid-template-columns:minmax(0,1fr) 16px; align-items:start; gap:12px; width:264px; max-width:calc(100vw - 48px); padding:4px 0 }
.node-editor__method-option > .select-option { min-width:0; max-width:none; color:var(--ink-1) }
.node-editor__method-check { display:grid; place-items:center; width:16px; height:20px; margin-top:3px; color:var(--accent) }
.node-editor__method-item.is-current .select-option { color:var(--accent); font-weight:500 }
.node-editor__method-item.is-current :deep(.select-option__icon) { color:var(--accent) }
.node-editor__source { width:184px; min-width:0; color:var(--accent) }
.node-editor__unit-value { width:80px; color:var(--accent) }
.node-editor__output-source,.node-editor__output-unit { display:flex; align-items:center; flex-wrap:wrap; gap:4px; min-height:32px; font-size:13px; line-height:1.8 }
.node-editor__output-choice { min-width:56px; max-width:220px; color:var(--accent) }
.node-editor__output-meaning { display:flex; flex-direction:column; gap:4px; padding:4px 0 12px; color:var(--ink-2); font-size:13px }
.node-editor__output-meaning small { color:var(--ink-3); font-size:12px }
.node-editor__output-uses { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:12px 0; font-size:13px; color:var(--ink-3) }
.node-editor__output-uses button { display:inline-flex; align-items:center; gap:6px; min-height:28px; border:1px solid var(--line); border-radius:var(--r-2,6px); padding:2px 8px; background:transparent; color:var(--ink-3); cursor:pointer; font:inherit }
.node-editor__output-uses button.enabled { color:var(--accent); border-color:var(--accent-muted,var(--line)); background:var(--accent-soft) }
.node-editor__output-uses button:focus-visible { outline:2px solid var(--accent); outline-offset:2px }
.node-editor__output-uses button:disabled { cursor:default }
.node-editor :deep(.ant-input-number) { width:96px; max-width:100% }
.node-editor :deep(.template-clause) { align-items:center; padding:6px 0 }
.node-editor :deep(.template-clause__icon) { margin-top:0 }
.node-editor :deep(.template-clause__body) { display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-height:32px }
.node-editor :deep(.template-clause__title) { margin:0; font-size:13px }
.node-editor > details > summary { padding:8px 0; color:var(--ink-3); font-size:12px; cursor:pointer }
.node-editor__id { grid-column:1/-1; height:18px; line-height:18px; font-size:12px; color:var(--ink-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; user-select:text }
@media(max-width:380px) { .node-editor__name { grid-column:1/-1 } .node-editor__method { grid-row:3; grid-column:1/-1 } }
</style>

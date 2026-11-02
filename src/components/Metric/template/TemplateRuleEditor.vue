<template>
  <a-form layout="vertical" :disabled="disabled">
    <a-form-item :label="t('calculationMethod')">
      <a-select :value="kind" :options="kinds" @update:value="changeKind" />
    </a-form-item>
    <template v-if="kind === 'statistics'">
      <a-form-item :label="t('source')"><a-select :value="rule.sourceMetric || ruleDependencies(rule)[0]" :options="references.map(item => ({ value: item.id, label: item.label }))" :aria-label="t('statisticSource')" @update:value="setStatisticSource" /></a-form-item>
      <TemplateWindowEditor :rule="rule" :disabled="disabled" @patch="emit('patch', $event)" />
    </template>
    <template v-else-if="kind === 'expression'">
      <a-form-item :label="t('formula')">
        <TemplateFormulaEditor :model-value="rule.expression || ''" :references="formulaReferences" :disabled="disabled"
          @change="updateFormula" @invalid="setFormulaInvalid" />
      </a-form-item>
    </template>
    <template v-else-if="kind === 'temporal'">
      <a-form-item :label="t('enterCondition')"><a-textarea :value="rule.temporalCondition?.enterExpression" @update:value="temporal('enterExpression', $event)" /></a-form-item>
      <a-form-item :label="t('dwell')"><TemplateDuration :model-value="rule.temporalCondition?.dwell" :disabled="disabled" @update:model-value="temporal('dwell', $event)" /></a-form-item>
      <a-form-item :label="t('exitCondition')"><a-textarea :value="rule.temporalCondition?.exitExpression" @update:value="temporal('exitExpression', $event)" /></a-form-item>
      <a-form-item :label="t('recovery')"><TemplateDuration :model-value="rule.temporalCondition?.recovery" :disabled="disabled" @update:model-value="temporal('recovery', $event)" /></a-form-item>
      <a-form-item :label="t('maxNoData')"><TemplateDuration :model-value="rule.temporalCondition?.maxNoData" :disabled="disabled" @update:model-value="temporal('maxNoData', $event)" /></a-form-item>
    </template>
    <a-form-item v-else :label="t('algorithmConfiguration')">
      <a-textarea v-model:value="calculatorText" :auto-size="{ minRows: 8, maxRows: 18 }" :aria-label="t('algorithmConfiguration')" @update:value="updateCalculator" />
      <a-alert v-if="calculatorError" type="error" :message="t('invalidText')" :description="calculatorError" show-icon />
    </a-form-item>
    <div v-if="kind !== 'statistics' && !rule.windowFamily && (!rule.window?.mode || rule.window.mode === 'none')" class="rule-editor__timing">
      <span>{{ t('calculationTrigger') }}</span>
      <a-select :value="rule.window?.emitPolicy || 'onEvent'" :aria-label="t('calculationTrigger')" :options="timings" @update:value="changeTiming" />
      <TemplateDuration v-if="rule.window?.emitPolicy === 'onSchedule'" :model-value="rule.window.emitInterval" :min="1" :disabled="disabled" @update:model-value="emit('patch', { window: { ...rule.window, emitInterval: $event } })" />
    </div>
    <a-collapse :bordered="false">
      <a-collapse-panel key="conditions" :header="t('conditionsAndTiming')">
        <a-form-item :label="t('dependencies')">
          <a-select mode="tags" :value="ruleDependencies(rule)" :options="references.map(item => ({ value: item.id, label: item.label }))" @update:value="updateDependencies" />
        </a-form-item>
        <a-form-item :label="t('applicability')"><a-textarea :value="rule.applicabilityExpression" :placeholder="t('alwaysApplicable')" @update:value="emit('patch', { applicabilityExpression: $event || undefined })" /></a-form-item>
        <a-form-item :label="t('maxInputSkew')"><TemplateDuration :model-value="rule.maxInputSkew" :disabled="disabled" @update:model-value="emit('patch', { maxInputSkew: $event })" /></a-form-item>
      </a-collapse-panel>
    </a-collapse>
  </a-form>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { configurationObject } from './configurationText'
import { ruleDependencies, type TemplateRule } from './designer'
import { ruleDataReferences, ruleFormulaReferences } from './formula'
import TemplateFormulaEditor from './TemplateFormulaEditor.vue'
import TemplateDuration from './TemplateDuration.vue'
import TemplateWindowEditor from './TemplateWindowEditor.vue'
import { calculationKind, calculationFields, type CalculationKind } from './window'
import { errorText } from '../service'
import { metricMessages } from '../messages'
import type { MetricTemplate } from '../types'
const props = defineProps<{ template: MetricTemplate; rule: TemplateRule; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'patch', fields: Partial<TemplateRule>): void; (event: 'invalid', value: boolean): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const kind = computed(() => calculationKind(props.rule))
const kinds = computed(() => ['expression', 'statistics', 'temporal', 'calculator'].map(value => ({ value, label: t(value) })))
const timings = computed(() => ['onEvent', 'onSchedule'].map(value => ({ value, label: t(value) })))
const references = computed(() => ruleDataReferences(props.template, props.rule))
const calculatorText = ref(JSON.stringify(props.rule.calculator || { provider: '', providerVersion: '1', parameters: {} }, null, 2))
const calculatorError = ref('')
const formulaInvalid = ref(false)
const formulaReferences = computed(() => ruleFormulaReferences(props.template, props.rule))
function setFormulaInvalid(value: boolean) { formulaInvalid.value = value; emit('invalid', value) }
function dependencyFields(ids: string[]): Partial<TemplateRule> {
  if (!props.rule.inputs?.length) return { dependsOn: ids }
  const inputs = props.rule.inputs.filter(item => item.source || ids.includes(item.metricId || ''))
  for (const id of ids) if (!inputs.some(item => !item.source && item.metricId === id)) inputs.push({ id, metricId: id })
  return { sourceMetric: undefined, dependsOn: inputs.filter(item => !item.source).map(item => item.metricId!), inputs }
}
function updateFormula(value: { expression: string; metricIds?: string[] }) {
  if (props.disabled) return
  const fields = value.metricIds ? dependencyFields([...new Set([...ruleDependencies(props.rule), ...value.metricIds])]) : {}
  emit('patch', { ...fields, expression: value.expression })
}
function updateDependencies(ids: string[]) { if (!props.disabled) emit('patch', dependencyFields(ids)) }
function temporal(field: string, value: unknown) { if (!props.disabled) emit('patch', { temporalCondition: { ...props.rule.temporalCondition, [field]: value } }) }
function updateCalculator(value: string) {
  try {
    const calculator = configurationObject(value, 'json')
    calculatorError.value = ''; emit('invalid', false)
    if (!props.disabled) emit('patch', { calculator })
  } catch (cause) { calculatorError.value = errorText(cause); emit('invalid', true) }
}
function setStatisticSource(id: string) { if (!props.disabled) emit('patch', { ...dependencyFields([id]), sourceMetric: id }) }
function changeTiming(value: 'onEvent' | 'onSchedule') {
  if (props.disabled) return
  // 算法随数据运行时不传 window，避免 mode=none/onEvent 触发后端互斥校验。
  const window = value === 'onEvent' && props.rule.calculator ? undefined : { ...props.rule.window, mode: 'none' as const, emitPolicy: value, emitInterval: value === 'onSchedule' ? props.rule.window?.emitInterval || 'PT5M' : undefined }
  emit('patch', { window })
}
function changeKind(value: CalculationKind) {
  if (props.disabled || calculatorError.value || formulaInvalid.value) return
  const fields = calculationFields(value)
  if (fields.calculator) calculatorText.value = JSON.stringify(fields.calculator, null, 2)
  emit('patch', fields)
}
</script>
<style scoped>
.rule-editor__timing { display:flex; align-items:center; gap:var(--space-2,8px); flex-wrap:wrap; margin:var(--space-3,12px) 0 }
.rule-editor__timing > .ant-select { min-width:150px }
</style>

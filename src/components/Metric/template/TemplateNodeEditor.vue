<template>
  <TemplateRuleEditor v-if="node.kind === 'rule'" :template="template" :rule="rule" :disabled="disabled" @patch="emit('patch', $event)" @invalid="emit('invalid', $event)" />
  <a-form v-else layout="vertical" :disabled="disabled">
    <template v-if="node.kind === 'input'">
      <a-form-item :label="t('label')"><a-input :value="input.name" @update:value="emit('patch', { name: $event })" /></a-form-item>
      <a-form-item :label="t('unit')"><a-input :value="input.unit" @update:value="emit('patch', { unit: $event })" /></a-form-item>
      <a-form-item :label="t('readMode')">
        <a-select :value="input.source?.lookback ? 'history' : 'latest'" :options="[{ value: 'latest', label: t('latestReading') }, { value: 'history', label: t('historySeries') }]" @update:value="setReadMode" />
      </a-form-item>
      <template v-if="input.source?.lookback">
        <a-form-item :label="t('lookback')"><TemplateDuration :model-value="input.source.lookback" :disabled="disabled" @update:model-value="sourceField('lookback', $event)" /></a-form-item>
        <a-form-item :label="t('minSamples')"><a-input-number :value="input.minSamples" :min="1" @update:value="emit('patch', { minSamples: $event ?? undefined })" /></a-form-item>
        <a-form-item :label="t('maxPoints')"><a-input-number :value="input.source.maxPoints" :min="1" @update:value="sourceField('maxPoints', $event ?? undefined)" /></a-form-item>
        <a-form-item :label="t('maxGap')"><TemplateDuration :model-value="input.maxGap as string | undefined" :disabled="disabled" @update:model-value="emit('patch', { maxGap: $event })" /></a-form-item>
      </template>
      <a-form-item :label="t('maxAge')"><TemplateDuration :model-value="input.maxAge" :disabled="disabled" @update:model-value="emit('patch', { maxAge: $event })" /></a-form-item>
      <a-form-item :label="t('inputPresence')">
        <a-select :value="input.presence || 'required'" :options="['required','optional','defaultValue'].map(value => ({ value, label: t(value) }))" @update:value="emit('patch', { presence: $event })" />
      </a-form-item>
      <a-form-item v-if="input.presence === 'defaultValue'" :label="t('defaultValue')">
        <MetricParameterValue :parameter="{ ...input, valueType: { ...input.valueType, type: String(input.valueType?.type || 'double') } }" :model-value="input.defaultValue" @update:model-value="emit('patch', { defaultValue: $event })" />
      </a-form-item>
    </template>
    <template v-else>
      <a-form-item :label="t('outputFrom')"><a-select :value="output.metricId" :options="sources" @update:value="emit('patch', { metricId: $event })" /></a-form-item>
      <a-form-item :label="t('label')"><a-input :value="output.label" @update:value="emit('patch', { label: $event })" /></a-form-item>
      <a-form-item :label="t('unit')"><a-input :value="output.unit" @update:value="emit('patch', { unit: $event })" /></a-form-item>
      <a-form-item :label="t('property')"><a-input :value="output.property" @update:value="emit('patch', { property: $event })" /></a-form-item>
      <a-form-item :label="t('persist')"><a-switch :checked="output.persist !== false" @update:checked="emit('patch', { persist: $event })" /></a-form-item>
      <a-form-item :label="t('publish')"><a-switch :checked="output.publish === true" @update:checked="emit('patch', { publish: $event })" /></a-form-item>
    </template>
  </a-form>
  <small class="node-editor__id">{{ t('declarationId') }}: {{ node.kind === 'input' ? input.id : node.kind === 'rule' ? rule.id : output.metricId }}</small>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../messages'
import MetricParameterValue from '../MetricParameterValue.vue'
import TemplateDuration from './TemplateDuration.vue'
import TemplateRuleEditor from './TemplateRuleEditor.vue'
import type { MetricTemplate, MetricTemplateInput } from '../types'
import type { TemplateNode, TemplateRule } from './designer'
const props = defineProps<{ template: MetricTemplate; node: TemplateNode; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'patch', fields: Record<string, unknown>): void; (event: 'invalid', value: boolean): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const input = computed(() => props.template.inputDefinitions[props.node.index] as MetricTemplateInput & { maxAge?: string; minSamples?: number; defaultValue?: unknown })
const output = computed(() => props.template.outputs[props.node.index])
const rule = computed(() => props.template.definitions[props.node.index] as TemplateRule)
const sources = computed(() => [...props.template.inputDefinitions.map(item => ({ value: item.id, label: item.name || item.id })), ...props.template.definitions.map(item => ({ value: String(item.id), label: String(item.id) }))])
function sourceField(field: string, value: unknown) { emit('patch', { source: { ...input.value.source, [field]: value } }) }
function setReadMode(mode: string) {
  if (mode === 'history') sourceField('lookback', 'PT1H')
  // 切回单值时一并移除序列约束，避免隐藏的 maxPoints/minSamples 阻止编译或产出。
  else emit('patch', { source: { ...input.value.source, lookback: undefined, maxPoints: undefined }, minSamples: undefined, maxGap: undefined })
}
</script>
<style scoped>
.node-editor__id { color:var(--ink-3); overflow-wrap:anywhere }
</style>

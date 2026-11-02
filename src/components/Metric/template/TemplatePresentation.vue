<template>
  <a-form layout="vertical">
    <a-form-item :label="t('presentationProvider')">
      <a-select :value="resolved.id" :disabled="disabled" @update:value="setProvider">
        <a-select-option v-if="missing" :value="resolved.id">{{ resolved.id }}</a-select-option>
        <a-select-option v-for="item in resources.presentations" :key="item.id" :value="item.id">{{ item.id === DEFAULT_METRIC_PRESENTATION ? t('defaultPresentation') : resourceLabel(item.provider.label) }}</a-select-option>
      </a-select>
    </a-form-item>
    <a-alert v-if="missing" type="warning" show-icon :message="t('presentationMissing')" />
    <MetricDisplayFields v-else :model-value="settings" :provider="provider" :disabled="disabled" @update:model-value="setSettings" @failed="emit('failed')" />
  </a-form>
</template>
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricDisplayFields from '../extensions/MetricDisplayFields.vue'
import { useMetricPresentation } from '../extensions/useMetricPresentation'
import { DEFAULT_METRIC_PRESENTATION } from '../extensions/registry'
import { normalizePresentation } from '../extensions/presentationSettings'
import { metricMessages } from '../messages'
import type { MetricLabel, MetricTemplate } from '../types'
const props = defineProps<{ template: MetricTemplate; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'update:template', value: MetricTemplate): void; (event: 'failed'): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const { resources, resolved, provider, missing } = useMetricPresentation(toRef(props, 'template'))
const settings = computed(() => normalizePresentation(props.template.options?.presentation?.settings))
const resourceLabel = (label: MetricLabel) => typeof label === 'function' ? label() : label
function change(presentation: NonNullable<MetricTemplate['options']>['presentation']) {
  if (!props.disabled) emit('update:template', { ...props.template, options: { ...props.template.options, presentation } })
}
function setProvider(value: string) { change({ ...props.template.options?.presentation, provider: value }) }
function setSettings(value: Record<string, unknown>) { change({ ...props.template.options?.presentation, settings: value }) }
</script>

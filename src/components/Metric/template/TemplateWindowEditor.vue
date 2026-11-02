<template>
  <div class="window-editor">
    <div class="window-editor__sentence">
      <span>{{ t('takeData') }}</span>
      <a-select :value="mode" :disabled="disabled" :aria-label="t('windowRange')" :options="modes" @update:value="changeMode" />
      <TemplateDuration v-if="mode === 'time'" :model-value="window?.size" :min="1" :disabled="disabled" @update:model-value="patchWindow({ size: $event })" />
      <a-input-number v-else-if="mode === 'latestN'" :value="Number(window?.size) || undefined" :min="1" :precision="0" :disabled="disabled" :aria-label="t('sampleCount')" @update:value="patchWindow({ size: $event == null ? undefined : String($event) })" />
      <span v-if="mode === 'latestN'">{{ t('readings') }}</span>
    </div>
    <div v-if="mode !== 'none'" class="window-editor__sentence">
      <span>{{ t('calculateStatistic') }}</span>
      <a-select :value="rule.aggregation || 'avg'" :disabled="disabled" :aria-label="t('statistic')" :options="statistics" @update:value="emit('patch', { aggregation: $event })" />
    </div>
    <small>{{ t(mode === 'latestN' ? 'countWindowHint' : mode === 'none' ? 'latestWindowHint' : 'rollingWindowHint') }}</small>
    <a-collapse v-if="mode !== 'none'" :bordered="false">
      <a-collapse-panel key="window" :header="t('moreSettings')">
        <a-form-item :label="t('timeBasis')"><a-select :value="window?.timeMode || 'processing'" :disabled="disabled" :options="timeModes" @update:value="patchWindow({ timeMode: $event })" /></a-form-item>
        <a-form-item :label="t('expectedCount')"><a-input-number :value="rule.qualityPolicy?.expectedCount ?? window?.expectedCount" :min="1" :precision="0" @update:value="setExpectedCount" /><small>{{ t('coverageHint') }}</small></a-form-item>
        <a-form-item v-if="mode === 'time'" :label="t('windowCapacity')"><a-input-number :value="window?.maxEntries" :min="1" :precision="0" @update:value="patchWindow({ maxEntries: $event ?? undefined })" /></a-form-item>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TemplateDuration from './TemplateDuration.vue'
import { aggregations, windowFields, type TemplateWindow } from './window'
import type { TemplateRule } from './designer'
import { metricMessages } from '../messages'
const props = defineProps<{ rule: TemplateRule; disabled?: boolean }>()
const emit = defineEmits<{ (event: 'patch', value: Partial<TemplateRule>): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const window = computed(() => props.rule.window)
const mode = computed(() => window.value?.mode || 'none')
const modes = computed(() => ['time', 'latestN', 'none'].map(value => ({ value, label: t(`window_${value}`) })))
const statistics = computed(() => aggregations.map(value => ({ value, label: t(`statistic_${value}`) })))
const timeModes = computed(() => ['event', 'processing', 'hybrid'].map(value => ({ value, label: t(`time_${value}`) })))
function patchWindow(fields: Partial<TemplateWindow>) { if (!props.disabled) emit('patch', { window: { ...window.value, ...fields } }) }
function setExpectedCount(value: number | null) {
  if (!props.disabled) emit('patch', { qualityPolicy: { ...props.rule.qualityPolicy, expectedCount: value ?? undefined }, window: { ...window.value, expectedCount: undefined } })
}
function changeMode(value: TemplateWindow['mode']) {
  if (!props.disabled) emit('patch', { type: value === 'none' ? 'raw' : 'feature', aggregation: value === 'none' ? undefined : props.rule.aggregation || 'avg', window: windowFields(window.value, value) })
}
</script>
<style scoped>
.window-editor { display:grid; gap:var(--space-3,12px) }
.window-editor__sentence { display:flex; align-items:center; flex-wrap:wrap; gap:var(--space-2,8px) }
.window-editor__sentence .ant-select { min-width:120px }
.window-editor small { display:block; color:var(--ink-3) }
</style>

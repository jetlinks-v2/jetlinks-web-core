<template>
  <MetricExtension v-if="provider?.presentationFields" :content="provider.presentationFields" :content-props="{ modelValue, defaults, disabled }" @update:model-value="change" @failed="emit('failed')">
    <template #fallback><a-alert type="warning" show-icon :message="t('presentationFailed')" /></template>
  </MetricExtension>
  <a-form v-else layout="vertical">
    <a-form-item :label="t('decimals')">
      <a-space>
        <a-input-number :value="decimals" :min="0" :max="8" :precision="0" :disabled="disabled" :placeholder="inherited" @update:value="setDecimals" />
        <a-button v-if="Object.hasOwn(modelValue, 'decimals')" type="link" size="small" :disabled="disabled" @click="inherit">{{ t('inheritDisplay') }}</a-button>
      </a-space>
    </a-form-item>
  </a-form>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import MetricExtension from './MetricExtension.vue'
import { metricMessages } from '../messages'
import type { MetricPresentationProvider } from '../types'
const props = withDefaults(defineProps<{ modelValue: Readonly<Record<string, unknown>>; defaults?: Readonly<Record<string, unknown>>; disabled?: boolean; provider?: MetricPresentationProvider }>(), { defaults: () => ({}) })
const emit = defineEmits<{ (event: 'update:modelValue', value: Record<string, unknown>): void; (event: 'failed'): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const decimals = computed(() => typeof props.modelValue.decimals === 'number' ? props.modelValue.decimals : undefined)
const inherited = computed(() => typeof props.defaults.decimals === 'number' ? String(props.defaults.decimals) : t('automaticDisplay'))
function change(value: Record<string, unknown>) { if (!props.disabled) emit('update:modelValue', value) }
function inherit() { const next = { ...props.modelValue }; delete next.decimals; change(next) }
function setDecimals(value: number | string | null) {
  if (value === null || value === '') { inherit(); return }
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 8) change({ ...props.modelValue, decimals: value })
}
</script>

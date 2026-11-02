<template>
  <a-input v-if="seconds === undefined && modelValue" :value="modelValue" :disabled="disabled" @update:value="emit('update:modelValue', $event || undefined)" />
  <a-space v-else size="small" class="template-duration">
    <a-input-number :value="seconds === undefined ? undefined : seconds / unit" :min="min" :disabled="disabled" :aria-label="t('durationAmount')" @update:value="update" />
    <a-select :value="unit" :disabled="disabled" :aria-label="t('durationUnit')" :options="units.map(item => ({ value: item.value, label: t(item.label) }))" @update:value="changeUnit" />
  </a-space>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../messages'
import { durationSeconds } from './window'
const props = withDefaults(defineProps<{ modelValue?: string; disabled?: boolean; min?: number }>(), { min: 0 })
const emit = defineEmits<{ (event: 'update:modelValue', value: string | undefined): void }>()
const { t } = useI18n({ useScope: 'local', messages: metricMessages })
const units = [{ value: 1, label: 'seconds' }, { value: 60, label: 'minutes' }, { value: 3600, label: 'hours' }, { value: 86400, label: 'days' }]
const seconds = computed(() => durationSeconds(props.modelValue))
const unit = ref([...units].reverse().find(item => seconds.value && seconds.value % item.value === 0)?.value || 1)
function update(value: number | string | null) {
  if (!props.disabled) emit('update:modelValue', value == null || value === '' ? undefined : `PT${Number(value) * unit.value}S`)
}
function changeUnit(value: number) {
  const amount = seconds.value === undefined ? undefined : seconds.value / unit.value
  unit.value = value
  if (amount !== undefined) update(amount)
}
</script>
<style scoped>
.template-duration { max-width:100%; flex-wrap:wrap }
.template-duration :deep(.ant-input-number) { width:100px }
.template-duration :deep(.ant-select) { min-width:74px }
</style>

<template>
  <a-switch v-if="parameter.valueType?.type === 'boolean'" :checked="modelValue === true"
    @update:checked="emit('update:modelValue', $event)" />
  <MetadataValueItem v-else :item="{ ...parameter, valueType: parameter.valueType || { type: 'string' } }"
    :model-value="modelValue as MetadataEditorValue" @update:model-value="emit('update:modelValue', $event)" />
</template>
<script setup lang="ts">
import MetadataValueItem from '../MetadataValueItem/index.vue'
import type { MetricParameter } from './types'
type MetadataEditorValue = string | number | unknown[] | Record<string, unknown> | undefined
defineProps<{ parameter: MetricParameter; modelValue: unknown }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: unknown): void }>()
</script>

<script setup lang="ts">
import MetadataValueItem from '../MetadataValueItem/index.vue'
import type { ObjectPropertyMetadata } from '../../object-capability/types'
const props = defineProps<{ field: ObjectPropertyMetadata; modelValue?: unknown }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()
type InputValue = string | number | boolean | Record<string, unknown> | unknown[] | undefined
const fieldValue = (id: string) => (props.modelValue as Record<string, unknown> | undefined)?.[id]
function update(id: string, value: unknown) { emit('update:modelValue', { ...(props.modelValue as Record<string, unknown> || {}), [id]: value }) }
</script>
<template>
  <div v-if="field.valueType.type === 'object' && field.valueType.properties?.length" class="object-input-fields">
    <label v-for="child in field.valueType.properties" :key="child.id"><span>{{ child.name || child.id }}</span><ObjectInputValue :field="child" :model-value="fieldValue(child.id)" @update:model-value="update(child.id, $event)" /></label>
  </div>
  <MetadataValueItem v-else :item="field" :model-value="modelValue as InputValue" @update:model-value="emit('update:modelValue', $event)" />
</template>
<style scoped>.object-input-fields { display: grid; gap: 12px; }.object-input-fields > label { display: grid; gap: 6px; }.object-input-fields > label > span { color: var(--ant-color-text-secondary, inherit); font-size: 12px; }</style>

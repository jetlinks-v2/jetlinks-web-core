<template>
  <div>
    <a-checkbox-group
      v-model:value="selectedValues"
      :options="options"
      @change="onChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type {
  CheckboxOptionType,
  CheckboxValueType,
} from 'ant-design-vue/es/checkbox/interface'

type CheckboxGroupOption = string | number | CheckboxOptionType

defineOptions({
  name: 'CheckboxGroup',
})

const props = withDefaults(
  defineProps<{
    options?: CheckboxGroupOption[]
    value?: CheckboxValueType[]
  }>(),
  {
    options: () => [],
    value: () => ['view'],
  },
)

const emit = defineEmits<{
  change: [value: CheckboxValueType[]]
}>()

const selectedValues = ref<CheckboxValueType[]>([])

const normalizeValue = (value: CheckboxValueType[]) => value.length ? value : ['view']

watch(
  () => props.value,
  (value) => {
    selectedValues.value = normalizeValue(value)
  },
  { deep: true, immediate: true },
)

const onChange = (value: CheckboxValueType[]) => {
  emit('change', value)
}
</script>

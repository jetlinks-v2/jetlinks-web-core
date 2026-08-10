<template>
  <div class="model-parameter-field">
    <a-select
      v-if="isMultipleModelField"
      mode="multiple"
      :value="modelValues"
      :options="modelFileOptions"
      :placeholder="placeholder"
      :disabled="disabled"
      allow-clear
      style="width: 100%"
      @update:value="emitModelValues"
    />
    <a-auto-complete
      v-else-if="isModelField"
      :value="modelText"
      :options="modelFileOptions"
      :placeholder="placeholder"
      :disabled="disabled"
      allow-clear
      @update:value="emitValue"
    />
    <a-input-number
      v-else-if="property.inputType === 'number'"
      :value="numericValue"
      :placeholder="placeholder"
      :disabled="disabled"
      style="width: 100%"
      @update:value="emitValue"
    />
    <a-switch
      v-else-if="property.inputType === 'boolean'"
      :checked="checked"
      :disabled="disabled"
      @change="onBooleanChange"
    />
    <a-select
      v-else-if="property.inputType === 'select'"
      :value="selectValue"
      :options="property.options"
      :placeholder="placeholder"
      :disabled="disabled"
      allow-clear
      style="width: 100%"
      @update:value="emitValue"
    />
    <a-textarea
      v-else-if="property.inputType === 'json'"
      :value="jsonDraft"
      :auto-size="{ minRows: 2, maxRows: 5 }"
      :placeholder="placeholder"
      :disabled="disabled"
      @update:value="onJsonInput"
    />
    <a-input
      v-else
      :value="textValue"
      :placeholder="placeholder"
      :disabled="disabled"
      allow-clear
      @update:value="emitValue"
    />
    <span v-if="jsonInvalid" class="model-parameter-field__error">{{ locale.invalidJson }}</span>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import { isStandardModelPath, isTargetInferenceModelPath } from '../ModelConfig/fileOwnerOptions'
import type { ModelParameterFile, ModelParameterLocale, ModelParameterProperty } from './types'
import { getModelFileLabel, getModelFileValue } from './modelParameterUtils'

type ModelFileScope = 'standard' | 'targetInference'

const props = defineProps({
  property: {
    type: Object as PropType<ModelParameterProperty>,
    required: true
  },
  modelValue: {
    type: [String, Number, Boolean, Object, Array] as PropType<unknown>
  },
  files: {
    type: Array as PropType<ModelParameterFile[]>,
    default: () => []
  },
  modelFileScope: {
    type: String as PropType<ModelFileScope>,
    default: 'standard'
  },
  locale: {
    type: Object as PropType<Pick<ModelParameterLocale, 'pleaseEnter' | 'pleaseSelect' | 'invalidJson'>>,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: unknown): void
}>()

const jsonDraft = ref('')
const jsonInvalid = ref(false)

const valueType = computed(() => props.property.valueType || {})
const modelFieldName = computed(() => props.property.property.split('.').pop())
const isModelField = computed(() => modelFieldName.value === 'model' || modelFieldName.value === 'model_file')
const isMultipleModelField = computed(() => modelFieldName.value === 'model_file')
const modelText = computed(() => props.modelValue == null ? '' : String(props.modelValue))
const modelValues = computed(() => {
  if (Array.isArray(props.modelValue)) return props.modelValue.map(String).filter(Boolean)
  if (props.modelValue == null) return []
  return String(props.modelValue).split(',').map(value => value.trim()).filter(Boolean)
})
const textValue = computed(() => props.modelValue == null ? '' : String(props.modelValue))
const numericValue = computed(() => typeof props.modelValue === 'number' ? props.modelValue : undefined)
const selectValue = computed<string | number | undefined>(() => (
  typeof props.modelValue === 'string' || typeof props.modelValue === 'number'
    ? props.modelValue
    : undefined
))
const trueValue = computed(() => valueType.value.trueValue ?? true)
const falseValue = computed(() => valueType.value.falseValue ?? false)
const checked = computed(() => props.modelValue === trueValue.value)
const placeholder = computed(() => (
  props.property.inputType === 'select' || props.property.inputType === 'boolean'
    ? props.locale.pleaseSelect
    : props.locale.pleaseEnter
))

const modelFileOptions = computed(() => props.files
  .filter(file => props.modelFileScope === 'targetInference'
    ? isTargetInferenceModelPath(file.path)
    : isStandardModelPath(file.path))
  .map(file => ({
    label: isMultipleModelField.value ? file.name : getModelFileLabel(file.path, file.name),
    value: isMultipleModelField.value ? file.name : getModelFileValue(file.path, file.name)
  }))
  .filter((option, index, options) => options.findIndex(item => item.value === option.value) === index))

watch(() => props.modelValue, value => {
  jsonDraft.value = value == null ? '' : JSON.stringify(value, null, 2)
  jsonInvalid.value = false
}, { immediate: true, deep: true })

function emitValue(value: unknown) {
  emit('update:modelValue', value)
}

function emitModelValues(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : value == null
      ? []
      : String(value).split(',')
  emitValue(values.map(item => String(item).trim()).filter(Boolean).join(','))
}

function onBooleanChange(value: unknown) {
  emitValue(Boolean(value) ? trueValue.value : falseValue.value)
}

function onJsonInput(value: string) {
  jsonDraft.value = value
  if (!value.trim()) {
    jsonInvalid.value = false
    emitValue(undefined)
    return
  }
  try {
    jsonInvalid.value = false
    emitValue(JSON.parse(value))
  } catch {
    jsonInvalid.value = true
  }
}
</script>

<style scoped lang="less">
.model-parameter-field {
  min-width: 0;
}

.model-parameter-field__error {
  display: block;
  margin-top: 0.25rem;
  color: var(--jet-theme-error);
  font-size: var(--fs-12);
  line-height: 1.4;
}
</style>

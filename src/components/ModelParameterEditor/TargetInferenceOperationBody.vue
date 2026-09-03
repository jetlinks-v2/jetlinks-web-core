<template>
  <div
    class="target-inference-operation__body"
    :class="{ 'target-inference-operation__body--user-selectable': operation.userSelectable }"
  >
    <div class="target-inference-operation__switches">
      <label class="target-inference-operation__switch-field">
        <span>{{ locale.defaultEnabled }}</span>
        <a-switch
          :checked="operation.enabled"
          :disabled="!editing"
          @change="updateDefaultEnabled"
        />
      </label>
      <label class="target-inference-operation__switch-field">
        <span>{{ locale.userSelectable }}</span>
        <a-switch
          :checked="operation.userSelectable"
          :disabled="!editing"
          @change="updateUserSelectable"
        />
      </label>
    </div>

    <div v-if="operation.userSelectable" class="target-inference-operation__parameter-fields">
      <div class="target-inference-operation__field">
        <span
          class="target-inference-operation__label"
          :class="{ 'target-inference-operation__label--required': operation.userSelectable }"
        >
          {{ locale.targetParameterName }}
        </span>
        <a-input
          :value="operation.parameterName"
          :disabled="!editing"
          :status="errors?.parameterName ? 'error' : undefined"
          allow-clear
          @update:value="updateParameterName"
        />
        <span v-if="errors?.parameterName" class="target-inference-operation__error">
          {{ getErrorMessage(errors.parameterName) }}
        </span>
      </div>
      <div class="target-inference-operation__field">
        <span class="target-inference-operation__label">{{ locale.targetParameterDescription }}</span>
        <a-input
          :value="operation.parameterDescription"
          :disabled="!editing"
          allow-clear
          @update:value="updateParameterDescription"
        />
      </div>
    </div>

    <div
      class="target-inference-operation__field target-inference-operation__field--model"
      :class="{ 'target-inference-operation__field--model-full': kind !== 'vector' }"
    >
      <span
        class="target-inference-operation__label"
        :class="{ 'target-inference-operation__label--required': capabilityActive }"
      >
        {{ locale.model }}
      </span>
      <ParameterField
        class="target-inference-operation__model-field"
        :property="modelProperty"
        :model-value="operation.model"
        :files="files"
        model-file-scope="targetInference"
        :locale="locale"
        :disabled="!editing"
        @update:model-value="updateModel"
      />
      <span v-if="errors?.model" class="target-inference-operation__error">
        {{ getErrorMessage(errors.model) }}
      </span>
    </div>

    <div v-if="kind === 'vector'" class="target-inference-operation__field">
      <span
        class="target-inference-operation__label"
        :class="{ 'target-inference-operation__label--required': capabilityActive }"
      >
        {{ locale.vectorProfile }}
      </span>
      <a-input
        :value="operation.vectorProfile"
        :disabled="!editing"
        :status="errors?.vectorProfile ? 'error' : undefined"
        allow-clear
        @update:value="updateVectorProfile"
      />
      <span v-if="errors?.vectorProfile" class="target-inference-operation__error">
        {{ getErrorMessage(errors.vectorProfile) }}
      </span>
    </div>

    <div class="target-inference-operation__field target-inference-operation__field--params">
      <span class="target-inference-operation__label">{{ locale.additionalParams }}</span>
      <MonacoEditor
        :model-value="operation.paramsText"
        class="target-inference-operation__json-editor"
        theme="vs"
        language="json"
        :read-only="!editing"
        :blur-format="true"
        :options="{ minimap: { enabled: false }, wordWrap: 'on' }"
        @update:model-value="updateParams"
      />
      <span v-if="errors?.params" class="target-inference-operation__error">
        {{ getErrorMessage(errors.params) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import MonacoEditor from '../MonacoEditor/monacoEditor.vue'
import ParameterField from './ParameterField.vue'
import type { ModelParameterFile, ModelParameterLocale, ModelParameterProperty } from './types'
import { isTargetInferenceOperationActive } from './targetInferenceUtils'
import type {
  TargetInferenceOperationDraft,
  TargetInferenceOperationErrors,
  TargetInferenceOperationKind
} from './targetInferenceUtils'

const props = defineProps({
  path: {
    type: String,
    required: true
  },
  kind: {
    type: String as PropType<TargetInferenceOperationKind>,
    required: true
  },
  operation: {
    type: Object as PropType<TargetInferenceOperationDraft>,
    required: true
  },
  errors: {
    type: Object as PropType<TargetInferenceOperationErrors>,
    default: undefined
  },
  files: {
    type: Array as PropType<ModelParameterFile[]>,
    default: () => []
  },
  locale: {
    type: Object as PropType<ModelParameterLocale>,
    required: true
  },
  editing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  (event: 'update:operation', value: TargetInferenceOperationDraft): void
}>()

const capabilityActive = computed(() => isTargetInferenceOperationActive(props.operation))

const modelProperty = computed<ModelParameterProperty>(() => ({
  property: `${props.path}.params.model_file`,
  name: props.locale.model,
  typeName: 'string',
  valueType: { type: 'string' },
  inputType: 'text'
}))

function updateOperation(value: Partial<TargetInferenceOperationDraft>) {
  emit('update:operation', { ...props.operation, ...value })
}

function updateDefaultEnabled(value: unknown) {
  updateOperation({ enabled: Boolean(value) })
}

function updateUserSelectable(value: unknown) {
  updateOperation({ userSelectable: Boolean(value) })
}

function updateParameterName(value: string) {
  updateOperation({ parameterName: value || '' })
}

function updateParameterDescription(value: string) {
  updateOperation({ parameterDescription: value || '' })
}

function updateModel(value: unknown) {
  updateOperation({ model: value == null ? '' : String(value) })
}

function updateVectorProfile(value: string) {
  updateOperation({ vectorProfile: value || '' })
}

function updateParams(value: string) {
  const text = value || ''
  if (!text.trim()) {
    updateOperation({ params: {}, paramsText: '{}', paramsInvalid: false })
    return
  }
  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('params-object-required')
    updateOperation({ params: parsed, paramsText: text, paramsInvalid: false })
  } catch {
    updateOperation({ paramsText: text, paramsInvalid: true })
  }
}

function getErrorMessage(key?: string) {
  if (!key) return ''
  const messages: Record<string, string> = {
    invalidJson: props.locale.invalidJson,
    targetParameterNameRequired: props.locale.targetParameterNameRequired,
    modelRequired: props.locale.modelRequired,
    vectorProfileRequired: props.locale.vectorProfileRequired
  }
  return messages[key] || key
}
</script>

<style src="./targetInferenceOperationBody.less" scoped lang="less"></style>

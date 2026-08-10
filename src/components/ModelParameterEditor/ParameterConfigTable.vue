<template>
  <div class="model-parameter-config">
    <div class="model-parameter-config__intro">
      {{ locale.parameterConfigDescription }}
    </div>
    <div v-if="editing" class="model-parameter-config__toolbar">
      <a-button type="link" size="small" @click="addParameter">
        <AIcon type="PlusOutlined" />
        {{ locale.addParameter }}
      </a-button>
    </div>

    <div
      v-if="rows.length"
      :class="[
        'model-parameter-config__matrix',
        { 'model-parameter-config__matrix--editing': editing }
      ]"
    >
      <div class="model-parameter-config__matrix-head">
        <span>{{ locale.parameterName }}</span>
        <span>{{ locale.parameterPath }}</span>
        <span>{{ locale.parameterType }}</span>
        <span>{{ locale.parameterDescription }}</span>
        <span>{{ locale.realtime }}</span>
        <span>{{ locale.imageTest }}</span>
        <span v-if="editing">{{ locale.actions }}</span>
      </div>
      <div
        v-for="property in rows"
        :key="property.rowId"
        class="model-parameter-config__matrix-row"
      >
        <div class="model-parameter-config__name" :title="property.name">
          <a-input
            v-if="editing"
            :value="property.name"
            :placeholder="locale.parameterName"
            :status="hasValidationError(property, 'name') ? 'error' : undefined"
            allow-clear
            @update:value="updateProperty(property, 'name', $event)"
          />
          <template v-else>{{ property.name }}</template>
        </div>
        <div class="model-parameter-config__path" :title="property.property">
          <a-input
            v-if="editing"
            :value="property.property"
            :placeholder="locale.parameterPath"
            :status="hasValidationError(property, 'property') ? 'error' : undefined"
            @update:value="updateProperty(property, 'property', $event)"
          />
          <template v-else>{{ property.property }}</template>
        </div>
        <div class="model-parameter-config__type" :title="property.typeName">
          <a-select
            v-if="editing"
            :value="property.typeName"
            :options="parameterTypeOptions"
            :status="hasValidationError(property, 'type') ? 'error' : undefined"
            style="width: 100%"
            @update:value="updateProperty(property, 'type', $event)"
          />
          <template v-else>{{ property.typeName }}</template>
        </div>
        <div class="model-parameter-config__description" :title="property.description">
          <a-input
            v-if="editing"
            :value="property.description"
            :placeholder="locale.parameterDescription"
            allow-clear
            @update:value="updateProperty(property, 'description', $event)"
          />
          <template v-else>{{ property.description }}</template>
        </div>
        <div
          :class="{
            'model-parameter-config__checkbox--error': hasValidationError(property, 'applicability')
          }"
        >
          <a-checkbox
            :checked="isApplicable('params', property)"
            :disabled="!editing || !property.property"
            @change="toggleApplicability('params', property, $event)"
          />
        </div>
        <div
          :class="{
            'model-parameter-config__checkbox--error': hasValidationError(property, 'applicability')
          }"
        >
          <a-checkbox
            :checked="isApplicable('testParams', property)"
            :disabled="!editing || !property.property"
            @change="toggleApplicability('testParams', property, $event)"
          />
        </div>
        <div v-if="editing" class="model-parameter-config__actions">
          <a-tooltip :title="locale.deleteParameter">
            <a-button
              type="text"
              danger
              size="small"
              :aria-label="locale.deleteParameter"
              @click="removeParameter(property)"
            >
              <AIcon type="DeleteOutlined" />
            </a-button>
          </a-tooltip>
        </div>
      </div>
    </div>
    <a-empty v-else :description="locale.noParameters" />
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import { cloneDeep } from 'lodash-es'
import type { ParameterRecord } from './modelParameterUtils'
import type {
  ModelParameterDefinitionSource,
  ModelParameterLocale,
  ModelParameterProperty,
  ModelParameterPropertyField
} from './types'
import {
  buildParameterDefinitionFromRows,
  buildParameterPreviewFromRows,
  parameterTypeOptions,
  toEditableRow,
  updateEditableProperty,
  validateParameterRows,
  type ParameterRow,
  type ParameterValidationErrors,
  type ParameterValidationField
} from './parameterConfigTableUtils'

const props = defineProps({
  definition: {
    type: Object as PropType<ParameterRecord>,
    required: true
  },
  properties: {
    type: Array as PropType<ModelParameterProperty[]>,
    required: true
  },
  editing: {
    type: Boolean,
    default: false
  },
  locale: {
    type: Object as PropType<ModelParameterLocale>,
    required: true
  }
})

const emit = defineEmits<{
  (event: 'update:preview', value: ParameterRecord): void
}>()

const editableRows = ref<ParameterRow[]>([])
const initialRows = ref<ParameterRow[]>([])
const validationErrors = ref<Record<string, ParameterValidationErrors>>({})
let draftSequence = 0

const rows = computed<ParameterRow[]>(() => props.editing
  ? editableRows.value
  : props.properties.map(toEditableRow))

watch(() => props.editing, value => {
  if (value) {
    editableRows.value = props.properties.map(toEditableRow)
    initialRows.value = cloneDeep(editableRows.value)
  } else {
    editableRows.value = []
    initialRows.value = []
    validationErrors.value = {}
  }
}, { immediate: true })

function addParameter() {
  editableRows.value.push({
    rowId: `draft:${++draftSequence}`,
    draft: true,
    property: '',
    name: '',
    typeName: 'string',
    description: '',
    valueType: { type: 'string' },
    inputType: 'text',
    options: [],
    paramsChecked: false,
    testParamsChecked: false
  })
  emitPreview()
}

function isApplicable(source: ModelParameterDefinitionSource, property: ParameterRow) {
  return source === 'params' ? property.paramsChecked : property.testParamsChecked
}

function updateProperty(property: ParameterRow, field: ModelParameterPropertyField, value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') return
  const normalizedValue = String(value)
  editableRows.value = editableRows.value.map(item => (
    item.rowId === property.rowId ? updateEditableProperty(item, field, normalizedValue) : item
  ))
  clearValidation(property.rowId, field)
  emitPreview()
}

function toggleApplicability(
  source: ModelParameterDefinitionSource,
  property: ParameterRow,
  event: { target?: { checked?: boolean }; checked?: boolean }
) {
  const checked = Boolean(event?.target?.checked ?? event?.checked)
  editableRows.value = editableRows.value.map(item => item.rowId === property.rowId
    ? {
        ...item,
        ...(source === 'params' ? { paramsChecked: checked } : { testParamsChecked: checked })
      }
    : item)
  clearValidation(property.rowId, 'applicability')
  emitPreview()
}

function removeParameter(property: ParameterRow) {
  editableRows.value = editableRows.value.filter(item => item.rowId !== property.rowId)
  clearRowValidation(property.rowId)
  emitPreview()
}

function emitPreview() {
  if (!props.editing) return
  emit('update:preview', buildParameterPreviewFromRows(props.definition, editableRows.value))
}

function prepareForSave(): ParameterRecord | undefined {
  if (!props.editing) return cloneDeep(props.definition)

  const errors = validateParameterRows(editableRows.value)
  validationErrors.value = errors
  if (Object.keys(errors).length) return undefined

  const next = buildParameterDefinitionFromRows(
    props.definition,
    editableRows.value,
    initialRows.value
  )
  initialRows.value = cloneDeep(editableRows.value)
  return next
}

function hasValidationError(property: ParameterRow, field: ParameterValidationField) {
  return Boolean(validationErrors.value[property.rowId]?.[field])
}

function clearValidation(rowId: string, field: ParameterValidationField) {
  const rowErrors = validationErrors.value[rowId]
  if (!rowErrors?.[field]) return
  const nextRowErrors = { ...rowErrors }
  delete nextRowErrors[field]
  const nextErrors = { ...validationErrors.value }
  if (Object.keys(nextRowErrors).length) nextErrors[rowId] = nextRowErrors
  else delete nextErrors[rowId]
  validationErrors.value = nextErrors
}

function clearRowValidation(rowId: string) {
  if (!validationErrors.value[rowId]) return
  const nextErrors = { ...validationErrors.value }
  delete nextErrors[rowId]
  validationErrors.value = nextErrors
}

defineExpose({ prepareForSave })
</script>

<style src="./parameterConfigTable.less" lang="less"></style>

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

    <!-- 行键沿用草稿 rowId；无排序和分页，单元格按表格行索引读取同一份草稿。 -->
    <a-table
      v-if="rows.length"
      row-key="rowId"
      size="small"
      :columns="columns"
      :data-source="rows"
      :pagination="false"
      :scroll="{ x: editing ? 960 : 896 }"
    >
      <template #bodyCell="{ column, index: rowIndex }">
        <div v-if="column.key === 'name'" class="model-parameter-config__name" :title="rows[rowIndex].name">
          <a-input
            v-if="editing"
            :value="rows[rowIndex].name"
            :placeholder="locale.parameterName"
            :status="hasValidationError(rows[rowIndex], 'name') ? 'error' : undefined"
            allow-clear
            @update:value="updateProperty(rows[rowIndex], 'name', $event)"
          />
          <template v-else>{{ rows[rowIndex].name }}</template>
        </div>
        <div v-else-if="column.key === 'property'" class="model-parameter-config__path" :title="rows[rowIndex].property">
          <a-input
            v-if="editing"
            :value="rows[rowIndex].property"
            :placeholder="locale.parameterPath"
            :status="hasValidationError(rows[rowIndex], 'property') ? 'error' : undefined"
            @update:value="updateProperty(rows[rowIndex], 'property', $event)"
          />
          <template v-else>{{ rows[rowIndex].property }}</template>
        </div>
        <div v-else-if="column.key === 'type'" class="model-parameter-config__type" :title="rows[rowIndex].typeName">
          <a-select
            v-if="editing"
            :value="rows[rowIndex].typeName"
            :options="parameterTypeOptions"
            :status="hasValidationError(rows[rowIndex], 'type') ? 'error' : undefined"
            style="width: 100%"
            @update:value="updateProperty(rows[rowIndex], 'type', $event)"
          />
          <template v-else>{{ rows[rowIndex].typeName }}</template>
        </div>
        <div v-else-if="column.key === 'description'" class="model-parameter-config__description" :title="rows[rowIndex].description">
          <a-input
            v-if="editing"
            :value="rows[rowIndex].description"
            :placeholder="locale.parameterDescription"
            allow-clear
            @update:value="updateProperty(rows[rowIndex], 'description', $event)"
          />
          <template v-else>{{ rows[rowIndex].description }}</template>
        </div>
        <div
          v-else-if="column.key === 'params'"
          :class="{
            'model-parameter-config__checkbox--error': hasValidationError(rows[rowIndex], 'applicability')
          }"
        >
          <a-checkbox
            :checked="isApplicable('params', rows[rowIndex])"
            :disabled="!editing || !rows[rowIndex].property"
            @change="toggleApplicability('params', rows[rowIndex], $event)"
          />
        </div>
        <div
          v-else-if="column.key === 'testParams'"
          :class="{
            'model-parameter-config__checkbox--error': hasValidationError(rows[rowIndex], 'applicability')
          }"
        >
          <a-checkbox
            :checked="isApplicable('testParams', rows[rowIndex])"
            :disabled="!editing || !rows[rowIndex].property"
            @change="toggleApplicability('testParams', rows[rowIndex], $event)"
          />
        </div>
        <div v-else-if="column.key === 'actions'" class="model-parameter-config__actions">
          <a-tooltip :title="locale.deleteParameter">
            <a-button
              type="text"
              danger
              size="small"
              :aria-label="locale.deleteParameter"
              @click="removeParameter(rows[rowIndex])"
            >
              <AIcon type="DeleteOutlined" />
            </a-button>
          </a-tooltip>
        </div>
      </template>
    </a-table>
    <CloudEmpty v-else :description="locale.noParameters" />
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import { cloneDeep, isEqual } from 'lodash-es'
import type { TableColumnsType } from 'ant-design-vue'
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
const editStartRows = ref<ParameterRow[]>([])
const validationErrors = ref<Record<string, ParameterValidationErrors>>({})
let draftSequence = 0

const rows = computed<ParameterRow[]>(() => props.editing
  ? editableRows.value
  : props.properties.map(toEditableRow))

const columns = computed<TableColumnsType<ParameterRow>>(() => [
  { title: props.locale.parameterName, key: 'name', width: 180 },
  { title: props.locale.parameterPath, key: 'property', width: 200 },
  { title: props.locale.parameterType, key: 'type', width: 104 },
  { title: props.locale.parameterDescription, key: 'description' },
  { title: props.locale.realtime, key: 'params', width: 112, align: 'center' },
  { title: props.locale.imageTest, key: 'testParams', width: 112, align: 'center' },
  ...(props.editing ? [{ title: props.locale.actions, key: 'actions', width: 64, align: 'center' as const }] : [])
])

watch(() => props.editing, value => {
  if (value) {
    editableRows.value = props.properties.map(toEditableRow)
    initialRows.value = cloneDeep(editableRows.value)
    editStartRows.value = initialRows.value
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

// 空白行可能不进入 definition 预览；编辑起点不随保存前校验更新。
defineExpose({ prepareForSave, hasChanges: () => props.editing && !isEqual(editableRows.value, editStartRows.value) })
</script>

<style src="./parameterConfigTable.less" lang="less"></style>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import ValueItem from '../Search/Filter/ValueItem.vue'
import {
  getConditionFilterDefaultTermType,
  getReadableTermTypeLabel,
  getTermTypeOption,
  isArrayTermType,
  isNullaryTermType,
  normalizeTermTypeOption,
} from '../Search/Filter/setting'
import { useColumnsMap } from '../Search/Filter/hooks/useSearchEngine'
import type { SearchItem } from '../Search/Filter/typing'
import type { ConditionFilterField, ConditionFilterTerm } from './types'
import { resolveConditionFields } from './schema'

const props = defineProps({
  fields: {
    type: Array as PropType<ConditionFilterField[]>,
    default: () => [],
  },
  columns: {
    type: Array as PropType<SearchItem[]>,
    default: () => [],
  },
  term: {
    type: Object as PropType<ConditionFilterTerm | undefined>,
    default: undefined,
  },
  placeholder: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'submit', value: ConditionFilterTerm): void
  (e: 'cancel'): void
  (e: 'columnChange', value?: string): void
}>()

const { t: $t } = useI18n()
const columnsMap = useColumnsMap()
const rootRef = ref()
const draftColumn = ref<string>()
const draftTermType = ref<string>()
const draftValue = ref<any>()
const resolvedFields = computed(() => resolveConditionFields(props.fields, props.columns))

const currentColumn = computed(() => {
  if (!draftColumn.value) {
    return undefined
  }

  return columnsMap[draftColumn.value]
})

const currentSearchType = computed(() => currentColumn.value?.search?.type || 'string')
const isDirectInputMode = computed(() => currentSearchType.value === 'string')
const needsValueInput = computed(() => !isNullaryTermType(draftTermType.value))
const resolvedPlaceholder = computed(() => props.placeholder || $t('components.ConditionFilter.placeholder.add'))
const valuePlaceholder = computed(() => currentColumn.value?.search?.componentProps?.placeholder || $t('components.ConditionFilter.placeholder.value'))

const fieldOptions = computed(() => {
  return resolvedFields.value.map(item => ({
    label: item.title,
    value: item.dataIndex,
  }))
})

const getTermTypeOptions = (column?: ConditionFilterField) => {
  const search = column?.search

  if (!search) {
    return []
  }

  if (search.termOptions?.length) {
    return search.termOptions.map((option) => {
      const nextOption = normalizeTermTypeOption(option)
      return {
        ...nextOption,
        label: nextOption.readableLabel || nextOption.label || getReadableTermTypeLabel(nextOption.value),
      }
    })
  }

  const filterKeys = search.termFilter || []
  const optionKeys = search.termTypeOptions || getConditionFilterDefaultTermType(search.type)

  return optionKeys
    .filter(item => !filterKeys.includes(item))
    .map((value) => {
      const option = normalizeTermTypeOption(getTermTypeOption(value) || { label: value, value })
      return {
        ...option,
        label: option.readableLabel || option.label || getReadableTermTypeLabel(option.value),
      }
    })
}

const termTypeOptions = computed(() => getTermTypeOptions(currentColumn.value))
const showTermType = computed(() => termTypeOptions.value.length > 1)

const cloneValue = (value: any) => {
  if (Array.isArray(value)) {
    return [...value]
  }

  if (value && typeof value === 'object') {
    return { ...value }
  }

  return value
}

const buildInitialValue = (termType?: string, value?: any) => {
  if (isNullaryTermType(termType)) {
    return undefined
  }

  if (value !== undefined) {
    return cloneValue(value)
  }

  if (isArrayTermType(termType || '')) {
    return ['btw', 'nbtw'].includes(termType || '') ? [undefined, undefined] : []
  }

  return undefined
}

const convertValue = (oldTermType?: string, newTermType?: string, currentValue?: any) => {
  if (!newTermType || oldTermType === newTermType) {
    return buildInitialValue(newTermType, currentValue)
  }

  if (isNullaryTermType(newTermType)) {
    return undefined
  }

  const expectsArrayValue = isArrayTermType(newTermType)
  const isRangeType = ['btw', 'nbtw'].includes(newTermType)

  if (!expectsArrayValue) {
    return Array.isArray(currentValue) ? currentValue[0] : cloneValue(currentValue)
  }

  if (currentValue === undefined || currentValue === null || currentValue === '') {
    return isRangeType ? [undefined, undefined] : []
  }

  if (Array.isArray(currentValue)) {
    if (isRangeType) {
      return [currentValue[0], currentValue[1] ?? undefined]
    }

    return [...currentValue]
  }

  return isRangeType ? [currentValue, undefined] : [currentValue]
}

const emitTerm = (payload?: Partial<ConditionFilterTerm>) => {
  const nextTerm: ConditionFilterTerm = {
    column: payload?.column ?? draftColumn.value,
    termType: payload?.termType ?? draftTermType.value,
    value: cloneValue(payload?.value ?? draftValue.value),
    key: props.term?.key,
    type: props.term?.type,
  }

  emit('submit', nextTerm)
}

const syncFromProps = () => {
  const columnKey = props.term?.column
  const column = columnKey ? columnsMap[columnKey] : undefined
  const search = column?.search

  draftColumn.value = columnKey

  if (!search) {
    draftTermType.value = props.term?.termType
    draftValue.value = cloneValue(props.term?.value)
    return
  }

  const defaultTermType =
    props.term?.termType ||
    search.defaultTermType ||
    getTermTypeOptions(column)[0]?.value ||
    getConditionFilterDefaultTermType(search.type)[0] ||
    'eq'

  draftTermType.value = defaultTermType
  draftValue.value = buildInitialValue(defaultTermType, props.term?.value ?? search.defaultValue)
}

const filterFieldOption = (input: string, option: Record<string, any>) => {
  const text = `${option.label || ''}${option.value || ''}`.toLowerCase()
  return text.includes(String(input || '').trim().toLowerCase())
}

const setDraftValue = (value: any) => {
  draftValue.value = cloneValue(value)
}

const onDirectInput = (event: Event) => {
  setDraftValue((event.target as HTMLInputElement)?.value)
}

const onColumnSelect = (value?: string) => {
  if (!value) {
    draftColumn.value = undefined
    draftTermType.value = undefined
    draftValue.value = undefined
    emitTerm({
      column: undefined,
      termType: undefined,
      value: undefined,
    })
    return
  }

  const column = columnsMap[value]
  const search = column?.search
  const nextTermType =
    search?.defaultTermType ||
    getTermTypeOptions(column)[0]?.value ||
    (search ? getConditionFilterDefaultTermType(search.type)[0] : undefined) ||
    'eq'
  const nextValue = buildInitialValue(nextTermType, search?.defaultValue)

  draftColumn.value = value
  draftTermType.value = nextTermType
  draftValue.value = nextValue

  emitTerm({
    column: value,
    termType: nextTermType,
    value: nextValue,
  })
}

const onTermTypeChange = (value: string) => {
  const nextValue = convertValue(draftTermType.value, value, draftValue.value)
  draftTermType.value = value
  draftValue.value = nextValue

  emitTerm({
    termType: value,
    value: nextValue,
  })
}

const onApply = () => {
  emitTerm()
}

const focusValueInput = () => {
  nextTick(() => {
    const el = rootRef.value?.querySelector?.('.condition-inline-composer__value input')
    el?.focus?.()
  })
}

watch(
  () => draftColumn.value,
  (value) => {
    emit('columnChange', value)
  },
)

watch(
  () => [props.term?.column, props.term?.termType, props.term?.value],
  () => {
    syncFromProps()
  },
  { immediate: true, deep: true },
)

watch(
  () => [draftColumn.value, draftTermType.value, isDirectInputMode.value, needsValueInput.value],
  () => {
    if (isDirectInputMode.value && needsValueInput.value) {
      focusValueInput()
    }
  },
)

watch(
  () => draftValue.value,
  () => {
    if (!isDirectInputMode.value && needsValueInput.value && draftColumn.value && draftTermType.value) {
      emitTerm()
    }
  },
  { deep: true },
)
</script>

<template>
  <div ref="rootRef" class="condition-inline-composer" :class="{ 'condition-inline-composer--direct': isDirectInputMode }">
    <a-select
      :value="draftColumn"
      class="condition-inline-composer__field"
      :placeholder="resolvedPlaceholder"
      :options="fieldOptions"
      :disabled="disabled"
      :bordered="false"
      show-search
      :filter-option="filterFieldOption"
      :dropdownMatchSelectWidth="false"
      @change="onColumnSelect"
    />
    <a-select
      v-if="showTermType"
      :value="draftTermType"
      class="condition-inline-composer__term"
      :options="termTypeOptions"
      :disabled="disabled"
      :bordered="false"
      :dropdownMatchSelectWidth="false"
      @change="onTermTypeChange"
    />
    <div v-if="needsValueInput" class="condition-inline-composer__value">
      <div class="condition-inline-composer__value-content">
        <slot
          name="value"
          :field="currentColumn"
          :term="term"
          :column="draftColumn"
          :termType="draftTermType"
          :value="draftValue"
          :setValue="setDraftValue"
          :submit="onApply"
        >
          <a-input
            v-if="isDirectInputMode"
            :value="draftValue"
            :placeholder="valuePlaceholder"
            :bordered="false"
            @input="onDirectInput"
            @pressEnter="onApply"
          />
          <ValueItem
            v-else
            :value="draftValue"
            :column="draftColumn"
            :termType="draftTermType"
            :show-action="false"
            embedded
            @update:value="setDraftValue"
          />
        </slot>
      </div>
    </div>
    <button class="condition-inline-composer__clear" type="button" :disabled="disabled" @click="emit('cancel')">
      <AIcon type="CloseOutlined" />
    </button>
  </div>
</template>

<style scoped>
.condition-inline-composer {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  min-height: 1.875rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  gap: var(--space-1);
}
.condition-inline-composer__field,
.condition-inline-composer__term {
  min-width: 0;
  flex: 0 0 auto;
  max-width: 11.25rem;
}
.condition-inline-composer__value {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 3.75rem;
  max-width: 15rem;
  background: var(--color-jet-primary-soft);
  border: 1px solid var(--color-jet-primary-soft);
  border-radius: var(--radius-jet);
}
.condition-inline-composer__value-content {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  padding: 0 0.5rem;
}
.condition-inline-composer__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 1.5rem;
  height: 1.5rem;
  margin-right: 0.1875rem;
  color: var(--color-jet-text-disabled);
  background: transparent;
  border: 0;
  border-radius: 62.4375rem;
  cursor: pointer;
  transition: color 0.2s ease, background-color 0.2s ease;
}
.condition-inline-composer__clear:hover:not(:disabled) {
  color: var(--color-jet-text-disabled);
  background: color-mix(in srgb, var(--color-jet-text-secondary) 8%, transparent);
}
.condition-inline-composer__clear:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.condition-inline-composer :deep(.ant-select) {
  display: flex;
  align-items: stretch;
}
.condition-inline-composer :deep(.ant-select-selector) {
  height: 1.875rem !important;
  padding: 0 0.625rem !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: var(--radius-jet) !important;
  box-shadow: none !important;
}
.condition-inline-composer :deep(.ant-select-selection-item),
.condition-inline-composer :deep(.ant-select-selection-placeholder) {
  display: flex;
  align-items: center;
  height: 1.875rem;
  font-size: var(--fs-14);
}
.condition-inline-composer :deep(.ant-select-selection-placeholder) {
  color: var(--color-jet-text-disabled);
}
.condition-inline-composer__field :deep(.ant-select-selector) {
  padding-inline-end: 1.75rem !important;
  background: var(--color-jet-primary-soft) !important;
  border: 1px solid var(--color-jet-primary-soft) !important;
}
.condition-inline-composer__field :deep(.ant-select-selection-item) {
  color: var(--color-jet-primary);
  font-weight: 500;
}
.condition-inline-composer__field :deep(.ant-select-arrow) {
  color: var(--color-jet-primary);
  right: 0.625rem;
}
.condition-inline-composer__term :deep(.ant-select-selector) {
  height: 1.875rem !important;
  padding: 0 1.375rem 0 0.625rem !important;
  background: var(--color-jet-primary-soft) !important;
  border: 1px solid var(--color-jet-primary-soft) !important;
}
.condition-inline-composer__term :deep(.ant-select-selection-item) {
  color: var(--color-jet-text-secondary);
  font-size: var(--fs-14);
  font-weight: 500;
}
.condition-inline-composer__term :deep(.ant-select-arrow) {
  color: var(--color-jet-text-secondary);
  right: 0.5rem;
  transform: scale(0.9);
}
.condition-inline-composer__value :deep(.filter-terms-value-item) {
  width: 100%;
  padding: 0;
  background: transparent;
  box-shadow: none;
}
.condition-inline-composer__value :deep(.ant-input),
.condition-inline-composer__value :deep(.ant-input-affix-wrapper),
.condition-inline-composer__value :deep(.ant-input-number),
.condition-inline-composer__value :deep(.ant-select-selector),
.condition-inline-composer__value :deep(.ant-picker) {
  background: transparent;
  border: 0;
  box-shadow: none;
}
.condition-inline-composer__value :deep(.ant-input) {
  height: 1.875rem;
  padding: 0;
  color: var(--color-jet-text);
  font-size: var(--fs-14);
}
.condition-inline-composer__value :deep(.ant-input::placeholder) {
  color: var(--color-jet-text-disabled);
}
.condition-inline-composer__value :deep(.ant-input:focus),
.condition-inline-composer__value :deep(.ant-input-focused),
.condition-inline-composer__value :deep(.ant-input-affix-wrapper-focused) {
  box-shadow: none;
}
.condition-inline-composer__value :deep(.ant-input-number) {
  width: 100%;
}
.condition-inline-composer__value :deep(.ant-select-selector),
.condition-inline-composer__value :deep(.ant-picker) {
  background: transparent !important;
}
.condition-inline-composer__value :deep(.ant-select-selection-item),
.condition-inline-composer__value :deep(.ant-picker-input input) {
  color: var(--color-jet-text);
  font-size: var(--fs-14);
}
.condition-inline-composer--direct .condition-inline-composer__value {
  background: transparent;
}
.condition-inline-composer--direct .condition-inline-composer__value-content {
  padding-right: 0;
}
.condition-inline-composer--direct :deep(.ant-input),
.condition-inline-composer--direct :deep(.ant-input:hover),
.condition-inline-composer--direct :deep(.ant-input:focus) {
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
@media (max-width: 48rem) {
  .condition-inline-composer {
    gap: 0.375rem;
  }
  .condition-inline-composer__field,
  .condition-inline-composer__term,
  .condition-inline-composer__value {
    min-width: 0;
    max-width: none;
  }
  .condition-inline-composer__field {
    max-width: 9.375rem;
  }
}</style>

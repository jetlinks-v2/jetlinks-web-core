<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import ConditionOptionPanel from './ConditionOptionPanel.vue'
import ValueItem from '../Search/Filter/ValueItem.vue'
import { isArrayTermType } from '../Search/Filter/setting'
import { useColumnItemOptions, useColumnsMap } from '../Search/Filter/hooks/useSearchEngine'
import type { ConditionFilterTerm } from './types'

const props = defineProps({
  column: {
    type: String,
    default: undefined,
  },
  term: {
    type: Object as PropType<ConditionFilterTerm | undefined>,
    default: undefined,
  },
  keyword: {
    type: String,
    default: '',
  },
})

const emit = defineEmits<{
  (e: 'apply', value: ConditionFilterTerm, options?: { close?: boolean; allowEmpty?: boolean }): void
  (e: 'draft-change', value?: ConditionFilterTerm): void
}>()

const { t: $t } = useI18n()
const columnsMap = useColumnsMap()
const optionsMap = useColumnItemOptions()
const draftValue = ref<any>()

const currentColumn = computed(() => {
  if (!props.column) {
    return undefined
  }

  const column = columnsMap[props.column]
  const resolvedOptions = optionsMap[props.column]

  if (!column?.search || !Array.isArray(resolvedOptions) || !resolvedOptions.length) {
    return column
  }

  return {
    ...column,
    search: {
      ...column.search,
      options: resolvedOptions,
    },
  }
})

const title = computed(() => currentColumn.value?.title || '')
const termType = computed(() => props.term?.termType)
const optionPanelConfig = computed(() => currentColumn.value?.search?.optionPanel)
const isOptionPanelMode = computed(() => ['select', 'tree', 'treeSelect'].includes(currentColumn.value?.search?.type || '') || !!optionPanelConfig.value?.loadOptions)
const hideTitle = computed(() => optionPanelConfig.value?.hideTitle ?? isOptionPanelMode.value)
const panelWidth = computed(() => `${optionPanelConfig.value?.width || (isOptionPanelMode.value ? 320 : 280)}px`)
const optionPanelValue = computed(() => cloneValue(draftValue.value))
const optionPanelOptions = computed(() => currentColumn.value?.search?.options || [])
const resolvedOptionPanelConfig = computed(() => ({
  ...optionPanelConfig.value,
  multiple: isArrayTermType(termType.value || ''),
}))

const cloneValue = (value: any) => {
  return Array.isArray(value) ? [...value] : value
}

const initDraft = () => {
  const search = currentColumn.value?.search

  if (!search) {
    draftValue.value = undefined
    return
  }

  draftValue.value = cloneValue(props.term?.value ?? search.defaultValue)

  if (draftValue.value === undefined && isArrayTermType(termType.value || '')) {
    draftValue.value = ['btw', 'nbtw'].includes(termType.value || '') ? [undefined, undefined] : []
  }
}

const canApply = computed(() => {
  if (!termType.value) {
    return false
  }

  if (['btw', 'nbtw'].includes(termType.value)) {
    return Array.isArray(draftValue.value) && draftValue.value.length > 1 && draftValue.value.every(item => item !== undefined && item !== null && item !== '')
  }

  if (isArrayTermType(termType.value)) {
    return Array.isArray(draftValue.value) && draftValue.value.some(item => item !== undefined && item !== null && item !== '')
  }

  return draftValue.value !== undefined && draftValue.value !== null && draftValue.value !== ''
})

const setDraftValue = (value: any) => {
  draftValue.value = cloneValue(value)
}

const onSubmit = (options?: { close?: boolean; allowEmpty?: boolean }) => {
  if (!props.column || (!canApply.value && !options?.allowEmpty)) {
    return
  }

  emit(
    'apply',
    {
      column: props.column,
      termType: termType.value,
      value: cloneValue(draftValue.value),
    },
    options,
  )
}

const emitDraftChange = () => {
  if (!props.column) {
    emit('draft-change', undefined)
    return
  }

  emit('draft-change', {
    column: props.column,
    termType: termType.value,
    value: cloneValue(draftValue.value),
  })
}

watch(
  () => [props.column, props.term?.termType, props.term?.value],
  () => {
    initDraft()
  },
  { immediate: true, deep: true },
)

watch(
  () => [props.column, termType.value, draftValue.value],
  () => {
    emitDraftChange()
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="condition-editor-panel" :class="{ 'condition-editor-panel--compact': hideTitle }" :style="{ width: panelWidth }">
    <div v-if="!hideTitle" class="condition-editor-panel__title">{{ $t('components.ConditionFilter.editor.title', { title }) }}</div>
    <div class="condition-editor-panel__body">
      <slot
        name="value"
        :field="currentColumn"
        :term="term"
        :column="column"
        :termType="termType"
        :value="draftValue"
        :setValue="setDraftValue"
        :submit="onSubmit"
      >
        <ConditionOptionPanel
          v-if="isOptionPanelMode"
          :value="optionPanelValue"
          :keyword="keyword"
          :options="optionPanelOptions"
          :config="resolvedOptionPanelConfig"
          @update:value="setDraftValue"
          @submit="onSubmit"
        />
        <ValueItem
          v-else
          v-model:value="draftValue"
          :column="column"
          :termType="termType"
          :show-action="false"
          embedded
        />
      </slot>
    </div>
  </div>
</template>

<style scoped lang="less">
.condition-editor-panel {
  padding: var(--space-3);
  background: var(--color-jet-bg-elevated);
  border: 1px solid var(--color-jet-border-secondary);
  border-radius: var(--radius-jet-lg);
  box-shadow: var(--jet-theme-shadow);

  &--compact {
    padding: var(--space-2);
  }

  &__title {
    margin-bottom: 0.625rem;
    color: var(--color-jet-text-title);
    font-size: var(--fs-14);
    font-weight: 600;
    line-height: 1.375rem;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
}</style>

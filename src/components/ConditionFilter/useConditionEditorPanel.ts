import { computed, ref, watch } from 'vue'
import { useColumnItemOptions, useColumnsMap } from '../Search/Filter/hooks/useSearchEngine'
import type { ConditionFilterField, ConditionFilterSubmitOptions, ConditionFilterTerm } from './types'
import { isConditionFieldArrayTermType } from './schema'

interface ConditionEditorPanelProps {
  column?: string
  term?: ConditionFilterTerm
}

const cloneValue = (value: unknown) => Array.isArray(value) ? [...value] : value

/** 管理公共值面板的草稿与提交；按字段及操作符选择编辑器，不改变查询值协议。 */
export function useConditionEditorPanel(
  props: ConditionEditorPanelProps,
  apply: (value: ConditionFilterTerm, options?: ConditionFilterSubmitOptions) => void,
) {
  const columnsMap = useColumnsMap()
  const optionsMap = useColumnItemOptions()
  const draftValue = ref<unknown>()
  const currentColumn = computed(() => {
    if (!props.column) return undefined
    const column = columnsMap[props.column] as ConditionFilterField | undefined
    const resolvedOptions = optionsMap[props.column]
    if (!column?.search || !Array.isArray(resolvedOptions) || !resolvedOptions.length) return column
    return { ...column, search: { ...column.search, options: resolvedOptions } }
  })

  const title = computed(() => currentColumn.value?.title || '')
  const termType = computed(() => props.term?.termType)
  const optionPanelConfig = computed(() => currentColumn.value?.search?.optionPanel)
  const isOptionPanelMode = computed(() => ['select', 'tree', 'treeSelect']
    .includes(currentColumn.value?.search?.type || '') || !!optionPanelConfig.value?.loadOptions)
  const isTextMembershipMode = computed(() => currentColumn.value?.search?.type === 'string'
    && ['in', 'nin'].includes(termType.value || ''))
  const hideTitle = computed(() => optionPanelConfig.value?.hideTitle ?? isOptionPanelMode.value)
  const panelWidth = computed(() => `${optionPanelConfig.value?.width || (isOptionPanelMode.value ? 320 : 280)}px`)
  const optionPanelValue = computed(() => draftValue.value)
  const valueItemValue = computed(() => {
    const value = draftValue.value
    return typeof value === 'string' || typeof value === 'number' || Array.isArray(value) ? value : undefined
  })
  const optionPanelOptions = computed(() => {
    const options = currentColumn.value?.search?.options
    return Array.isArray(options) ? options : []
  })
  const resolvedOptionPanelConfig = computed(() => ({
    ...optionPanelConfig.value,
    multiple: isConditionFieldArrayTermType(currentColumn.value?.search, termType.value),
  }))
  // 兼容已有单值回显；挂载时不回写，用户修改后才提交数组。
  const textValues = computed(() => Array.isArray(draftValue.value) ? draftValue.value
    : typeof draftValue.value === 'string' ? [draftValue.value] : [])

  const initDraft = () => {
    const search = currentColumn.value?.search
    if (!search) {
      draftValue.value = undefined
      return
    }
    draftValue.value = cloneValue(props.term?.value ?? search.defaultValue)
    if (draftValue.value === undefined && isConditionFieldArrayTermType(search, termType.value)) {
      draftValue.value = ['btw', 'nbtw'].includes(termType.value || '') ? [undefined, undefined] : []
    }
  }

  const canApply = computed(() => {
    if (!termType.value) return false
    if (['btw', 'nbtw'].includes(termType.value)) {
      return Array.isArray(draftValue.value) && draftValue.value.length > 1
        && draftValue.value.every(item => item !== undefined && item !== null && item !== '')
    }
    if (isConditionFieldArrayTermType(currentColumn.value?.search, termType.value)) {
      return Array.isArray(draftValue.value)
        && draftValue.value.some(item => item !== undefined && item !== null && item !== '')
    }
    return draftValue.value !== undefined && draftValue.value !== null && draftValue.value !== ''
  })
  const shouldCloseOnValueUpdate = computed(() => ['date', 'time', 'timeRange', 'rangePicker']
    .includes(currentColumn.value?.search?.type || ''))
  const setDraftValue = (value: unknown) => { draftValue.value = cloneValue(value) }

  /** 空选项仅由显式清空提交；普通未完成输入不覆盖已提交条件。 */
  const onSubmit = (options?: ConditionFilterSubmitOptions) => {
    if (!props.column || (!canApply.value && !options?.allowEmpty)) return
    apply({ column: props.column, termType: termType.value, value: cloneValue(draftValue.value) }, options)
  }

  const onValueItemUpdate = (value: unknown) => {
    if (isTextMembershipMode.value
      && (!Array.isArray(value) || value.some(item => typeof item !== 'string'))) return
    setDraftValue(value)
    const clearedTextValues = isTextMembershipMode.value && Array.isArray(value) && value.length === 0
    if (canApply.value || clearedTextValues) {
      const close = shouldCloseOnValueUpdate.value
      onSubmit({
        close,
        source: close ? 'commit' : 'input',
        ...(clearedTextValues ? { allowEmpty: true } : {}),
      })
    }
  }

  const onConfirmKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.isComposing && !isOptionPanelMode.value && !shouldCloseOnValueUpdate.value) onSubmit()
  }

  watch(() => [props.column, props.term?.termType, props.term?.value], initDraft, { immediate: true, deep: true })

  return {
    title, termType, currentColumn, draftValue, isOptionPanelMode, isTextMembershipMode, hideTitle,
    panelWidth, optionPanelValue, valueItemValue, optionPanelOptions, resolvedOptionPanelConfig, textValues,
    canApply, shouldCloseOnValueUpdate, setDraftValue, onValueItemUpdate, onSubmit, onConfirmKeydown,
  }
}

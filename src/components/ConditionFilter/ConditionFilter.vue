<script setup lang="ts" name="ConditionFilter">
import type { PropType } from 'vue'
import dayjs from 'dayjs'
import { isRef } from 'vue'
import { request } from '@jetlinks-web/core'
import { randomString } from '@jetlinks-web/utils'
import { getDefaultTermType, isArrayTermType, TermTypeOptions } from '../Search/Filter/setting'
import { useColumnItemOptionsContext, useColumnsMapContext } from '../Search/Filter/hooks/useSearchEngine'
import type { SearchItem, TermsItem } from '../Search/Filter/typing'
import ConditionEditorPanel from './ConditionEditorPanel.vue'
import FieldSelectPanel from './FieldSelectPanel.vue'
import type { ConditionFilterChangePayload, ConditionFilterCommonField, ConditionFilterExpose } from './types'
import {
  buildQueryFilter,
  buildWhereExpression,
  cloneTerms,
  isSameTerms,
  normalizeInputTerms,
  parseWhereExpression,
} from './utils'

const slots = useSlots()

type TokenKind = 'logic' | 'field' | 'operator' | 'value'
type EditorMode = 'tail' | 'field' | 'value'

const nullaryTermTypes = new Set(['isnull', 'notnull'])
const fieldBlurLock = ref(false)
const autoSearchDelay = 260

const props = defineProps({
  columns: {
    type: Array as PropType<SearchItem[]>,
    default: () => [],
  },
  modelValue: {
    type: Array as PropType<TermsItem[]>,
    default: () => [],
  },
  where: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '点击添加筛选条件',
  },
  commonFields: {
    type: Array as PropType<ConditionFilterCommonField[]>,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: TermsItem[]): void
  (e: 'update:where', value: string): void
  (e: 'change', value: ConditionFilterChangePayload): void
}>()

const logicOptions = [
  { label: '并且', value: 'and' },
  { label: '或者', value: 'or' },
]

const logicLabelMap = logicOptions.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

const logicCompactLabelMap = {
  and: '且',
  or: '或',
}

const termTypeLabelMap = TermTypeOptions.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

const termsModel = ref<TermsItem[]>([])
const rootRef = ref<HTMLElement>()

const editorMode = ref<EditorMode>('tail')
const editingTermKey = ref<string>()
const fieldKeyword = ref('')
const valueKeyword = ref('')
const fieldPanelOpen = ref(false)
const valuePanelTermKey = ref<string>()

const columnsMap = reactive<Record<string, SearchItem>>({})
const optionsMap = reactive<Record<string, any[]>>({})
const loadingMap = reactive<Record<string, boolean>>({})
const watchDisposers = new Map<string, () => void>()
let autoSearchTimer: number | undefined

useColumnsMapContext(columnsMap)
useColumnItemOptionsContext(optionsMap)

const searchColumns = computed(() => {
  return props.columns
    .map((column, index) => ({
      ...column,
      sortIndex: index,
    }))
    .filter(item => item.search)
    .sort((a, b) => {
      const fixedSort = Number(Boolean(b.search?.fixed)) - Number(Boolean(a.search?.fixed))
      if (fixedSort !== 0) {
        return fixedSort
      }

      const firstSort = Number(Boolean(b.search?.first)) - Number(Boolean(a.search?.first))
      if (firstSort !== 0) {
        return firstSort
      }

      return a.sortIndex - b.sortIndex
    })
})

const commonFieldOrderMap = computed(() => {
  return props.commonFields.reduce((acc, item, index) => {
    const value = typeof item === 'string' ? item : item.value
    acc.set(value, index)
    return acc
  }, new Map<string, number>())
})

const orderedSearchColumns = computed(() => {
  return [...searchColumns.value].sort((a, b) => {
    const aOrder = commonFieldOrderMap.value.get(a.dataIndex)
    const bOrder = commonFieldOrderMap.value.get(b.dataIndex)

    if (aOrder !== undefined || bOrder !== undefined) {
      if (aOrder === undefined) {
        return 1
      }

      if (bOrder === undefined) {
        return -1
      }

      if (aOrder !== bOrder) {
        return aOrder - bOrder
      }
    }

    return (a.sortIndex || 0) - (b.sortIndex || 0)
  })
})

const fieldOptions = computed(() => {
  const keyword = fieldKeyword.value.trim().toLowerCase()

  if (!keyword) {
    return orderedSearchColumns.value
  }

  return orderedSearchColumns.value.filter((item) => {
    return `${item.title || ''}${item.dataIndex || ''}`.toLowerCase().includes(keyword)
  })
})

const payload = computed<ConditionFilterChangePayload>(() => {
  const filter = buildQueryFilter(termsModel.value, props.columns)
  const terms = cloneTerms(filter.terms, { stripKey: true })
  return {
    terms,
    filter: {
      terms,
    },
    where: buildWhereExpression(termsModel.value, props.columns),
  }
})

const hasAnyTerms = computed(() => termsModel.value.length > 0)

const cloneValue = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item))
  }

  if (value && typeof value === 'object') {
    return { ...value }
  }

  return value
}

const isNilValue = (value: any) => {
  return value === undefined || value === null || value === ''
}

const hasTermValue = (item?: TermsItem) => {
  if (!item?.termType) {
    return false
  }

  if (nullaryTermTypes.has(item.termType)) {
    return true
  }

  if (Array.isArray(item.value)) {
    if (['btw', 'nbtw'].includes(item.termType)) {
      return item.value.length > 1 && !isNilValue(item.value[0]) && !isNilValue(item.value[1])
    }

    return item.value.some(val => !isNilValue(val))
  }

  return !isNilValue(item.value)
}

const getTermKey = (term: TermsItem) => term.key || ''

const getTermIndex = (termKey?: string) => {
  return termsModel.value.findIndex(item => item.key === termKey)
}

const getTerm = (termKey?: string) => {
  const index = getTermIndex(termKey)
  return index === -1 ? undefined : termsModel.value[index]
}

const getTermColumn = (term?: TermsItem) => {
  return term?.column ? columnsMap[term.column] : undefined
}

const getTermTypeOptions = (column?: SearchItem) => {
  const search = column?.search

  if (!search) {
    return []
  }

  if (search.termOptions?.length) {
    return search.termOptions
  }

  const filterKeys = search.termFilter || []
  const optionKeys = search.termTypeOptions || getDefaultTermType(search.type)

  return TermTypeOptions.filter(item => optionKeys.includes(item.value) && !filterKeys.includes(item.value))
}

const getRecommendedTermType = (column?: SearchItem) => {
  const search = column?.search

  if (!column || !search) {
    return undefined
  }

  const options = getTermTypeOptions(column)
  const optionValues = options.map(item => item.value)
  const searchType = search.type
  const columnKey = column.dataIndex.toLowerCase()
  const title = String(column.title || '').toLowerCase()
  const fieldText = `${columnKey} ${title}`

  const pick = (...values: string[]) => values.find(item => optionValues.includes(item))

  if (['date', 'time', 'timeRange', 'rangePicker'].includes(searchType)) {
    return pick('btw', 'gte', 'lte', 'eq')
  }

  if (['select', 'treeSelect', 'tree'].includes(searchType)) {
    const preferMultiple = search.optionPanel?.multiple !== false
    return preferMultiple ? pick('in', 'eq', 'not') : pick('eq', 'in', 'not')
  }

  if (searchType === 'number') {
    if (/(^|[\s_-])(id|sn|no|code|key)([\s_-]|$)/.test(fieldText)) {
      return pick('eq', 'in', 'not')
    }

    return pick('eq', 'gte', 'lte', 'gt', 'lt')
  }

  if (searchType === 'string') {
    if (/(^|[\s_-])(id|sn|no|code|key|deviceid|serialnumber)([\s_-]|$)/.test(fieldText)) {
      return pick('eq', 'not', 'like')
    }

    if (/(name|title|desc|remark|content|detail|model|category|location|assignee|project)/.test(fieldText)) {
      return pick('like', 'eq', 'not')
    }

    return pick('like', 'eq', 'not')
  }

  return search.defaultTermType || options[0]?.value
}

const buildInitialValue = (termType?: string, value?: any) => {
  if (nullaryTermTypes.has(termType || '')) {
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

  if (nullaryTermTypes.has(newTermType)) {
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

const isDirectTextTerm = (column?: SearchItem, termType?: string) => {
  return column?.search?.type === 'string' && !!termType && !nullaryTermTypes.has(termType) && !isArrayTermType(termType)
}

const isPopupValueTerm = (column?: SearchItem, termType?: string) => {
  return !!column?.search && !!termType && !nullaryTermTypes.has(termType) && !isDirectTextTerm(column, termType)
}

const getFieldLabel = (columnKey?: string) => {
  const column = columnKey ? columnsMap[columnKey] : undefined
  return column?.title || column?.dataIndex || ''
}

const getTermTypeLabel = (term: TermsItem) => {
  const options = getTermTypeOptions(getTermColumn(term))
  return options.find(item => item.value === term.termType)?.label || termTypeLabelMap[term.termType || ''] || '--'
}

const isTermTypeSelected = (term: TermsItem, termType: string) => {
  return term.termType === termType
}

const isLogicTypeSelected = (term: TermsItem, value: string) => {
  return (term.type || 'and') === value
}

const getReadableTermTypeLabel = (termType?: string) => {
  const readableMap: Record<string, string> = {
    eq: '为',
    not: '不为',
    like: '包含',
    nlike: '不包含',
    gt: '大于',
    gte: '大于等于',
    lt: '小于',
    lte: '小于等于',
    in: '属于',
    nin: '不属于',
    btw: '处于范围',
    nbtw: '不在范围',
    isnull: '为空',
    notnull: '不为空',
  }

  return readableMap[termType || ''] || termTypeLabelMap[termType || ''] || '--'
}

const getValuePlaceholder = (term: TermsItem) => {
  return getTermColumn(term)?.search?.componentProps?.placeholder || '输入筛选值'
}

const getOptionList = (column?: SearchItem) => {
  const key = column?.dataIndex
  if (!key) {
    return []
  }

  if (Array.isArray(optionsMap[key]) && optionsMap[key].length) {
    return optionsMap[key]
  }

  if (Array.isArray(column?.search?.options)) {
    return column?.search?.options || []
  }

  return []
}

const normalizeOptionItems = (items: any[] = []) => {
  return items.map((item: any) => ({
    ...item,
    label: item?.label ?? item?.text ?? item?.name ?? item?.title ?? item?.value ?? item?.id,
    value: item?.value ?? item?.id,
  }))
}

const mergeOptionItems = (...groups: any[][]) => {
  const seen = new Set<string>()

  return normalizeOptionItems(groups.flat()).filter((item) => {
    const key = String(item?.value ?? item?.id ?? '')
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const getOptionLabel = (column: SearchItem | undefined, value: any) => {
  const option = getOptionList(column).find((item: Record<string, any>) => {
    const optionValue = item?.value ?? item?.id
    return String(optionValue) === String(value)
  })

  if (!option) {
    return String(value)
  }

  return String(option.label ?? option.name ?? option.title ?? option.value ?? option.id)
}

const formatScalarValue = (column: SearchItem | undefined, value: any) => {
  if (isNilValue(value)) {
    return ''
  }

  const searchType = column?.search?.type

  if (['select', 'treeSelect', 'tree'].includes(searchType || '')) {
    return getOptionLabel(column, value)
  }

  if (['date', 'time', 'timeRange', 'rangePicker'].includes(searchType || '')) {
    const dateValue = dayjs(value)
    if (dateValue.isValid()) {
      return dateValue.format('YYYY-MM-DD HH:mm:ss')
    }
  }

  return String(value)
}

const getValueLabel = (term: TermsItem) => {
  const column = getTermColumn(term)

  if (!term.termType || nullaryTermTypes.has(term.termType) || !hasTermValue(term)) {
    return ''
  }

  if (Array.isArray(term.value)) {
    const values = term.value.filter(item => !isNilValue(item)).map(item => formatScalarValue(column, item))
    return ['btw', 'nbtw'].includes(term.termType) ? values.join(' ~ ') : values.join('、')
  }

  return formatScalarValue(column, term.value)
}

const syncColumnsContext = () => {
  watchDisposers.forEach(stop => stop())
  watchDisposers.clear()

  Object.keys(columnsMap).forEach((key) => {
    delete columnsMap[key]
  })

  Object.keys(optionsMap).forEach((key) => {
    delete optionsMap[key]
  })

  Object.keys(loadingMap).forEach((key) => {
    delete loadingMap[key]
  })

  searchColumns.value.forEach((item) => {
    columnsMap[item.dataIndex] = item
  })
}

const createOptionsLoader = async (column: SearchItem | undefined, term?: TermsItem) => {
  const key = column?.dataIndex
  const rawOptions = column?.search?.options
  const loadSelectedOptions = column?.search?.optionPanel?.loadSelectedOptions

  if (!key) {
    return
  }

  if (column.search?.dictId) {
    if (loadingMap[key]) {
      return
    }

    loadingMap[key] = true
    try {
      const resp = await request.get(`/dictionary/${column.search.dictId}/items`)
      const list = resp?.result || resp?.data || []
      optionsMap[key] = Array.isArray(list) ? normalizeOptionItems(list) : []
    } finally {
      loadingMap[key] = false
    }

    return
  }

  if (!rawOptions) {
    return
  }

  if (Array.isArray(rawOptions)) {
    optionsMap[key] = mergeOptionItems(rawOptions)
    return
  }

  if (isRef(rawOptions)) {
    const watchKey = `${key}:ref`
    if (watchDisposers.has(watchKey)) {
      return
    }

    const stop = watch(
      rawOptions,
      val => (optionsMap[key] = mergeOptionItems(optionsMap[key] || [], val || [])),
      { immediate: true },
    )

    watchDisposers.set(watchKey, stop)
  } else if (typeof rawOptions === 'function' && !loadingMap[key]) {
    loadingMap[key] = true
    try {
      optionsMap[key] = mergeOptionItems(await rawOptions())
    } finally {
      loadingMap[key] = false
    }
  }

  if (loadSelectedOptions && term && hasTermValue(term)) {
    const values = Array.isArray(term.value) ? term.value : [term.value]
    const selectedItems = await loadSelectedOptions(values)

    if (Array.isArray(selectedItems) && selectedItems.length) {
      optionsMap[key] = mergeOptionItems(optionsMap[key] || [], selectedItems)
    }
  }
}

const ensureTermOptionsLoaded = () => {
  termsModel.value.forEach((term) => {
    createOptionsLoader(getTermColumn(term), term)
  })
}

const syncByProps = () => {
  const nextTerms = props.where?.trim()
    ? parseWhereExpression(props.where, props.columns)
    : normalizeInputTerms(props.modelValue, props.columns)

  if (!isSameTerms(termsModel.value, nextTerms)) {
    termsModel.value = nextTerms
  }

  ensureTermOptionsLoaded()
}

const focusEditorInput = () => {
  nextTick(() => {
    rootRef.value?.querySelector<HTMLInputElement>('.condition-filter__text-input')?.focus?.()
  })
}

const getActiveTextInput = () => {
  const activeElement = document.activeElement as HTMLElement | null

  if (!activeElement?.classList?.contains('condition-filter__text-input')) {
    return undefined
  }

  return activeElement
}

const isTailInputFocused = () => {
  return getActiveTextInput()?.classList?.contains('condition-filter__text-input--tail') || false
}

const isInlineEditorFocused = () => {
  return !!getActiveTextInput()
}

const setTailMode = (options?: { focus?: boolean; open?: boolean; keyword?: string }) => {
  editorMode.value = 'tail'
  editingTermKey.value = undefined
  valueKeyword.value = ''
  fieldKeyword.value = options?.keyword ?? ''
  fieldPanelOpen.value = options?.open ?? false
  valuePanelTermKey.value = undefined

  if (options?.focus) {
    focusEditorInput()
  }
}

const focusTailInput = (open = true) => {
  if (props.disabled) {
    return
  }

  setTailMode({
    focus: true,
    open,
  })
}

const applyTermUpdate = (termKey: string, value: Partial<TermsItem>) => {
  const index = getTermIndex(termKey)

  if (index === -1) {
    return
  }

  const current = termsModel.value[index]
  const nextItem: TermsItem = {
    ...current,
    ...value,
    key: termKey,
    type: index ? current.type || 'and' : undefined,
  }

  if (JSON.stringify({
    column: current.column,
    termType: current.termType,
    value: current.value,
    type: current.type,
  }) === JSON.stringify({
    column: nextItem.column,
    termType: nextItem.termType,
    value: nextItem.value,
    type: nextItem.type,
  })) {
    return
  }

  termsModel.value.splice(index, 1, nextItem)
}

const startFieldEdit = (termKey: string) => {
  if (props.disabled) {
    return
  }

  editorMode.value = 'field'
  editingTermKey.value = termKey
  fieldKeyword.value = ''
  valueKeyword.value = ''
  fieldPanelOpen.value = true
  valuePanelTermKey.value = undefined
  focusEditorInput()
}

const startValueEdit = (termKey: string, initialValue?: string) => {
  if (props.disabled) {
    return
  }

  const term = getTerm(termKey)
  const column = getTermColumn(term)

  if (!term || !isDirectTextTerm(column, term.termType)) {
    return
  }

  editorMode.value = 'value'
  editingTermKey.value = termKey
  fieldPanelOpen.value = false
  valuePanelTermKey.value = undefined
  valueKeyword.value = initialValue ?? (isNilValue(term.value) ? '' : String(term.value))
  focusEditorInput()
}

const applyFieldSelection = (termKey: string, columnKey: string) => {
  const term = getTerm(termKey)
  const column = columnsMap[columnKey]

  if (!term || !column?.search) {
    return
  }

  const termOptions = getTermTypeOptions(column)
  const nextTermType =
    (term.termType && termOptions.some(item => item.value === term.termType) && term.termType) ||
    getRecommendedTermType(column) ||
    'eq'

  const nextValue = buildInitialValue(nextTermType, column.search.defaultValue)

  applyTermUpdate(termKey, {
    column: columnKey,
    termType: nextTermType,
    value: nextValue,
  })

  createOptionsLoader(column)
  fieldKeyword.value = ''
  fieldPanelOpen.value = false

  if (nullaryTermTypes.has(nextTermType)) {
    setTailMode({ focus: true })
    return
  }

  if (isDirectTextTerm(column, nextTermType)) {
    startValueEdit(termKey, isNilValue(nextValue) ? '' : String(nextValue))
    return
  }

  editorMode.value = 'tail'
  editingTermKey.value = undefined
  valuePanelTermKey.value = termKey
}

const onSelectField = (columnKey: string) => {
  let termKey = editingTermKey.value

  if (editorMode.value !== 'field' || !termKey) {
    const nextTerm: TermsItem = {
      key: randomString(10),
      type: termsModel.value.length ? 'and' : undefined,
    }

    termsModel.value.push(nextTerm)
    termKey = nextTerm.key
  }

  if (!termKey) {
    return
  }

  applyFieldSelection(termKey, columnKey)
}

const onChangeLogic = (index: number, type: string) => {
  if (!termsModel.value[index]) {
    return
  }

  termsModel.value.splice(index, 1, {
    ...termsModel.value[index],
    type,
  })
}

const triggerSearch = () => {
  if (autoSearchTimer) {
    window.clearTimeout(autoSearchTimer)
    autoSearchTimer = undefined
  }

  emit('change', {
    terms: cloneTerms(payload.value.terms, { stripKey: true }),
    filter: {
      terms: cloneTerms(payload.value.filter.terms, { stripKey: true }),
    },
    where: payload.value.where,
  })
}

const scheduleAutoSearch = () => {
  if (autoSearchTimer) {
    window.clearTimeout(autoSearchTimer)
  }

  autoSearchTimer = window.setTimeout(() => {
    triggerSearch()
  }, autoSearchDelay)
}

const onTermTypeChange = (termKey: string, nextTermType: string) => {
  const term = getTerm(termKey)
  const column = getTermColumn(term)

  if (!term) {
    return
  }

  const nextValue = convertValue(term.termType, nextTermType, term.value)
  applyTermUpdate(termKey, {
    termType: nextTermType,
    value: nextValue,
  })

  if (nullaryTermTypes.has(nextTermType)) {
    setTailMode({ focus: true })
    return
  }

  if (isDirectTextTerm(column, nextTermType)) {
    if (!hasTermValue({
      ...term,
      termType: nextTermType,
      value: nextValue,
    })) {
      startValueEdit(termKey, '')
    }
    return
  }

  valuePanelTermKey.value = termKey
  editorMode.value = 'tail'
  editingTermKey.value = undefined
  fieldPanelOpen.value = false
}

const onRemoveTerm = (termKey: string) => {
  const index = getTermIndex(termKey)

  if (index === -1) {
    return
  }

  termsModel.value.splice(index, 1)

  if (termsModel.value[0]) {
    delete termsModel.value[0].type
  }

  if (editingTermKey.value === termKey || valuePanelTermKey.value === termKey) {
    setTailMode({ focus: true })
  }
}

const removeTailToken = () => {
  const lastTerm = termsModel.value[termsModel.value.length - 1]

  if (!lastTerm?.key) {
    return
  }

  onRemoveTerm(lastTerm.key)
}

const commitTextValue = (options?: { focusTail?: boolean }) => {
  const termKey = editingTermKey.value
  const term = getTerm(termKey)

  if (!term || !termKey) {
    return
  }

  const nextValue = valueKeyword.value

  if (!nextValue) {
    onRemoveTerm(termKey)
    return
  }

  applyTermUpdate(termKey, {
    value: nextValue,
  })

  setTailMode({ focus: options?.focusTail })
}

const onApplyPanelValue = (termKey: string, value: TermsItem, options?: { close?: boolean; allowEmpty?: boolean }) => {
  if (!nullaryTermTypes.has(value.termType || '') && !hasTermValue(value)) {
    onRemoveTerm(termKey)
    return
  }

  applyTermUpdate(termKey, value)

  if (options?.close === false) {
    valuePanelTermKey.value = termKey
    fieldPanelOpen.value = false
    editorMode.value = 'tail'
    editingTermKey.value = undefined
    return
  }

  setTailMode({ focus: true })
}

const onClear = () => {
  termsModel.value = []
  setTailMode()
}

const onClearAll = () => {
  onClear()
}

const exposeApi: ConditionFilterExpose = {
  getTerms: () => cloneTerms(payload.value.terms, { stripKey: true }),
  getFilter: () => ({
    terms: cloneTerms(payload.value.filter.terms, { stripKey: true }),
  }),
  getWhere: () => payload.value.where,
  setTerms: (terms = []) => {
    termsModel.value = normalizeInputTerms(terms, props.columns)
    setTailMode()
  },
  setFilter: (filter) => {
    termsModel.value = normalizeInputTerms(filter?.terms || [], props.columns)
    setTailMode()
  },
  setWhere: (where = '') => {
    termsModel.value = parseWhereExpression(where, props.columns)
    setTailMode()
  },
  clear: onClear,
}

const getFocusableElements = () => {
  return Array.from(
    rootRef.value?.querySelectorAll<HTMLElement>('[data-condition-focusable="true"]') || [],
  ).filter(item => !item.hasAttribute('disabled'))
}

const focusSibling = (current: EventTarget | null, offset: number) => {
  const target = current as HTMLElement | null

  if (!target) {
    return
  }

  const elements = getFocusableElements()
  const index = elements.findIndex(item => item === target)

  if (index === -1) {
    return
  }

  elements[index + offset]?.focus?.()
}

const isCursorAtStart = (event: KeyboardEvent) => {
  const target = event.target as HTMLInputElement
  return (target.selectionStart ?? 0) === 0 && (target.selectionEnd ?? 0) === 0
}

const onShellClick = () => {
  if (props.disabled) {
    return
  }

  focusTailInput(true)
}

const onTokenActivate = (termKey: string, kind: TokenKind, target?: EventTarget | null) => {
  const term = getTerm(termKey)

  if (!term) {
    return
  }

  if (kind === 'field') {
    startFieldEdit(termKey)
    return
  }

  if (kind === 'value') {
    const column = getTermColumn(term)

    if (isPopupValueTerm(column, term.termType)) {
      valuePanelTermKey.value = termKey
      fieldPanelOpen.value = false
      editorMode.value = 'tail'
      editingTermKey.value = undefined
      return
    }

    startValueEdit(termKey)
    return
  }

  ;(target as HTMLElement | null)?.click?.()
}

const onTokenKeydown = (event: KeyboardEvent, termKey: string, kind: TokenKind) => {
  if (props.disabled) {
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusSibling(event.currentTarget, -1)
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    focusSibling(event.currentTarget, 1)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    onTokenActivate(termKey, kind, event.currentTarget)
    return
  }

  if (!['Backspace', 'Delete'].includes(event.key)) {
    return
  }

  event.preventDefault()

  if (kind === 'value') {
    onRemoveTerm(termKey)
    return
  }

  onRemoveTerm(termKey)
}

const onTailFocus = () => {
  if (props.disabled) {
    return
  }

  editorMode.value = 'tail'
  editingTermKey.value = undefined
  valuePanelTermKey.value = undefined
  fieldPanelOpen.value = true
}

const onTailActivate = () => {
  if (props.disabled) {
    return
  }

  fieldPanelOpen.value = true
}

const releaseFieldBlurLock = () => {
  requestAnimationFrame(() => {
    fieldBlurLock.value = false
  })
}

const onTailBlur = () => {
  fieldBlurLock.value = true
  fieldPanelOpen.value = false
  releaseFieldBlurLock()
}

const onTailInput = (event: Event) => {
  fieldKeyword.value = (event.target as HTMLInputElement)?.value || ''
  fieldPanelOpen.value = true
}

const onTailKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()

    if (fieldOptions.value[0]) {
      onSelectField(fieldOptions.value[0].dataIndex)
    }
    return
  }

  if (event.key === 'Escape') {
    fieldPanelOpen.value = false
    fieldKeyword.value = ''
    return
  }

  if (!isCursorAtStart(event) || fieldKeyword.value) {
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusSibling(event.currentTarget, -1)
    return
  }

  if (event.key === 'Backspace') {
    event.preventDefault()
    removeTailToken()
  }
}

const onFieldInput = (event: Event) => {
  fieldKeyword.value = (event.target as HTMLInputElement)?.value || ''
  fieldPanelOpen.value = true
}

const onFieldBlur = () => {
  fieldBlurLock.value = true
  fieldPanelOpen.value = false
  releaseFieldBlurLock()
}

const onFieldKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()

    if (fieldOptions.value[0]) {
      onSelectField(fieldOptions.value[0].dataIndex)
    }
    return
  }

  if (event.key === 'Escape') {
    setTailMode({ focus: true })
    return
  }

  if (!isCursorAtStart(event) || fieldKeyword.value) {
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusSibling(event.currentTarget, -1)
    return
  }

  if (event.key === 'Backspace' && editingTermKey.value) {
    event.preventDefault()
    onRemoveTerm(editingTermKey.value)
  }
}

const onValueInput = (event: Event) => {
  valueKeyword.value = (event.target as HTMLInputElement)?.value || ''
}

const onValueBlur = () => {
  if (editorMode.value !== 'value') {
    return
  }

  commitTextValue()
}

const onValueKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    commitTextValue({ focusTail: true })
    return
  }

  if (event.key === 'Escape') {
    setTailMode({ focus: true })
    return
  }

  if (!isCursorAtStart(event) || valueKeyword.value) {
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusSibling(event.currentTarget, -1)
    return
  }

  if (event.key === 'Backspace' && editingTermKey.value) {
    event.preventDefault()
    onRemoveTerm(editingTermKey.value)
  }
}

const onFieldPanelOpenChange = (visible: boolean) => {
  if (!visible && (fieldBlurLock.value || isInlineEditorFocused())) {
    return
  }

  fieldPanelOpen.value = visible

  if (!visible && editorMode.value === 'field') {
    setTailMode()
  }
}

const onValuePanelOpenChange = (termKey: string, visible: boolean) => {
  if (visible) {
    valuePanelTermKey.value = termKey
    fieldPanelOpen.value = false
    editorMode.value = 'tail'
    editingTermKey.value = undefined
    return
  }

  if (valuePanelTermKey.value === termKey) {
    valuePanelTermKey.value = undefined
  }
}

const onClearTermValue = (termKey: string) => {
  onRemoveTerm(termKey)
}

defineExpose<ConditionFilterExpose>(exposeApi)

watch(
  searchColumns,
  () => {
    syncColumnsContext()
    syncByProps()
  },
  { immediate: true, deep: true },
)

watch(
  () => props.modelValue,
  () => {
    if (!props.where?.trim()) {
      syncByProps()
    }
  },
  { deep: true },
)

watch(
  () => props.where,
  () => {
    syncByProps()
  },
)

watch(
  termsModel,
  () => {
    ensureTermOptionsLoaded()
    emit('update:modelValue', cloneTerms(termsModel.value, { stripKey: true }))
    emit('update:where', payload.value.where)
    scheduleAutoSearch()
  },
  { deep: true },
)

onUnmounted(() => {
  if (autoSearchTimer) {
    window.clearTimeout(autoSearchTimer)
  }

  watchDisposers.forEach(stop => stop())
  watchDisposers.clear()
})
</script>

<template>
  <div class="condition-filter" :class="{ 'condition-filter--disabled': disabled }">
    <div ref="rootRef" class="condition-filter__shell" @click="onShellClick">
      <div class="condition-filter__content">
        <div
          v-for="(term, index) in termsModel"
          :key="getTermKey(term) || `${term.column}-${index}`"
          class="condition-filter__term"
          :class="{ 'condition-filter__term--or': index && (term.type || 'and') === 'or' }"
        >
          <a-dropdown
            v-if="index"
            trigger="click"
            placement="bottomLeft"
          >
            <button
              class="condition-filter__chip condition-filter__chip--logic"
              type="button"
              :disabled="disabled"
              data-condition-focusable="true"
              @click.stop
              @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'logic')"
            >
              <span class="condition-filter__chip-text">{{ logicCompactLabelMap[term.type || 'and'] }}</span>
            </button>
            <template #overlay>
              <div class="condition-filter__dropdown-panel" @mousedown.prevent>
                <button
                  v-for="option in logicOptions"
                  :key="option.value"
                  class="condition-filter__dropdown-option condition-filter__chip condition-filter__chip--logic"
                  :class="[
                    { 'condition-filter__dropdown-option--active': isLogicTypeSelected(term, option.value) },
                    option.value === 'or' ? 'condition-filter__chip--logic-or' : '',
                  ]"
                  type="button"
                  @click.stop="onChangeLogic(index, option.value)"
                >
                  <span class="condition-filter__chip-text">{{ option.label }}</span>
                </button>
              </div>
            </template>
          </a-dropdown>

          <div class="condition-filter__term-main">
            <a-dropdown
              v-if="editorMode === 'field' && editingTermKey === getTermKey(term)"
              :open="fieldPanelOpen"
              trigger="click"
              placement="bottomLeft"
              @openChange="onFieldPanelOpenChange"
            >
              <div class="condition-filter__editor condition-filter__editor--field" @click.stop>
                <input
                  class="condition-filter__text-input"
                  :value="fieldKeyword"
                  :placeholder="getFieldLabel(term.column) || placeholder"
                  data-condition-focusable="true"
                  @blur="onFieldBlur"
                  @click="fieldPanelOpen = true"
                  @focus="fieldPanelOpen = true"
                  @input="onFieldInput"
                  @keydown="onFieldKeydown"
                />
              </div>
              <template #overlay>
                <FieldSelectPanel
                  :columns="fieldOptions"
                  :keyword="fieldKeyword"
                  :showSearch="false"
                  @select="onSelectField"
                />
              </template>
            </a-dropdown>

            <button
              v-else
              class="condition-filter__chip condition-filter__chip--field"
              type="button"
              :disabled="disabled"
              data-condition-focusable="true"
              @click.stop="startFieldEdit(getTermKey(term))"
              @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'field')"
            >
              <span class="condition-filter__chip-text">{{ getFieldLabel(term.column) }}</span>
            </button>

            <a-dropdown
              trigger="click"
              placement="bottomLeft"
            >
              <button
                class="condition-filter__chip condition-filter__chip--operator"
                type="button"
                :disabled="disabled"
                data-condition-focusable="true"
                @click.stop
                @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'operator')"
              >
                <span class="condition-filter__chip-text">{{ getReadableTermTypeLabel(term.termType) }}</span>
                <span
                  v-if="nullaryTermTypes.has(term.termType || '')"
                  class="condition-filter__chip-close"
                  @click.stop="onClearTermValue(getTermKey(term))"
                >
                  <AIcon type="CloseOutlined" />
                </span>
              </button>
              <template #overlay>
                <div class="condition-filter__dropdown-panel" @mousedown.prevent>
                  <button
                    v-for="option in getTermTypeOptions(getTermColumn(term))"
                    :key="option.value"
                    class="condition-filter__dropdown-option condition-filter__chip condition-filter__chip--operator"
                    :class="{ 'condition-filter__dropdown-option--active': isTermTypeSelected(term, option.value) }"
                    type="button"
                    @click.stop="onTermTypeChange(getTermKey(term), option.value)"
                  >
                    <span class="condition-filter__chip-text">{{ getReadableTermTypeLabel(option.value) }}</span>
                  </button>
                </div>
              </template>
            </a-dropdown>

            <template v-if="!nullaryTermTypes.has(term.termType || '')">
              <div
                v-if="editorMode === 'value' && editingTermKey === getTermKey(term)"
                class="condition-filter__editor condition-filter__editor--value"
                @click.stop
              >
                <input
                  class="condition-filter__text-input"
                  :value="valueKeyword"
                  :placeholder="getValuePlaceholder(term)"
                  data-condition-focusable="true"
                  @blur="onValueBlur"
                  @input="onValueInput"
                  @keydown="onValueKeydown"
                />
              </div>

              <a-dropdown
                v-else-if="isPopupValueTerm(getTermColumn(term), term.termType)"
                :open="valuePanelTermKey === getTermKey(term)"
                trigger="click"
                placement="bottomLeft"
                @openChange="(visible) => onValuePanelOpenChange(getTermKey(term), visible)"
              >
                <button
                  class="condition-filter__chip condition-filter__chip--value"
                  :class="{ 'condition-filter__chip--placeholder': !getValueLabel(term) }"
                  type="button"
                  :disabled="disabled"
                  data-condition-focusable="true"
                  @click.stop="valuePanelTermKey = getTermKey(term)"
                  @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'value')"
                >
                  <span class="condition-filter__chip-text">
                    {{ getValueLabel(term) || getValuePlaceholder(term) }}
                  </span>
                  <span
                    v-if="hasTermValue(term)"
                    class="condition-filter__chip-close"
                    @click.stop="onClearTermValue(getTermKey(term))"
                  >
                    <AIcon type="CloseOutlined" />
                  </span>
                </button>
                <template #overlay>
                  <ConditionEditorPanel
                    :column="term.column"
                    :term="term"
                    @apply="(value, options) => onApplyPanelValue(getTermKey(term), value, options)"
                  >
                    <template v-if="slots['value-editor']" #value="slotProps">
                      <slot name="value-editor" v-bind="slotProps" />
                    </template>
                  </ConditionEditorPanel>
                </template>
              </a-dropdown>

              <button
                v-else
                class="condition-filter__chip condition-filter__chip--value"
                :class="{ 'condition-filter__chip--placeholder': !getValueLabel(term) }"
                type="button"
                :disabled="disabled"
                data-condition-focusable="true"
                @click.stop="startValueEdit(getTermKey(term))"
                @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'value')"
              >
                <span class="condition-filter__chip-text">
                  {{ getValueLabel(term) || getValuePlaceholder(term) }}
                </span>
                <span
                  v-if="hasTermValue(term)"
                  class="condition-filter__chip-close"
                  @click.stop="onClearTermValue(getTermKey(term))"
                >
                  <AIcon type="CloseOutlined" />
                </span>
              </button>
            </template>
          </div>
        </div>

        <a-dropdown
          v-if="!disabled && editorMode === 'tail'"
          :open="fieldPanelOpen"
          trigger="click"
          placement="bottomLeft"
          @openChange="onFieldPanelOpenChange"
        >
          <div class="condition-filter__tail" @click.stop>
            <span class="condition-filter__tail-prefix" aria-hidden="true">
              <AIcon type="PlusOutlined" />
            </span>
            <input
              class="condition-filter__text-input condition-filter__text-input--tail"
              :value="fieldKeyword"
              :placeholder="placeholder"
              data-condition-focusable="true"
              @blur="onTailBlur"
              @click="onTailActivate"
              @focus="onTailFocus"
              @input="onTailInput"
              @keydown="onTailKeydown"
            />
          </div>
          <template #overlay>
            <FieldSelectPanel
              :columns="fieldOptions"
              :keyword="fieldKeyword"
              :showSearch="false"
              @select="onSelectField"
            />
          </template>
        </a-dropdown>

        <span
          v-else-if="disabled && !termsModel.length"
          class="condition-filter__placeholder"
        >
          {{ placeholder }}
        </span>
      </div>

      <div v-if="!disabled" class="condition-filter__actions" @click.stop>
        <button
          class="condition-filter__action condition-filter__action--clear"
          type="button"
          :disabled="!hasAnyTerms"
          @click="onClearAll"
        >
          <AIcon type="CloseCircleOutlined" />
        </button>
        <button
          class="condition-filter__action condition-filter__action--search"
          type="button"
          @click="triggerSearch"
        >
          <AIcon type="SearchOutlined" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="less">
.condition-filter {
  width: 100%;

  &__shell {
    display: flex;
    align-items: flex-start;
    width: 100%;
    min-height: 38px;
    padding: 5px 10px;
    background: #fff;
    border: 1px solid #d0d7de;
    border-radius: 8px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover {
      border-color: #b6c0cc;
    }

    &:focus-within {
      border-color: #91caff;
      box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.08);
    }
  }

  &__content {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 4px;
    min-width: 0;
  }

  &__term {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
  }

  &__term-main {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: 100%;
  }

  &__chip,
  &__editor {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    max-width: min(100%, 260px);
    height: 26px;
    padding: 0 8px;
    color: #1f2329;
    font-size: 12px;
    line-height: 24px;
    border: 1px solid transparent;
    border-radius: 6px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  }

  &__chip {
    cursor: pointer;
    background: #f5f7fa;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.72;
    }

    &:focus-visible {
      border-color: #91caff;
      outline: none;
      box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.08);
    }
  }

  &__chip--logic {
    height: 22px;
    padding: 0 7px;
    color: #667085;
    font-size: 11px;
    line-height: 20px;
    background: #fff;
    border-color: #d0d5dd;
  }

  &__term--or &__chip--logic,
  &__chip--logic-or {
    color: #b54708;
    background: #fff7ed;
    border-color: #fdba74;
  }

  &__chip--field,
  &__editor--field {
    color: #0f4c81;
    background: #edf5ff;
  }

  &__chip--operator {
    color: #475467;
    background: #f4f6f8;
  }

  &__chip--value,
  &__editor--value {
    color: #111827;
    background: #eef2f6;
  }

  &__chip--value,
  &__editor--value,
  &__editor--field {
    flex: 0 1 auto;
  }

  &__chip--placeholder {
    color: #98a2b3;
  }

  &__chip-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__chip-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    color: #8a94a6;
    border-radius: 50%;
    transition: background-color 0.15s ease, color 0.15s ease;

    &:hover {
      color: #475467;
      background: rgba(15, 23, 42, 0.08);
    }
  }

  &__editor {
    padding-right: 6px;

    &:focus-within {
      border-color: #91caff;
      box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.08);
    }
  }

  &__tail {
    display: inline-flex;
    flex: 1 1 120px;
    min-width: 120px;
    align-items: center;
    min-height: 26px;
    gap: 6px;
  }

  &__tail-prefix {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    color: #8a94a6;
    font-size: 12px;
    flex: 0 0 auto;
  }

  &__text-input {
    width: 100%;
    min-width: 56px;
    padding: 0;
    color: #1f2329;
    font-size: 12px;
    line-height: 24px;
    background: transparent;
    border: 0;
    outline: none;

    &::placeholder {
      color: #98a2b3;
    }
  }

  &__text-input--tail {
    min-width: 120px;
  }

  &__placeholder {
    color: #98a2b3;
    font-size: 12px;
    line-height: 24px;
  }

  &__actions {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 0;
    align-self: stretch;
    margin-left: 8px;
    border-left: 1px solid #e4e7ec;
    padding-left: 8px;
  }

  &__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    color: #667085;
    background: transparent;
    border: 0;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;

    &:hover:not(:disabled) {
      color: #344054;
      background: #f2f4f7;
    }

    &:disabled {
      color: #c0c6d0;
      cursor: not-allowed;
    }
  }

  &__action--search {
    color: #1677ff;
  }

  &__dropdown-panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 120px;
    padding: 8px;
    background: #fff;
    border: 1px solid #e4e7ec;
    border-radius: 10px;
    box-shadow: 0 8px 20px rgba(31, 35, 41, 0.12);
  }

  &__dropdown-option {
    max-width: 100%;
    justify-content: flex-start;
  }

  &__dropdown-option--active {
    border-color: #91caff;
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.08);
  }

  &--disabled {
    .condition-filter__shell {
      background: #f7f8fa;
      cursor: not-allowed;
    }
  }
}

@media (max-width: 768px) {
  .condition-filter {
    &__shell {
      padding: 6px 8px;
    }

    &__chip,
    &__editor {
      max-width: 100%;
    }
  }
}
</style>

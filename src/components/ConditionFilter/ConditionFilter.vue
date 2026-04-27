<script setup lang="ts" name="ConditionFilter">
import type { PropType } from 'vue'
import dayjs from 'dayjs'
import { isRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { request } from '@jetlinks-web/core'
import { randomString } from '@jetlinks-web/utils'
import {
  getConditionFilterDefaultTermType,
  getReadableTermTypeLabel,
  getTermTypeDescription,
  getTermTypeOption,
  getTermTypeShortDescription,
  isArrayTermType,
  isNullaryTermType,
  normalizeTermTypeOption,
} from '../Search/Filter/setting'
import { useColumnItemOptionsContext, useColumnsMapContext } from '../Search/Filter/hooks/useSearchEngine'
import ConditionEditorPanel from './ConditionEditorPanel.vue'
import FieldSelectPanel from './FieldSelectPanel.vue'
import { normalizeOptionItemsByFields, resolveOptionDisplayFields } from './option-display'
import { resolveConditionFields } from './schema'
import type {
  ConditionFilterChangePayload,
  ConditionFilterCommonField,
  ConditionFilterExpose,
  ConditionFilterField,
  ConditionFilterTerm,
} from './types'
import type { SearchItem } from '../Search/Filter/typing'
import {
  buildQueryFilter,
  buildWhereExpression,
  cloneTerms,
  isConditionGroup,
  isSameTerms,
  normalizeInputTerms,
  parseWhereExpression,
} from './utils'

const slots = useSlots()

type TokenKind = 'logic' | 'field' | 'operator' | 'value'
type EditorMode = 'tail' | 'field' | 'value'

const fieldBlurLock = ref(false)
const autoSearchDelay = 260

const props = defineProps({
  fields: {
    type: Array as PropType<ConditionFilterField[]>,
    default: () => [],
  },
  columns: {
    type: Array as PropType<SearchItem[]>,
    default: () => [],
  },
  modelValue: {
    type: Array as PropType<ConditionFilterTerm[]>,
    default: () => [],
  },
  where: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
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
  (e: 'update:modelValue', value: ConditionFilterTerm[]): void
  (e: 'update:where', value: string): void
  (e: 'change', value: ConditionFilterChangePayload): void
}>()

const { t: $t } = useI18n()

const resolvedPlaceholder = computed(() => props.placeholder || $t('components.ConditionFilter.placeholder.add'))

const logicOptions = computed(() => [
  { label: $t('components.ConditionFilter.logic.and'), value: 'and' },
  { label: $t('components.ConditionFilter.logic.or'), value: 'or' },
])

const logicCompactLabelMap = computed(() => ({
  and: $t('components.ConditionFilter.logic.andCompact'),
  or: $t('components.ConditionFilter.logic.orCompact'),
}))

const termsModel = ref<ConditionFilterTerm[]>([])
const rootRef = ref<HTMLElement>()

const editorMode = ref<EditorMode>('tail')
const editingTermKey = ref<string>()
const fieldKeyword = ref('')
const valueKeyword = ref('')
const fieldPanelActiveIndex = ref(-1)
const fieldPanelOpen = ref(false)
const nextTailFocusOpenState = ref<boolean>()
const operatorPanelTermKey = ref<string>()
const valuePanelTermKey = ref<string>()
const valuePanelOpenVersion = ref(0)

const columnsMap = reactive<Record<string, ConditionFilterField>>({})
const optionsMap = reactive<Record<string, any[]>>({})
const loadingMap = reactive<Record<string, boolean>>({})
const valueDraftMap = reactive<Record<string, ConditionFilterTerm | undefined>>({})
const watchDisposers = new Map<string, () => void>()
let autoSearchTimer: number | undefined
let keepEmptyValueOnBlur = false

useColumnsMapContext(columnsMap)
useColumnItemOptionsContext(optionsMap)

const resolvedFields = computed(() => resolveConditionFields(props.fields, props.columns))

const searchColumns = computed(() => {
  return resolvedFields.value
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

const activeFieldOption = computed(() => {
  if (fieldPanelActiveIndex.value < 0) {
    return undefined
  }

  return fieldOptions.value[fieldPanelActiveIndex.value]
})

const payload = computed<ConditionFilterChangePayload>(() => {
  const filter = buildQueryFilter(termsModel.value, resolvedFields.value)
  const terms = cloneTerms(filter.terms, { stripKey: true })
  return {
    terms,
    filter: {
      terms,
    },
    where: buildWhereExpression(termsModel.value, resolvedFields.value),
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

const hasTermValue = (item?: ConditionFilterTerm) => {
  if (isConditionGroup(item)) {
    return Array.isArray(item.terms) && item.terms.some(child => hasTermValue(child))
  }

  if (!item?.termType) {
    return false
  }

  if (isNullaryTermType(item.termType)) {
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

const getTermKey = (term: ConditionFilterTerm) => term.key || ''

const getTermIndex = (termKey?: string) => {
  return termsModel.value.findIndex(item => item.key === termKey)
}

const getNextTermKey = (termKey?: string) => {
  const index = getTermIndex(termKey)

  return index >= 0 ? termsModel.value[index + 1]?.key : undefined
}

const getTerm = (termKey?: string) => {
  const index = getTermIndex(termKey)
  return index === -1 ? undefined : termsModel.value[index]
}

const getTermColumn = (term?: ConditionFilterTerm) => {
  return term?.column ? columnsMap[term.column] : undefined
}

const getTermTypeOptions = (column?: ConditionFilterField) => {
  const search = column?.search

  if (!search) {
    return []
  }

  if (search.termOptions?.length) {
    return search.termOptions.map(option => normalizeTermTypeOption(option))
  }

  const filterKeys = search.termFilter || []
  const optionKeys = search.termTypeOptions || getConditionFilterDefaultTermType(search.type)

  return optionKeys
    .filter(item => !filterKeys.includes(item))
    .map((value) => normalizeTermTypeOption(getTermTypeOption(value) || { label: value, value }))
}

const getRecommendedTermType = (column?: ConditionFilterField) => {
  const search = column?.search

  if (!column || !search) {
    return undefined
  }

  const options = getTermTypeOptions(column)
  if (typeof search.recommendTermType === 'function') {
    return search.recommendTermType(column, { options }) || search.defaultTermType || options[0]?.value
  }

  if (typeof search.recommendTermType === 'string') {
    return options.some(item => item.value === search.recommendTermType)
      ? search.recommendTermType
      : search.defaultTermType || options[0]?.value
  }

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

const getFieldValueKind = (column?: ConditionFilterField, termType?: string) => {
  if (!column?.search || !termType) {
    return 'unknown'
  }

  if (isNullaryTermType(termType)) {
    return 'nullary'
  }

  const searchType = column.search.type
  const isArray = isArrayTermType(termType)

  if (searchType === 'string' && !isArray) {
    return 'text'
  }

  if (searchType === 'number') {
    return isArray ? 'number-range' : 'number'
  }

  if (['select', 'tree', 'treeSelect'].includes(searchType)) {
    return isArray ? 'options-multiple' : 'options-single'
  }

  if (['date', 'time', 'timeRange', 'rangePicker'].includes(searchType)) {
    return isArray ? 'date-range' : 'date'
  }

  if (searchType === 'component') {
    return 'component'
  }

  return `${searchType}:${isArray ? 'array' : 'single'}`
}

const shouldKeepTermTypeOnFieldSwitch = (
  term: ConditionFilterTerm | undefined,
  nextColumn: ConditionFilterField | undefined,
) => {
  const currentColumn = getTermColumn(term)

  if (!term?.termType || !currentColumn?.search?.type || !nextColumn?.search?.type) {
    return false
  }

  return currentColumn.search.type === nextColumn.search.type
}

const canReuseFieldValueOnSwitch = (
  term: ConditionFilterTerm | undefined,
  nextColumn: ConditionFilterField | undefined,
  nextTermType?: string,
) => {
  const currentColumn = getTermColumn(term)

  if (!term?.termType || !nextColumn?.search || !nextTermType || !hasTermValue(term)) {
    return false
  }

  const currentKind = getFieldValueKind(currentColumn, term.termType)
  const nextKind = getFieldValueKind(nextColumn, nextTermType)

  if (['unknown', 'nullary', 'component'].includes(currentKind) || ['unknown', 'nullary', 'component'].includes(nextKind)) {
    return false
  }

  return currentKind === nextKind
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

const isDirectTextTerm = (column?: ConditionFilterField, termType?: string) => {
  return column?.search?.type === 'string' && !!termType && !isNullaryTermType(termType) && !isArrayTermType(termType)
}

const isPopupValueTerm = (column?: ConditionFilterField, termType?: string) => {
  return !!column?.search && !!termType && !isNullaryTermType(termType) && !isDirectTextTerm(column, termType)
}

const getFieldLabel = (columnKey?: string) => {
  const column = columnKey ? columnsMap[columnKey] : undefined
  return column?.title || column?.dataIndex || ''
}

const countGroupLeaves = (term?: ConditionFilterTerm): number => {
  if (!term) {
    return 0
  }

  if (!isConditionGroup(term)) {
    return 1
  }

  return (term.terms || []).reduce((total, item) => total + countGroupLeaves(item), 0)
}

const getGroupLabel = (term?: ConditionFilterTerm) => {
  const total = countGroupLeaves(term)
  return total
    ? $t('components.ConditionFilter.group.withCount', { total })
    : $t('components.ConditionFilter.group.default')
}

const isTermTypeSelected = (term: ConditionFilterTerm, termType: string) => {
  return term.termType === termType
}

const isLogicTypeSelected = (term: ConditionFilterTerm, value: string) => {
  return (term.type || 'and') === value
}

const getResolvedTermTypeOption = (termType?: string, column?: ConditionFilterField) => {
  const option = getTermTypeOptions(column).find(item => item.value === termType)
  return option || getTermTypeOption(termType)
}

const getTermTypeReadableText = (termType?: string, column?: ConditionFilterField) => {
  const option = getResolvedTermTypeOption(termType, column)
  return option?.readableLabel || option?.label || getReadableTermTypeLabel(termType)
}

const getTermTypeShortText = (termType?: string, column?: ConditionFilterField) => {
  const option = getResolvedTermTypeOption(termType, column)
  return option?.shortDescription || getTermTypeShortDescription(termType)
}

const getTermTypeTooltip = (termType?: string, column?: ConditionFilterField) => {
  const option = getResolvedTermTypeOption(termType, column)
  return option?.description || getTermTypeDescription(termType)
}

const getValuePlaceholder = (term: ConditionFilterTerm) => {
  return getTermColumn(term)?.search?.componentProps?.placeholder || $t('components.ConditionFilter.placeholder.value')
}

const getOptionList = (column?: ConditionFilterField) => {
  const key = column?.dataIndex
  if (!key) {
    return []
  }

  if (Array.isArray(optionsMap[key]) && optionsMap[key].length) {
    return optionsMap[key]
  }

  if (Array.isArray(column?.search?.options)) {
    return normalizeOptionItems(column?.search?.options || [], column)
  }

  return []
}

const normalizeOptionItems = (items: any[] = [], column?: ConditionFilterField) =>
  normalizeOptionItemsByFields(items, resolveOptionDisplayFields(column))

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

const hasResolvedOptionValues = (column: ConditionFilterField | undefined, values: any[] = []) => {
  const normalizedValues = values.filter(value => !isNilValue(value)).map(value => String(value))

  if (!column?.dataIndex || !normalizedValues.length) {
    return false
  }

  const optionValueSet = new Set(
    getOptionList(column).map((item: Record<string, any>) => String(item?.value ?? item?.id)),
  )

  return normalizedValues.every(value => optionValueSet.has(value))
}

const getOptionLabel = (column: ConditionFilterField | undefined, value: any) => {
  const option = getOptionList(column).find((item: Record<string, any>) => {
    const optionValue = item?.value ?? item?.id
    return String(optionValue) === String(value)
  })

  if (!option) {
    return String(value)
  }

  return String(option.label ?? option.name ?? option.title ?? option.value ?? option.id)
}

const getDateDisplayFormat = (searchType?: string) => {
  if (searchType === 'time') {
    return 'HH:mm:ss'
  }

  if (searchType === 'date') {
    return 'YYYY-MM-DD'
  }

  return 'YYYY-MM-DD HH:mm'
}

const getDateTooltipFormat = (searchType?: string) => {
  if (searchType === 'time') {
    return 'HH:mm:ss'
  }

  if (searchType === 'date') {
    return 'YYYY-MM-DD HH:mm:ss'
  }

  return 'YYYY-MM-DD HH:mm'
}

const formatDateValue = (column: ConditionFilterField | undefined, value: any) => {
  const searchType = column?.search?.type
  const dateValue = dayjs(value)

  if (!dateValue.isValid()) {
    return String(value)
  }

  return dateValue.format(getDateDisplayFormat(searchType))
}

const formatDateTooltipValue = (column: ConditionFilterField | undefined, value: any) => {
  const searchType = column?.search?.type
  const dateValue = dayjs(value)

  if (!dateValue.isValid()) {
    return String(value)
  }

  return dateValue.format(getDateTooltipFormat(searchType))
}

const getWeekRange = (value = dayjs()) => {
  const current = value.startOf('day')
  const weekDay = current.day()
  const diff = weekDay === 0 ? 6 : weekDay - 1
  const start = current.subtract(diff, 'day').startOf('day')
  const end = start.add(6, 'day').endOf('day')
  return { start, end }
}

const isExactDateRange = (start: dayjs.Dayjs, end: dayjs.Dayjs, expectedStart: dayjs.Dayjs, expectedEnd: dayjs.Dayjs) => {
  return start.valueOf() === expectedStart.valueOf() && end.valueOf() === expectedEnd.valueOf()
}

const getPresetDateRangeLabel = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
  const today = dayjs()
  const todayStart = today.startOf('day')
  const todayEnd = today.endOf('day')
  const yesterday = today.subtract(1, 'day')
  const yesterdayStart = yesterday.startOf('day')
  const yesterdayEnd = yesterday.endOf('day')
  const thisWeek = getWeekRange(today)
  const lastWeek = getWeekRange(today.subtract(7, 'day'))
  const thisMonthStart = today.startOf('month')
  const thisMonthEnd = today.endOf('month')
  const lastMonth = today.subtract(1, 'month')
  const lastMonthStart = lastMonth.startOf('month')
  const lastMonthEnd = lastMonth.endOf('month')
  const thisYearStart = today.startOf('year')
  const thisYearEnd = today.endOf('year')
  const recent7DaysStart = today.subtract(6, 'day').startOf('day')
  const recent30DaysStart = today.subtract(29, 'day').startOf('day')

  if (isExactDateRange(start, end, todayStart, todayEnd)) {
    return $t('components.ConditionFilter.date.today')
  }

  if (isExactDateRange(start, end, yesterdayStart, yesterdayEnd)) {
    return $t('components.ConditionFilter.date.yesterday')
  }

  if (isExactDateRange(start, end, thisWeek.start, thisWeek.end)) {
    return $t('components.ConditionFilter.date.thisWeek')
  }

  if (isExactDateRange(start, end, lastWeek.start, lastWeek.end)) {
    return $t('components.ConditionFilter.date.lastWeek')
  }

  if (isExactDateRange(start, end, thisMonthStart, thisMonthEnd)) {
    return $t('components.ConditionFilter.date.thisMonth')
  }

  if (isExactDateRange(start, end, lastMonthStart, lastMonthEnd)) {
    return $t('components.ConditionFilter.date.lastMonth')
  }

  if (isExactDateRange(start, end, thisYearStart, thisYearEnd)) {
    return $t('components.ConditionFilter.date.thisYear')
  }

  if (isExactDateRange(start, end, recent7DaysStart, todayEnd)) {
    return $t('components.ConditionFilter.date.last7Days')
  }

  if (isExactDateRange(start, end, recent30DaysStart, todayEnd)) {
    return $t('components.ConditionFilter.date.last30Days')
  }

  return undefined
}

const getDateRangeLabel = (column: ConditionFilterField | undefined, startValue: any, endValue: any) => {
  const searchType = column?.search?.type
  const start = dayjs(startValue)
  const end = dayjs(endValue)

  if (!start.isValid() || !end.isValid()) {
    return undefined
  }

  const preset = getPresetDateRangeLabel(start, end)

  if (preset) {
    return preset
  }

  if (searchType === 'date') {
    if (start.isSame(end, 'day')) {
      return `${start.format('YYYY-MM-DD')}${$t('components.ConditionFilter.date.sameDaySuffix')}`
    }

    if (start.isSame(end, 'year')) {
      return `${start.format('MM-DD')} ~ ${end.format('MM-DD')}`
    }

    return `${start.format('YYYY-MM-DD')} ~ ${end.format('YYYY-MM-DD')}`
  }

  if (start.isSame(end, 'day')) {
    return `${start.format('MM-DD HH:mm')} ~ ${end.format('HH:mm')}`
  }

  if (start.isSame(end, 'year')) {
    return `${start.format('MM-DD HH:mm')} ~ ${end.format('MM-DD HH:mm')}`
  }

  return `${start.format('YYYY-MM-DD HH:mm')} ~ ${end.format('YYYY-MM-DD HH:mm')}`
}

const formatScalarValue = (column: ConditionFilterField | undefined, value: any, term?: ConditionFilterTerm) => {
  if (isNilValue(value)) {
    return ''
  }

  if (column?.search?.formatValuePreview && term) {
    return column.search.formatValuePreview(value, term, column)
  }

  const searchType = column?.search?.type

  if (['select', 'treeSelect', 'tree'].includes(searchType || '')) {
    return getOptionLabel(column, value)
  }

  if (['date', 'time', 'timeRange', 'rangePicker'].includes(searchType || '')) {
    return formatDateValue(column, value)
  }

  return String(value)
}

const getValueLabel = (term: ConditionFilterTerm) => {
  const column = getTermColumn(term)

  if (!term.termType || isNullaryTermType(term.termType) || !hasTermValue(term)) {
    return ''
  }

  if (Array.isArray(term.value)) {
    if (['btw', 'nbtw'].includes(term.termType) && ['date', 'time', 'timeRange', 'rangePicker'].includes(column?.search?.type || '')) {
      const [start, end] = term.value.filter(item => !isNilValue(item))

      if (!isNilValue(start) && !isNilValue(end)) {
        const label = getDateRangeLabel(column, start, end)

        if (label) {
          return label
        }
      }
    }

    const values = term.value.filter(item => !isNilValue(item)).map(item => formatScalarValue(column, item, term))
    return ['btw', 'nbtw'].includes(term.termType) ? values.join(' ~ ') : values.join('、')
  }

  return formatScalarValue(column, term.value, term)
}

const getValueTooltip = (term: ConditionFilterTerm) => {
  const displayTerm = getDisplayTerm(term)
  const column = getTermColumn(displayTerm)

  if (!displayTerm.termType || isNullaryTermType(displayTerm.termType) || !hasTermValue(displayTerm)) {
    return ''
  }

  if (Array.isArray(displayTerm.value)) {
    const values = displayTerm.value
      .filter(item => !isNilValue(item))
      .map((item) => ['date', 'time', 'timeRange', 'rangePicker'].includes(column?.search?.type || '')
        ? formatDateTooltipValue(column, item)
        : formatScalarValue(column, item, displayTerm))

    return ['btw', 'nbtw'].includes(displayTerm.termType) ? values.join(' ~ ') : values.join('、')
  }

  if (['date', 'time', 'timeRange', 'rangePicker'].includes(column?.search?.type || '')) {
    return formatDateTooltipValue(column, displayTerm.value)
  }

  return formatScalarValue(column, displayTerm.value, displayTerm)
}

const setValueDraft = (termKey: string, draft?: ConditionFilterTerm) => {
  if (!termKey) {
    return
  }

  if (!draft) {
    delete valueDraftMap[termKey]
    return
  }

  valueDraftMap[termKey] = {
    ...draft,
    key: termKey,
  }
}

const getDisplayTerm = (term: ConditionFilterTerm) => {
  const termKey = getTermKey(term)
  const draft = termKey ? valueDraftMap[termKey] : undefined

  if (!draft || valuePanelTermKey.value !== termKey) {
    return term
  }

  return {
    ...term,
    ...draft,
    key: termKey,
  }
}

const getDisplayValueLabel = (term: ConditionFilterTerm) => getValueLabel(getDisplayTerm(term))
const hasDisplayTermValue = (term: ConditionFilterTerm) => hasTermValue(getDisplayTerm(term))
const fieldPanelVisible = computed(() => fieldPanelOpen.value && !valuePanelTermKey.value && !operatorPanelTermKey.value)

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

const createOptionsLoader = async (column: ConditionFilterField | undefined, term?: ConditionFilterTerm) => {
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
      optionsMap[key] = Array.isArray(list) ? normalizeOptionItems(list, column) : []
    } finally {
      loadingMap[key] = false
    }

    return
  }

  if (!rawOptions) {
    return
  }

  if (Array.isArray(rawOptions)) {
    optionsMap[key] = mergeOptionItems(normalizeOptionItems(rawOptions, column))
    return
  }

  if (isRef(rawOptions)) {
    const watchKey = `${key}:ref`
    if (watchDisposers.has(watchKey)) {
      return
    }

    const stop = watch(
      rawOptions,
      val => (optionsMap[key] = mergeOptionItems(optionsMap[key] || [], normalizeOptionItems(val || [], column))),
      { immediate: true },
    )

    watchDisposers.set(watchKey, stop)
  } else if (typeof rawOptions === 'function' && !loadingMap[key]) {
    loadingMap[key] = true
    try {
      optionsMap[key] = mergeOptionItems(normalizeOptionItems(await rawOptions(), column))
    } finally {
      loadingMap[key] = false
    }
  }

  if (loadSelectedOptions && term && hasTermValue(term)) {
    const values = Array.isArray(term.value) ? term.value : [term.value]

    if (hasResolvedOptionValues(column, values)) {
      return
    }

    const selectedItems = await loadSelectedOptions(values)

    if (Array.isArray(selectedItems) && selectedItems.length) {
      optionsMap[key] = mergeOptionItems(optionsMap[key] || [], normalizeOptionItems(selectedItems, column))
    }
  }
}

const ensureTermOptionsLoaded = (terms: ConditionFilterTerm[] = termsModel.value) => {
  terms.forEach((term) => {
    if (isConditionGroup(term)) {
      ensureTermOptionsLoaded(term.terms || [])
      return
    }

    createOptionsLoader(getTermColumn(term), term)
  })
}

const syncByProps = () => {
  const nextTerms = props.where?.trim()
    ? parseWhereExpression(props.where, resolvedFields.value)
    : normalizeInputTerms(props.modelValue, resolvedFields.value)

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
  if (valuePanelTermKey.value) {
    delete valueDraftMap[valuePanelTermKey.value]
  }

  editorMode.value = 'tail'
  editingTermKey.value = undefined
  valueKeyword.value = ''
  fieldKeyword.value = options?.keyword ?? ''
  fieldPanelActiveIndex.value = 0
  fieldPanelOpen.value = options?.open ?? false
  operatorPanelTermKey.value = undefined
  valuePanelTermKey.value = undefined

  if (options?.focus) {
    nextTailFocusOpenState.value = options?.open ?? false
    focusEditorInput()
    return
  }

  nextTailFocusOpenState.value = undefined
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

const focusTermFieldChip = (termKey?: string) => {
  if (!termKey) {
    return
  }

  nextTick(() => {
    const termElement = Array.from(
      rootRef.value?.querySelectorAll<HTMLElement>('.condition-filter__term') || [],
    ).find(item => item.dataset.termKey === termKey)

    termElement
      ?.querySelector<HTMLElement>('[data-condition-focusable="true"][data-token-kind="field"]')
      ?.focus?.()
  })
}

const focusNextCondition = (termKey?: string) => {
  const nextTermKey = getNextTermKey(termKey)

  if (nextTermKey) {
    focusTermFieldChip(nextTermKey)
    return
  }

  focusTailInput(false)
}

const applyTermUpdate = (termKey: string, value: Partial<ConditionFilterTerm>) => {
  const index = getTermIndex(termKey)

  if (index === -1) {
    return
  }

  const current = termsModel.value[index]
  const nextItem: ConditionFilterTerm = {
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
  delete valueDraftMap[termKey]
}

const startFieldEdit = (termKey: string) => {
  if (props.disabled) {
    return
  }

  editorMode.value = 'field'
  editingTermKey.value = termKey
  fieldKeyword.value = ''
  fieldPanelActiveIndex.value = 0
  valueKeyword.value = ''
  fieldPanelOpen.value = true
  operatorPanelTermKey.value = undefined
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
  operatorPanelTermKey.value = undefined
  valuePanelTermKey.value = undefined
  valueKeyword.value = initialValue ?? (isNilValue(term.value) ? '' : String(term.value))
  focusEditorInput()
}

const activatePopupValueTerm = (termKey: string) => {
  nextTailFocusOpenState.value = false
  editorMode.value = 'tail'
  editingTermKey.value = undefined
  fieldKeyword.value = ''
  fieldPanelOpen.value = false
  operatorPanelTermKey.value = undefined
  valuePanelTermKey.value = termKey

  nextTick(() => {
    if (valuePanelTermKey.value === termKey) {
      fieldPanelOpen.value = false
    }
  })
}

const applyFieldSelection = (termKey: string, columnKey: string) => {
  const term = getTerm(termKey)
  const column = columnsMap[columnKey]

  if (!term || !column?.search) {
    return
  }

  const termOptions = getTermTypeOptions(column)
  const nextTermType =
    (shouldKeepTermTypeOnFieldSwitch(term, column) &&
      term.termType &&
      termOptions.some(item => item.value === term.termType) &&
      term.termType) ||
    getRecommendedTermType(column) ||
    'eq'

  const nextValue = canReuseFieldValueOnSwitch(term, column, nextTermType)
    ? convertValue(term.termType, nextTermType, term.value)
    : buildInitialValue(nextTermType, column.search.defaultValue)

  const nextTerm = {
    ...term,
    column: columnKey,
    termType: nextTermType,
    value: nextValue,
  }

  applyTermUpdate(termKey, {
    column: columnKey,
    termType: nextTermType,
    value: nextValue,
  })

  createOptionsLoader(column, nextTerm)
  fieldKeyword.value = ''
  fieldPanelActiveIndex.value = 0
  fieldPanelOpen.value = false

  if (isNullaryTermType(nextTermType)) {
    setTailMode({ focus: true })
    return
  }

  if (isDirectTextTerm(column, nextTermType)) {
    startValueEdit(termKey, isNilValue(nextValue) ? '' : String(nextValue))
    return
  }

  activatePopupValueTerm(termKey)
}

const onSelectField = (columnKey: string) => {
  let termKey = editingTermKey.value

  if (editorMode.value !== 'field' || !termKey) {
    const nextTerm: ConditionFilterTerm = {
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
  operatorPanelTermKey.value = undefined
  applyTermUpdate(termKey, {
    termType: nextTermType,
    value: nextValue,
  })

  if (isNullaryTermType(nextTermType)) {
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
      return
    }

    setTailMode({ focus: true })
    return
  }

  activatePopupValueTerm(termKey)
}

const onRemoveTerm = (termKey: string, options?: { focusTail?: boolean }) => {
  const index = getTermIndex(termKey)

  if (index === -1) {
    return
  }

  termsModel.value.splice(index, 1)
  delete valueDraftMap[termKey]

  if (termsModel.value[0]) {
    delete termsModel.value[0].type
  }

  if (editingTermKey.value === termKey || valuePanelTermKey.value === termKey) {
    setTailMode({ focus: options?.focusTail !== false })
  }
}

const removeTailToken = () => {
  const lastTerm = termsModel.value[termsModel.value.length - 1]

  if (!lastTerm?.key) {
    return
  }

  onRemoveTerm(lastTerm.key)
}

const commitTextValue = (options?: { focusTail?: boolean; allowEmpty?: boolean; focusNext?: boolean }) => {
  const termKey = editingTermKey.value
  const term = getTerm(termKey)

  if (!term || !termKey) {
    return
  }

  const nextValue = valueKeyword.value
  const shouldFocusNext = options?.focusNext

  if (!nextValue) {
    if (options?.allowEmpty) {
      applyTermUpdate(termKey, {
        value: undefined,
      })

      setTailMode({ focus: !shouldFocusNext && options?.focusTail })

      if (shouldFocusNext) {
        focusNextCondition(termKey)
      }
      return
    }

    onRemoveTerm(termKey, {
      focusTail: !shouldFocusNext,
    })

    if (shouldFocusNext) {
      focusNextCondition(termKey)
    }
    return
  }

  applyTermUpdate(termKey, {
    value: nextValue,
  })

  setTailMode({ focus: !shouldFocusNext && options?.focusTail })

  if (shouldFocusNext) {
    focusNextCondition(termKey)
  }
}

const onApplyPanelValue = (termKey: string, value: ConditionFilterTerm, options?: { close?: boolean; allowEmpty?: boolean }) => {
  delete valueDraftMap[termKey]

  if (!isNullaryTermType(value.termType) && !hasTermValue(value)) {
    if (options?.allowEmpty) {
      applyTermUpdate(termKey, {
        termType: value.termType,
        value: cloneValue(value.value),
      })

      if (options?.close === false) {
        valuePanelTermKey.value = termKey
        fieldPanelOpen.value = false
        editorMode.value = 'tail'
        editingTermKey.value = undefined
        return
      }

      setTailMode({ focus: true })
      return
    }

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
  Object.keys(valueDraftMap).forEach((key) => {
    delete valueDraftMap[key]
  })
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
    termsModel.value = normalizeInputTerms(terms, resolvedFields.value)
    setTailMode()
  },
  setFilter: (filter) => {
    termsModel.value = normalizeInputTerms(filter?.terms || [], resolvedFields.value)
    setTailMode()
  },
  setWhere: (where = '') => {
    termsModel.value = parseWhereExpression(where, resolvedFields.value)
    setTailMode()
  },
  clear: onClear,
}

const getFocusableElements = () => {
  return Array.from(
    rootRef.value?.querySelectorAll<HTMLElement>('[data-condition-focusable="true"]') || [],
  ).filter(item => !item.hasAttribute('disabled'))
}

const resetFieldPanelActiveIndex = () => {
  fieldPanelActiveIndex.value = fieldOptions.value.length ? 0 : -1
}

const moveFieldPanelActiveIndex = (offset: number) => {
  if (!fieldOptions.value.length) {
    fieldPanelActiveIndex.value = -1
    return
  }

  const currentIndex = fieldPanelActiveIndex.value < 0 ? 0 : fieldPanelActiveIndex.value
  fieldPanelActiveIndex.value = Math.min(
    fieldOptions.value.length - 1,
    Math.max(0, currentIndex + offset),
  )
}

const selectActiveFieldOption = () => {
  const option = activeFieldOption.value || fieldOptions.value[0]

  if (option) {
    onSelectField(option.dataIndex)
  }
}

const onFieldOptionHover = (columnKey: string) => {
  const index = fieldOptions.value.findIndex(item => item.dataIndex === columnKey)

  if (index >= 0) {
    fieldPanelActiveIndex.value = index
  }
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
      activatePopupValueTerm(termKey)
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
  resetFieldPanelActiveIndex()
  fieldPanelOpen.value = nextTailFocusOpenState.value ?? true
  nextTailFocusOpenState.value = undefined
}

const onTailActivate = () => {
  if (props.disabled) {
    return
  }

  resetFieldPanelActiveIndex()
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
  resetFieldPanelActiveIndex()
  fieldPanelOpen.value = true
}

const onTailKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!fieldOptions.value.length) {
      return
    }

    event.preventDefault()
    fieldPanelOpen.value = true
    if (!fieldPanelVisible.value || fieldPanelActiveIndex.value < 0) {
      resetFieldPanelActiveIndex()
      return
    }

    moveFieldPanelActiveIndex(event.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()

    selectActiveFieldOption()
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
  resetFieldPanelActiveIndex()
  fieldPanelOpen.value = true
}

const onFieldBlur = () => {
  fieldBlurLock.value = true
  fieldPanelOpen.value = false
  releaseFieldBlurLock()
}

const onFieldKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!fieldOptions.value.length) {
      return
    }

    event.preventDefault()
    fieldPanelOpen.value = true
    if (!fieldPanelVisible.value || fieldPanelActiveIndex.value < 0) {
      resetFieldPanelActiveIndex()
      return
    }

    moveFieldPanelActiveIndex(event.key === 'ArrowDown' ? 1 : -1)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()

    selectActiveFieldOption()
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

const onOperatorChipMouseDown = () => {
  if (editorMode.value === 'value') {
    keepEmptyValueOnBlur = true
  }
}

const shouldKeepEmptyTermOnValueBlur = (nextTarget: HTMLElement | null) => {
  if (!nextTarget) {
    return false
  }

  return !!nextTarget.closest?.(
    '.condition-filter__chip--operator, .condition-filter__chip--field, .condition-filter__chip--logic',
  )
}

const onValueBlur = (event: FocusEvent) => {
  if (editorMode.value !== 'value') {
    keepEmptyValueOnBlur = false
    return
  }

  const nextTarget = event.relatedTarget as HTMLElement | null
  const allowEmpty = keepEmptyValueOnBlur || shouldKeepEmptyTermOnValueBlur(nextTarget)
  keepEmptyValueOnBlur = false

  commitTextValue({ allowEmpty })
}

const onValueKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Tab' && !event.shiftKey) {
    event.preventDefault()
    commitTextValue({ focusNext: true })
    return
  }

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
  if (visible && valuePanelTermKey.value) {
    fieldPanelOpen.value = false
    return
  }

  if (!visible && (fieldBlurLock.value || isInlineEditorFocused())) {
    return
  }

  fieldPanelOpen.value = visible

  if (visible) {
    resetFieldPanelActiveIndex()
    operatorPanelTermKey.value = undefined
  }

  if (!visible && editorMode.value === 'field') {
    setTailMode()
  }
}

const onOperatorPanelOpenChange = (termKey: string, visible: boolean) => {
  if (visible) {
    operatorPanelTermKey.value = termKey
    fieldPanelOpen.value = false
    valuePanelTermKey.value = undefined
    editorMode.value = 'tail'
    editingTermKey.value = undefined
    return
  }

  if (operatorPanelTermKey.value === termKey) {
    operatorPanelTermKey.value = undefined
  }
}

const onValuePanelOpenChange = (termKey: string, visible: boolean) => {
  if (visible) {
    valuePanelOpenVersion.value += 1
    activatePopupValueTerm(termKey)
    return
  }

  const draft = valueDraftMap[termKey]

  if (draft && !isNullaryTermType(draft.termType) && !hasTermValue(draft)) {
    onApplyPanelValue(termKey, draft, { close: true, allowEmpty: true })
    return
  }

  if (valuePanelTermKey.value === termKey) {
    valuePanelTermKey.value = undefined
  }

  delete valueDraftMap[termKey]
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
          :data-term-key="getTermKey(term)"
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
            <template v-if="isConditionGroup(term)">
              <button
                class="condition-filter__chip condition-filter__chip--group"
                type="button"
                :disabled="disabled"
                data-condition-focusable="true"
                @click.stop
                @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'value')"
              >
                <span class="condition-filter__chip-text">{{ getGroupLabel(term) }}</span>
                <span
                  class="condition-filter__chip-close"
                  @click.stop="onClearTermValue(getTermKey(term))"
                >
                  <AIcon type="CloseOutlined" />
                </span>
              </button>
            </template>

            <template v-else>
            <a-dropdown
              v-if="editorMode === 'field' && editingTermKey === getTermKey(term)"
              :open="fieldPanelVisible"
              trigger="click"
              placement="bottomLeft"
              @openChange="onFieldPanelOpenChange"
            >
              <div class="condition-filter__editor condition-filter__editor--field" @click.stop>
                <input
                  class="condition-filter__text-input"
                  :value="fieldKeyword"
                  :placeholder="getFieldLabel(term.column) || resolvedPlaceholder"
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
                  :fields="fieldOptions"
                  :active-key="activeFieldOption?.dataIndex"
                  :keyword="fieldKeyword"
                  :showSearch="false"
                  @hover="onFieldOptionHover"
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
              data-token-kind="field"
              @click.stop="startFieldEdit(getTermKey(term))"
              @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'field')"
            >
              <span class="condition-filter__chip-text">{{ getFieldLabel(term.column) }}</span>
            </button>

            <a-dropdown
              :open="operatorPanelTermKey === getTermKey(term)"
              trigger="click"
              placement="bottomLeft"
              @openChange="(visible) => onOperatorPanelOpenChange(getTermKey(term), visible)"
            >
              <a-tooltip :title="getTermTypeTooltip(term.termType, getTermColumn(term)) || undefined">
                <button
                  class="condition-filter__chip condition-filter__chip--operator"
                  type="button"
                  :disabled="disabled"
                  data-condition-focusable="true"
                  @mousedown="onOperatorChipMouseDown"
                  @click.stop
                  @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'operator')"
                >
                  <span class="condition-filter__chip-text">{{ getTermTypeReadableText(term.termType, getTermColumn(term)) }}</span>
                  <span
                    v-if="isNullaryTermType(term.termType)"
                    class="condition-filter__chip-close"
                    @click.stop="onClearTermValue(getTermKey(term))"
                  >
                    <AIcon type="CloseOutlined" />
                  </span>
                </button>
              </a-tooltip>
              <template #overlay>
                <div class="condition-filter__dropdown-panel" @mousedown.prevent>
                  <a-tooltip
                    v-for="option in getTermTypeOptions(getTermColumn(term))"
                    :key="option.value"
                    :title="getTermTypeTooltip(option.value, getTermColumn(term)) || undefined"
                    placement="right"
                  >
                    <button
                      class="condition-filter__dropdown-option condition-filter__chip condition-filter__chip--operator"
                      :class="{ 'condition-filter__dropdown-option--active': isTermTypeSelected(term, option.value) }"
                      type="button"
                      @click.stop="onTermTypeChange(getTermKey(term), option.value)"
                    >
                      <span class="condition-filter__dropdown-option-content">
                        <span class="condition-filter__dropdown-option-title">
                          {{ getTermTypeReadableText(option.value, getTermColumn(term)) }}
                        </span>
                        <span v-if="getTermTypeShortText(option.value, getTermColumn(term))" class="condition-filter__dropdown-option-desc">
                          {{ getTermTypeShortText(option.value, getTermColumn(term)) }}
                        </span>
                      </span>
                    </button>
                  </a-tooltip>
                </div>
              </template>
            </a-dropdown>

            <template v-if="!isNullaryTermType(term.termType)">
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
                <a-tooltip :title="getValueTooltip(term) || undefined">
                  <button
                    class="condition-filter__chip condition-filter__chip--value"
                    :class="{ 'condition-filter__chip--placeholder': !getDisplayValueLabel(term) }"
                    type="button"
                    :disabled="disabled"
                    data-condition-focusable="true"
                    @click.stop="valuePanelTermKey = getTermKey(term)"
                    @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'value')"
                  >
                    <span class="condition-filter__chip-text">
                      {{ getDisplayValueLabel(term) || getValuePlaceholder(term) }}
                    </span>
                    <span
                      v-if="hasDisplayTermValue(term)"
                      class="condition-filter__chip-close"
                      @click.stop="onClearTermValue(getTermKey(term))"
                    >
                      <AIcon type="CloseOutlined" />
                    </span>
                  </button>
                </a-tooltip>
                <template #overlay>
                  <ConditionEditorPanel
                    :key="`${getTermKey(term)}:${valuePanelOpenVersion}`"
                    :column="term.column"
                    :term="term"
                    @draft-change="(value) => setValueDraft(getTermKey(term), value)"
                    @apply="(value, options) => onApplyPanelValue(getTermKey(term), value, options)"
                  >
                    <template v-if="slots['value-editor']" #value="slotProps">
                      <slot name="value-editor" v-bind="slotProps" />
                    </template>
                  </ConditionEditorPanel>
                </template>
              </a-dropdown>

              <a-tooltip v-else :title="getValueTooltip(term) || undefined">
                <button
                  class="condition-filter__chip condition-filter__chip--value"
                  :class="{ 'condition-filter__chip--placeholder': !getDisplayValueLabel(term) }"
                  type="button"
                  :disabled="disabled"
                  data-condition-focusable="true"
                  @click.stop="startValueEdit(getTermKey(term))"
                  @keydown="(event) => onTokenKeydown(event, getTermKey(term), 'value')"
                >
                  <span class="condition-filter__chip-text">
                    {{ getDisplayValueLabel(term) || getValuePlaceholder(term) }}
                  </span>
                  <span
                    v-if="hasDisplayTermValue(term)"
                    class="condition-filter__chip-close"
                    @click.stop="onClearTermValue(getTermKey(term))"
                  >
                    <AIcon type="CloseOutlined" />
                  </span>
                </button>
              </a-tooltip>
            </template>
            </template>
          </div>
        </div>

        <a-dropdown
          v-if="!disabled && editorMode === 'tail'"
          :open="fieldPanelVisible"
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
              :placeholder="resolvedPlaceholder"
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
              :fields="fieldOptions"
              :active-key="activeFieldOption?.dataIndex"
              :keyword="fieldKeyword"
              :showSearch="false"
              @hover="onFieldOptionHover"
              @select="onSelectField"
            />
          </template>
        </a-dropdown>

        <span
          v-else-if="disabled && !termsModel.length"
          class="condition-filter__placeholder"
        >
          {{ resolvedPlaceholder }}
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
        <span class="condition-filter__action-divider" aria-hidden="true" />
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

  &__chip--group {
    color: #6941c6;
    background: #f4f3ff;
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
    gap: 6px;
    align-self: stretch;
    margin-left: 8px;
    padding-left: 2px;
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

  &__action-divider {
    width: 1px;
    height: 16px;
    background: #e4e7ec;
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
    align-items: flex-start;
    height: auto;
    padding-top: 6px;
    padding-bottom: 6px;
  }

  &__dropdown-option-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    gap: 2px;
  }

  &__dropdown-option-title {
    color: #344054;
    font-size: 12px;
    line-height: 18px;
  }

  &__dropdown-option-desc {
    max-width: 220px;
    color: #98a2b3;
    font-size: 11px;
    line-height: 16px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

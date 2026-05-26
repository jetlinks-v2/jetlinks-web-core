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
  ConditionFieldQuickSuggestion,
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
type FieldQuickSuggestion = ConditionFieldQuickSuggestion

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
const valuePanelKeywordMap = reactive<Record<string, string | undefined>>({})
const watchDisposers = new Map<string, () => void>()
const pendingEmptyRemovalKeys = new Set<string>()
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

const normalizeQuickKeyword = (value?: string) => String(value || '').trim()
const previewQuickKeyword = (value?: string, maxLength = 20) => {
  const text = normalizeQuickKeyword(value)

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength)}…`
}

const getNormalizedFieldTokens = (column: ConditionFilterField) => {
  const matchTokens = Array.isArray(column.search?.matchTokens)
    ? column.search?.matchTokens || []
    : []

  return [
    String(column.title || '').trim().toLowerCase(),
    String(column.dataIndex || '').trim().toLowerCase(),
    ...matchTokens.map(item => String(item || '').trim().toLowerCase()),
  ].filter(Boolean)
}

const getFieldSearchText = (column: ConditionFilterField) => {
  return getNormalizedFieldTokens(column).join(' ')
}

const isExactFieldMatch = (column: ConditionFilterField, rawKeyword: string) => {
  const keyword = normalizeQuickKeyword(rawKeyword).toLowerCase()

  if (!keyword) {
    return false
  }

  return getNormalizedFieldTokens(column).some(item => item === keyword)
}

const identifierFieldPattern = /(^|[\s_-])(id|sn|no|code|key|deviceid|serialnumber)([\s_-]|$)/
const textFieldPattern = /(name|title|desc|remark|content|detail|model|category|location|assignee|creator|project)/

const resolveQuickDateRangeValue = (rawKeyword: string) => {
  const keyword = normalizeQuickKeyword(rawKeyword)

  if (!keyword) {
    return undefined
  }

  const lowerKeyword = keyword.toLowerCase()
  const now = dayjs()
  const shortcutRanges: Record<string, [number, number]> = {
    today: [now.startOf('day').valueOf(), now.endOf('day').valueOf()],
    [$t('components.ConditionFilter.date.today').toLowerCase()]: [now.startOf('day').valueOf(), now.endOf('day').valueOf()],
    yesterday: [now.subtract(1, 'day').startOf('day').valueOf(), now.subtract(1, 'day').endOf('day').valueOf()],
    [$t('components.ConditionFilter.date.yesterday').toLowerCase()]: [now.subtract(1, 'day').startOf('day').valueOf(), now.subtract(1, 'day').endOf('day').valueOf()],
    thisweek: [now.startOf('week').valueOf(), now.endOf('week').valueOf()],
    [$t('components.ConditionFilter.date.thisWeek').toLowerCase()]: [now.startOf('week').valueOf(), now.endOf('week').valueOf()],
    last7days: [now.subtract(6, 'day').startOf('day').valueOf(), now.endOf('day').valueOf()],
    [$t('components.ConditionFilter.date.last7Days').toLowerCase()]: [now.subtract(6, 'day').startOf('day').valueOf(), now.endOf('day').valueOf()],
    thismonth: [now.startOf('month').valueOf(), now.endOf('month').valueOf()],
    [$t('components.ConditionFilter.date.thisMonth').toLowerCase()]: [now.startOf('month').valueOf(), now.endOf('month').valueOf()],
  }

  if (shortcutRanges[lowerKeyword]) {
    return shortcutRanges[lowerKeyword]
  }

  const rangeParts = keyword
    .split(/\s*(?:~|～|至|—|–|,|，)\s*/)
    .map(item => item.trim())
    .filter(Boolean)

  if (rangeParts.length === 2) {
    const startDate = dayjs(rangeParts[0])
    const endDate = dayjs(rangeParts[1])

    if (startDate.isValid() && endDate.isValid()) {
      return [startDate.startOf('day').valueOf(), endDate.endOf('day').valueOf()]
    }
  }

  const isTimestampKeyword = /^\d{13}$/.test(keyword)
  const isDateLikeKeyword = /^\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?$/.test(keyword)

  if (!isTimestampKeyword && !isDateLikeKeyword) {
    return undefined
  }

  const singleDate = isTimestampKeyword ? dayjs(Number(keyword)) : dayjs(keyword)

  if (singleDate.isValid()) {
    return [singleDate.startOf('day').valueOf(), singleDate.endOf('day').valueOf()]
  }

  return undefined
}

const resolveQuickSelectValue = (
  column: ConditionFilterField | undefined,
  rawKeyword: string,
  termType?: string,
) => {
  const keyword = normalizeQuickKeyword(rawKeyword).toLowerCase()

  if (!column || !keyword) {
    return undefined
  }

  const matched = getOptionList(column).filter((item: Record<string, any>) => {
    const label = String(item?.label ?? item?.name ?? item?.title ?? item?.value ?? item?.id ?? '').toLowerCase()
    const value = String(item?.value ?? item?.id ?? '').toLowerCase()
    return label.includes(keyword) || value.includes(keyword)
  })

  if (!matched.length) {
    return undefined
  }

  const exactMatched = matched.filter((item: Record<string, any>) => {
    const label = String(item?.label ?? item?.name ?? item?.title ?? item?.value ?? item?.id ?? '').toLowerCase()
    const value = String(item?.value ?? item?.id ?? '').toLowerCase()
    return label === keyword || value === keyword
  })

  const target = exactMatched.length === 1
    ? exactMatched[0]
    : matched.length === 1
      ? matched[0]
      : undefined

  if (!target) {
    return undefined
  }

  const targetValue = target.value ?? target.id

  return isArrayTermType(termType || '') ? [targetValue] : targetValue
}

const buildQuickSuggestionDescription = (
  column: ConditionFilterField,
  termType: string,
  rawKeyword: string,
) => {
  const readableLabel = getTermTypeReadableText(termType, column)
  const keywordPreview = previewQuickKeyword(rawKeyword)

  return keywordPreview ? `${readableLabel} ${keywordPreview}` : readableLabel
}

const getFieldQuickSuggestion = (
  column: ConditionFilterField,
  rawKeyword: string,
): FieldQuickSuggestion | undefined => {
  const search = column.search
  const keyword = normalizeQuickKeyword(rawKeyword)

  if (!search || !keyword) {
    return undefined
  }

  const optionValues = getTermTypeOptions(column).map(item => item.value)
  const customSuggestion = search.resolveQuickSuggestion?.(keyword, column, {
    options: getTermTypeOptions(column),
  })

  if (customSuggestion) {
    return customSuggestion
  }

  const fallbackTermType = search.defaultTermType || optionValues[0] || 'eq'
  const recommendedTermType = getRecommendedTermType(column) || fallbackTermType
  const fieldText = getFieldSearchText(column)
  const keywordLower = keyword.toLowerCase()
  const keywordMatchedByField = fieldText.includes(keywordLower)
  const keywordLooksNumeric = /^-?\d+(\.\d+)?$/.test(keyword)

  if (['select', 'treeSelect', 'tree'].includes(search.type)) {
    const matchedValue = resolveQuickSelectValue(column, keyword, recommendedTermType)

    if (matchedValue !== undefined) {
      return {
        score: 680,
        termType: recommendedTermType,
        value: matchedValue,
        description: buildQuickSuggestionDescription(column, recommendedTermType, keyword),
      }
    }

    if (keywordMatchedByField) {
      return {
        score: 120,
        termType: recommendedTermType,
      }
    }

    return undefined
  }

  if (['date', 'time', 'timeRange', 'rangePicker'].includes(search.type)) {
    const rangeValue = resolveQuickDateRangeValue(keyword)

    if (rangeValue) {
      const termType = optionValues.includes('btw') ? 'btw' : recommendedTermType

      return {
        score: 660,
        termType,
        value: rangeValue,
        description: buildQuickSuggestionDescription(column, termType, keyword),
      }
    }

    return keywordMatchedByField
      ? {
          score: 180,
          termType: recommendedTermType,
          description: buildQuickSuggestionDescription(column, recommendedTermType, keyword),
        }
      : undefined
  }

  if (search.type === 'number') {
    if (!keywordLooksNumeric) {
      return keywordMatchedByField
        ? {
            score: 180,
            termType: recommendedTermType,
            description: buildQuickSuggestionDescription(column, recommendedTermType, keyword),
          }
        : undefined
    }

    const termType = optionValues.includes('eq') ? 'eq' : recommendedTermType

    return {
      score: identifierFieldPattern.test(fieldText) ? 640 : 600,
      termType,
      value: Number(keyword),
      description: buildQuickSuggestionDescription(column, termType, keyword),
    }
  }

  if (search.type === 'string') {
    if (keywordMatchedByField) {
      return undefined
    }

    if (keyword.length < 2) {
      return undefined
    }

    const termType = identifierFieldPattern.test(fieldText) && optionValues.includes('eq')
      ? 'eq'
      : recommendedTermType

    return {
      score: identifierFieldPattern.test(fieldText)
        ? 560
        : textFieldPattern.test(fieldText)
          ? 520
          : 460,
      termType,
      value: keyword,
      description: buildQuickSuggestionDescription(column, termType, keyword),
    }
  }

  return keywordMatchedByField
    ? {
        score: 150,
        termType: recommendedTermType,
        description: buildQuickSuggestionDescription(column, recommendedTermType, keyword),
      }
    : undefined
}

const fieldOptions = computed(() => {
  const keyword = normalizeQuickKeyword(fieldKeyword.value)

  if (!keyword) {
    return orderedSearchColumns.value
  }

  const normalizedKeyword = keyword.toLowerCase()

  return orderedSearchColumns.value
    .map((item) => {
      const exactFieldMatched = isExactFieldMatch(item, keyword)
      const fieldMatched = getFieldSearchText(item).includes(normalizedKeyword)
      const rawQuickSuggestion = getFieldQuickSuggestion(item, keyword)
      const preferFieldOnly = fieldMatched
        && typeof rawQuickSuggestion?.value === 'string'
        && normalizeQuickKeyword(rawQuickSuggestion.value) === keyword
      const quickSuggestion = preferFieldOnly ? undefined : rawQuickSuggestion

      if (!fieldMatched && !quickSuggestion) {
        return undefined
      }

      return {
        ...item,
        description: quickSuggestion?.description || item.description,
        quickSuggestion,
        matchScore: (exactFieldMatched ? 3000 : fieldMatched ? 1000 : 0) + (quickSuggestion?.score || 0),
      }
    })
    .filter(Boolean)
    .sort((left: any, right: any) => {
      const scoreSort = Number(right?.matchScore || 0) - Number(left?.matchScore || 0)

      if (scoreSort !== 0) {
        return scoreSort
      }

      return Number(left?.sortIndex || 0) - Number(right?.sortIndex || 0)
    })
    .slice(0, 12) as ConditionFilterField[]
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

  if (column?.search?.formatValuePreview) {
    return column.search.formatValuePreview(term.value, term, column)
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

  if (column?.search?.formatValueTooltip) {
    return column.search.formatValueTooltip(displayTerm.value, displayTerm, column)
  }

  if (column?.search?.formatValuePreview) {
    return column.search.formatValuePreview(displayTerm.value, displayTerm, column)
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

const setValuePanelKeyword = (termKey: string, keyword?: string) => {
  if (!termKey) {
    return
  }

  const nextKeyword = normalizeQuickKeyword(keyword)

  if (!nextKeyword) {
    delete valuePanelKeywordMap[termKey]
    return
  }

  valuePanelKeywordMap[termKey] = nextKeyword
}

const getValuePanelKeyword = (termKey?: string) => {
  if (!termKey) {
    return ''
  }

  return valuePanelKeywordMap[termKey] || ''
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
  const selectedFieldOption = fieldOptions.value.find(item => item.dataIndex === columnKey) as
    | (ConditionFilterField & { quickSuggestion?: FieldQuickSuggestion })
    | undefined
  const quickSuggestion = selectedFieldOption?.quickSuggestion

  if (!term || !column?.search) {
    return
  }

  const termOptions = getTermTypeOptions(column)
  const nextTermType =
    (quickSuggestion?.termType && termOptions.some(item => item.value === quickSuggestion.termType) && quickSuggestion.termType) ||
    (shouldKeepTermTypeOnFieldSwitch(term, column) &&
      term.termType &&
      termOptions.some(item => item.value === term.termType) &&
      term.termType) ||
    getRecommendedTermType(column) ||
    'eq'

  const nextValue = quickSuggestion?.value !== undefined
    ? cloneValue(quickSuggestion.value)
    : canReuseFieldValueOnSwitch(term, column, nextTermType)
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
  setValuePanelKeyword(termKey, quickSuggestion?.panelKeyword)

  if (isNullaryTermType(nextTermType)) {
    setTailMode({ focus: true })
    return
  }

  if (hasTermValue(nextTerm)) {
    delete valuePanelKeywordMap[termKey]
    setTailMode({ focus: true })
    return
  }

  if (isDirectTextTerm(column, nextTermType)) {
    startValueEdit(termKey, quickSuggestion?.panelKeyword || (isNilValue(nextValue) ? '' : String(nextValue)))
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
  delete valuePanelKeywordMap[termKey]
  pendingEmptyRemovalKeys.delete(termKey)

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
  const currentTerm = getTerm(termKey)
  delete valueDraftMap[termKey]
  delete valuePanelKeywordMap[termKey]

  if (!isNullaryTermType(value.termType) && !hasTermValue(value)) {
    if (options?.allowEmpty) {
      if (options?.close === false && currentTerm && hasTermValue(currentTerm)) {
        pendingEmptyRemovalKeys.add(termKey)
      } else {
        pendingEmptyRemovalKeys.delete(termKey)
      }

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

  pendingEmptyRemovalKeys.delete(termKey)
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
  Object.keys(valuePanelKeywordMap).forEach((key) => {
    delete valuePanelKeywordMap[key]
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
  const currentTerm = getTerm(termKey)

  if (pendingEmptyRemovalKeys.has(termKey) && currentTerm && !hasTermValue(currentTerm)) {
    pendingEmptyRemovalKeys.delete(termKey)
    onRemoveTerm(termKey)
    return
  }

  if (draft && !isNullaryTermType(draft.termType) && !hasTermValue(draft)) {
    if (currentTerm && hasTermValue(currentTerm)) {
      onRemoveTerm(termKey)
      return
    }

    onApplyPanelValue(termKey, draft, { close: true, allowEmpty: true })
    return
  }

  if (valuePanelTermKey.value === termKey) {
    valuePanelTermKey.value = undefined
  }

  delete valueDraftMap[termKey]
  delete valuePanelKeywordMap[termKey]
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
                  :key="`field:${getTermKey(term)}`"
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
                  :key="`value:${getTermKey(term)}`"
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
                      v-if="!disabled"
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
                    :keyword="getValuePanelKeyword(getTermKey(term))"
                    @draft-change="(value) => setValueDraft(getTermKey(term), value)"
                    @apply="(value, options) => onApplyPanelValue(getTermKey(term), value, options)"
                  >
                    <template v-if="slots['value-editor']" #value="slotProps">
                      <slot
                        name="value-editor"
                        v-bind="{
                          ...slotProps,
                          panelKeyword: getValuePanelKeyword(getTermKey(term)),
                        }"
                      />
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
                    v-if="!disabled"
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
              key="tail"
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
    min-height: 2.1rem;
    padding: 0.175rem 0.625rem;
    background: var(--color-jet-bg-container);
    border: 1px solid var(--color-jet-border);
    border-radius: var(--jet-theme-button-r);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:hover {
      border-color: color-mix(in srgb, var(--color-jet-border) 60%, var(--color-jet-text-disabled));
    }

    &:focus-within {
      border-color: var(--jet-theme-primary-3);
      box-shadow: 0 0 0 0.125rem color-mix(in srgb, var(--color-jet-primary) 8%, transparent);
    }
  }

  &__content {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem 0.25rem;
    min-width: 0;
  }

  &__term {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
  }

  &__term-main {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    max-width: 100%;
  }

  &__chip,
  &__editor {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    max-width: min(100%, 16.25rem);
    height: 1.625rem;
    padding: 0 0.5rem;
    color: var(--color-jet-text);
    font-size: var(--fs-12);
    line-height: 1.5rem;
    border: 1px solid transparent;
    border-radius: var(--jet-theme-button-r);
    transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  }

  &__chip {
    cursor: pointer;
    background: var(--color-jet-bg-layout);

    &:disabled {
      cursor: not-allowed;
      opacity: 0.72;
    }

    &:focus-visible {
      border-color: var(--jet-theme-primary-3);
      outline: none;
      box-shadow: 0 0 0 0.125rem color-mix(in srgb, var(--color-jet-primary) 8%, transparent);
    }
  }

  &__chip--logic {
    height: 1.375rem;
    padding: 0 0.4375rem;
    color: var(--color-jet-text-secondary);
    font-size: var(--fs-12);
    line-height: 1.25rem;
    background: var(--color-jet-bg-container);
    border-color: var(--color-jet-border);
  }

  &__term--or &__chip--logic,
  &__chip--logic-or {
    color: color-mix(in srgb, var(--color-jet-warning) 70%, var(--color-jet-text));
    background: color-mix(in srgb, var(--color-jet-warning) 10%, var(--color-jet-bg-container));
    border-color: color-mix(in srgb, var(--color-jet-warning) 45%, var(--color-jet-bg-container));
  }

  &__chip--field,
  &__editor--field {
    color: var(--color-jet-primary);
    background: var(--color-jet-primary-soft);
  }

  &__chip--group {
    color: color-mix(in srgb, var(--color-jet-primary) 65%, var(--color-jet-error));
    background: color-mix(in srgb, var(--color-jet-primary) 8%, var(--color-jet-bg-container));
  }

  &__chip--operator {
    color: var(--color-jet-text-secondary);
    background: var(--color-jet-bg-layout);
  }

  &__chip--value,
  &__editor--value {
    color: var(--color-jet-text);
    background: color-mix(in srgb, var(--color-jet-border-secondary) 65%, var(--color-jet-bg-layout));
  }

  &__chip--value,
  &__editor--value,
  &__editor--field {
    flex: 0 1 auto;
  }

  &__chip--placeholder {
    color: var(--color-jet-text-disabled);
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
    width: 0.875rem;
    height: 0.875rem;
    color: var(--color-jet-text-disabled);
    border-radius: 50%;
    transition: background-color 0.15s ease, color 0.15s ease;

    &:hover {
      color: var(--color-jet-text-secondary);
      background: color-mix(in srgb, var(--color-jet-text-secondary) 8%, transparent);
    }
  }

  &__editor {
    padding-right: 0.375rem;

    &:focus-within {
      border-color: var(--jet-theme-primary-3);
      box-shadow: 0 0 0 0.125rem color-mix(in srgb, var(--color-jet-primary) 8%, transparent);
    }
  }

  &__tail {
    display: inline-flex;
    flex: 1 1 7.5rem;
    min-width: 7.5rem;
    align-items: center;
    min-height: 1.625rem;
    gap: 0.375rem;
  }

  &__tail-prefix {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.125rem;
    height: 1.125rem;
    color: var(--color-jet-text-disabled);
    font-size: var(--fs-12);
    flex: 0 0 auto;
  }

  &__text-input {
    width: 100%;
    min-width: 3.5rem;
    padding: 0;
    color: var(--color-jet-text);
    font-size: var(--fs-12);
    line-height: 1.5rem;
    background: transparent;
    border: 0;
    outline: none;

    &::placeholder {
      color: var(--color-jet-text-disabled);
    }
  }

  &__text-input--tail {
    min-width: 7.5rem;
  }

  &__placeholder {
    color: var(--color-jet-text-disabled);
    font-size: var(--fs-12);
    line-height: 1.5rem;
  }

  &__actions {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 0.375rem;
    align-self: stretch;
    margin-left: var(--space-2);
    padding-left: 0.125rem;
  }

  &__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    color: var(--color-jet-text-secondary);
    background: transparent;
    border: 0;
    border-radius: var(--radius-jet);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;

    &:hover:not(:disabled) {
      color: var(--color-jet-text-secondary);
      background: var(--color-jet-border-secondary);
    }

    &:disabled {
      color: var(--color-jet-text-disabled);
      cursor: not-allowed;
    }
  }

  &__action-divider {
    width: 0.0625rem;
    height: 1rem;
    background: var(--color-jet-border-secondary);
  }

  &__action--search {
    color: var(--color-jet-primary);
  }

  &__dropdown-panel {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 7.5rem;
    padding: var(--space-2);
    background: var(--color-jet-bg-elevated);
    border: 1px solid var(--color-jet-border-secondary);
    border-radius: var(--radius-jet-lg);
    box-shadow: var(--jet-theme-shadow);
  }

  &__dropdown-option {
    max-width: 100%;
    justify-content: flex-start;
    align-items: flex-start;
    height: auto;
    padding-top: 0.375rem;
    padding-bottom: 0.375rem;
  }

  &__dropdown-option-content {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    gap: 0.125rem;
  }

  &__dropdown-option-title {
    color: var(--color-jet-text-secondary);
    font-size: var(--fs-12);
    line-height: 1.125rem;
  }

  &__dropdown-option-desc {
    max-width: 13.75rem;
    color: var(--color-jet-text-disabled);
    font-size: var(--fs-12);
    line-height: 1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__dropdown-option--active {
    border-color: var(--jet-theme-primary-3);
    box-shadow: 0 0 0 0.125rem color-mix(in srgb, var(--color-jet-primary) 8%, transparent);
  }

  &--disabled {
    .condition-filter__shell {
      background: var(--color-jet-bg-layout);
      cursor: not-allowed;
    }
  }
}

@media (max-width: 48rem) {
  .condition-filter {
    &__shell {
      padding: 0.375rem 0.5rem;
    }

    &__chip,
    &__editor {
      max-width: 100%;
    }
  }
}</style>

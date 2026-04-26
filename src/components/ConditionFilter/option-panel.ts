import { ref, type Ref } from 'vue'
import { request } from '@jetlinks-web/core'
import type { ConditionOptionPanelLoadOptionsParams } from './types'

export interface ConditionFilterNoPagingOptionSourceConfig<T = any> {
  url: string
  pageSize?: number
  includes?: string[]
  sorts?: Array<Record<string, any>>
  valueColumn?: string
  queryMode?: 'no-paging' | 'paging'
  keywordColumns?: string[]
  fixedTerms?: Array<Record<string, any>>
  buildQuery?: (keyword?: string, params?: ConditionOptionPanelLoadOptionsParams) => Record<string, any>
  buildSelectedQuery?: (values?: any[]) => Record<string, any>
  mapOption?: (item: any) => T
}

export interface ConditionFilterDictionaryOptionSourceConfig<T = any> {
  dictId: string
  pageSize?: number
  mapOption?: (item: any) => T
}

export interface ConditionFilterNoPagingOptionSource<T = any> {
  options: Ref<T[]>
  loadOptions: (keyword?: string, params?: ConditionOptionPanelLoadOptionsParams) => Promise<T[]>
  loadSelectedOptions: (values?: any[]) => Promise<T[]>
}

const normalizeQueryUrl = (url: string, mode: 'no-paging' | 'paging') => {
  const normalized = url.replace(/\/+$/, '')

  if (normalized.endsWith('/_query') || normalized.endsWith('/_query/no-paging')) {
    return normalized
  }

  return `${normalized}/${mode === 'paging' ? '_query' : '_query/no-paging'}`
}

const resolveResultList = (response: any) => {
  if (Array.isArray(response?.result?.data)) {
    return response.result.data
  }

  if (Array.isArray(response?.result)) {
    return response.result
  }

  if (Array.isArray(response?.data)) {
    return response.data
  }

  if (Array.isArray(response)) {
    return response
  }

  return []
}

const buildKeywordTerms = (keyword = '', columns: string[] = []) => {
  const value = keyword.trim()

  if (!value || !columns.length) {
    return []
  }

  return columns.map((column, index) => ({
    column,
    termType: 'like',
    value: `%${value}%`,
    type: index ? 'or' : undefined,
  }))
}

export const createQueryNoPagingOptionSource = <T = any>(
  config: ConditionFilterNoPagingOptionSourceConfig<T>,
): ConditionFilterNoPagingOptionSource<T> => {
  const options = ref<T[]>([])
  const defaultOptions = ref<T[]>([])
  const queryMode = config.queryMode || 'no-paging'
  const requestUrl = normalizeQueryUrl(config.url, queryMode)
  const pageSize = config.pageSize ?? 12
  const valueColumn = config.valueColumn || 'id'
  const pendingKeywordRequests = new Map<string, Promise<T[]>>()
  const pendingSelectedRequests = new Map<string, Promise<T[]>>()
  const getOptionKey = (item: any) => String(item?.value ?? item?.id ?? item?.key ?? '')
  const dedupeOptions = (items: T[] = []) => {
    const seen = new Set<string>()
    return items.filter((item: any) => {
      const key = getOptionKey(item)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
  const mergeOptions = (...groups: T[][]) => dedupeOptions(groups.flat())
  const normalizeKeyword = (keyword = '') => keyword.trim()
  const buildSelectedRequestKey = (values: any[] = []) =>
    values.map(value => String(value)).sort().join('|')
  const sortOptionsByValues = (items: T[] = [], values: any[] = []) => {
    const orderMap = values.reduce((map, value, index) => {
      map.set(String(value), index)
      return map
    }, new Map<string, number>())

    return [...dedupeOptions(items)].sort((left: any, right: any) => {
      const leftIndex = orderMap.get(getOptionKey(left))
      const rightIndex = orderMap.get(getOptionKey(right))

      if (leftIndex === undefined && rightIndex === undefined) {
        return 0
      }

      if (leftIndex === undefined) {
        return 1
      }

      if (rightIndex === undefined) {
        return -1
      }

      return leftIndex - rightIndex
    })
  }

  const loadOptions = async (keyword = '', params: ConditionOptionPanelLoadOptionsParams = {}) => {
    const normalizedKeyword = normalizeKeyword(keyword)
    const currentPageIndex = Math.max(Number(params.pageIndex ?? 0), 0)
    const currentPageSize = Math.max(Number(params.pageSize ?? pageSize), 1)

    if (!normalizedKeyword && currentPageIndex === 0 && defaultOptions.value.length) {
      return defaultOptions.value
    }

    const requestKey = `${normalizedKeyword}:${currentPageIndex}:${currentPageSize}`
    const pendingRequest = pendingKeywordRequests.get(requestKey)

    if (pendingRequest) {
      return pendingRequest
    }

    const task = (async () => {
      const query = config.buildQuery
        ? config.buildQuery(normalizedKeyword, {
            pageIndex: currentPageIndex,
            pageSize: currentPageSize,
          })
        : {
            paging: queryMode !== 'no-paging',
            pageIndex: currentPageIndex,
            pageSize: currentPageSize,
            includes: config.includes,
            sorts: config.sorts,
            terms: [
              ...(config.fixedTerms || []),
              ...buildKeywordTerms(normalizedKeyword, config.keywordColumns || ['name']),
            ],
          }

      const response = await request.post(requestUrl, query)
      const list = resolveResultList(response)
      const mapped = (config.mapOption ? list.map(config.mapOption) : list).slice(0, currentPageSize)
      options.value = currentPageIndex === 0
        ? mergeOptions(mapped, options.value || [])
        : mergeOptions(options.value || [], mapped)

      if (!normalizedKeyword && currentPageIndex === 0) {
        defaultOptions.value = mapped
      }

      return mapped
    })()

    pendingKeywordRequests.set(requestKey, task)

    try {
      return await task
    } finally {
      if (pendingKeywordRequests.get(requestKey) === task) {
        pendingKeywordRequests.delete(requestKey)
      }
    }
  }

  const loadSelectedOptions = async (values: any[] = []) => {
    const normalizedValues = Array.from(
      new Set(
        (Array.isArray(values) ? values : [values]).filter(
          value => value !== undefined && value !== null && value !== '',
        ),
      ),
    )

    if (!normalizedValues.length) {
      return []
    }

    const selectedValueSet = new Set(normalizedValues.map(value => String(value)))
    const cachedItems = sortOptionsByValues(
      (options.value || []).filter((item: any) => selectedValueSet.has(getOptionKey(item))),
      normalizedValues,
    )

    if (cachedItems.length === normalizedValues.length) {
      return cachedItems
    }

    const requestKey = buildSelectedRequestKey(normalizedValues)
    const pendingRequest = pendingSelectedRequests.get(requestKey)

    if (pendingRequest) {
      return pendingRequest
    }

    const task = (async () => {
      const query = config.buildSelectedQuery
        ? config.buildSelectedQuery(normalizedValues)
        : {
            paging: queryMode !== 'no-paging',
            pageSize: Math.max(pageSize, normalizedValues.length),
            includes: config.includes,
            sorts: config.sorts,
            terms: [
              ...(config.fixedTerms || []),
              {
                column: valueColumn,
                termType: normalizedValues.length > 1 ? 'in' : 'eq',
                value: normalizedValues.length > 1 ? normalizedValues : normalizedValues[0],
              },
            ],
          }

      const response = await request.post(requestUrl, query)
      const list = resolveResultList(response)
      const mapped = sortOptionsByValues(config.mapOption ? list.map(config.mapOption) : list, normalizedValues)
      options.value = mergeOptions(options.value || [], mapped)
      return mapped
    })()

    pendingSelectedRequests.set(requestKey, task)

    try {
      return await task
    } finally {
      if (pendingSelectedRequests.get(requestKey) === task) {
        pendingSelectedRequests.delete(requestKey)
      }
    }
  }

  return {
    options,
    loadOptions,
    loadSelectedOptions,
  }
}

export const createDictionaryOptionSource = <T = any>(
  config: ConditionFilterDictionaryOptionSourceConfig<T>,
): ConditionFilterNoPagingOptionSource<T> => {
  const options = ref<T[]>([])
  const pageSize = config.pageSize ?? 12
  let sourceItems: any[] | undefined

  const mapOption =
    config.mapOption ||
    ((item: any) => ({
      label: item.text ?? item.name ?? item.label ?? item.value,
      value: item.value ?? item.id,
      raw: item,
    }) as T)

  const normalizeKeyword = (keyword = '') => keyword.trim().toLowerCase()
  const getOptionKey = (item: any) => String(item?.value ?? item?.id ?? item?.key ?? '')
  const dedupeOptions = (items: T[] = []) => {
    const seen = new Set<string>()
    return items.filter((item: any) => {
      const key = getOptionKey(item)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }
  const mergeOptions = (...groups: T[][]) => dedupeOptions(groups.flat())
  const sortOptionsByValues = (items: T[] = [], values: any[] = []) => {
    const orderMap = values.reduce((map, value, index) => {
      map.set(String(value), index)
      return map
    }, new Map<string, number>())

    return [...dedupeOptions(items)].sort((left: any, right: any) => {
      const leftIndex = orderMap.get(getOptionKey(left))
      const rightIndex = orderMap.get(getOptionKey(right))

      if (leftIndex === undefined && rightIndex === undefined) {
        return 0
      }

      if (leftIndex === undefined) {
        return 1
      }

      if (rightIndex === undefined) {
        return -1
      }

      return leftIndex - rightIndex
    })
  }

  const loadDictionaryItems = async () => {
    if (sourceItems) {
      return sourceItems
    }

    const response = await request.get(`/dictionary/${config.dictId}/items`)
    const list = response?.result || response?.data || []
    sourceItems = Array.isArray(list) ? list : []
    return sourceItems
  }

  const loadOptions = async (keyword = '', params: ConditionOptionPanelLoadOptionsParams = {}) => {
    const list = await loadDictionaryItems()
    const searchText = normalizeKeyword(keyword)
    const currentPageIndex = Math.max(Number(params.pageIndex ?? 0), 0)
    const currentPageSize = Math.max(Number(params.pageSize ?? pageSize), 1)
    const filtered = !searchText
      ? list
      : list.filter((item: any) => {
          return `${item.text ?? ''}${item.name ?? ''}${item.label ?? ''}${item.value ?? ''}`
            .toLowerCase()
            .includes(searchText)
        })
    const startIndex = currentPageIndex * currentPageSize
    const mapped = filtered.slice(startIndex, startIndex + currentPageSize).map(mapOption)
    options.value = currentPageIndex === 0
      ? mergeOptions(mapped, options.value || [])
      : mergeOptions(options.value || [], mapped)
    return mapped
  }

  const loadSelectedOptions = async (values: any[] = []) => {
    const list = await loadDictionaryItems()
    const selectedValueSet = new Set(
      (Array.isArray(values) ? values : [values])
        .filter(value => value !== undefined && value !== null && value !== '')
        .map(value => String(value)),
    )

    if (!selectedValueSet.size) {
      return []
    }

    const mapped = sortOptionsByValues(list
      .filter((item: any) => selectedValueSet.has(String(item.value ?? item.id)))
      .map(mapOption), Array.from(selectedValueSet))
    options.value = mergeOptions(options.value || [], mapped)
    return mapped
  }

  return {
    options,
    loadOptions,
    loadSelectedOptions,
  }
}

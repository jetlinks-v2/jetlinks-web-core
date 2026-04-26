import { ref, type Ref } from 'vue'
import { request } from '@jetlinks-web/core'

export interface ConditionFilterNoPagingOptionSourceConfig<T = any> {
  url: string
  pageSize?: number
  includes?: string[]
  sorts?: Array<Record<string, any>>
  valueColumn?: string
  keywordColumns?: string[]
  fixedTerms?: Array<Record<string, any>>
  buildQuery?: (keyword?: string) => Record<string, any>
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
  loadOptions: (keyword?: string) => Promise<T[]>
  loadSelectedOptions: (values?: any[]) => Promise<T[]>
}

const normalizeNoPagingUrl = (url: string) => {
  const normalized = url.replace(/\/+$/, '')
  return normalized.endsWith('/_query/no-paging') ? normalized : `${normalized}/_query/no-paging`
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
  const requestUrl = normalizeNoPagingUrl(config.url)
  const pageSize = config.pageSize ?? 12
  const valueColumn = config.valueColumn || 'id'
  const dedupeOptions = (items: T[] = []) => {
    const seen = new Set<string>()
    return items.filter((item: any) => {
      const key = String(item?.value ?? item?.id ?? item?.key ?? '')
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  const loadOptions = async (keyword = '') => {
    const query = config.buildQuery
      ? config.buildQuery(keyword)
      : {
          paging: false,
          pageSize,
          includes: config.includes,
          sorts: config.sorts,
          terms: [
            ...(config.fixedTerms || []),
            ...buildKeywordTerms(keyword, config.keywordColumns || ['name']),
          ],
        }

    const response = await request.post(requestUrl, query)
    const list = resolveResultList(response)
    const mapped = (config.mapOption ? list.map(config.mapOption) : list).slice(0, pageSize)
    options.value = mapped
    return mapped
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

    const query = config.buildSelectedQuery
      ? config.buildSelectedQuery(normalizedValues)
      : {
          paging: false,
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
    const mapped = dedupeOptions(config.mapOption ? list.map(config.mapOption) : list)
    options.value = dedupeOptions([...(options.value || []), ...mapped])
    return mapped
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

  const loadDictionaryItems = async () => {
    if (sourceItems) {
      return sourceItems
    }

    const response = await request.get(`/dictionary/${config.dictId}/items`)
    const list = response?.result || response?.data || []
    sourceItems = Array.isArray(list) ? list : []
    return sourceItems
  }

  const loadOptions = async (keyword = '') => {
    const list = await loadDictionaryItems()
    const searchText = normalizeKeyword(keyword)
    const filtered = !searchText
      ? list
      : list.filter((item: any) => {
          return `${item.text ?? ''}${item.name ?? ''}${item.label ?? ''}${item.value ?? ''}`
            .toLowerCase()
            .includes(searchText)
        })
    const mapped = filtered.slice(0, pageSize).map(mapOption)
    options.value = mapped
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

    const mapped = list
      .filter((item: any) => selectedValueSet.has(String(item.value ?? item.id)))
      .map(mapOption)
    options.value = [...mapped]
    return mapped
  }

  return {
    options,
    loadOptions,
    loadSelectedOptions,
  }
}

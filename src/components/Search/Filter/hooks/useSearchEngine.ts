import { inject, provide, reactive,onUnmounted, nextTick, type Ref, type Reactive } from 'vue'
import { SearchItem, TermsItem } from '../typing'
import { randomString } from '@jetlinks-web/utils'
import { getDefaultTermType, isArrayTermType } from '../setting'

const columnsKey = 'columnsKey';
const loadingKey = 'loadingKey';
const columnsMapKey = 'columnsMapKey';
const useColumnItemOptionsKey = 'useColumnItemOptionsKey';
const enginesKey = 'enginesKey';

export const useColumnsContext = (data: Ref<SearchItem[]>) => {
  provide(columnsKey, data)
}

export const useColumns = (): Ref<SearchItem[]> => {
  return inject(columnsKey, ref([]))
}

export const useLoadingContext = (data: Reactive<Record<string, boolean>>) => {
  provide(loadingKey, data)
}

export const useLoading = (): Reactive<Record<string, boolean>> => {
  return inject(loadingKey, reactive({}))
}

export const useColumnsMapContext = (data: Reactive<Record<string, any>>) => {
  provide(columnsMapKey, data)
}

export const useColumnsMap = (): Reactive<Record<string, any>> => {
  return inject(columnsMapKey, reactive({}))
}

export const useColumnItemOptionsContext = (data: Reactive<Record<string, any[]>>) => {
  provide(useColumnItemOptionsKey, data)
}

export const useColumnItemOptions = (): Reactive<Record<string,  any[]>> => {
  return inject(useColumnItemOptionsKey, reactive({}))
}

export const useEnginesContext = (data: Record<string, any>) => {
  provide(enginesKey, data)
}

export const useEngines = (): Record<string, any> => {
  return inject(enginesKey, {})
}

export const useSearchEngine = (props: any) => {
  const formModel = ref<TermsItem[]>([]) // 搜索表单数据模型
  const optionsMap = reactive<Record<string, any[]>>({}) // 缓存每一项的options，便于生成下拉选项
  const loadingMap = reactive<Record<string, boolean>>({}) // 缓存每一项的加载状态，便于生成加载中状态
  const columnsOptions = ref<SearchItem[]>([]) // 缓存columns，便于后续操作
  const columnsFieldNames = ref<Record<string, any>>({}) // 缓存columns字段，便于后续操作
  const columnsMap = reactive<Record<string, any>>({})

  const watchDisposers = new Map<string, () => void>()
  const lastParsedQuery = ref<string | undefined>(undefined)
  const router = useRouter()
  const route = useRoute()

  const createOptionsLoader = async (column: SearchItem) => {
    const key = column.dataIndex
    const search = column.search!
    const rawOptions = search.options

    if (Array.isArray(rawOptions)) {
      optionsMap[key] = rawOptions
    }

    if (isRef(rawOptions)) {
      const stop = watch(
        rawOptions,
        val => (optionsMap[key] = val || []),
        { immediate: true  }
      )
      watchDisposers.set(`${key}:ref`, stop)
    }

    // 函数（异步）
    if (typeof rawOptions === 'function' && !loadingMap[key]) {
      loadingMap[key] = true
      try {
        optionsMap[key] = await rawOptions()
      } finally {
        loadingMap[key] = false
      }
    }
  }

  const init = (columns: SearchItem[]) => {
    // 初始化逻辑
    const co: any[] = []
    columns.filter(column => column.search)
      .sort((a,b) => Number(a.search!.first ?? 0) - Number(b.search!.first ?? 0))
      .forEach(column => {
        co.push({
          label: column.title,
          value: column.dataIndex,
        })

        columnsMap[column.dataIndex] = column

        columnsFieldNames.value[column.dataIndex] = column.search!.rename || column.dataIndex

        if (column.search!.options) {
          createOptionsLoader(column)
        }
      })

    columnsOptions.value = co
  }

  /**
   * @return column:termType:value column:termType:value:type 格式化后的查询参数,用于url
   */
  const toFormatUrl = () => {
    return formModel.value.map((item) => {
      const value = Array.isArray(item.value) ? item.value.join('|') : (item.value ?? '')
      let str = `${item.column}:${item.termType}:${value}`
      if (item.type) {
        str += `:${item.type}`
      }
      return str
    }).join(' ')
  }

  /**
   * @return 将url中的查询参数格式化为表单模型
   */
  const normalizeSearchQuery = (value: unknown): string | undefined => {
    if (Array.isArray(value)) {
      return value.join(' ')
    }
    if (typeof value === 'string') {
      return value
    }
    return undefined
  }

  const urlToformMadel = (searchQuery?: string) => {
    const search = searchQuery ?? normalizeSearchQuery(route.query.q)
    const _params: TermsItem[] = []
    if (!search) {
      formModel.value = []
      return
    }

    const parseNumberValue = (column?: string, value?: string) => {
      if (value === undefined || value === '') return value
      const searchType = column ? columnsMap[column]?.search?.type : undefined
      const isNumberLikeValue = /^-?\d+(\.\d+)?$/.test(value)

      if (!isNumberLikeValue) {
        return value
      }

      if (['number', 'date', 'time', 'timeRange', 'rangePicker'].includes(searchType)) {
        return Number(value)
      }

      return value
    }

    const parseValue = (column?: string, termType?: string, rawValue?: string) => {
      if (!termType || !isArrayTermType(termType)) {
        return parseNumberValue(column, rawValue)
      }

      if (!rawValue) return []

      if (rawValue.includes('|')) {
        return rawValue.split('|').map(item => item === '' ? undefined : parseNumberValue(column, item))
      }

      if (rawValue.includes(',')) {
        return rawValue.split(',').map(item => item === '' ? undefined : parseNumberValue(column, item))
      }

      return [parseNumberValue(column, rawValue)]
    }

    decodeURI(search).split(" ").forEach((item: string) => {
      const parts = item.split(":")
      if (parts.length < 3) {
        return
      }

      const [column, termType, ...rest] = parts
      let type: string | undefined
      let valueParts = rest

      const maybeType = rest[rest.length - 1]
      if (maybeType && ['and', 'or'].includes(maybeType)) {
        type = maybeType
        valueParts = rest.slice(0, -1)
      }

      _params.push({
        column,
        termType,
        value: parseValue(column, termType, valueParts.join(':')),
        type,
        key: randomString(10)
      })
    })
    formModel.value = _params
  }

  const syncFormModelByRouteQuery = (searchQuery: unknown, force = false) => {
    const normalizedQuery = normalizeSearchQuery(searchQuery)
    if (!force && normalizedQuery === lastParsedQuery.value) {
      return
    }
    lastParsedQuery.value = normalizedQuery
    urlToformMadel(normalizedQuery)
  }

  const submit = () => {
    let isFiled = false // 验证状态
    const termsData = formModel.value.map((item) => {
      let newItem = { ...item }
      const column = columnsMap[item.column!]
      const search = column.search!

      if (search.rename) {
        newItem.column = search.rename
      }

      if (search.handleValue) {
        newItem.value = search.handleValue(item.value)
      } else if (search.handleParamsItem) {
        newItem = search.handleParamsItem(item, formModel.value)
      }

      if (newItem.value === undefined || newItem.value === null) {
        isFiled = true
      }

      return newItem
    })

    if (!isFiled) {
      const url = encodeURI(toFormatUrl()) // 修改页面url
      router.replace({
        query: {
          ...route.query,
          q: url || undefined
        }
      })
    }
    return termsData
  }

  const addValue = (columnKey: string) => {
    const column = columnsMap[columnKey]
    // 获取默认值和默认termType
    const value = column.search?.defaultValue
    const termType = column.search?.defaultTermType || getDefaultTermType(column.search.type)[0] || 'eq'
    const item: TermsItem = {
      column: columnKey,
      termType,
      value,
      key: randomString(10)
    }

    if (['select', 'tree'].includes(column.search.type)) {
      createOptionsLoader(column)
    }

    if (formModel.value.length > 0) {
      item.type = 'and'
    }
    formModel.value.push(item)
  }

  const removeItem = (index: number) => {
    formModel.value.splice(index, 1)
  }

  const updateTermItemValue = (key: string, value: any, index: number) => {
    const oldItem = formModel.value[index]

    return {
      ...oldItem,
      [key]: value
    }
  }

  const updateTermValue = (value: any, index?: number, key?: string) => {
    if (index !== undefined) {
      formModel.value.splice(index, 1, updateTermItemValue(key!, value, index))
    } else {
      const lastItem = formModel.value.pop()!
      lastItem.value = value
      formModel.value.push(lastItem)
    }
  }

  useColumnsContext(columnsOptions)
  useLoadingContext(loadingMap)
  useColumnsMapContext(columnsMap)
  useColumnItemOptionsContext(optionsMap)

  onMounted(() => {
    nextTick(() => {
      syncFormModelByRouteQuery(route.query.q, true)
    })
  })

  watch(() => route.query.q, (val) => {
    syncFormModelByRouteQuery(val)
  })

  onUnmounted(() => {
    watchDisposers.forEach((stop) => stop())
    watchDisposers.clear()
  })

  watch(() => props.columns, () => {
    if (!props.columns) return
    init(props.columns)
  }, { immediate: true })

  return {
    formModel,
    columnsOptions,
    submit,
    createOptionsLoader,
    addValue,
    updateTermValue,
    removeItem
  }
}

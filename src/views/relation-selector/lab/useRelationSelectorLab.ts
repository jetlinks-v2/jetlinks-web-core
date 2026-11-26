import { computed, onMounted, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'
import { relationApi } from '../../../api/relations'
import type { RelationObjectData, RelationObjectResult, RelationObjectType, VariableObjectSpec } from '../../../types/relation'
import type { RelationSelectorOptions } from '../../../components/RelationSelector/types'

/** 动态配置保持不变，仅在只读试查请求中用样例 ID 替换变量来源。 */
export function sampleSpec(value: VariableObjectSpec, sampleId: string) {
  const { objectSource: _source, ...spec } = value
  return { ...spec, objectId: sampleId }
}

/** 验证页只编排基础目录、样例搜索与只读试查，不接入业务模块或创建关系。 */
export function useRelationSelectorLab(language: Ref<string>, api = relationApi) {
  const types = shallowRef<RelationObjectType[]>([])
  const typeLoading = ref(false)
  const typeFailed = ref(false)
  const sourceType = ref('')
  const targetType = ref('')
  const value = ref<VariableObjectSpec>()
  const samples = shallowRef<RelationObjectData[]>([])
  const selectedSample = shallowRef<RelationObjectData>()
  const sampleId = ref<string>()
  const sampleLoading = ref(false)
  const sampleFailed = ref(false)
  const sampleMore = ref(false)
  const queryState = ref<'idle' | 'loading' | 'loaded' | 'error' | 'cancelled'>('idle')
  const queryError = ref('')
  const data = shallowRef<RelationObjectResult[]>([])
  const limited = ref(false)
  const resultKeyword = ref('')
  let keyword = ''
  let pageIndex = 0
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  let sampleVersion = 0
  let typesVersion = 0
  let queryVersion = 0
  let controller: AbortController | undefined

  const typeName = (id: string) => types.value.find(item => item.id === id)?.i18nName
    || types.value.find(item => item.id === id)?.name || id
  const typeOptions = computed(() => types.value.map(type => ({ value: type.id, label: type.i18nName || type.name })))
  const options = computed<RelationSelectorOptions>(() => ({
    origins: sourceType.value ? [{ key: 'input', label: typeName(sourceType.value), root: {
      objectType: sourceType.value, objectSource: { source: 'upper', upperKey: 'input.objectId' },
    } }] : [],
    ...(targetType.value ? { targetTypes: [targetType.value] } : {}),
  }))
  const sampleOptions = computed(() => {
    const items = selectedSample.value && !samples.value.some(item => item.id === selectedSample.value!.id)
      ? [selectedSample.value, ...samples.value] : samples.value
    return items.map(item => ({ value: item.id, label: item.name || item.id }))
  })
  const nameOf = (item: RelationObjectResult) => String(item.properties?.name || item.id)
  const results = computed(() => {
    const search = resultKeyword.value.trim().toLocaleLowerCase(language.value)
    return data.value.filter(item => `${nameOf(item)} ${item.id} ${typeName(item.type)}`.toLocaleLowerCase(language.value).includes(search))
  })
  const canQuery = computed(() => !!value.value && !!sampleId.value && queryState.value !== 'loading')

  /** 改变配置或样例会取消旧试查，避免把不同输入的结果混在一起。 */
  function resetQuery() {
    ++queryVersion
    controller?.abort()
    controller = undefined
    data.value = []
    limited.value = false
    resultKeyword.value = ''
    queryState.value = 'idle'
    queryError.value = ''
  }
  async function loadTypes() {
    const version = ++typesVersion
    typeLoading.value = true
    typeFailed.value = false
    try {
      const items = await api.types()
      if (version !== typesVersion) return
      types.value = items
      // 验证页初值对应本次设备找人员的示例；通用组件没有设备或人员分支。
      if (!sourceType.value) sourceType.value = items.find(item => item.id === 'device')?.id || items[0]?.id || ''
      if (!targetType.value) targetType.value = items.find(item => item.id === 'user')?.id || ''
    } catch {
      if (version === typesVersion) typeFailed.value = true
    } finally {
      if (version === typesVersion) typeLoading.value = false
    }
  }

  /** 分批读取样例，旧搜索在防抖期间也立即失效，不展示上一个关键字的晚到数据。 */
  async function loadSamples(append = false) {
    if (!sourceType.value || append && (sampleLoading.value || !sampleMore.value)) return
    const version = ++sampleVersion
    sampleLoading.value = true
    sampleFailed.value = false
    const page = append ? pageIndex + 1 : 0
    try {
      const items = await api.objects(sourceType.value, keyword, page)
      if (version !== sampleVersion) return
      samples.value = append ? [...new Map([...samples.value, ...items].map(item => [item.id, item])).values()] : items
      pageIndex = page
      sampleMore.value = items.length === 20
    } catch {
      if (version === sampleVersion) sampleFailed.value = true
    } finally {
      if (version === sampleVersion) sampleLoading.value = false
    }
  }
  function searchSamples(search: string) {
    keyword = search
    ++sampleVersion
    clearTimeout(searchTimer)
    samples.value = []
    sampleMore.value = false
    sampleLoading.value = true
    searchTimer = setTimeout(() => { void loadSamples() }, 250)
  }
  function moreSamples(event: Event) {
    const element = event.target as HTMLElement
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 24) void loadSamples(true)
  }
  function selectSample(id?: string) {
    sampleId.value = id
    selectedSample.value = samples.value.find(item => item.id === id)
  }
  async function query() {
    if (!value.value || !sampleId.value) return
    resetQuery()
    const version = queryVersion
    controller = new AbortController()
    const signal = controller.signal
    queryState.value = 'loading'
    try {
      const response = await api.preview(sampleSpec(value.value, sampleId.value), signal)
      if (version !== queryVersion) return
      data.value = response.data
      limited.value = response.limited
      queryState.value = 'loaded'
    } catch (error) {
      if (version !== queryVersion || signal.aborted) return
      queryState.value = 'error'
      queryError.value = error instanceof Error ? error.message : ''
    } finally {
      if (version === queryVersion) controller = undefined
    }
  }
  function cancel() { resetQuery(); queryState.value = 'cancelled' }

  watch(sourceType, () => {
    value.value = undefined
    selectSample(undefined)
    samples.value = []
    keyword = ''
    clearTimeout(searchTimer)
    ++sampleVersion
    void loadSamples()
  })
  watch(targetType, () => { value.value = undefined })
  watch([value, sampleId], resetQuery, { deep: true })
  watch(language, () => { resetQuery(); void loadTypes(); void loadSamples() })
  onMounted(loadTypes)
  onScopeDispose(() => { ++typesVersion; ++sampleVersion; clearTimeout(searchTimer); resetQuery() })
  return { types, typeOptions, typeLoading, typeFailed, sourceType, targetType, value, options, sampleId, sampleOptions,
    sampleLoading, sampleFailed, queryState, queryError, data, results, limited, resultKeyword, canQuery, typeName, nameOf,
    loadTypes, loadSamples, searchSamples, moreSamples, selectSample, query, cancel }
}

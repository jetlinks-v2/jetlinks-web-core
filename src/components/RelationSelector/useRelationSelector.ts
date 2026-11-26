import { computed, onScopeDispose, ref, shallowReactive, shallowRef, watch, type Ref } from 'vue'
import { relationApi } from '../../api/relations'
import { acceptsRelationType, relationInfoStep, relationName, relationStepKey, relationSteps, relationValue, sameRelationOrigin } from './path'
import type { RelationInfo, RelationObjectType, RelationSelectorCatalog, RelationSelectorOptions, RelationStep, VariableObjectSpec } from './types'

interface SelectorProps {
  value?: VariableObjectSpec
  options: RelationSelectorOptions
  disabled?: boolean
  readonly?: boolean
}

/** 单实例持有目录缓存与草稿；关闭不提交，外部配置与语言变化会使旧请求失效。 */
export function useRelationSelector(
  props: SelectorProps,
  submit: (value?: VariableObjectSpec) => void,
  language: Ref<string>,
  api: RelationSelectorCatalog = relationApi,
) {
  const open = ref(false)
  const loading = ref(false)
  const failed = ref(false)
  const resolved = ref(false)
  const displayFailed = ref(false)
  const searchOpen = ref(false)
  const keyword = ref('')
  const originKey = ref('')
  const prefix = ref<RelationStep[]>([])
  const types = shallowRef<RelationObjectType[]>([])
  const catalog = shallowReactive(new Map<string, RelationInfo[]>())
  const requests = new Map<string, Promise<RelationInfo[]>>()
  const searches = new Map<number, string>()
  let typesRequest: Promise<RelationObjectType[]> | undefined
  let generation = 0
  let viewRequest = 0
  let hydration = 0

  const savedSteps = computed(() => relationSteps(props.value))
  const savedOrigin = computed(() => props.value && props.options.origins.find(item => sameRelationOrigin(props.value!, item)))
  const origin = computed(() => props.options.origins.find(item => item.key === originKey.value))
  const currentType = computed(() => prefix.value.at(-1)?.objectType || origin.value?.root.objectType)
  const typeName = (id: string) => {
    const type = types.value.find(item => item.id === id)
    return type?.i18nName || type?.name || id
  }
  const labelAt = (rootType: string, steps: RelationStep[], index: number) => {
    const source = index ? steps[index - 1].objectType : rootType
    const match = catalog.get(source)?.find(item => relationStepKey(relationInfoStep(item)) === relationStepKey(steps[index]))
    return match ? relationName(match) : steps[index].relation
  }
  const labels = computed(() => props.value ? [savedOrigin.value?.label || typeName(props.value.objectType),
    ...savedSteps.value.map((_step, index) => labelAt(props.value!.objectType, savedSteps.value, index))] : [])
  const breadcrumbs = computed(() => origin.value ? [origin.value.label,
    ...prefix.value.map((_step, index) => labelAt(origin.value!.root.objectType, prefix.value, index))] : [])
  const invalid = computed(() => !!props.value && resolved.value && (!savedOrigin.value
    || !acceptsRelationType(savedSteps.value.at(-1)?.objectType || props.value.objectType, props.options.targetTypes)
    || savedSteps.value.some((step, index) => !catalog.get(index ? savedSteps.value[index - 1].objectType : props.value!.objectType)
      ?.some(item => relationStepKey(relationInfoStep(item)) === relationStepKey(step)))))
  const matchesSavedPrefix = computed(() => savedOrigin.value?.key === originKey.value
    && prefix.value.every((step, index) => savedSteps.value[index] && relationStepKey(step) === relationStepKey(savedSteps.value[index])))
  const selectedKey = computed(() => matchesSavedPrefix.value && savedSteps.value.length === prefix.value.length + 1
    ? relationStepKey(savedSteps.value[prefix.value.length]) : undefined)
  const canContinue = computed(() => !!props.value && !invalid.value && (selectedKey.value !== undefined
    || matchesSavedPrefix.value && savedSteps.value.length === 0 && prefix.value.length === 0))
  const canUseSelf = computed(() => !!origin.value && !prefix.value.length
    && acceptsRelationType(origin.value.root.objectType, props.options.targetTypes))
  const selfSelected = computed(() => matchesSavedPrefix.value && savedSteps.value.length === 0)
  const rows = computed(() => {
    const search = keyword.value.trim().toLocaleLowerCase(language.value)
    return (catalog.get(currentType.value || '') || []).map(info => ({
      key: relationStepKey(relationInfoStep(info)), info, label: relationName(info), typeLabel: typeName(info.targetType),
      more: !acceptsRelationType(info.targetType, props.options.targetTypes),
    })).filter(row => !search || `${row.label} ${row.typeLabel}`.toLocaleLowerCase(language.value).includes(search))
      .sort((left, right) => Number(left.more) - Number(right.more) || left.label.localeCompare(right.label, language.value))
  })

  /** 相同类型并发读取共用一个请求，但不跨语言或组件实例缓存。 */
  function ensureRelations(type: string): Promise<RelationInfo[]> {
    if (catalog.has(type)) return Promise.resolve(catalog.get(type)!)
    if (requests.has(type)) return requests.get(type)!
    const version = generation
    const promise = api.relations(type).then(items => {
      if (version === generation) catalog.set(type, items)
      return items
    }).finally(() => { if (version === generation) requests.delete(type) })
    requests.set(type, promise)
    return promise
  }
  function ensureTypes() {
    if (!typesRequest) {
      const version = generation
      typesRequest = api.types().then(items => { if (version === generation) types.value = items; return items })
        .catch(error => { if (version === generation) typesRequest = undefined; throw error })
    }
    return typesRequest
  }

  /** 回显只读取已保存路径经过的类型，既不遍历全图也不查询实例。 */
  async function hydrate() {
    const version = ++hydration
    resolved.value = false
    displayFailed.value = false
    if (!props.value) return
    const sources = [props.value.objectType, ...savedSteps.value.slice(0, -1).map(step => step.objectType)]
    try {
      await Promise.all([ensureTypes(), ...[...new Set(sources)].map(ensureRelations)])
      if (version === hydration) resolved.value = true
    } catch {
      if (version === hydration) displayFailed.value = true
    }
  }

  /** 只让最后一次导航更新当前浮层；较慢的上一层响应可入缓存，不能覆盖新层。 */
  async function loadCurrent() {
    const type = currentType.value
    const version = ++viewRequest
    failed.value = false
    loading.value = true
    try {
      if (type) await Promise.all([ensureTypes(), ensureRelations(type)])
    } catch {
      if (version === viewRequest) failed.value = true
    } finally {
      if (version === viewRequest) loading.value = false
    }
  }
  function close() {
    open.value = false
    ++viewRequest
    loading.value = false
  }
  function setOpen(next: boolean) {
    if (!next) { close(); return }
    if (props.disabled || props.readonly || !props.options.origins.length) return
    originKey.value = savedOrigin.value?.key || props.options.origins[0].key
    prefix.value = savedOrigin.value ? savedSteps.value.slice(0, -1) : []
    searches.clear()
    keyword.value = ''
    searchOpen.value = false
    open.value = true
    void loadCurrent()
  }

  /** 返回仅改变浏览位置；新分支到达合法终点前，不改外部已保存值。 */
  function navigate(depth: number) {
    searches.set(prefix.value.length, keyword.value)
    prefix.value = prefix.value.slice(0, depth)
    keyword.value = searches.get(depth) || ''
    searchOpen.value = !!keyword.value
    void loadCurrent()
  }
  function changeOrigin(key: string) {
    const previousType = origin.value?.root.objectType
    originKey.value = key
    if (origin.value?.root.objectType !== previousType) prefix.value = []
    searches.clear()
    keyword.value = ''
    searchOpen.value = false
    void loadCurrent()
  }
  function commit(steps: RelationStep[]) {
    if (!origin.value || props.disabled || props.readonly) return
    submit(relationValue(origin.value, steps))
    close()
  }
  function select(key: string) {
    if (loading.value || failed.value || props.disabled || props.readonly) return
    const row = rows.value.find(item => item.key === key)
    if (!row) return
    // 重新选中原终点时保留调用方已有 options，而非仅重建 reverse。
    const original = matchesSavedPrefix.value ? savedSteps.value[prefix.value.length] : undefined
    const step = original && relationStepKey(original) === key ? original : relationInfoStep(row.info)
    const next = [...prefix.value, step]
    if (!row.more) { commit(next); return }
    searches.set(prefix.value.length, keyword.value)
    for (const depth of searches.keys()) if (depth > prefix.value.length) searches.delete(depth)
    prefix.value = next
    keyword.value = ''
    searchOpen.value = false
    void loadCurrent()
  }
  function continueFromSaved() {
    if (!canContinue.value) return
    prefix.value = [...savedSteps.value]
    keyword.value = ''
    searchOpen.value = false
    void loadCurrent()
  }
  function useSelf() { if (canUseSelf.value && !loading.value && !failed.value) commit([]) }
  function clear() { if (!props.disabled && !props.readonly) { submit(undefined); close() } }
  function retry() { void hydrate(); void loadCurrent() }

  watch(() => [props.value, props.options], () => { close(); void hydrate() }, { deep: true, immediate: true })
  watch(() => [props.disabled, props.readonly], () => { if (props.disabled || props.readonly) close() })
  watch(language, () => {
    ++generation
    types.value = []
    typesRequest = undefined
    catalog.clear()
    requests.clear()
    void hydrate()
    if (open.value) void loadCurrent()
  })
  onScopeDispose(() => { ++generation; ++viewRequest; ++hydration })
  return { open, loading, failed, displayFailed, invalid, searchOpen, keyword, originKey, origin, prefix, rows,
    labels, breadcrumbs, selectedKey, canContinue, canUseSelf, selfSelected, setOpen, navigate, changeOrigin, select,
    continueFromSaved, useSelf, clear, retry }
}

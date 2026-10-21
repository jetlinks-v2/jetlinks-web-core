import { computed, markRaw, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { getAssetAccessContext } from '../../api/asset-access'
import { buildAssetOwnershipTerm, formatAssetOwnershipTerm, parseAssetOwnershipTerm } from './condition'
import { onAssetDimensionFiltersChange, resolveAssetDimensionFilter } from './registry'
import type {
  AssetAccessContext, AssetDimensionFilter, AssetDimensionOperator, AssetDimensionOption, AssetDimensionSelector,
  AssetOwnershipOptions, AssetOwnershipSelection, AssetOwnershipTerm,
} from './types'

export interface AssetOwnershipDisplay {
  context?: AssetAccessContext
  labels: ReadonlyMap<string, AssetDimensionOption[]>
}

/** 网络仅由打开选择器的动作触发；失效或失败的请求不改写已提交条件。 */
export const useAssetOwnershipCondition = (
  props: { value?: AssetOwnershipTerm; options: AssetOwnershipOptions },
  update: (value?: AssetOwnershipTerm) => void,
  displayChanged: (display: AssetOwnershipDisplay) => void,
  translate: (key: string, values?: Record<string, string>) => string,
) => {
  const loadedContext = shallowRef<AssetAccessContext>()
  const loading = ref(false)
  const contextFailed = ref(false)
  const optionsFailed = ref(false)
  const targetOpen = ref(false)
  const selector = shallowRef<AssetDimensionSelector & { onOptionsChange: (items: AssetDimensionOption[]) => void }>()
  const labels = shallowRef(new Map<string, AssetDimensionOption[]>())
  const registryVersion = ref(0)
  const draft = ref<AssetOwnershipSelection>({ rangeId: 'all', operator: 'targets', ids: [] })
  const invalid = ref(false)
  let contextVersion = 0
  let selectorVersion = 0
  let pendingContext: Promise<void> | undefined

  const context = computed(() => props.options.context || loadedContext.value)
  const notifyDisplay = () => displayChanged({ context: context.value, labels: labels.value })
  const provider = computed(() => {
    void registryVersion.value
    return draft.value.rangeId.startsWith('dimension:')
      ? resolveAssetDimensionFilter(draft.value.rangeId.slice(10)) : undefined
  })
  const canSelectTargets = (rangeId: string) => context.value?.ranges
    .some(range => range.id === rangeId && range.canSelectTargets === true) === true
  const supportedOperators = (dimension?: AssetDimensionFilter, rangeId = draft.value.rangeId) => (dimension?.getOperators(props.options.assetType) || [])
    .filter(operator => !['targets', 'notTargets'].includes(operator) || !!dimension?.createSelector && canSelectTargets(rangeId))
  const operators = computed(() => supportedOperators(provider.value))
  const createSelector = computed(() => canSelectTargets(draft.value.rangeId)
    ? draft.value.rangeId === 'creator' ? props.options.createCreatorSelector : provider.value?.createSelector : undefined)
  const ranges = computed(() => {
    void registryVersion.value
    if (context.value?.assetType !== props.options.assetType) return []
    const key = 'components.AssetOwnershipCondition.'
    const builtIn = new Map([
      ['all', { icon: 'GlobalOutlined', description: translate(key + 'allDescription') }],
      ['creator', { icon: 'UserOutlined', description: translate(key + 'creatorDescription') }],
      ['unbound', { icon: 'DisconnectOutlined', description: translate(key + 'unboundDescription') }],
    ])
    // 仅固定通用选项的首尾位置；维度沿用 Context 的策略优先级，不在前端维护维度排序。
    const position = (id: string) => id === 'all' ? -1 : id === 'unbound' ? 1 : 0
    return context.value.ranges.filter(range => range.id !== 'all' || props.options.allowClear !== false)
      .map(range => {
        const dimension = range.dimensionType ? resolveAssetDimensionFilter(range.dimensionType) : undefined
        return {
          value: range.id, label: range.id === 'creator' ? translate(key + 'creator') : range.name,
          ...(builtIn.get(range.id) || {
            icon: dimension?.icon || 'PartitionOutlined',
            description: dimension?.getDescription?.(props.options.assetType)
              || translate(key + 'dimensionDescription', { dimension: range.name }),
          }),
          disabled: range.id === 'creator' ? !props.options.userId && !(canSelectTargets(range.id) && props.options.createCreatorSelector)
            : range.id === 'all' || range.id === 'unbound' ? false : !supportedOperators(dimension, range.id).length,
        }
      })
      .sort((left, right) => position(left.value) - position(right.value))
  })
  const preview = computed(() => formatAssetOwnershipTerm(props.value, props.options, context.value, labels.value, translate))
  const failure = computed(() => contextFailed.value ? 'contextFailed'
    : optionsFailed.value ? 'optionsFailed' : invalid.value ? 'invalid'
      : context.value && draft.value.rangeId !== 'all'
        && (!ranges.value.some(range => range.value === draft.value.rangeId && !range.disabled)
          || draft.value.rangeId.startsWith('dimension:') && !operators.value.includes(draft.value.operator))
        ? 'unavailable' : undefined)

  const syncValue = () => {
    selectorVersion++
    optionsFailed.value = false
    const parsed = parseAssetOwnershipTerm(props.value, props.options)
    invalid.value = !parsed
    if (parsed) draft.value = parsed
    targetOpen.value = false
    selector.value = undefined
  }
  const reset = () => {
    contextVersion++
    pendingContext = undefined
    loadedContext.value = undefined
    loading.value = contextFailed.value = optionsFailed.value = false
    labels.value = new Map()
    syncValue()
    notifyDisplay()
  }
  watch(() => [props.options.assetType, props.options.column, props.options.userId,
    props.options.context, props.options.loadContext, props.options.createCreatorSelector], reset, { flush: 'sync' })
  watch(() => props.value, syncValue, { immediate: true, deep: true })
  // 能力撤回只关闭目录，保留已提交条件并拒绝旧目录响应回填名称。
  watch(() => canSelectTargets(draft.value.rangeId), allowed => {
    if (!allowed) { selectorVersion++; targetOpen.value = false; selector.value = undefined }
  }, { flush: 'sync' })
  const stopRegistry = onAssetDimensionFiltersChange(() => {
    registryVersion.value++
    selectorVersion++
    targetOpen.value = false
    selector.value = undefined
  })
  onScopeDispose(() => { contextVersion++; selectorVersion++; stopRegistry() })

  const activate = (): Promise<void> => {
    if (context.value?.assetType === props.options.assetType) return Promise.resolve()
    if (pendingContext) return pendingContext
    const current = contextVersion
    const assetType = props.options.assetType
    const loadContext = props.options.loadContext || (() => getAssetAccessContext(assetType))
    loading.value = true
    contextFailed.value = false
    pendingContext = (async () => {
      await Promise.resolve()
      if (current !== contextVersion) return
      try {
        const next = await loadContext()
        if (current !== contextVersion) return
        if (next.assetType !== assetType || !Array.isArray(next.ranges)) throw new Error('Invalid asset context')
        loadedContext.value = next
        notifyDisplay()
      } catch {
        if (current === contextVersion) contextFailed.value = true
      } finally {
        if (current === contextVersion) { loading.value = false; pendingContext = undefined }
      }
    })()
    return pendingContext
  }

  const submit = () => {
    if (failure.value || !context.value) return
    if (draft.value.rangeId === 'all' && props.options.allowClear === false) return
    if (['targets', 'notTargets'].includes(draft.value.operator)
      && (draft.value.rangeId.startsWith('dimension:') || draft.value.rangeId === 'creator') && !draft.value.ids.length) return
    const term = buildAssetOwnershipTerm(draft.value, props.options)
    update(term && props.value?.type ? { ...term, type: props.value.type } : term)
    targetOpen.value = false
  }
  const selectRange = (rangeId: string) => {
    if (!ranges.value.some(range => range.value === rangeId && !range.disabled)) return
    selectorVersion++
    targetOpen.value = false
    selector.value = undefined
    optionsFailed.value = invalid.value = false
    // 默认值只在主动添加创建人条件时设置，不覆盖外部条件或路由中的用户选择。
    draft.value = { rangeId, operator: 'targets', ids: rangeId === 'creator' && props.options.userId ? [props.options.userId] : [] }
    if (rangeId.startsWith('dimension:')) draft.value.operator = operators.value[0] || 'targets'
    if (rangeId === 'creator' ? !createSelector.value
      : !rangeId.startsWith('dimension:') || ['bound', 'unbound'].includes(draft.value.operator)) submit()
  }
  const selectOperator = (operator: AssetDimensionOperator) => {
    if (!operators.value.includes(operator)) return
    selectorVersion++
    draft.value.operator = operator
    targetOpen.value = false
    selector.value = undefined
    optionsFailed.value = false
    if (['bound', 'unbound'].includes(operator)) submit()
  }
  const selectTargets = (ids: string[]) => { draft.value.ids = ids }

  const openTargets = async () => {
    const openingVersion = selectorVersion
    optionsFailed.value = false
    await activate()
    if (openingVersion !== selectorVersion || !context.value
      || context.value.assetType !== props.options.assetType || failure.value || !createSelector.value) return
    const current = ++selectorVersion
    const dimension = draft.value.rangeId === 'creator' ? 'creator' : draft.value.rangeId.slice(10)
    const remember = (items: AssetDimensionOption[]) => {
      if (current !== selectorVersion) return []
      const previous = labels.value.get(dimension) || []
      const keys = new Set(items.map(item => item.value))
      labels.value = new Map(labels.value).set(dimension, [...items, ...previous.filter(item => !keys.has(item.value))])
      notifyDisplay()
      return items
    }
    try {
      const source = createSelector.value({ assetType: props.options.assetType })
      const self = dimension === 'creator' && props.options.userId
        ? [{ value: props.options.userId, label: translate('components.AssetOwnershipCondition.me') }] : []
      const options = [...self, ...(source.options || []).filter(item => !self.some(option => option.value === item.value))]
      remember(options)
      optionsFailed.value = false
      // 包装既有面板加载器以记录标签和错误；面板只在用户打开后挂载。
      const wrap = <Args extends unknown[]>(load: (...args: Args) => Promise<AssetDimensionOption[]>) => async (...args: Args) => {
        try { return remember(await load(...args)) } catch (error) {
          if (current === selectorVersion) optionsFailed.value = true
          throw error
        }
      }
      selector.value = {
        ...source,
        options,
        component: source.component ? markRaw(source.component) : undefined,
        onOptionsChange: remember,
        optionPanel: {
          ...source.optionPanel, multiple: true,
          ...(source.optionPanel?.loadOptions ? { loadOptions: wrap(source.optionPanel.loadOptions) } : {}),
          ...(source.optionPanel?.loadSelectedOptions ? { loadSelectedOptions: wrap(source.optionPanel.loadSelectedOptions) } : {}),
        },
      }
      targetOpen.value = true
    } catch { optionsFailed.value = true }
  }
  /** 弹层由用户重开时恢复目标面板；异步期间切换条件、身份或卸载则放弃恢复。 */
  const resumeEditing = async () => {
    const openingVersion = selectorVersion
    await activate()
    if (openingVersion !== selectorVersion || invalid.value || failure.value) return
    if (['targets', 'notTargets'].includes(draft.value.operator) && createSelector.value) await openTargets()
  }
  return { context, loading, contextFailed, targetOpen, selector, draft, invalid,
    ranges, operators, createSelector, preview, failure, activate, selectRange, selectOperator, selectTargets, openTargets, resumeEditing, submit }
}

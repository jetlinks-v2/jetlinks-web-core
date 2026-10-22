import type {
  AssetAccessContext, AssetDimensionOption, AssetOwnershipOptions,
  AssetOwnershipSelection, AssetOwnershipTerm,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 只解析简单目标与布尔闭包；关系、混合维度等条件不得在编辑时被静默改写。 */
export const parseAssetOwnershipTerm = (
  term: unknown, options: Pick<AssetOwnershipOptions, 'assetType' | 'column' | 'userId'>,
): AssetOwnershipSelection | undefined => {
  if (term === undefined) return { rangeId: 'all', operator: 'targets', ids: [] }
  if (!isRecord(term) || term.column !== options.column
    || Object.keys(term).some(key => !['column', 'termType', 'value', 'type', 'key'].includes(key))) return undefined
  if (term.termType === 'assets-unbound') {
    return term.value === options.assetType ? { rangeId: 'unbound', operator: 'targets', ids: [] } : undefined
  }
  if (term.termType === `${options.assetType}-creator`) {
    const ids = Array.isArray(term.value) ? term.value : [term.value]
    return ids.length && ids.every(id => typeof id === 'string' && id.length > 0)
      ? { rangeId: 'creator', operator: 'targets', ids: [...new Set(ids)] } : undefined
  }
  if (term.termType !== 'dim-assets' || !isRecord(term.value)) return undefined
  const value = term.value
  if (value.assetType !== options.assetType
    || Object.keys(value).some(key => !['assetType', 'targets', 'targetType', 'not', 'closure'].includes(key))
    || value.closure !== undefined && typeof value.closure !== 'boolean'
    || value.not !== undefined && typeof value.not !== 'boolean') return undefined
  if (typeof value.targetType === 'string' && value.targetType.length > 0) {
    if (value.targets !== undefined || value.closure !== undefined) return undefined
    return { rangeId: `dimension:${value.targetType}`, operator: value.not ? 'unbound' : 'bound', ids: [] }
  }
  if (value.targetType !== undefined || !Array.isArray(value.targets) || !value.targets.length) return undefined
  const targets = value.targets
  if (!targets.every(target => isRecord(target) && typeof target.type === 'string' && target.type.length > 0
    && typeof target.id === 'string' && target.id.length > 0 && target.type === targets[0].type
    && Object.keys(target).every(key => ['type', 'id'].includes(key)))) return undefined
  return {
    rangeId: `dimension:${targets[0].type}`,
    operator: value.not ? 'notTargets' : 'targets',
    ids: targets.map(target => target.id),
    ...(value.closure !== undefined ? { closure: value.closure } : {}),
  }
}

/** 构造统一 dim-assets / creator 条件，不写入身份、Scope 或授权策略。 */
export const buildAssetOwnershipTerm = (
  selection: AssetOwnershipSelection, options: Pick<AssetOwnershipOptions, 'assetType' | 'column' | 'userId'>,
): AssetOwnershipTerm | undefined => {
  if (selection.rangeId === 'all') return undefined
  if (selection.rangeId === 'unbound') {
    return { column: options.column, termType: 'assets-unbound', value: options.assetType }
  }
  if (selection.rangeId === 'creator') {
    if (selection.operator !== 'targets') throw new Error('Invalid creator operator')
    if (!selection.ids.length || selection.ids.some(id => typeof id !== 'string' || !id.length)) {
      throw new Error('Missing creator targets')
    }
    const ids = [...new Set(selection.ids)]
    return { column: options.column, termType: `${options.assetType}-creator`, value: ids.length === 1 ? ids[0] : ids }
  }
  const dimension = selection.rangeId.startsWith('dimension:') ? selection.rangeId.slice(10) : ''
  if (!dimension) throw new Error('Invalid dimension range')
  const existence = selection.operator === 'bound' || selection.operator === 'unbound'
  if (!existence && (!selection.ids.length || selection.ids.some(id => typeof id !== 'string' || !id.length))) {
    throw new Error('Missing dimension targets')
  }
  return {
    column: options.column,
    termType: 'dim-assets',
    value: {
      assetType: options.assetType,
      ...(existence ? { targetType: dimension } : {
        targets: [...new Set(selection.ids)].map(id => ({ type: dimension, id })),
      }),
      not: selection.operator === 'notTargets' || selection.operator === 'unbound',
      ...(!existence && selection.closure !== undefined ? { closure: selection.closure } : {}),
    },
  }
}

/** 标签来自本实例已有数据；冷回显保留 ID，禁止为绘制 Token 自动查询目录。 */
export const formatAssetOwnershipTerm = (
  term: unknown, options: AssetOwnershipOptions, context: AssetAccessContext | undefined,
  labels: ReadonlyMap<string, AssetDimensionOption[]>,
  translate: (key: string, values?: Record<string, string>) => string,
): string => {
  const selection = parseAssetOwnershipTerm(term, options)
  if (!selection) return translate('components.AssetOwnershipCondition.invalid')
  const name = context?.ranges.find(range => range.id === selection.rangeId)?.name
  if (selection.rangeId === 'all' || selection.rangeId === 'unbound') {
    return name || translate(`components.AssetOwnershipCondition.${selection.rangeId === 'unbound' ? 'unboundRange' : selection.rangeId}`)
  }
  const dimension = selection.rangeId === 'creator' ? 'creator' : selection.rangeId.slice(10)
  const findLabel = (items: AssetDimensionOption[], id: string, parents: string[] = []): string | undefined => {
    for (const item of items) {
      const path = [...parents, item.label]
      if (item.value === id) return path.join('/')
      const child = findLabel(item.children || [], id, path)
      if (child) return child
    }
    return undefined
  }
  const values = selection.ids.map(id => selection.rangeId === 'creator' && id === options.userId
    ? translate('components.AssetOwnershipCondition.me') : findLabel(labels.get(dimension) || [], id) || id)
    .join(translate('components.AssetOwnershipCondition.valueSeparator'))
  if (selection.rangeId === 'creator') {
    return translate('components.AssetOwnershipCondition.preview.creator', { targets: values })
  }
  return translate(`components.AssetOwnershipCondition.preview.${selection.operator}`, {
    dimension: name || dimension, targets: selection.closure
      ? translate('components.AssetOwnershipCondition.withDescendants', { targets: values }) : values,
  })
}

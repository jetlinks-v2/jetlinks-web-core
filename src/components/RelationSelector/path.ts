import type { RelationInfo, RelationSelectorOrigin, RelationStep, VariableObjectSpec } from './types'

/** 编辑副本保留原 options，不将显示名、图标或样例对象写进执行配置。 */
export function relationSteps(value?: VariableObjectSpec): RelationStep[] {
  const steps: RelationStep[] = []
  for (let current = value?.related; current; current = current.next) {
    const { next: _next, ...step } = current
    steps.push({ ...step, ...(step.options ? { options: { ...step.options } } : {}) })
  }
  return steps
}

/** 仅在选到合法终点时，将编辑路径组装成既有的递归协议。 */
export function relationValue(origin: RelationSelectorOrigin, steps: RelationStep[]): VariableObjectSpec {
  const root = { ...origin.root }
  if (root.objectSource) root.objectSource = { ...root.objectSource }
  const related = steps.reduceRight<VariableObjectSpec['related']>((next, step) => ({
    ...step, ...(step.options ? { options: { ...step.options } } : {}), ...(next ? { next } : {}),
  }), undefined)
  return { ...root, ...(related ? { related } : {}) }
}

/** 根身份由调用方提供的 ID 或变量来源决定，不按显示名称匹配。 */
export function sameRelationOrigin(value: VariableObjectSpec, origin: RelationSelectorOrigin): boolean {
  const left = value.objectSource
  const right = origin.root.objectSource
  return value.objectType === origin.root.objectType && value.objectId === origin.root.objectId
    && (left?.source === 'upper' && right?.source === 'upper' ? left.upperKey === right.upperKey
      : left?.source === 'fixed' && right?.source === 'fixed' ? left.value === right.value : !left && !right)
}

/** 同一关系可以正反向到达相同类型，身份必须包含方向。 */
export function relationStepKey(step: RelationStep): string {
  return JSON.stringify([step.objectType, step.relation, step.options?.reverse === true])
}

export const relationInfoStep = (info: RelationInfo): RelationStep => ({
  objectType: info.targetType, relation: info.relation,
  ...(info.reverse ? { options: { reverse: true } } : {}),
})

export const relationName = (info: RelationInfo): string => (
  info.reverse ? info.reverseName || info.name : info.name
)

export const acceptsRelationType = (type: string, targets?: string[]): boolean => (
  targets === undefined || targets.includes(type)
)

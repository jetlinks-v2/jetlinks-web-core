import type { MetricApi, MetricConfig, MetricContext, MetricDataTarget, MetricTemplate, MetricValue } from './types'

export const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const outputId = (output: { property?: string; metricId: string }): string => output.metricId
export const templateKey = (template: { id: string; version: string }): string => JSON.stringify([template.id, template.version])
/** 只在结果语义变化时重建详情；改名和普通修订不触发趋势重读。 */
export const metricResultKey = (config: MetricConfig | undefined, outputId: string): string =>
  JSON.stringify([config?.id, outputId, config?.dataVersion, config?.state, config?.enabledAt])

/** 范围配置在所属对象上用于管理，在成员页读取该成员的结果，不能查询虚拟的 * 设备。 */
export function metricDataTarget(config: MetricConfig, context: MetricContext): MetricDataTarget | undefined {
  if (config.scope === 'children') {
    if (config.ownerType === context.ownerType && config.ownerId === context.ownerId) return
    return { targetType: context.targetType || context.ownerType, targetId: context.targetId || context.ownerId }
  }
  return { targetType: config.targetType, targetId: config.targetId }
}

/** 推送和迟到的 HTTP 快照只合并同一启用周期、数据口径和实际目标的结果。 */
export function metricValueMatches(config: MetricConfig, target: MetricDataTarget | undefined, value: MetricValue): boolean {
  return Boolean(target && config.state === 'enabled' && config.dataVersion && config.enabledAt != null
    && value.thingType === target.targetType && value.thingId === target.targetId && value.dataVersion === config.dataVersion
    && String(value.tags?.enabledAt) === String(config.enabledAt) && value.tags?.configId === config.id)
}

export function newerMetricValue(previous: MetricValue | undefined, next: MetricValue): MetricValue {
  if (!previous) return next
  const before = previous.evaluationTime || previous.timestamp || 0, after = next.evaluationTime || next.timestamp || 0
  if (before !== after) return before > after ? previous : next
  const beforeProcess = previous.processTime || 0, afterProcess = next.processTime || 0
  if (beforeProcess !== afterProcess) return beforeProcess > afterProcess ? previous : next
  // 同一计算快照的读取视图仍会推进；较旧推送不能覆盖刷新后确认的时长。
  const beforeRead = previous.state?.readView?.time || 0, afterRead = next.state?.readView?.time || 0
  if (beforeRead !== afterRead) return beforeRead > afterRead ? previous : next
  return (previous.quality?.freshness || 0) >= (next.quality?.freshness || 0) ? previous : next
}

/** 一次新增只生成一个稳定引用位置；保存/启用重试沿用服务端返回的配置。 */
export function createConfig(context: MetricContext): MetricConfig {
  return {
    ownerType: context.ownerType, ownerId: context.ownerId,
    targetType: context.targetType || context.ownerType, targetId: context.targetId || context.ownerId,
    ...(context.inheritance ? { scope: 'children', targetType: context.inheritance.targetType, targetId: '*' } : {}),
    slot: crypto.randomUUID(), templateId: '', templateVersion: '',
    inputMappings: {}, parameters: {}, state: 'disabled', revision: 0
  }
}
export class MetricActivationError extends Error {
  constructor(public readonly configuration: MetricConfig, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause))
    this.name = 'MetricActivationError'
  }
}
/** 先确认持久化，再启用；第二步失败携带已保存身份，不以新增来重试。 */
export async function saveAndActivate(
  api: Pick<MetricApi, 'saveConfig'>, config: MetricConfig, activate: boolean
): Promise<MetricConfig> {
  if (activate && config.id && config.state === 'enabled') return api.saveConfig(copy(config))
  const saved = await api.saveConfig({ ...copy(config), state: 'disabled' })
  if (!activate) return saved
  try { return await api.saveConfig({ ...saved, state: 'enabled' }) }
  catch (error) { throw new MetricActivationError(saved, error) }
}
export function editableParameters(template?: MetricTemplate) {
  return template?.parameterDefinitions.filter(parameter => parameter.expands?.editable === true) || []
}
/** 不提交固定参数的覆盖值，由服务端使用已发布模板的真实默认值。 */
export function parameterOverrides(template: MetricTemplate, parameters: Record<string, unknown>) {
  return Object.fromEntries(editableParameters(template)
    .filter(parameter => Object.prototype.hasOwnProperty.call(parameters, parameter.id))
    .map(parameter => [parameter.id, parameters[parameter.id]]))
}
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

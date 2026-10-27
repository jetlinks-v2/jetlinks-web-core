import type { BufferDisplayConfig } from '../types'

/** 保存用户期望的完整身份，不能用暂时为空 / 部分到达的快照销毁偏好；空数组为主动全关。 */
export function normalizeBufferConfig(config: BufferDisplayConfig | undefined, objectNames: readonly string[]): BufferDisplayConfig {
  const selected = config?.visibleObjectNames ?? (config?.objectName ? [config.objectName] : objectNames)
  const visibleObjectNames = [...new Set(selected)]
  return {
    filter: config?.filter ?? 'all',
    grouping: config?.grouping ?? 'aggregate',
    view: config?.view ?? 'backlog',
    scale: config?.scale ?? 'linear',
    visibleObjectNames,
    objectName: visibleObjectNames.length === 1 ? visibleObjectNames[0] : undefined,
  }
}

/** 当前汇总与历史必须使用同一身份范围；任一字段未知时不显示部分总量。 */
export function bufferQuantityTotal(queues: readonly { pending?: number; dead?: number }[], key: 'pending' | 'dead'): number | undefined {
  if (!queues.length) return undefined
  let total = 0
  for (const queue of queues) {
    const value = queue[key]
    if (value === undefined || !Number.isFinite(value) || value < 0) return undefined
    total += value
  }
  return Number.isFinite(total) ? total : undefined
}

/** 压缩只改变坐标，不改变原始计数、速率或 Tooltip；零与缺测保持各自语义。 */
export function bufferPlotValue(value: number | undefined, scale: BufferDisplayConfig['scale']): number | null {
  if (value === undefined || !Number.isFinite(value) || value < 0) return null
  return scale === 'compressed' ? Math.log1p(value) : value
}

export function bufferAxisValue(value: number, scale: BufferDisplayConfig['scale']): number {
  return scale === 'compressed' ? Math.expm1(value) : value
}

/** 同一完整 ObjectName 在节点切换、队列增减和图例操作后保留颜色。 */
export function bufferColorIndex(objectName: string, paletteSize: number): number {
  let hash = 0
  for (let index = 0; index < objectName.length; index++) hash = Math.imul(hash, 31) + objectName.charCodeAt(index) | 0
  return paletteSize > 0 ? (hash >>> 0) % paletteSize : 0
}

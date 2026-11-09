import { escape } from 'lodash-es'
import { projectBufferHistory, validBufferCount, type BufferHistorySource, type BufferScope, type BufferHistoryPoint, type BufferThroughputPoint, type BufferOverviewPoint } from './historyProjection'
export { createBufferHistoryProjection } from './historyProjection'
export type { BufferHistoryProjection, BufferHistoryPoint, BufferThroughputPoint, BufferOverviewPoint } from './historyProjection'

/** 普通数组按本次内容计算；共享投影复用已规范化的同一观测快照。 */
export function bufferHistoryPoints(history: BufferHistorySource, scope?: BufferScope): BufferHistoryPoint[] {
  return projectBufferHistory(history).overview(scope).map(({ sampledAt, pending, dead }) => ({ sampledAt, pending, dead }))
}
export function bufferThroughputPoints(history: BufferHistorySource, scope?: BufferScope): BufferThroughputPoint[] {
  return projectBufferHistory(history).overview(scope).map(({ pending, dead, ...rates }) => rates)
}
export function bufferOverviewPoints(history: BufferHistorySource, scope?: BufferScope): BufferOverviewPoint[] {
  return projectBufferHistory(history).overview(scope)
}

/** name 支持 JMX 引号及转义逗号；未知结构保留完整身份，不猜测队列名称。 */
export function bufferObjectLabel(objectName: string): string {
  const name = /(?:^|[:,])name=("(?:\\.|[^"\\])*"|[^,]*)/.exec(objectName)?.[1]
  return name?.startsWith('"') ? name.slice(1, -1).replace(/\\(["\\*?])/g, '$1').replace(/\\n/g, '\n') : name || objectName
}

export interface BufferTooltipLabels {
  queue: string; pending: string; dead: string; items: string; aggregate?: string
  writtenRate?: string; attemptedRate?: string; itemsPerSecond?: string
  inRowsRate?: string; outRowsRate?: string; rowGap?: string; rowsPerSecond?: string
}

/** tooltip 枚举本次观测范围中的每个队列；全部动态文本统一转义，缺数不补零。 */
export function bufferTooltipHtml(history: BufferHistorySource, sampledAt: number, labels: BufferTooltipLabels, selection: { objectName?: string; visibleObjectNames?: readonly string[]; view?: 'backlog' | 'throughput'; grouping?: 'aggregate' | 'queues'; combined?: boolean; rateUnit?: 'items' | 'rows' } = {}): string {
  const projection = projectBufferHistory(history)
  if (!projection.hasSample(sampledAt)) return ''
  const names = selection.visibleObjectNames ?? (selection.objectName ? [selection.objectName] : projection.queueNames)
  if (!names.length) return ''
  const quantity = (value: number | undefined) => validBufferCount(value) === undefined ? '—' : `${value} ${labels.items}`
  const row = (name: string, identity: string, values: string[]) => `<span title="${escape(identity)}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escape(name)}</span>${values.map(value => `<span>${escape(value)}</span>`).join('')}`
  const rows = selection.rateUnit === 'rows', unit = rows ? labels.rowsPerSecond : labels.itemsPerSecond
  const rateText = (value: number | undefined) => value === undefined ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit ?? ''}`
  const values = (point: BufferOverviewPoint | undefined) => {
    const rates = rows ? [point?.inRowsRate, point?.outRowsRate, point?.rowGap] : [point?.writtenRate, point?.attemptedRate]
    return selection.combined ? [quantity(point?.pending), quantity(point?.dead), ...rates.map(rateText)]
      : selection.view === 'throughput' ? rates.map(rateText) : [quantity(point?.pending), quantity(point?.dead)]
  }
  const cells = selection.grouping === 'aggregate' ? (() => {
    const point = projection.at(sampledAt, names)
    return row(labels.aggregate ?? labels.queue, labels.aggregate ?? labels.queue, values(point))
  })() : names.map(objectName => {
    return row(bufferObjectLabel(objectName), objectName, values(projection.at(sampledAt, objectName)))
  }).join('')
  const rateColumns = rows ? [labels.inRowsRate ?? '', labels.outRowsRate ?? '', labels.rowGap ?? ''] : [labels.writtenRate ?? '', labels.attemptedRate ?? '']
  const columns = selection.combined ? [labels.pending, labels.dead, ...rateColumns]
    : selection.view === 'throughput' ? rateColumns : [labels.pending, labels.dead]
  return `<strong>${escape(new Date(sampledAt).toLocaleTimeString([], { hour12: false }))}</strong><div style="max-width:min(640px,calc(100vw - 48px));max-height:220px;overflow:auto;margin-top:6px"><div style="display:grid;grid-template-columns:minmax(90px,1fr) repeat(${columns.length},max-content);gap:4px 12px;width:max-content;min-width:100%"><b>${escape(labels.queue)}</b>${columns.map(label => `<b>${escape(label)}</b>`).join('')}${cells}</div></div>`
}

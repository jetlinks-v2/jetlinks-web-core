import { escape } from 'lodash-es'
import { projectBufferHistory, validBufferCount, type BufferHistorySource, type BufferScope, type BufferHistoryPoint, type BufferThroughputPoint, type BufferOverviewPoint } from './historyProjection'
export { createBufferHistoryProjection } from './historyProjection'
export type { BufferHistoryProjection, BufferHistoryPoint, BufferThroughputPoint, BufferOverviewPoint } from './historyProjection'

/** 普通数组按本次内容计算；共享投影复用已规范化的同一观测快照。 */
export function bufferHistoryPoints(history: BufferHistorySource, scope?: BufferScope): BufferHistoryPoint[] {
  return projectBufferHistory(history).overview(scope).map(({ sampledAt, pending, dead }) => ({ sampledAt, pending, dead }))
}
export function bufferThroughputPoints(history: BufferHistorySource, scope?: BufferScope): BufferThroughputPoint[] {
  return projectBufferHistory(history).overview(scope).map(({ sampledAt, writtenRate, attemptedRate }) => ({ sampledAt, writtenRate, attemptedRate }))
}
export function bufferOverviewPoints(history: BufferHistorySource, scope?: BufferScope): BufferOverviewPoint[] {
  return projectBufferHistory(history).overview(scope)
}

/** name 支持 JMX 引号及转义逗号；未知结构保留完整身份，不猜测队列名称。 */
export function bufferObjectLabel(objectName: string): string {
  const name = /(?:^|[:,])name=("(?:\\.|[^"\\])*"|[^,]*)/.exec(objectName)?.[1]
  return name?.startsWith('"') ? name.slice(1, -1).replace(/\\(["\\*?])/g, '$1').replace(/\\n/g, '\n') : name || objectName
}

export interface BufferTooltipLabels { queue: string; pending: string; dead: string; items: string; writtenRate?: string; attemptedRate?: string; itemsPerSecond?: string; aggregate?: string }

/** tooltip 枚举本次观测范围中的每个队列；全部动态文本统一转义，缺数不补零。 */
export function bufferTooltipHtml(history: BufferHistorySource, sampledAt: number, labels: BufferTooltipLabels, selection: { objectName?: string; visibleObjectNames?: readonly string[]; view?: 'backlog' | 'throughput'; grouping?: 'aggregate' | 'queues'; combined?: boolean } = {}): string {
  const projection = projectBufferHistory(history)
  if (!projection.hasSample(sampledAt)) return ''
  const names = selection.visibleObjectNames ?? (selection.objectName ? [selection.objectName] : projection.queueNames)
  if (!names.length) return ''
  const quantity = (value: number | undefined) => validBufferCount(value) === undefined ? '—' : `${value} ${labels.items}`
  const row = (name: string, identity: string, values: string[]) => `<span title="${escape(identity)}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escape(name)}</span>${values.map(value => `<span>${escape(value)}</span>`).join('')}`
  const rateText = (value: number | undefined) => value === undefined ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${labels.itemsPerSecond ?? ''}`
  const values = (point: BufferOverviewPoint | undefined) => selection.combined
    ? [quantity(point?.pending), quantity(point?.dead), rateText(point?.writtenRate), rateText(point?.attemptedRate)]
    : selection.view === 'throughput' ? [rateText(point?.writtenRate), rateText(point?.attemptedRate)] : [quantity(point?.pending), quantity(point?.dead)]
  const cells = selection.grouping === 'aggregate' ? (() => {
    const point = projection.at(sampledAt, names)
    return row(labels.aggregate ?? labels.queue, labels.aggregate ?? labels.queue, values(point))
  })() : names.map(objectName => {
    return row(bufferObjectLabel(objectName), objectName, values(projection.at(sampledAt, objectName)))
  }).join('')
  const columns = selection.combined ? [labels.pending, labels.dead, labels.writtenRate ?? '', labels.attemptedRate ?? '']
    : selection.view === 'throughput' ? [labels.writtenRate ?? '', labels.attemptedRate ?? ''] : [labels.pending, labels.dead]
  return `<strong>${escape(new Date(sampledAt).toLocaleTimeString([], { hour12: false }))}</strong><div style="max-width:min(640px,calc(100vw - 48px));max-height:220px;overflow:auto;margin-top:6px"><div style="display:grid;grid-template-columns:minmax(90px,1fr) repeat(${columns.length},max-content);gap:4px 12px;width:max-content;min-width:100%"><b>${escape(labels.queue)}</b>${columns.map(label => `<b>${escape(label)}</b>`).join('')}${cells}</div></div>`
}

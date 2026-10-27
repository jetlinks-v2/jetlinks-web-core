import type { BufferHistorySample } from '../types'
import { escape } from 'lodash-es'
import { bufferCounterText } from './counters'

export interface BufferHistoryPoint { sampledAt: number; pending?: number; dead?: number }

/** 仅采用真实采集时间；同一时间以后返回的快照为准，不扩展到采集前。 */
function recentBufferSamples(history: readonly BufferHistorySample[]): BufferHistorySample[] {
  const samples = new Map<number, BufferHistorySample>()
  for (const sample of history) if (Number.isFinite(sample.sampledAt) && sample.sampledAt > 0) samples.set(sample.sampledAt, sample)
  const ordered = [...samples.values()].sort((left, right) => left.sampledAt - right.sampledAt)
  const latest = ordered.at(-1)?.sampledAt
  if (latest === undefined) return []
  return ordered.filter(sample => sample.sampledAt >= latest - 300_000)
}

const validCount = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined

/** 同一观测范围内求和；队列或字段缺失保留断点，避免部分响应形成虚假的下降。 */
export function bufferHistoryPoints(history: readonly BufferHistorySample[], scope?: string | readonly string[]): BufferHistoryPoint[] {
  const recent = recentBufferSamples(history)
  const names = new Set(typeof scope === 'string' ? [scope] : scope ?? recent.flatMap(sample => sample.buffers.map(buffer => buffer.objectName)))
  return recent.map(sample => {
    const buffers = new Map(sample.buffers.map(buffer => [buffer.objectName, buffer]))
    const total = (key: 'pending' | 'dead') => {
      if (!names.size) return undefined
      let sum = 0
      for (const name of names) {
        const value = validCount(buffers.get(name)?.[key])
        if (value === undefined) return undefined
        sum += value
      }
      return Number.isFinite(sum) ? sum : undefined
    }
    return { sampledAt: sample.sampledAt, pending: total('pending'), dead: total('dead') }
  })
}

export interface BufferThroughputPoint { sampledAt: number; writtenRate?: number; attemptedRate?: number }

/** 只用相邻真实快照求差：缺字段、集合变化、重置、倒退均断开，不跨越缺测点。 */
export function bufferThroughputPoints(history: readonly BufferHistorySample[], scope?: string | readonly string[]): BufferThroughputPoint[] {
  const recent = recentBufferSamples(history)
  const names = scope === undefined ? undefined : new Set(typeof scope === 'string' ? [scope] : scope)
  const selected = (sample: BufferHistorySample) => sample.buffers.filter(buffer => !names || names.has(buffer.objectName))
  return recent.map((sample, index) => {
    const previous = recent[index - 1], currentQueues = selected(sample), previousQueues = previous ? selected(previous) : []
    const previousByName = new Map(previousQueues.map(queue => [queue.objectName, queue]))
    const sameQueues = currentQueues.length > 0 && (!names || currentQueues.length === names.size) && currentQueues.length === previousQueues.length && currentQueues.length === new Set(currentQueues.map(queue => queue.objectName)).size
      && currentQueues.every(queue => previousByName.has(queue.objectName))
    const elapsed = previous ? sample.sampledAt - previous.sampledAt : 0
    const rate = (key: 'written' | 'attempted') => {
      if (!sameQueues || elapsed <= 0) return undefined
      let difference = 0n
      for (const queue of currentQueues) {
        const before = previousByName.get(queue.objectName)!
        const validEpoch = (epoch: number | undefined) => epoch === undefined || Number.isSafeInteger(epoch) && epoch >= 0
        if (!validEpoch(queue.counterEpoch) || !validEpoch(before.counterEpoch) || queue.counterEpoch !== before.counterEpoch) return undefined
        const currentValue = bufferCounterText(queue[key]), previousValue = bufferCounterText(before[key])
        if (currentValue === undefined || previousValue === undefined) return undefined
        const delta = BigInt(currentValue) - BigInt(previousValue)
        if (delta < 0n) return undefined
        difference += delta
      }
      if (difference > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
      const result = Number(difference) / (elapsed / 1000)
      return Number.isFinite(result) ? result : undefined
    }
    return { sampledAt: sample.sampledAt, writtenRate: rate('written'), attemptedRate: rate('attempted') }
  })
}

export interface BufferOverviewPoint extends BufferHistoryPoint, BufferThroughputPoint {}

/** 合图和 tooltip 使用同一身份范围及真实采样时间，数量与速率各自保留缺测。 */
export function bufferOverviewPoints(history: readonly BufferHistorySample[], scope?: string | readonly string[]): BufferOverviewPoint[] {
  const rates = new Map(bufferThroughputPoints(history, scope).map(point => [point.sampledAt, point]))
  return bufferHistoryPoints(history, scope).map(point => ({ ...point, ...rates.get(point.sampledAt) }))
}

/** name 支持 JMX 引号及转义逗号；未知结构保留完整身份，不猜测队列名称。 */
export function bufferObjectLabel(objectName: string): string {
  const name = /(?:^|[:,])name=("(?:\\.|[^"\\])*"|[^,]*)/.exec(objectName)?.[1]
  return name?.startsWith('"') ? name.slice(1, -1).replace(/\\(["\\*?])/g, '$1').replace(/\\n/g, '\n') : name || objectName
}

export interface BufferTooltipLabels { queue: string; pending: string; dead: string; items: string; writtenRate?: string; attemptedRate?: string; itemsPerSecond?: string; aggregate?: string }

/** tooltip 枚举本次观测范围中的每个队列；全部动态文本统一转义，缺数不补零。 */
export function bufferTooltipHtml(history: readonly BufferHistorySample[], sampledAt: number, labels: BufferTooltipLabels, selection: { objectName?: string; visibleObjectNames?: readonly string[]; view?: 'backlog' | 'throughput'; grouping?: 'aggregate' | 'queues'; combined?: boolean } = {}): string {
  const recent = recentBufferSamples(history)
  const sample = recent.find(item => item.sampledAt === sampledAt)
  if (!sample) return ''
  const names = selection.visibleObjectNames ?? (selection.objectName ? [selection.objectName] : [...new Set(recent.flatMap(item => item.buffers.map(buffer => buffer.objectName)))])
  if (!names.length) return ''
  const buffers = new Map(sample.buffers.map(buffer => [buffer.objectName, buffer]))
  const quantity = (value: number | undefined) => validCount(value) === undefined ? '—' : `${value} ${labels.items}`
  const row = (name: string, identity: string, values: string[]) => `<span title="${escape(identity)}" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escape(name)}</span>${values.map(value => `<span>${escape(value)}</span>`).join('')}`
  const rateText = (value: number | undefined) => value === undefined ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${labels.itemsPerSecond ?? ''}`
  const values = (point: BufferOverviewPoint | undefined) => selection.combined
    ? [quantity(point?.pending), quantity(point?.dead), rateText(point?.writtenRate), rateText(point?.attemptedRate)]
    : selection.view === 'throughput' ? [rateText(point?.writtenRate), rateText(point?.attemptedRate)] : [quantity(point?.pending), quantity(point?.dead)]
  const cells = selection.grouping === 'aggregate' ? (() => {
    const point = bufferOverviewPoints(recent, names).find(item => item.sampledAt === sampledAt)
    return row(labels.aggregate ?? labels.queue, labels.aggregate ?? labels.queue, values(point))
  })() : names.map(objectName => {
    const buffer = buffers.get(objectName)
    const rate = selection.combined || selection.view === 'throughput' ? bufferThroughputPoints(recent, objectName).find(point => point.sampledAt === sampledAt) : undefined
    return row(bufferObjectLabel(objectName), objectName, values({ sampledAt, pending: buffer?.pending, dead: buffer?.dead, ...rate }))
  }).join('')
  const columns = selection.combined ? [labels.pending, labels.dead, labels.writtenRate ?? '', labels.attemptedRate ?? '']
    : selection.view === 'throughput' ? [labels.writtenRate ?? '', labels.attemptedRate ?? ''] : [labels.pending, labels.dead]
  return `<strong>${escape(new Date(sampledAt).toLocaleTimeString([], { hour12: false }))}</strong><div style="max-width:min(640px,calc(100vw - 48px));max-height:220px;overflow:auto;margin-top:6px"><div style="display:grid;grid-template-columns:minmax(90px,1fr) repeat(${columns.length},max-content);gap:4px 12px;width:max-content;min-width:100%"><b>${escape(labels.queue)}</b>${columns.map(label => `<b>${escape(label)}</b>`).join('')}${cells}</div></div>`
}

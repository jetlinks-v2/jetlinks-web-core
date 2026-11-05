import type { BufferHistorySample } from '../types'
import { bufferCounterText } from './counters'
import { bufferObservationTotal } from './observation'

export interface BufferHistoryPoint { sampledAt: number; pending?: number; dead?: number }
export interface BufferThroughputPoint {
  sampledAt: number; writtenRate?: number; attemptedRate?: number; inRowsRate?: number; outRowsRate?: number; rowGap?: number; errorRate?: number
  rateWindow?: { from: number; to: number; seconds: number }
}
export interface BufferOverviewPoint extends BufferHistoryPoint, BufferThroughputPoint {}
export type BufferScope = string | readonly string[] | undefined
type Queue = BufferHistorySample['buffers'][number]
interface IndexedQueue extends Queue { occurrences: number; writtenCount?: bigint; attemptedCount?: bigint }
interface IndexedSample { sampledAt: number; queues: Map<string, IndexedQueue>; count: number }
const maximumDelta = BigInt(Number.MAX_SAFE_INTEGER)
export const validBufferCount = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined
const validEpoch = (epoch: number | undefined) => epoch === undefined || Number.isSafeInteger(epoch) && epoch >= 0
const counter = (value: string | undefined) => { const text = bufferCounterText(value); return text === undefined ? undefined : BigInt(text) }

/** One immutable, five-minute snapshot shared by curves, latest readings and tooltips.
 * Scope arrays and returned projections are immutable for this snapshot's lifetime.
 * Plain-array callers create a fresh projection; no identity cache can hide in-place mutations.
 */
export function createBufferHistoryProjection(history: readonly BufferHistorySample[]) {
  const unique = new Map<number, BufferHistorySample>()
  for (const sample of history) if (Number.isFinite(sample.sampledAt) && sample.sampledAt > 0) unique.set(sample.sampledAt, sample)
  const ordered = [...unique.values()].sort((a, b) => a.sampledAt - b.sampledAt)
  const cutoff = (ordered.at(-1)?.sampledAt ?? 0) - 300_000
  const names = new Set<string>()
  // Copy/parse every relevant field here so Vue tracks sample mutations at this boundary.
  const samples: IndexedSample[] = ordered.filter(sample => sample.sampledAt >= cutoff).map(sample => {
    const queues = new Map<string, IndexedQueue>()
    for (const queue of sample.buffers) {
      names.add(queue.objectName)
      queues.set(queue.objectName, { ...queue, occurrences: (queues.get(queue.objectName)?.occurrences ?? 0) + 1,
        writtenCount: counter(queue.written), attemptedCount: counter(queue.attempted) })
    }
    return { sampledAt: sample.sampledAt, queues, count: sample.buffers.length }
  })
  const queueNames = [...names], byTime = new Map(samples.map((sample, index) => [sample.sampledAt, index]))
  const queueCache = new Map<string | undefined, BufferOverviewPoint[]>()
  const selectionCache = new WeakMap<readonly string[], BufferOverviewPoint[]>()
  const selectedNames = (scope: BufferScope) => typeof scope === 'string' ? [scope] : scope === undefined ? queueNames : [...new Set(scope)]

  function point(index: number, scope: BufferScope, selected: readonly string[]): BufferOverviewPoint {
    const sample = samples[index], previous = samples[index - 1]
    const elapsed = previous ? (sample.sampledAt - previous.sampledAt) / 1000 : 0
    let pending: number | undefined = selected.length ? 0 : undefined, dead = pending
    for (const name of selected) {
      const queue = sample.queues.get(name), p = validBufferCount(queue?.pending), d = validBufferCount(queue?.dead)
      pending = pending === undefined || p === undefined ? undefined : pending + p
      dead = dead === undefined || d === undefined ? undefined : dead + d
    }
    // Unscoped rates compare each adjacent sample's actual membership, whereas quantities
    // require the union over the window. These intentionally have different missing-data rules.
    const rateNames = scope === undefined ? sample.queues.keys() : selected
    let valid = !!previous && elapsed > 0 && (scope === undefined
      ? sample.count > 0 && sample.count === sample.queues.size && previous.count === sample.count
      : selected.length > 0)
    let written: bigint | undefined = 0n, attempted: bigint | undefined = 0n
    for (const name of rateNames) {
      const current = sample.queues.get(name), before = previous?.queues.get(name)
      if (!current || !before || current.occurrences !== 1 || before.occurrences !== 1 || !validEpoch(current.counterEpoch) || !validEpoch(before.counterEpoch) || current.counterEpoch !== before.counterEpoch || current.observation?.generation !== before.observation?.generation) { valid = false; break }
      const delta = (value: bigint | undefined, prior: bigint | undefined) => value === undefined || prior === undefined || value < prior ? undefined : value - prior
      const w = delta(current.writtenCount, before.writtenCount), a = delta(current.attemptedCount, before.attemptedCount)
      written = written === undefined || w === undefined ? undefined : written + w
      attempted = attempted === undefined || a === undefined ? undefined : attempted + a
    }
    const rate = (value: bigint | undefined) => {
      if (!valid || value === undefined || value > maximumDelta) return undefined
      const result = Number(value) / elapsed
      return Number.isFinite(result) ? result : undefined
    }
    const result: BufferOverviewPoint = { sampledAt: sample.sampledAt, pending: validBufferCount(pending), dead: validBufferCount(dead), writtenRate: rate(written), attemptedRate: rate(attempted) }
    const observationNames = scope === undefined ? [...sample.queues.keys()] : selected
    const observations = observationNames.map(name => { const queue = sample.queues.get(name); return queue?.occurrences === 1 ? queue.observation : undefined })
    if (observations.some(Boolean)) {
      // 新节点直接展示已完成采样区间；页面刷新频率不再改变吞吐口径。
      result.writtenRate = bufferObservationTotal(observations, 'WrittenRate')
      result.attemptedRate = bufferObservationTotal(observations, 'AttemptedRate')
      result.inRowsRate = bufferObservationTotal(observations, 'InRowsRate')
      result.outRowsRate = bufferObservationTotal(observations, 'OutRowsRate')
      // 差额只从同一完整范围的已知速率派生；负值表示消费历史数据，不是负积压。
      result.rowGap = result.inRowsRate !== undefined && result.outRowsRate !== undefined ? result.inRowsRate - result.outRowsRate : undefined
      result.errorRate = bufferObservationTotal(observations, 'ErrorRate')
      const first = observations[0]
      if (first?.fresh && first.windowMillis > 0 && observations.every(value => value?.fresh && value.sampledAt === first.sampledAt && value.windowMillis === first.windowMillis)) {
        result.rateWindow = { from: first.sampledAt - first.windowMillis, to: first.sampledAt, seconds: first.windowMillis / 1000 }
      }
    }
    return result
  }
  function cached(scope: BufferScope) { return typeof scope === 'object' ? selectionCache.get(scope) : queueCache.get(scope) }
  function overview(scope?: BufferScope): BufferOverviewPoint[] {
    const existing = cached(scope)
    if (existing) return existing
    const selected = selectedNames(scope), result = samples.map((_, index) => point(index, scope, selected))
    if (typeof scope === 'object') selectionCache.set(scope, result)
    else if (scope === undefined || names.has(scope)) queueCache.set(scope, result)
    return result
  }
  function at(sampledAt: number, scope?: BufferScope) {
    const index = byTime.get(sampledAt)
    return index === undefined ? undefined : cached(scope)?.[index] ?? point(index, scope, selectedNames(scope))
  }
  return { queueNames, overview, at,
    latest(scope?: BufferScope) { const time = samples.at(-1)?.sampledAt; return time === undefined ? undefined : at(time, scope) },
    hasSample(sampledAt: number) { return byTime.has(sampledAt) },
  }
}
export type BufferHistoryProjection = ReturnType<typeof createBufferHistoryProjection>
export type BufferHistorySource = readonly BufferHistorySample[] | BufferHistoryProjection
export const projectBufferHistory = (source: BufferHistorySource): BufferHistoryProjection => Array.isArray(source) ? createBufferHistoryProjection(source) : source as BufferHistoryProjection

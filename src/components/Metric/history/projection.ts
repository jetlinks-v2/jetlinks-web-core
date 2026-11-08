import type { MetricStateInterval, MetricValue } from '../types'
import { metricRecordedBoolean, metricRecordedState, metricResultReference, resultTime } from '../presentation'
import { stateIntervalSegments } from '../stateIntervals'

export const STATE_SAMPLE_LIMIT = 60

export type HistoryEntry = {
  kind: 'record'; key: string; time: number; value: MetricValue; state: string | number | boolean | null
} | {
  kind: 'interval'; key: string; time: number; end: number; interval: MetricStateInterval; cutoff: number; color: number; value?:MetricValue
}

/** Stable result or round references preserve selection across refresh; legacy rows keep same-time distinct results. */
export function historyRecords(values: MetricValue[], bounds?: [number, number], declaredStates = false): HistoryEntry[] {
  const occurrences = new Map<string, number>()
  const unique = new Map<string, HistoryEntry>()
  for (const value of values) {
    const time = resultTime(value)
    if (time === undefined || !Number.isFinite(time) || bounds && (time < bounds[0] || time > bounds[1])) continue
    const reference = metricResultReference(value)
    const identity = value.resultId ? `result:${reference}` : value.executionId ? `execution:${reference}:${value.metricId}` : JSON.stringify([
      value.metricId, time, value.thingType, value.thingId, value.dataVersion, value.eventTime, value.processTime, value.value,
    ])
    const ordinal = occurrences.get(identity) || 0
    occurrences.set(identity, ordinal + 1)
    const key = reference ? identity : `${identity}:${ordinal}`
    unique.set(key, { kind:'record', key, time, value, state:declaredStates ? metricRecordedState(value) : metricRecordedBoolean(value) })
  }
  return [...unique.values()].sort((a, b) => a.time - b.time || a.key.localeCompare(b.key))
}

/** Only server-confirmed intervals become bands; the clipped view never changes original start/end or duration facts. */
export function historyIntervals(values: MetricValue[], current?: MetricValue, bounds?: [number, number]): HistoryEntry[] {
  const owners = new Map<string,MetricValue>()
  // 关闭区间的转换记录属于下一个状态，不能冒充上一状态的计算过程。
  for (const value of [...values,...(current ? [current] : [])]) {
    const interval = value.state?.currentInterval, time = resultTime(value)
    if (!interval || !metricResultReference(value) || time == null || time < interval.startTime || time > Math.min(interval.endTime ?? time,interval.validUntil)) continue
    const previous = owners.get(interval.id)
    if (!previous || time >= (resultTime(previous) || 0)) owners.set(interval.id,value)
  }
  return stateIntervalSegments(values, current, bounds).flatMap(({ interval, cutoff, color }) => {
    const end = Math.min(interval.endTime ?? cutoff, interval.validUntil)
    return Number.isFinite(interval.startTime) && Number.isFinite(end) && end > interval.startTime
      ? [{ kind:'interval' as const, key:`interval:${interval.id}`, time:interval.startTime, end, interval, cutoff, color, value:owners.get(interval.id) }] : []
  }).sort((a, b) => a.time - b.time || a.key.localeCompare(b.key))
}

export function historyEntryState(entry: HistoryEntry) {
  return entry.kind === 'record' ? entry.state : entry.interval.value
}

/** State type is part of identity: numeric 1, string "1", and boolean true are different states. */
export function historyGroup(entry: HistoryEntry) {
  const value = historyEntryState(entry)
  return JSON.stringify([typeof value, value])
}

export function historyBounds(entries: HistoryEntry[], bounds?: [number, number]): [number, number] | undefined {
  const from = bounds?.[0] ?? (entries.length ? Math.min(...entries.map(entry => entry.time)) : undefined)
  const to = bounds?.[1] ?? (entries.length ? Math.max(...entries.map(entry => entry.kind === 'interval' ? entry.end : entry.time)) : undefined)
  if (from === undefined || to === undefined || !Number.isFinite(from) || !Number.isFinite(to) || to < from) return
  return from === to ? [from - 1, to + 1] : [from, to]
}

/** Complement of confirmed intervals, not a new device state. Filtering the visible lanes must not change these gaps. */
export function historyGaps(entries:HistoryEntry[], bounds:[number,number]) {
  const intervals = entries.filter((entry):entry is Extract<HistoryEntry,{ kind:'interval' }> => entry.kind === 'interval').sort((a,b)=>a.time-b.time)
  const gaps:Array<{ start:number; end:number }> = []
  let cursor = bounds[0]
  for (const entry of intervals) {
    const start = Math.max(bounds[0], entry.time), end = Math.min(bounds[1],entry.end)
    if (end <= start) continue
    if (start > cursor) gaps.push({ start:cursor, end:start })
    cursor = Math.max(cursor,end)
  }
  if (cursor < bounds[1]) gaps.push({ start:cursor, end:bounds[1] })
  return gaps
}

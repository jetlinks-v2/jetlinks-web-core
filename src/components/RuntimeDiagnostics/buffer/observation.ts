import type { MBeanDescriptor } from '../types'
import { bufferCounterText } from './counters'

export const bufferObservationMetrics = ['WrittenRate', 'AttemptedRate', 'InRowsRate', 'OutRowsRate', 'ErrorRate', 'DroppedRate', 'Pending', 'Dead', 'PendingBytes', 'Wip', 'WriterPending'] as const
export type BufferObservationMetric = typeof bufferObservationMetrics[number]
export interface BufferObservationPeak { value: number; time: number }
export interface BufferObservation {
  generation: string; sampledAt: number; windowMillis: number; rowsEnabled: boolean; zoneId: string
  statisticsStartTime: number; todayStartTime: number; fresh: boolean
  written?: string; attempted?: string
  inRows?: string; outRows?: string; errors?: string; dropped?: string
  values: Partial<Record<BufferObservationMetric, number>>
  todayPeaks: Partial<Record<BufferObservationMetric, BufferObservationPeak>>
}
export interface BufferObservationPoint {
  time: number; windowMillis: number; values: BufferObservation['values']; peaks: BufferObservation['todayPeaks']
}
export interface BufferObservationRecording { snapshot: BufferObservation; points: BufferObservationPoint[]; hour: boolean }
const record = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
const integer = (value: unknown) => { const result = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : number(value); return result !== undefined && Number.isSafeInteger(result) && result >= 0 ? result : undefined }

/** New attributes are optional; invalid or absent data never becomes zero activity. */
export function readBufferObservation(value: unknown): BufferObservation | undefined {
  const source = record(value), time = integer(source?.SampleTime), start = integer(source?.StartTime), generation = integer(source?.Generation)
  if (!source || time === undefined || start === undefined || generation === undefined || typeof source.RowsEnabled !== 'boolean' || typeof source.ZoneId !== 'string') return undefined
  const values: BufferObservation['values'] = {}, todayPeaks: BufferObservation['todayPeaks'] = {}
  for (const key of ['Values', 'TodayPeaks'] as const) {
    const rows = record(source[key])
    if (!rows || Object.keys(rows).length > bufferObservationMetrics.length) return undefined
    const seen = new Set<string>()
    for (const raw of Object.values(rows)) {
      const row = record(raw), metric = row?.Metric as BufferObservationMetric, value = number(row?.Value), at = integer(row?.Time)
      if (!bufferObservationMetrics.includes(metric) || seen.has(metric) || value === undefined || at === undefined) return undefined
      seen.add(metric)
      if (key === 'Values') values[metric] = value
      else todayPeaks[metric] = { value, time: at }
    }
  }
  const readTime = integer(source.ReadTime), windowMillis = integer(source.WindowMillis), statisticsStartTime = integer(source.StatisticsStartTime), todayStartTime = integer(source.TodayStartTime)
  if (windowMillis === undefined || statisticsStartTime === undefined || todayStartTime === undefined) return undefined
  return { generation: `${start}:${generation}`, sampledAt: time, windowMillis, rowsEnabled: source.RowsEnabled,
    zoneId: source.ZoneId, statisticsStartTime, todayStartTime, values, todayPeaks,
    fresh: time > 0 && readTime !== undefined && readTime >= time && readTime - time <= 2000,
    written: bufferCounterText(source.Written), attempted: bufferCounterText(source.Attempted),
    inRows: bufferCounterText(source.InRows), outRows: bufferCounterText(source.OutRows),
    errors: bufferCounterText(source.Errors), dropped: bufferCounterText(source.Dropped) }
}

export function availableBufferObservationMetrics(observation: Pick<BufferObservation, 'rowsEnabled'>) {
  return bufferObservationMetrics.filter(key => observation.rowsEnabled || key !== 'InRowsRate' && key !== 'OutRowsRate')
}

/** 小时记录的值是分钟均值，区间最大值必须从已保存的峰值及原始时间取得。 */
export function bufferObservationRangePeaks(recording: BufferObservationRecording): BufferObservation['todayPeaks'] {
  const result: BufferObservation['todayPeaks'] = {}
  for (const point of recording.points) for (const metric of bufferObservationMetrics) {
    const value = point.values[metric]
    const peak = recording.hour ? point.peaks[metric] : value === undefined ? undefined : { value, time: point.time }
    if (peak && (!result[metric] || peak.value > result[metric]!.value)) result[metric] = peak
  }
  return result
}

/** One exact Buffer is loaded on demand; bounds match the node's fixed rings. */
export function readBufferObservationRecording(bean: MBeanDescriptor, hour: boolean): BufferObservationRecording | undefined {
  const attribute = bean.attributes.find(item => item.name === (hour ? 'HourHistory' : 'RecentHistory') && item.available)
  const source = record(attribute?.value), snapshot = readBufferObservation(source?.Snapshot), rows = record(source?.Points)
  if (!snapshot || !rows || Object.keys(rows).length > (hour ? 60 : 300)) return undefined
  const points: BufferObservationPoint[] = []
  for (const raw of Object.values(rows)) {
    const row = record(raw), time = integer(row?.Time), windowMillis = integer(row?.WindowMillis)
    if (time === undefined || windowMillis === undefined) return undefined
    const values: BufferObservation['values'] = {}, peaks: BufferObservation['todayPeaks'] = {}
    for (const metric of bufferObservationMetrics) {
      const value = number(row?.[metric]), peak = number(row?.[`${metric}Peak`]), at = integer(row?.[`${metric}PeakTime`])
      if (value !== undefined) values[metric] = value
      if (peak !== undefined && at !== undefined) peaks[metric] = { value: peak, time: at }
    }
    points.push({ time, windowMillis, values, peaks })
  }
  points.sort((a, b) => a.time - b.time)
  if (points.some((point, index) => index > 0 && point.time === points[index - 1].time)) return undefined
  return { snapshot, points, hour }
}

/** Only a complete, contemporaneous selection may be added; peaks are never summed. */
export function bufferObservationTotal(observations: readonly (Pick<BufferObservation, 'sampledAt' | 'fresh' | 'values'> | undefined)[], metric: BufferObservationMetric) {
  if (!observations.length || observations.some(value => !value?.fresh || value.values[metric] === undefined)) return undefined
  const times = observations.map(value => value!.sampledAt)
  if (Math.max(...times) - Math.min(...times) > 2000) return undefined
  return observations.reduce((sum, value) => sum + value!.values[metric]!, 0)
}

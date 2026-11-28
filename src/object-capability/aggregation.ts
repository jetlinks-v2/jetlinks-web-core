import type { AggregationQueryParam } from '../types/aggregation'
import type { TimeWindow } from '../components/RuntimeDiagnostics/types'
import type { ObjectDataAccess } from './types'

/** Legacy native time grouping uses the source's declared zone, independent of browser locale. */
function sourceTime(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23' }).formatToParts(timestamp)
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day} ${value.hour}:${value.minute}:${value.second}.${value.fractionalSecond}`
}

export function objectAggregationQuery(access: ObjectDataAccess, property: string, range: TimeWindow,
  operation: string, intervalSeconds: number): AggregationQueryParam {
  if (!access.aggregate || !access.groupByTime || !access.operations.some(value => value.id === operation) ||
    !Number.isSafeInteger(intervalSeconds) || intervalSeconds <= 0) throw new Error('Unsupported aggregation')
  return {
    columns: [{ column: property, aggregation: operation }],
    groupByTime: { column: access.groupByTime.column, interval: `${intervalSeconds}s`,
      from: sourceTime(range.from, access.groupByTime.timeZone), to: sourceTime(range.to, access.groupByTime.timeZone) },
    limit: access.pageSize,
  }
}

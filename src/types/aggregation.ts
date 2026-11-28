/** Platform AggregationQueryParam. Sources declare the supported subset. */
export interface AggregationQueryParam {
  columns: Array<{ column: string; alias?: string; aggregation: string; scale?: number; defaultValue?: unknown; options?: Record<string, unknown> }>
  groupByTime?: {
    column: string
    alias?: string
    interval: string
    format?: string
    from?: string
    to?: string
    timeZone?: string
    fromTimestamp?: number
    toTimestamp?: number
  }
  groupBy?: Array<{ column: string; alias?: string }>
  filter?: Record<string, unknown>
  having?: Record<string, unknown>
  limit?: number
}

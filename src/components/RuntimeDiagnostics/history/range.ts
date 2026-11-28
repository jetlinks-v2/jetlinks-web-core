import type { TimeWindow } from '../types'

export const historyRangeSeconds = [15 * 60, 3600, 6 * 3600, 24 * 3600] as const
export const defaultHistoryRangeSeconds = historyRangeSeconds[1]
export function createHistoryWindow(seconds: number = defaultHistoryRangeSeconds): TimeWindow {
  const to = Date.now()
  return { from: to - seconds * 1000, to, relativeSeconds: seconds }
}

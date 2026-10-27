/** 诊断页面共用的采集周期；旧版 3 秒偏好迁移为 2 秒。 */
export const diagnosticSamplingIntervals = [1, 2, 5, 10, 30, 60] as const
export type DiagnosticSamplingInterval = typeof diagnosticSamplingIntervals[number]
export const defaultDiagnosticSamplingInterval: DiagnosticSamplingInterval = 2

export function isDiagnosticSamplingInterval(value: unknown): value is DiagnosticSamplingInterval {
  return diagnosticSamplingIntervals.includes(value as DiagnosticSamplingInterval)
}

export function normalizeDiagnosticSamplingInterval(value: unknown): DiagnosticSamplingInterval {
  if (value === 3) return 2
  return isDiagnosticSamplingInterval(value) ? value : defaultDiagnosticSamplingInterval
}

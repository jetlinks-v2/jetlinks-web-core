import { defineAsyncComponent } from 'vue'
import './style.css'
export const SamplingIntervalControl = defineAsyncComponent(() => import('./SamplingIntervalControl.vue'))
export { diagnosticSamplingIntervals, defaultDiagnosticSamplingInterval, isDiagnosticSamplingInterval, normalizeDiagnosticSamplingInterval } from './samplingInterval'
export type { DiagnosticSamplingInterval } from './samplingInterval'
export const RuntimeMetricsPanel = defineAsyncComponent(() => import('./RuntimeMetricsPanel.vue'))
export const RuntimeMBeanOverview = defineAsyncComponent(() => import('./RuntimeMBeanOverview.vue'))
export const ThreadViewer = defineAsyncComponent(() => import('./ThreadViewer.vue'))
export const DeviceSessionViewer = defineAsyncComponent(() => import('./DeviceSessionViewer.vue'))
export const DeviceSessionObservation = defineAsyncComponent(() => import('./DeviceSessionObservation.vue'))
export { appendDeviceObservation, deviceObservationSample, deviceObservationPoints, deviceObservationActivity, deviceObservationColors, deviceObservationMetrics } from './device-sessions/observation'
export type { DeviceObservationEntry, DeviceObservationMetric, DeviceObservationSample, DeviceObservationPoint } from './device-sessions/observation'
export const JvmDiagnosticPanel = defineAsyncComponent(() => import('./JvmDiagnosticPanel.vue'))
export const FlameGraphViewer = defineAsyncComponent(() => import('./FlameGraphViewer.vue'))
export const MBeanBrowser = defineAsyncComponent(() => import('./MBeanBrowser.vue'))
export const TraceViewer = defineAsyncComponent(() => import('./TraceViewer.vue'))
export const LogViewer = defineAsyncComponent(() => import('./LogViewer.vue'))
export { registerMBeanRenderer } from './registry'
export { useMBeanRendererContext } from './mbean/context'
export { createFlameGraphHtml } from './flameGraphHtml'
export type { FlameExportOptions } from './flameGraphHtml'
export { createJvmDiagnosticReport } from './jvmDiagnosticReport'
export { createJvmDiagnosticHtml } from './jvmDiagnosticHtml'
export type { JvmDiagnosticHtmlOptions } from './jvmDiagnosticHtml'
export type { JvmDiagnosticExport, JvmDiagnosticReportLabels } from './jvmDiagnosticReport'
export { nanosText, nanosBetween, traceRows } from './utils'
export { bufferHistoryPoints, bufferThroughputPoints } from './buffer/history'
export type { BufferHistoryPoint, BufferThroughputPoint } from './buffer/history'
export { bufferCounterTotal } from './buffer/counters'
export type * from './types'

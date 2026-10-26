import { defineAsyncComponent } from 'vue'
import './style.css'
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
export { nanosText, nanosBetween, traceRows } from './utils'
export { bufferHistoryPoints, bufferThroughputPoints } from './buffer/history'
export type { BufferHistoryPoint, BufferThroughputPoint } from './buffer/history'
export { bufferCounterTotal } from './buffer/counters'
export type * from './types'

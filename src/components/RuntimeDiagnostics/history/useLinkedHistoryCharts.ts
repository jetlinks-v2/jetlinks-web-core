import { computed, onActivated, onDeactivated, onScopeDispose, watch, type Ref } from 'vue'
import type { ECharts } from 'echarts/core'
import type { MetricChart, TimeWindow } from '../types'

interface ZoomEvent { start?: number; end?: number; startValue?: number; endValue?: number; batch?: ZoomEvent[] }
interface PointerEvent { axesInfo?: Array<{ axisDim?: string; axisIndex?: number; value?: number }> }
interface ChartBinding {
  instance: ECharts
  listeners?: { pointer: (event: unknown) => void; zoom: (event: unknown) => void; leave: () => void }
}

/** 仅联动本历史区的时间游标与范围；实例由 ready 信号注册，不猜测异步初始化时机。 */
export function useLinkedHistoryCharts(charts: Ref<MetricChart[]>, range: Ref<TimeWindow | undefined>, change: (range: TimeWindow) => void) {
  const bindings = new Map<string, ChartBinding>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let active = true, disposed = false
  let zoomRange: TimeWindow | undefined
  let pendingRange: TimeWindow | undefined
  const extent = computed(() => {
    if (range.value) return range.value
    let from = Infinity, to = -Infinity
    for (const chart of charts.value) for (const series of chart.series) for (const point of series.samples) {
      if (Number.isFinite(point.timestamp)) { from = Math.min(from, point.timestamp); to = Math.max(to, point.timestamp) }
    }
    return Number.isFinite(from) && Number.isFinite(to) ? { from, to } : undefined
  })

  function dispatch(instance: ECharts, action: Parameters<ECharts['dispatchAction']>[0]) {
    if (!instance.isDisposed()) instance.dispatchAction({ ...action, escapeConnect: true }, { silent: true })
  }

  function hidePointers(source?: ECharts) {
    for (const { instance } of bindings.values()) if (instance !== source) {
      dispatch(instance, { type: 'updateAxisPointer', currTrigger: 'leave' })
      dispatch(instance, { type: 'hideTip' })
    }
  }

  /** 传时间值而非数据下标或像素，容许各图采样密度、坐标宽度不同。 */
  function pointer(source: ECharts, payload: unknown) {
    if (!payload || typeof payload !== 'object') return
    const axes = (payload as PointerEvent).axesInfo
    if (!axes?.length) { hidePointers(source); return }
    const value = axes.find(axis => axis.axisDim === 'x')?.value
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    for (const { instance } of bindings.values()) if (instance !== source && !instance.isDisposed()) {
      const x = instance.convertToPixel({ xAxisIndex: 0 }, value)
      const bottom = instance.convertToPixel({ yAxisIndex: 0 }, 0)
      if (typeof x !== 'number' || typeof bottom !== 'number' || !Number.isFinite(x) || !Number.isFinite(bottom)) continue
      dispatch(instance, { type: 'updateAxisPointer', x, y: bottom - 1, axesInfo: [{ axisDim: 'x', axisIndex: 0, value }] })
    }
  }

  function applyZoom(instance: ECharts) {
    dispatch(instance, zoomRange
      ? { type: 'dataZoom', dataZoomId: 'window', startValue: zoomRange.from, endValue: zoomRange.to }
      : { type: 'dataZoom', dataZoomId: 'window', start: 0, end: 100 })
  }

  function scheduleRangeChange() {
    clearTimeout(timer)
    if (!active || !pendingRange) return
    timer = setTimeout(() => {
      const selected = pendingRange
      pendingRange = undefined
      if (!disposed && active && selected) change(selected)
    }, 180)
  }

  /** 缩放立即对齐其他图，查询范围仅防抖提交一次；同步动作静默，避免回环和重复请求。 */
  function zoom(source: ECharts, payload: unknown) {
    if (!payload || typeof payload !== 'object') return
    const window = extent.value
    if (!window || window.to <= window.from) return
    const event = payload as ZoomEvent, data = event.batch?.[0] ?? event
    const from = data.startValue ?? window.from + (window.to - window.from) * (data.start ?? 0) / 100
    const to = data.endValue ?? window.from + (window.to - window.from) * (data.end ?? 100) / 100
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return
    zoomRange = { from: Math.round(from), to: Math.round(to) }
    for (const { instance } of bindings.values()) if (instance !== source) applyZoom(instance)
    if (from === window.from && to === window.to) {
      pendingRange = undefined
      clearTimeout(timer)
      return
    }
    pendingRange = zoomRange
    scheduleRangeChange()
  }

  function detach(binding: ChartBinding) {
    if (!binding.listeners) return
    const { instance, listeners } = binding
    if (!instance.isDisposed()) {
      instance.off('updateAxisPointer', listeners.pointer)
      instance.off('datazoom', listeners.zoom)
      instance.off('globalout', listeners.leave)
    }
    binding.listeners = undefined
  }

  function bind(binding: ChartBinding) {
    if (!active || binding.listeners || binding.instance.isDisposed()) return
    const { instance } = binding
    const listeners = { pointer: (event: unknown) => pointer(instance, event), zoom: (event: unknown) => zoom(instance, event), leave: () => hidePointers(instance) }
    instance.on('updateAxisPointer', listeners.pointer)
    instance.on('datazoom', listeners.zoom)
    instance.on('globalout', listeners.leave)
    binding.listeners = listeners
    if (zoomRange) applyZoom(instance)
  }

  function register(key: string, instance: ECharts) {
    if (disposed || instance.isDisposed()) return
    const previous = bindings.get(key)
    if (previous?.instance === instance) return
    if (previous) detach(previous)
    const binding = { instance }
    bindings.set(key, binding)
    bind(binding)
  }

  function unregister(key: string, instance: ECharts) {
    const binding = bindings.get(key)
    if (binding?.instance !== instance) return
    detach(binding)
    bindings.delete(key)
  }

  // 查询范围改变后所有图使用新的完整窗口；样本刷新但范围不变时不重置用户交互。
  watch([() => extent.value?.from, () => extent.value?.to], () => {
    zoomRange = pendingRange = undefined
    clearTimeout(timer)
    if (active) { hidePointers(); for (const { instance } of bindings.values()) applyZoom(instance) }
  }, { flush: 'post' })
  onDeactivated(() => {
    active = false
    clearTimeout(timer)
    hidePointers()
    bindings.forEach(detach)
  })
  onActivated(() => {
    active = true
    bindings.forEach(bind)
    scheduleRangeChange()
  })
  onScopeDispose(() => {
    disposed = true
    clearTimeout(timer)
    bindings.forEach(detach)
    bindings.clear()
  })
  return { register, unregister, extent }
}

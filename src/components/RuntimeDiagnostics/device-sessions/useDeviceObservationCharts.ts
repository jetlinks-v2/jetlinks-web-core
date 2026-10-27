import { onScopeDispose, watch, type Ref } from 'vue'
import type { ECharts } from 'echarts/core'

/** 只联动当前设备观测区的真实时间游标；图例选择由宿主共享状态统一驱动。 */
export function useDeviceObservationCharts(active: Ref<boolean>) {
  let disposed = false
  const bindings = new Map<string, { instance: ECharts; pointer: (event: unknown) => void; leave: () => void }>()
  const dispatch = (instance: ECharts, action: Parameters<ECharts['dispatchAction']>[0]) => {
    if (!instance.isDisposed()) instance.dispatchAction({ ...action, escapeConnect: true }, { silent: true })
  }
  function hide(source?: ECharts) {
    for (const { instance } of bindings.values()) if (instance !== source) {
      dispatch(instance, { type: 'updateAxisPointer', currTrigger: 'leave' })
      dispatch(instance, { type: 'hideTip' })
    }
  }
  function unregister(key: string, instance: ECharts) {
    const binding = bindings.get(key)
    if (binding?.instance !== instance) return
    if (!instance.isDisposed()) { instance.off('updateAxisPointer', binding.pointer); instance.off('globalout', binding.leave) }
    bindings.delete(key)
  }
  function register(key: string, instance: ECharts) {
    if (disposed || instance.isDisposed() || bindings.get(key)?.instance === instance) return
    const previous = bindings.get(key)
    if (previous) unregister(key, previous.instance)
    const pointer = (event: unknown) => {
      if (!active.value || !event || typeof event !== 'object') return
      const axes = (event as { axesInfo?: Array<{ axisDim?: string; value?: number }> }).axesInfo
      const time = axes?.find(axis => axis.axisDim === 'x')?.value
      if (typeof time !== 'number' || !Number.isFinite(time)) { hide(instance); return }
      for (const { instance: target } of bindings.values()) if (target !== instance && !target.isDisposed()) {
        const x = target.convertToPixel({ xAxisIndex: 0 }, time), bottom = target.convertToPixel({ yAxisIndex: 0 }, 0)
        if (typeof x === 'number' && typeof bottom === 'number' && Number.isFinite(x) && Number.isFinite(bottom)) {
          dispatch(target, { type: 'updateAxisPointer', x, y: bottom - 1, axesInfo: [{ axisDim: 'x', axisIndex: 0, value: time }] })
        }
      }
    }
    const leave = () => hide(instance)
    bindings.set(key, { instance, pointer, leave })
    instance.on('updateAxisPointer', pointer); instance.on('globalout', leave)
  }
  watch(active, enabled => { if (!enabled) hide() }, { flush: 'sync' })
  onScopeDispose(() => { disposed = true; hide(); for (const [key, { instance }] of bindings) unregister(key, instance) })
  return { register, unregister }
}

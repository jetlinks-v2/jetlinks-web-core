import echarts from "./library"
import { type Ref, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, unref, watch } from 'vue'
import { cloneDeep, debounce } from 'lodash-es'
import { createMeasuredEchartsLayout } from './measuredLayout'
import type { EchartsLayoutProfile } from './geometryDefaults'

export type { EchartsLayoutProfile } from './geometryDefaults'

export type EchartsRenderErrorStage = 'init' | 'setOption' | 'resize' | 'export'
export type EchartsRenderer = 'canvas' | 'svg'
export type EchartsEvents = Readonly<Record<string, (params: unknown) => void>>

export interface EchartsLifecycleOptions {
  onError?: (error: unknown, stage: EchartsRenderErrorStage) => void
  /** 首次配置成功（或无配置初始化）后通知；隐藏容器延迟创建也走同一入口。 */
  onReady?: (instance: echarts.ECharts) => void
  onDispose?: (instance: echarts.ECharts) => void
}

export interface EchartsProps {
  option?: echarts.EChartsCoreOption
  library?: Parameters<typeof echarts.use>[0]
  layoutProfile?: EchartsLayoutProfile
  renderer?: EchartsRenderer
  /** 可选原生事件；实例重建或事件配置变化时成对绑定和释放。 */
  events?: EchartsEvents
}

/** Render canonical options, optionally deriving measured presentation anchors on a renderer copy. */
export const useEcharts = (
  el: Ref<HTMLDivElement | undefined>,
  props: EchartsProps = {},
  lifecycle: EchartsLifecycleOptions = {}
) => {
  let echartsInstance: echarts.ECharts | null = null  // echarts实例
  let resizeObserver: ResizeObserver | null = null
  let measuredLayout: ReturnType<typeof createMeasuredEchartsLayout> | undefined
  let inactive = false, hidden = false, disposed = false
  let pendingOption: echarts.EChartsCoreOption | undefined
  let boundEvents: EchartsEvents = {}
  let ready = false

  function notifyReady() {
    if (!echartsInstance || ready) return
    ready = true
    lifecycle.onReady?.(echartsInstance)
  }

  function releaseEvents(instance: echarts.ECharts) {
    for (const [event, handler] of Object.entries(boundEvents)) instance.off(event, handler)
    boundEvents = {}
  }

  function bindEvents() {
    if (!echartsInstance) return
    releaseEvents(echartsInstance)
    boundEvents = { ...props.events }
    for (const [event, handler] of Object.entries(boundEvents)) echartsInstance.on(event, handler)
  }

  function size() {
    const element = unref(el)
    if (inactive || !element) return undefined
    // 使用未变换的布局尺寸；rect包含祖先transform，交给ECharts会再次缩放画布。
    const width = element.clientWidth, height = element.clientHeight
    return width > 0 && height > 0 ? { width, height } : undefined
  }

  const reportError = (error: unknown, stage: EchartsRenderErrorStage) => {
    lifecycle.onError?.(error, stage)
  }

  const disposeInstance = () => {
    const instance = echartsInstance
    if (instance) releaseEvents(instance)
    echartsInstance = null
    ready = false
    if (instance) lifecycle.onDispose?.(instance)
    measuredLayout?.dispose()
    measuredLayout = undefined
    try {
      instance?.dispose()
    } catch {
      // Cleanup is best-effort; the original render error remains the actionable failure.
    }
  }

  if (props.library) { // 添加依赖包
    try {
      echarts.use(props.library)
    } catch (error) {
      reportError(error, 'init')
    }
  }

  // 初始化
  function init() {
    const _el = unref(el)
    if (!_el || echartsInstance) return !!echartsInstance
    const measured = size()
    if (!measured) { hidden = true; return false }
    try {
      echartsInstance = echarts.init(_el, undefined, { renderer: props.renderer ?? 'canvas', ...measured })
      bindEvents()
      measuredLayout = createMeasuredEchartsLayout(echartsInstance, echarts, props.layoutProfile === 'presentation')
      return true
    } catch (error) {
      reportError(error, 'init')
      return false
    }
  }

  // 配置option
  function setOption(option: echarts.EChartsCoreOption) {
    if (disposed) return false
    if (!size()) { pendingOption = option; hidden = true; return false }
    if (!echartsInstance && !init()) return false
    try {
      pendingOption = undefined
      const renderOption = props.layoutProfile === 'presentation' ? cloneDeep(option || {}) : option || {}
      measuredLayout?.prepare(renderOption)
      echartsInstance?.setOption(renderOption)
      measuredLayout?.apply()
      notifyReady()
      return true
    } catch (error) {
      // Invalid model/user options may leave ECharts partially initialized; dispose it to stop resize retries.
      disposeInstance()
      reportError(error, 'setOption')
      return false
    }
  }

  function getDataURL(options?: Parameters<echarts.ECharts['getDataURL']>[0]) {
    try {
      return echartsInstance?.getDataURL(options)
    } catch (error) {
      reportError(error, 'export')
      return undefined
    }
  }

  // 更新大小
  function resizeNow() {
    const measured = size()
    if (!measured) { hidden = true; return }
    try {
      hidden = false
      if (!echartsInstance) { const option = pendingOption ?? props.option; if (option) setOption(option); else if (init()) notifyReady(); return }
      echartsInstance.resize?.({ ...measured, animation: { duration: 0 } })
      measuredLayout?.apply()
      if (pendingOption) setOption(pendingOption)
    } catch (error) {
      disposeInstance()
      reportError(error, 'resize')
    }
  }
  const echartsResize = debounce(resizeNow, 300)

  // 释放资源
  function dispose() {
    disposed = true
    echartsResize.cancel()
    resizeObserver?.disconnect()
    resizeObserver = null
    disposeInstance()
  }

  // 监听元素大小变化
  function watchEl() {
    const _el = unref(el)
    if (!_el) return


    // 避免重复监听
    if (resizeObserver) {
      resizeObserver.disconnect()
    }

    resizeObserver = new ResizeObserver(() => {
      if (!size()) { hidden = true; echartsResize.cancel(); return }
      // display:none/KeepAlive恢复在本次布局帧修正；不能先绘出被压成零的旧画布。
      if (hidden || !echartsInstance) { echartsResize.cancel(); resizeNow() }
      else echartsResize()
    })
    resizeObserver.observe(_el)
  }


  onMounted(() => {
    if (props.option) setOption(props.option)
    else if (init()) notifyReady()
    window.addEventListener('resize', echartsResize)
    watchEl()
  })

  onUnmounted(() => {
    window.removeEventListener('resize', echartsResize)
    dispose()
  })
  onDeactivated(() => { inactive = true; hidden = true; echartsResize.cancel() })
  onActivated(async () => { inactive = false; await nextTick(); if (!disposed && size()) { echartsResize.cancel(); resizeNow() } })

  // 监听 props.option 变化时更新
  watch(
    () => props.option,
    (newVal) => {
      if (newVal) setOption(newVal)
    },
    { deep: true }
  )

  // Event replacement changes listeners without replaying source data or resetting interactions.
  watch(() => props.events, bindEvents, { deep: true })

  // Changing the presentation profile must not replay source data or reset current interactions.
  watch(() => props.layoutProfile, profile => {
    if (!echartsInstance) return
    try {
      measuredLayout?.setEnabled(profile === 'presentation')
      resizeNow()
      measuredLayout?.apply()
    } catch (error) {
      disposeInstance()
      reportError(error, 'setOption')
    }
  })

  // Renderer变更需重建实例；getOption保留用户缩放、图例选择等当前交互状态。
  watch(() => props.renderer, () => {
    if (!echartsInstance) return
    const option = echartsInstance.getOption()
    disposeInstance()
    setOption(option)
  })

  return {
    setOption,
    getDataURL
  }
}

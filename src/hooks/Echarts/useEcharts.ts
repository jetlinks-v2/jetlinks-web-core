import echarts from "./library"
import { type Ref, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, unref, watch } from 'vue'
import { cloneDeep, debounce } from 'lodash-es'
import { createMeasuredEchartsLayout } from './measuredLayout'
import type { EchartsLayoutProfile } from './geometryDefaults'
import { composeStreamOption } from './streamOption'

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
  /** Immutable complete data snapshot; shallow-watched and coalesced, with stable component ids. */
  dataOption?: echarts.EChartsCoreOption
  /** Retain only the latest pending snapshot outside the viewport. */
  deferOffscreen?: boolean
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
  let intersectionObserver: IntersectionObserver | undefined
  let measuredLayout: ReturnType<typeof createMeasuredEchartsLayout> | undefined
  let inactive = false, hidden = false, disposed = false
  let pendingOption: echarts.EChartsCoreOption | undefined
  let pendingData = false, offscreen = false
  let boundEvents: EchartsEvents = {}
  let ready = false
  let measuredSize: { width: number; height: number } | undefined
  let renderedSize: { width: number; height: number } | undefined
  let optionFrame: number | undefined
  let mounted = false

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

  /** Layout is measured on mount/resize/restore, never between successive chart writes. */
  function measureSize() {
    const element = unref(el)
    if (inactive || !element) { measuredSize = undefined; return }
    // 使用未变换的布局尺寸；rect包含祖先transform，交给ECharts会再次缩放画布。
    const width = element.clientWidth, height = element.clientHeight
    measuredSize = width > 0 && height > 0 ? { width, height } : undefined
    return measuredSize
  }

  const size = () => inactive ? undefined : measuredSize
  function cancelOptionFrame() {
    if (optionFrame !== undefined) window.cancelAnimationFrame(optionFrame)
    optionFrame = undefined
  }

  /** Streaming changes in the same paint frame share one write of the latest canonical option. */
  function scheduleOption(option?: echarts.EChartsCoreOption) {
    if (disposed) return
    if (option) pendingOption = option
    else pendingData = true
    if (!size() || inactive || offscreen) return
    if (typeof window.requestAnimationFrame !== 'function') { flushPending(); return }
    if (optionFrame !== undefined) return
    optionFrame = window.requestAnimationFrame(() => {
      optionFrame = undefined
      flushPending()
    })
  }

  const reportError = (error: unknown, stage: EchartsRenderErrorStage) => {
    lifecycle.onError?.(error, stage)
  }

  const disposeInstance = () => {
    const instance = echartsInstance
    if (instance) releaseEvents(instance)
    echartsInstance = null
    renderedSize = undefined
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
      renderedSize = measured
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
    return renderOption(option, false)
  }

  function flushPending(force = false) {
    if (pendingOption || !echartsInstance) return renderOption(pendingOption ?? props.option ?? {}, false, force)
    if (pendingData && props.dataOption) return renderOption(props.dataOption, true, force)
    pendingData = false
    return true
  }

  function renderOption(option: echarts.EChartsCoreOption, dataOnly: boolean, force = false) {
    if (disposed) return false
    cancelOptionFrame()
    // Explicit calls before mount still initialize an already available element.
    if (!mounted && !size()) measureSize()
    if (!size() || offscreen && !force) {
      if (dataOnly) pendingData = true; else pendingOption = option
      hidden = !size()
      return false
    }
    if (!echartsInstance && !init()) return false
    try {
      pendingOption = undefined
      pendingData = false
      const composed = dataOnly ? option : composeStreamOption(option, props.dataOption)
      const renderOption = props.layoutProfile === 'presentation' && !dataOnly ? cloneDeep(composed) : composed
      if (!dataOnly) measuredLayout?.prepare(renderOption)
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
      // An export requested before the next paint must include the latest streaming option.
      if ((pendingOption || pendingData) && size()) flushPending(true)
      return echartsInstance?.getDataURL(options)
    } catch (error) {
      reportError(error, 'export')
      return undefined
    }
  }

  // 更新大小
  function resizeNow() {
    const measured = measureSize()
    if (!measured) { hidden = true; return }
    if (offscreen) return
    try {
      hidden = false
      if (!echartsInstance) { if (pendingOption || props.option || props.dataOption) flushPending(); else if (init()) notifyReady(); return }
      if (measured.width !== renderedSize?.width || measured.height !== renderedSize?.height) {
        echartsInstance.resize?.({ ...measured, animation: { duration: 0 } })
        renderedSize = measured
        measuredLayout?.apply()
      }
      if (pendingOption || pendingData) flushPending()
    } catch (error) {
      disposeInstance()
      reportError(error, 'resize')
    }
  }
  const echartsResize = debounce(resizeNow, 300)

  // 释放资源
  function dispose() {
    disposed = true
    cancelOptionFrame()
    echartsResize.cancel()
    resizeObserver?.disconnect()
    resizeObserver = null
    intersectionObserver?.disconnect()
    intersectionObserver = undefined
    disposeInstance()
  }

  function watchVisibility() {
    intersectionObserver?.disconnect()
    intersectionObserver = undefined
    offscreen = !!props.deferOffscreen && typeof IntersectionObserver !== 'undefined'
    const element = unref(el)
    if (offscreen && element) {
      const observer = new IntersectionObserver(entries => {
        if (disposed || intersectionObserver !== observer) return
        const entry = entries.find(item => item.target === element)
        if (!entry) return
        offscreen = !entry.isIntersecting
        if (offscreen) { cancelOptionFrame(); echartsResize.cancel() }
        else if (!inactive) resizeNow()
      })
      intersectionObserver = observer
      observer.observe(element)
    }
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
      const measured = measureSize()
      if (!measured) { hidden = true; echartsResize.cancel(); cancelOptionFrame(); return }
      // display:none/KeepAlive恢复在本次布局帧修正；不能先绘出被压成零的旧画布。
      if (hidden || !echartsInstance) { echartsResize.cancel(); resizeNow() }
      else if (measured.width !== renderedSize?.width || measured.height !== renderedSize?.height) echartsResize()
    })
    resizeObserver.observe(_el)
  }


  onMounted(() => {
    mounted = true
    measureSize()
    watchVisibility()
    if (props.option || props.dataOption) setOption(props.option ?? {})
    else if (!offscreen && init()) notifyReady()
    window.addEventListener('resize', echartsResize)
    watchEl()
  })

  onUnmounted(() => {
    window.removeEventListener('resize', echartsResize)
    dispose()
  })
  onDeactivated(() => { inactive = true; hidden = true; measuredSize = undefined; cancelOptionFrame(); echartsResize.cancel() })
  onActivated(async () => { inactive = false; await nextTick(); if (!disposed) { echartsResize.cancel(); resizeNow() } })

  // 监听 props.option 变化时更新
  watch(
    () => props.option,
    (newVal) => {
      if (newVal) scheduleOption(newVal)
    },
    { deep: true, flush: 'post' }
  )
  watch(() => props.dataOption, () => scheduleOption(), { flush: 'post' })
  watch(() => props.deferOffscreen, () => { if (mounted) { watchVisibility(); if (!offscreen) resizeNow() } })

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
    if (pendingOption || pendingData) flushPending(true)
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

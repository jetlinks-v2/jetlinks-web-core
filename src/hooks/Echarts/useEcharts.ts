import echarts from "./library"
import { Ref, onMounted, onUnmounted, unref } from 'vue'
import { debounce } from 'lodash-es'

export type EchartsRenderErrorStage = 'init' | 'setOption' | 'resize' | 'export'

export interface EchartsLifecycleOptions {
  onError?: (error: unknown, stage: EchartsRenderErrorStage) => void
}

export const useEcharts = (
  el: Ref<HTMLDivElement | undefined>,
  props: any = {},
  lifecycle: EchartsLifecycleOptions = {}
) => {
  let echartsInstance: echarts.ECharts | null = null  // echarts实例
  let resizeObserver: ResizeObserver | null = null

  const reportError = (error: unknown, stage: EchartsRenderErrorStage) => {
    lifecycle.onError?.(error, stage)
  }

  const disposeInstance = () => {
    const instance = echartsInstance
    echartsInstance = null
    try {
      instance?.dispose()
    } catch {
      // Cleanup is best-effort; the original render error remains the actionable failure.
    }
  }

  if (props?.library?.length) { // 添加依赖包
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
    try {
      echartsInstance = echarts.init(_el)
      return true
    } catch (error) {
      reportError(error, 'init')
      return false
    }
  }

  // 配置option
  function setOption(option: any) {
    if (!echartsInstance && !init()) return false
    try {
      echartsInstance?.setOption(option || {})
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
  const echartsResize = debounce(() => {
    try {
      echartsInstance?.resize?.()
    } catch (error) {
      disposeInstance()
      reportError(error, 'resize')
    }
  }, 300)

  // 释放资源
  function dispose() {
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

    resizeObserver = new ResizeObserver(() => echartsResize())
    resizeObserver.observe(_el)
  }


  onMounted(() => {
    if (props.option) setOption(props.option)
    else init()
    window.addEventListener('resize', echartsResize)
    watchEl()
  })

  onUnmounted(() => {
    window.removeEventListener('resize', echartsResize)
    dispose()
  })

  // 监听 props.option 变化时更新
  watch(
    () => props.option,
    (newVal) => {
      if (newVal) setOption(newVal)
    },
    { deep: true }
  )

  return {
    setOption,
    getDataURL
  }
}

import { onBeforeUnmount, onMounted, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'

interface ContentFitOptions {
  viewport: Ref<HTMLElement | undefined>
  content: Ref<HTMLElement | undefined>
  minSize: MaybeRefOrGetter<number>
  maxSize: MaybeRefOrGetter<number>
  /** 只读缩略图可优先适配分支高度，默认保留原有宽度适配。 */
  axis?: 'width' | 'height' | 'both'
}

/** 根据未缩放的布局尺寸调整字号，保留原生坐标；完整查看方式由宿主提供。 */
export function useContentFit(options: ContentFitOptions) {
  const fontSize = ref(toValue(options.maxSize))
  let observer: ResizeObserver | undefined, frame: number | undefined, disposed = false
  let fonts: FontFaceSet | undefined
  function measure() {
    frame = undefined
    const viewport = options.viewport.value, content = options.content.value
    if (!viewport?.clientWidth || !content || typeof getComputedStyle === 'undefined') return
    const style = getComputedStyle(content)
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
    const current = parseFloat(style.fontSize) || fontSize.value
    // 使用布局尺寸，避免画布 transform 缩放再次影响公式字号。
    const natural = Math.max(content.scrollWidth, content.offsetWidth || 0) - padding
    if (natural <= 0) return
    const base = toValue(options.maxSize)
    const height = options.axis !== undefined && options.axis !== 'width' && viewport.clientHeight ? Math.max(content.scrollHeight,content.offsetHeight || 0) : 0
    const ratio = Math.min(options.axis === 'height' ? Infinity : Math.max(0, viewport.clientWidth - padding - 2) / natural,
      height ? Math.max(0,viewport.clientHeight - 2) / height : Infinity)
    const next = Math.round(Math.max(toValue(options.minSize), Math.min(base,
      current * ratio)) * 10) / 10
    if (Math.abs(fontSize.value - next) > 0.1) fontSize.value = next
  }
  // ResizeObserver、内容更新及字体加载合并到同一布局帧，不创建轮询或额外渲染实例。
  function refresh() {
    if (!disposed && frame === undefined && typeof requestAnimationFrame !== 'undefined') frame = requestAnimationFrame(measure)
  }
  onMounted(() => {
    if (typeof ResizeObserver !== 'undefined') observer = new ResizeObserver(refresh)
    watch([options.viewport, options.content, () => toValue(options.minSize), () => toValue(options.maxSize)], () => {
      observer?.disconnect()
      if (options.viewport.value) observer?.observe(options.viewport.value)
      if (options.content.value) observer?.observe(options.content.value)
      refresh()
    }, { immediate: true, flush: 'post' })
    fonts = typeof document === 'undefined' ? undefined : document.fonts
    fonts?.addEventListener('loadingdone', refresh)
    void fonts?.ready.then(refresh)
  })
  onBeforeUnmount(() => {
    disposed = true
    observer?.disconnect()
    fonts?.removeEventListener('loadingdone', refresh)
    if (frame !== undefined) cancelAnimationFrame(frame)
  })
  return { fontSize, refresh }
}

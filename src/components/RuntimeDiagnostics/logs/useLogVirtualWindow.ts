import { computed, nextTick, onActivated, onDeactivated, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { LogEntry } from '../types'

const estimatedHeight = 34, overscan = 240
type Anchor = { id: string; offset: number; index: number } | 'end'

/** 未挂载行使用估算高度；测量以记录身份缓存，不受前后窗口合并改变下标的影响。 */
export function logRowOffsets(entries: readonly Pick<LogEntry, 'id'>[], heights: ReadonlyMap<string, number>) {
  const offsets = [0]
  for (const entry of entries) offsets.push(offsets[offsets.length - 1] + (heights.get(entry.id) ?? estimatedHeight))
  return offsets
}

/** 查找包含目标位置的行；末尾与空列表都返回有界下标。 */
export function logRowAt(offsets: readonly number[], position: number) {
  let low = 0, high = Math.max(0, offsets.length - 2)
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (offsets[middle] <= position) low = middle
    else high = middle - 1
  }
  return low
}

/** 只挂载视口及上下缓冲，零尺寸初次挂载也不退回全量渲染。 */
export function logWindowRange(offsets: readonly number[], top: number, height: number) {
  const count = offsets.length - 1, total = offsets[count]
  const start = logRowAt(offsets, Math.max(0, top - overscan))
  const end = count ? Math.min(count, logRowAt(offsets, top + (height || 480) + overscan) + 1) : 0
  return { start, end, before: offsets[start], after: total - offsets[end] }
}

/** 变高日志的视口、测量与阅读锚点；不请求数据，程序定位不会成为滚动加载意图。 */
export function useLogVirtualWindow(
  element: Ref<HTMLElement | undefined>, entries: Ref<LogEntry[]>,
  active: MaybeRefOrGetter<boolean>, layout: MaybeRefOrGetter<boolean>,
) {
  const leading = ref<HTMLElement>(), top = ref(0), height = ref(0), head = ref(0), measured = ref(0)
  const heights = new Map<string, number>(), rows = new Map<string, HTMLElement>()
  let width = 0, activated = true, target: Anchor | undefined, pending: Anchor | undefined, suspended: Anchor | undefined
  let frame: number | undefined, version = 0, scheduled = false, writtenTop: number | undefined
  const enabled = () => activated && toValue(active)
  const offsets = computed(() => { measured.value; return logRowOffsets(entries.value, heights) })
  const range = computed(() => logWindowRange(offsets.value, Math.max(0, top.value - head.value), height.value))
  const items = computed(() => entries.value.slice(range.value.start, range.value.end).map((entry, index) => ({ entry, index: range.value.start + index })))

  /** 位置来自滚动事件和既有高度索引，捕获时不强制浏览器计算行布局。 */
  function capture(data = entries.value): Anchor | undefined {
    if (!data.length) return
    const positions = data === entries.value ? offsets.value : logRowOffsets(data, heights)
    const index = logRowAt(positions, Math.max(0, top.value - head.value))
    return { id: data[index].id, offset: top.value - head.value - positions[index], index }
  }

  /** 先更新可见区，再在 DOM 提交后校正；后续行高测量继续保持同一目标。 */
  function align(anchor: Anchor) {
    const container = element.value
    if (!enabled() || !container?.isConnected) return
    // 恢复时 DOM 可能仍无布局；保留身份，等容器观察通知后再定位。
    if (container.clientHeight <= 0) { pending = anchor; return }
    const found = anchor === 'end' ? -1 : entries.value.findIndex(entry => entry.id === anchor.id)
    const index = anchor === 'end' ? 0 : found < 0 ? Math.max(0, Math.min(anchor.index, entries.value.length - 1)) : found
    const within = anchor === 'end' ? 0 : Math.min(anchor.offset, Math.max(0, (offsets.value[index + 1] ?? 0) - offsets.value[index] - 1))
    const position = anchor === 'end' ? container.scrollHeight - container.clientHeight
      : head.value + offsets.value[index] + within
    container.scrollTop = Math.max(0, position)
    writtenTop = top.value = container.scrollTop
  }

  function cancel() {
    version++; scheduled = false; pending = undefined
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
  }

  function queue(anchor = target ?? capture()) {
    if (!anchor || !enabled()) return
    pending = anchor
    if (scheduled) return
    scheduled = true
    const current = version
    void nextTick(() => {
      if (current !== version || !enabled()) return
      frame = requestAnimationFrame(() => {
        frame = undefined; scheduled = false
        const next = pending
        pending = undefined
        if (current === version && next) align(next)
      })
    })
  }

  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(changes => {
    if (!enabled()) return
    const anchor = target ?? pending ?? capture()
    let changed = false
    for (const change of changes) {
      const box = change.borderBoxSize?.[0]
      const size = box?.blockSize ?? change.contentRect.height
      if (change.target === element.value) {
        if (size <= 0 || change.contentRect.width <= 0) continue
        height.value = size
        const nextWidth = change.contentRect.width
        if (width && width !== nextWidth) {
          heights.clear(); changed = true
          // 宽度变化后，未改变高度的可见行也要重新提交测量，不能保留旧宽度的估算。
          for (const row of rows.values()) { observer?.unobserve(row); observer?.observe(row) }
        }
        width = nextWidth
      } else if (change.target === leading.value) {
        head.value = size
      } else {
        const id = (change.target as HTMLElement).dataset.logId
        if (id && rows.get(id) === change.target && size > 0 && heights.get(id) !== size) {
          heights.set(id, size); changed = true
        }
      }
    }
    if (changed) measured.value++
    queue(anchor)
  })

  function setRow(id: string, value: unknown) {
    const previous = rows.get(id), row = value as HTMLElement | null
    if (previous === row) return
    if (previous) observer?.unobserve(previous)
    if (row) { rows.set(id, row); observer?.observe(row) }
    else rows.delete(id)
  }

  /** 主动阅读取消查找 / 跟随定位，测量校正仍由当前首个可见行接续。 */
  function readIntent() { target = undefined; writtenTop = undefined; cancel() }

  /** 返回 true 表示程序滚动；调用方仍可记位置，但不能因此暂停跟随或请求下一窗口。 */
  function onScroll() {
    const container = element.value
    if (!enabled() || !container) return true
    // DOM 提交 / 行高测量会让浏览器钳制上一次写入值；仍属定位过程，不能误判为主动阅读。
    // wheel、pointerdown、keydown 已通过 readIntent 清除定位目标与写入标记。
    const programmatic = target !== undefined || writtenTop !== undefined
    if (!programmatic) { target = undefined; cancel() }
    top.value = container.scrollTop; writtenTop = undefined
    return programmatic
  }

  function scrollTo(id: string) {
    const index = entries.value.findIndex(entry => entry.id === id)
    if (index < 0) return
    target = { id, index, offset: 0 }
    align(target); queue(target)
  }
  function bottom() { target = 'end'; align(target); queue(target) }

  /** 展开状态可能属于已离开视口的行，先废弃其旧高度，再由可见行观察器确认。 */
  function invalidate(ids?: string[]) {
    const anchor = target ?? pending ?? capture()
    if (ids) ids.forEach(id => heights.delete(id))
    else heights.clear()
    for (const [id, row] of rows) if (!ids || ids.includes(id)) { observer?.unobserve(row); observer?.observe(row) }
    measured.value++
    queue(anchor)
  }

  function reset() { target = undefined; suspended = undefined; writtenTop = undefined; top.value = 0; heights.clear(); measured.value++; cancel() }

  watch(element, (current, previous) => {
    if (previous) observer?.unobserve(previous)
    if (current) observer?.observe(current)
  }, { flush: 'post' })
  watch(leading, (current, previous) => {
    if (previous) observer?.unobserve(previous)
    if (current) observer?.observe(current)
    else head.value = 0
  }, { flush: 'post' })
  watch(entries, (next, previous) => {
    let anchor = suspended ?? target ?? pending ?? capture(previous)
    const current = new Map(next.map(entry => [entry.id, entry]))
    if (anchor && anchor !== 'end' && !current.has(anchor.id)) {
      const survivor = previous.slice(anchor.index).find(entry => current.has(entry.id))
        ?? previous.slice(0, anchor.index).reverse().find(entry => current.has(entry.id))
      anchor = survivor ? { id: survivor.id, offset: 0, index: anchor.index } : undefined
      target = undefined
    }
    for (const entry of previous) {
      const updated = current.get(entry.id)
      if (!updated || updated.text !== entry.text || updated.message !== entry.message || updated.stack !== entry.stack || updated.raw !== entry.raw) heights.delete(entry.id)
    }
    measured.value++
    if (enabled()) queue(anchor)
    else suspended = anchor
  }, { flush: 'pre' })
  watch(() => toValue(layout), () => invalidate(), { flush: 'pre' })
  function suspend() { suspended = target ?? pending ?? capture(); cancel() }
  function restore() {
    // 隐藏期间的观察通知不可靠；重新观察同一批行，且只恢复其身份锚点。
    for (const row of rows.values()) { observer?.unobserve(row); observer?.observe(row) }
    queue(suspended ?? target ?? capture()); suspended = undefined
  }
  watch(() => toValue(active), value => { if (!value) suspend(); else restore() }, { flush: 'sync' })
  onDeactivated(() => { suspend(); activated = false })
  onActivated(() => { activated = true; restore() })
  onScopeDispose(() => { cancel(); observer?.disconnect(); rows.clear() })
  return { leading, items, range, setRow, readIntent, onScroll, scrollTo, bottom, invalidate, reset }
}

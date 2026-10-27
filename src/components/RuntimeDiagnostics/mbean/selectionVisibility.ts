interface Interval { start: number; end: number }
/** 已可见项不滚动；过长标题与视口已有交集时保留水平阅读位置。 */
export function nearestVisibilityDelta(viewport: Interval, item: Interval) {
  if (item.start >= viewport.start && item.end <= viewport.end) return 0
  if (item.start < viewport.start && item.end > viewport.end) return 0
  return item.start < viewport.start ? item.start - viewport.start : item.end - viewport.end
}

export function revealMBeanSelection(container: HTMLElement, objectName: string) {
  const title = Array.from(container.querySelectorAll<HTMLElement>('[data-mbean-object]')).find(item => item.dataset.mbeanObject === objectName)
  if (!title || !container.clientHeight || !container.clientWidth) return false
  const viewport = container.getBoundingClientRect(), item = title.getBoundingClientRect()
  const top = nearestVisibilityDelta({ start: viewport.top, end: viewport.bottom }, { start: item.top, end: item.bottom })
  const left = nearestVisibilityDelta({ start: viewport.left, end: viewport.right }, { start: item.left, end: item.right })
  if (!top && !left) return false
  container.scrollTop += top; container.scrollLeft += left
  return true
}

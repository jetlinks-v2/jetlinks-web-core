import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, onUpdated, shallowRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import type { Tree } from 'ant-design-vue'

type TreeInstance = InstanceType<typeof Tree>

const pixels = (value: string) => Number.parseFloat(value) || 0

/** 只把确定的像素上限当作容器约束，百分比与 auto 继续由真实布局决定。 */
function maxContentHeight(style: CSSStyleDeclaration) {
  if (!style.maxHeight.endsWith('px')) return Infinity
  const inset = style.boxSizing === 'border-box'
    ? pixels(style.paddingTop) + pixels(style.paddingBottom) + pixels(style.borderTopWidth) + pixels(style.borderBottomWidth)
    : 0
  return Math.max(0, pixels(style.maxHeight) - inset)
}

/** 预留同列后续内容，绝对定位覆盖物和相邻列不占用树的剩余高度。 */
function followingHeight(branch: HTMLElement, parentStyle: CSSStyleDeclaration, scale: number) {
  const edge = branch.getBoundingClientRect().bottom
  const gap = /^(inline-)?(flex|grid)$/.test(parentStyle.display) ? pixels(parentStyle.rowGap) : 0
  let height = 0
  for (let sibling = branch.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    if (!(sibling instanceof HTMLElement) || !sibling.getClientRects().length) continue
    const style = getComputedStyle(sibling)
    const rect = sibling.getBoundingClientRect()
    if (style.position === 'absolute' || style.position === 'fixed' || rect.top < edge - 1) continue
    height += rect.height / scale + pixels(style.marginTop) + pixels(style.marginBottom) + gap
  }
  return height
}

/**
 * 保留 Tree 根节点与实例接口，在调用方未指定 height 时推导现有布局的可用高度。
 * 测量时短暂收起列表视口，在同一帧内恢复，区分容器分配的高度与树自身撑出的高度。
 */
export function useAutoTree(explicitHeight: () => number | undefined) {
  const treeRef = shallowRef<TreeInstance>()
  const measuredHeight = shallowRef(1)
  let targets: HTMLElement[] = []
  let ancestors: HTMLElement[] = []
  let observer: MutationObserver | undefined
  let resizeObserver: ResizeObserver | undefined
  let frame: number | undefined
  let disposed = false

  const treeHeight = computed(() => explicitHeight() ?? measuredHeight.value)
  // 使用访问代理保留 scrollTo、treeRef 和各类 keys 等原 Tree 的公开接口。
  const treeApi = new Proxy({} as TreeInstance, {
    get(target, key) {
      return Reflect.has(target, key) ? Reflect.get(target, key) : treeRef.value && Reflect.get(treeRef.value, key)
    },
    has(target, key) {
      return Reflect.has(target, key) || !!treeRef.value && Reflect.has(treeRef.value, key)
    },
  })

  const getRoot = () => {
    const element: unknown = treeRef.value?.$el
    if (typeof Node === 'undefined' || !(element instanceof Node)) return
    // TreeContext 以 Fragment 渲染，$el 可能是起始文本锚点；实际根节点仍是 role=tree。
    for (let node: Node | null = element; node; node = node.nextSibling) {
      if (node instanceof HTMLElement && node.getAttribute('role') === 'tree') return node
    }
  }

  /** 按帧合并布局变化；高度未变化时不写响应式状态，阻止测量反馈循环。 */
  function schedule() {
    if (!disposed && frame === undefined) {
      frame = requestAnimationFrame(() => {
        frame = undefined
        measure()
      })
    }
  }

  /** 只订阅祖先与其相邻区块，不监听整棵树的节点更新。 */
  function connect(root: HTMLElement) {
    const parents: HTMLElement[] = []
    const elements = new Set<HTMLElement>([root])
    for (let parent = root.parentElement; parent; parent = parent.parentElement) {
      parents.push(parent)
      elements.add(parent)
      for (const child of Array.from(parent.children)) {
        if (child instanceof HTMLElement && child !== root) elements.add(child)
      }
    }
    if (parents.length === ancestors.length && parents.every((parent, index) => parent === ancestors[index])
      && elements.size === targets.length && targets.every(element => elements.has(element))) return

    ancestors = parents
    targets = [...elements]
    resizeObserver ??= new ResizeObserver(schedule)
    resizeObserver.disconnect()
    targets.forEach(element => resizeObserver?.observe(element))
    observer?.disconnect()
    observer ??= new MutationObserver(schedule)
    for (const parent of parents) {
      observer.observe(parent, { attributes: true, attributeFilter: ['class', 'style', 'hidden'], childList: true })
    }
  }

  /** 在最小列表视口下读取独立边界，避免自然流容器随上一次树高锁住。 */
  function availableHeight(root: HTMLElement, list: HTMLElement) {
    const rect = root.getBoundingClientRect()
    const scale = rect.height / root.offsetHeight || 1
    const style = getComputedStyle(root)
    const contentHeight = root.clientHeight - pixels(style.paddingTop) - pixels(style.paddingBottom)
    const rootBounded = contentHeight > Math.max(1, pixels(style.minHeight)) + 1

    const viewport = root.ownerDocument.defaultView?.visualViewport
    const viewportBottom = viewport ? viewport.offsetTop + viewport.height : root.ownerDocument.documentElement.clientHeight
    // Ant Tree 的 style 落在列表外层，保留该处的 CSS max-height 约束。
    let limit = Math.min(maxContentHeight(style), maxContentHeight(getComputedStyle(list)), rootBounded ? contentHeight : Infinity)
    let trailing = pixels(style.marginBottom)
    let scrolled = 0
    let branch = root
    let bounded = false

    for (const parent of ancestors) {
      const parentStyle = getComputedStyle(parent)
      const parentRect = parent.getBoundingClientRect()
      trailing += followingHeight(branch, parentStyle, scale)
      scrolled += parent.scrollTop
      const bottomInset = pixels(parentStyle.paddingBottom) + pixels(parentStyle.borderBottomWidth)
      const available = (parentRect.bottom - rect.top) / scale - bottomInset - trailing - scrolled

      // 自然撑高的外层可能包含折叠 margin，不能再次当作独立高度约束。
      // 采用最近的空间分配容器，额外保留真正会裁切/滚动的外层边界。
      const clips = /^(auto|scroll|hidden|clip)$/.test(parentStyle.overflowY)
      const pageRoot = parent === root.ownerDocument.body || parent === root.ownerDocument.documentElement
      if (available > rect.height / scale + 1 && (clips || !bounded && !pageRoot)) {
        limit = Math.min(limit, available)
        bounded = true
      }

      const topInset = pixels(parentStyle.paddingTop) + pixels(parentStyle.borderTopWidth)
      const offset = (rect.top - parentRect.top) / scale - topInset + scrolled
      limit = Math.min(limit, maxContentHeight(parentStyle) - offset - trailing)
      trailing += bottomInset + pixels(parentStyle.marginBottom)
      branch = parent
    }

    limit = Math.min(limit, (viewportBottom - Math.max(rect.top, viewport?.offsetTop ?? 0)) / scale - trailing)
    return Math.max(1, Math.floor(limit))
  }

  /** 用独立容器边界与视口约束树高，保留隐藏前的正高度及内部滚动状态。 */
  function measure() {
    const root = getRoot()
    if (!root?.isConnected) return
    connect(root)
    if (explicitHeight() != null || !root.getClientRects().length) return

    // Ant 4.x 的 TreeContext 是 Fragment，最后一个元素为列表容器，其首元素为视口。
    const list = root.lastElementChild
    const viewport = list?.firstElementChild
    if (!(list instanceof HTMLElement) || !(viewport instanceof HTMLElement)) return
    const rect = root.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    const previous = viewport.style.getPropertyValue('max-height')
    const priority = viewport.style.getPropertyPriority('max-height')
    let nextHeight: number
    try {
      // 只修改原列表的视口上限；不卸载节点、不改祖先布局，同步恢复后浏览器才绘制。
      viewport.style.setProperty('max-height', '1px', 'important')
      nextHeight = availableHeight(root, list)
    } finally {
      if (previous) viewport.style.setProperty('max-height', previous, priority)
      else viewport.style.removeProperty('max-height')
    }
    if (nextHeight !== measuredHeight.value) measuredHeight.value = nextHeight
  }

  useEventListener('resize', schedule, { passive: true })
  useEventListener('scroll', event => {
    const root = getRoot()
    // 树内部滚动不改变可用空间，仅在外层滚动时重新测量。
    if (!root || !(event.target instanceof Node) || !root.contains(event.target)) schedule()
  }, { capture: true, passive: true })
  onMounted(measure)
  onActivated(() => { void nextTick(schedule) })
  onUpdated(schedule)
  onBeforeUnmount(() => {
    disposed = true
    observer?.disconnect()
    resizeObserver?.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
  })

  return { treeRef, treeHeight, treeApi }
}

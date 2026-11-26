export const displayAttributes = ['placeholder', 'title', 'aria-label'] as const
export type DisplayAttribute = typeof displayAttributes[number]

const excludedSelector = '[translate="no"],.notranslate,[data-no-translate],'
  + '[contenteditable]:not([contenteditable="false"]),script,style,noscript,pre,code,kbd,samp,svg,math,iframe,canvas,'
  + '.monaco-editor,.cm-editor,.CodeMirror,[role="log"]'

interface SlotState {
  original: string
  written: string
  hint?: string
  attempted: boolean
  controller?: AbortController
}

export type TextSlot = SlotState & { element: Element } & (
  { node: Text; attribute?: never } | { node: Element; attribute: DisplayAttribute }
)

export function excludedElement(element: Element): boolean {
  return !!element.closest(excludedSelector)
}

export function readSlot(slot: TextSlot): string {
  return slot.attribute ? slot.node.getAttribute(slot.attribute) ?? '' : slot.node.data
}

export function writeSlot(slot: TextSlot, value: string): void {
  slot.written = value
  if (slot.attribute) slot.node.setAttribute(slot.attribute, value)
  else slot.node.data = value
}

/** IntersectionObserver 回调与 DOM 更新可交错，提交译文前还需校验当前布局。 */
export function visibleElement(element: Element): boolean {
  if (!element.isConnected || excludedElement(element)) return false
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return false
  const { display, visibility } = getComputedStyle(element)
  return display !== 'none' && visibility !== 'hidden' && visibility !== 'collapse'
}

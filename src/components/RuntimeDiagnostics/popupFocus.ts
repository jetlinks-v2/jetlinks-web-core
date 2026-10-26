export type VisiblePopupFocusOptions = {
  getPopup: () => HTMLElement | undefined
  getTarget?: (popup: HTMLElement) => HTMLElement | undefined
  isActive?: () => boolean
}

/** Waits for a public popup DOM node and its first usable control without guessing animation timing. */
export function createVisiblePopupFocus() {
  let resize: ResizeObserver | undefined, mutation: MutationObserver | undefined, generation = 0

  function cancel() {
    generation++
    resize?.disconnect(); resize = undefined
    mutation?.disconnect(); mutation = undefined
  }

  function focus(options: VisiblePopupFocusOptions) {
    cancel()
    const current = generation
    const targetOf = (popup: HTMLElement) => options.getTarget?.(popup) ?? popup.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]), input:not(:disabled), button:not(:disabled)')
    const usable = (target: HTMLElement) => target.isConnected && (target.offsetWidth > 0 || target.getBoundingClientRect().height > 0)
    const attempt = () => {
      if (generation !== current || options.isActive?.() === false) return cancel()
      const popup = options.getPopup(), target = popup && targetOf(popup)
      if (target && usable(target)) { target.focus(); return cancel() }
      if (!popup || !target) {
        if (!mutation && typeof MutationObserver !== 'undefined' && document.body) {
          mutation = new MutationObserver(attempt)
          mutation.observe(document.body, { childList: true, subtree: true })
        }
        return
      }
      mutation?.disconnect(); mutation = undefined
      if (!resize && typeof ResizeObserver !== 'undefined') {
        resize = new ResizeObserver(attempt)
        resize.observe(popup)
        if (target !== popup) resize.observe(target)
      }
    }
    attempt()
  }

  return { focus, cancel }
}

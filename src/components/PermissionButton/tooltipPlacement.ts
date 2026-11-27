import type { ComponentInternalInstance, ComponentPublicInstance, VNode } from 'vue'

export type TooltipPlacement =
  | 'top'
  | 'left'
  | 'right'
  | 'bottom'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'leftTop'
  | 'leftBottom'
  | 'rightTop'
  | 'rightBottom'

export type PermissionTooltipConfig = Record<string, unknown> & {
  title?: unknown
  placement?: TooltipPlacement
  align?: Record<string, unknown>
  onOpenChange?: (open: boolean) => void
}

export interface TriggerBounds {
  left: number
  right: number
  width: number
}

export interface ResolveTooltipPlacementInput {
  triggerRect: TriggerBounds
  viewportWidth: number
  preferredPlacement?: TooltipPlacement
  maxTooltipWidth?: number
  edgeGap?: number
}

export interface ResolvedTooltipPosition {
  placement: TooltipPlacement
  align: Record<string, unknown>
}

export const DEFAULT_MAX_TOOLTIP_WIDTH = 250
export const DEFAULT_VIEWPORT_EDGE_GAP = 8
export const DEFAULT_NO_PERMISSION_TITLE = '暂无权限，请联系管理员'

export const BASE_TOOLTIP_OVERFLOW = {
  adjustX: 1,
  adjustY: 1,
  alwaysByViewport: true,
} as const

/**
 * Resolve tooltip placement and viewport-safe align config for permission buttons.
 * Switches near-edge triggers from centered `top` to `topRight`/`topLeft` so subpixel clamping
 * never expands document.documentElement.scrollWidth or triggers a scrollbar cascade.
 */
export function resolveTooltipPlacement(
  input: ResolveTooltipPlacementInput,
): ResolvedTooltipPosition {
  const {
    triggerRect,
    viewportWidth,
    preferredPlacement,
    maxTooltipWidth = DEFAULT_MAX_TOOLTIP_WIDTH,
    edgeGap = DEFAULT_VIEWPORT_EDGE_GAP,
  } = input

  const overflow = { ...BASE_TOOLTIP_OVERFLOW }

  if (preferredPlacement && preferredPlacement !== 'top') {
    return {
      placement: preferredPlacement,
      align: { overflow },
    }
  }

  const halfTooltipWidth = maxTooltipWidth / 2
  const triggerCenter = triggerRect.left + triggerRect.width / 2
  const spaceRight = viewportWidth - triggerCenter
  const spaceLeft = triggerCenter

  if (spaceRight < halfTooltipWidth + edgeGap && triggerRect.right >= maxTooltipWidth + edgeGap) {
    const rightGap = viewportWidth - triggerRect.right
    const align: Record<string, unknown> =
      rightGap < edgeGap
        ? { offset: [-Math.ceil(edgeGap - rightGap), -4], overflow }
        : { overflow }
    return { placement: 'topRight', align }
  }

  if (spaceLeft < halfTooltipWidth + edgeGap && viewportWidth - triggerRect.left >= maxTooltipWidth + edgeGap) {
    const align: Record<string, unknown> =
      triggerRect.left < edgeGap
        ? { offset: [Math.ceil(edgeGap - triggerRect.left), -4], overflow }
        : { overflow }
    return { placement: 'topLeft', align }
  }

  return {
    placement: 'top',
    align: { overflow },
  }
}

/**
 * Merge resolved viewport-safe align options with any caller-provided align overrides.
 */
export function mergeTooltipAlign(
  resolvedAlign: Record<string, unknown>,
  callerAlign?: Record<string, unknown>,
): Record<string, unknown> {
  if (!callerAlign) return resolvedAlign
  const baseOverflow = (resolvedAlign.overflow as Record<string, unknown>) || {}
  const callerOverflow =
    typeof callerAlign.overflow === 'object' && callerAlign.overflow !== null
      ? (callerAlign.overflow as Record<string, unknown>)
      : undefined

  return {
    ...resolvedAlign,
    ...callerAlign,
    overflow: {
      ...baseOverflow,
      ...(callerOverflow || {}),
    },
  }
}

const isElementLike = (value: unknown): value is HTMLElement =>
  typeof value === 'object' &&
  value !== null &&
  (value as { nodeType?: number }).nodeType === 1 &&
  typeof (value as HTMLElement).getBoundingClientRect === 'function'

const findElementInVNode = (vnode: VNode | null | undefined): HTMLElement | null => {
  if (!vnode) return null
  if (isElementLike(vnode.el)) return vnode.el
  if (vnode.component?.subTree) {
    const found = findElementInVNode(vnode.component.subTree)
    if (found) return found
  }
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children) {
      if (child && typeof child === 'object' && 'type' in child) {
        const found = findElementInVNode(child as VNode)
        if (found) return found
      }
    }
  }
  return null
}

/**
 * Resolve the DOM element of the trigger button from either a ref target or Vue component instance.
 */
export function resolveTriggerElement(
  triggerTarget: unknown,
  instance: ComponentInternalInstance | null,
): HTMLElement | null {
  if (isElementLike(triggerTarget)) {
    return triggerTarget
  }
  if (triggerTarget && typeof triggerTarget === 'object' && '$el' in triggerTarget) {
    const el = (triggerTarget as ComponentPublicInstance).$el
    if (isElementLike(el)) return el
  }
  if (instance) {
    if (isElementLike(instance.vnode?.el)) {
      return instance.vnode.el
    }
    const found = findElementInVNode(instance.subTree)
    if (found) return found
  }
  return null
}

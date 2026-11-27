import {
  computed,
  getCurrentInstance,
  inject,
  nextTick,
  onMounted,
  ref,
  watch,
  type ComponentInternalInstance,
  type ComponentPublicInstance,
  type Ref,
  type VNode,
} from 'vue'
import { usePermission, type PermissionCodeType } from '@jetlinks-web/hooks'
import componentsZhCN from '@jetlinks-web/components/es/locale/zh-CN'

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

export type NoPermissionTooltipConfig = Record<string, unknown> & {
  placement?: TooltipPlacement
  align?: Record<string, unknown>
  onOpenChange?: (open: boolean) => void
}

export interface TriggerBounds {
  left: number
  right: number
  width: number
}

export interface ResolveNoPermissionTooltipPlacementInput {
  triggerRect: TriggerBounds
  viewportWidth: number
  preferredPlacement?: TooltipPlacement
  maxTooltipWidth?: number
  edgeGap?: number
}

export interface ResolvedNoPermissionTooltipPosition {
  placement: TooltipPlacement
  align: Record<string, unknown>
}

export const DEFAULT_MAX_TOOLTIP_WIDTH = 250
export const DEFAULT_VIEWPORT_EDGE_GAP = 8

const BASE_OVERFLOW = {
  adjustX: 1,
  adjustY: 1,
  alwaysByViewport: true,
} as const

/**
 * Resolve tooltip placement and viewport-safe align config for disabled permission buttons.
 * Switches near-edge triggers from centered `top` to `topRight`/`topLeft` so subpixel clamping
 * never expands document.documentElement.scrollWidth or triggers a scrollbar cascade.
 */
export function resolveNoPermissionTooltipPlacement(
  input: ResolveNoPermissionTooltipPlacementInput,
): ResolvedNoPermissionTooltipPosition {
  const {
    triggerRect,
    viewportWidth,
    preferredPlacement,
    maxTooltipWidth = DEFAULT_MAX_TOOLTIP_WIDTH,
    edgeGap = DEFAULT_VIEWPORT_EDGE_GAP,
  } = input

  const overflow = { ...BASE_OVERFLOW }

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
 * Resolve the DOM element of the trigger button from either a component/element ref or Vue instance.
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

function mergeCallerAlign(
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

export interface UseNoPermissionTooltipOptions {
  hasPermission: Ref<boolean | string | string[] | undefined>
  tooltip: Ref<NoPermissionTooltipConfig | undefined>
  noPermissionTitle: Ref<string | undefined>
}

/**
 * Compute permission state, localized no-permission tooltip copy, and viewport-aware tooltip placement.
 */
export function useNoPermissionTooltip(options: UseNoPermissionTooltipOptions) {
  const instance = getCurrentInstance()
  const { hasPerm } = usePermission(options.hasPermission as Ref<PermissionCodeType>)

  const hasAccess = computed(() => {
    if (options.hasPermission.value === true || options.hasPermission.value === undefined) {
      return true
    }
    return hasPerm.value
  })

  const localeData = inject<{
    antLocale?: { PermissionButton?: { hasPermission?: string } }
  }>('componentLocaleData', {})

  const resolvedTitle = computed(() => (
    options.noPermissionTitle.value
    || localeData.antLocale?.PermissionButton?.hasPermission
    || (componentsZhCN as { PermissionButton?: { hasPermission?: string } }).PermissionButton?.hasPermission
    || '暂无权限，请联系管理员'
  ))

  const placement = ref<TooltipPlacement>(options.tooltip.value?.placement || 'top')
  const align = ref<Record<string, unknown>>(
    mergeCallerAlign({ overflow: { ...BASE_OVERFLOW } }, options.tooltip.value?.align),
  )

  let triggerTarget: unknown = null

  const setTriggerRef = (el: unknown) => {
    triggerTarget = el
  }

  const syncPlacement = () => {
    const triggerEl = resolveTriggerElement(triggerTarget, instance)
    if (!triggerEl) return

    const hostEl = triggerEl.closest('.ant-tooltip-disabled-compatible-wrapper') || triggerEl
    const rect = hostEl.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) return

    const doc = hostEl.ownerDocument
    const viewportWidth = doc?.documentElement?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 0)
    if (!viewportWidth) return

    const resolved = resolveNoPermissionTooltipPlacement({
      triggerRect: {
        left: rect.left,
        right: rect.right,
        width: rect.width,
      },
      viewportWidth,
      preferredPlacement: options.tooltip.value?.placement,
    })

    placement.value = resolved.placement
    align.value = mergeCallerAlign(resolved.align, options.tooltip.value?.align)
  }

  const handleOpenChange = (open: boolean) => {
    if (open) {
      syncPlacement()
    }
    options.tooltip.value?.onOpenChange?.(open)
  }

  onMounted(() => {
    if (!hasAccess.value) {
      void nextTick(syncPlacement)
    }
  })

  watch(hasAccess, (allowed) => {
    if (!allowed) {
      void nextTick(syncPlacement)
    }
  })

  return {
    hasAccess,
    resolvedTitle,
    placement,
    align,
    setTriggerRef,
    syncPlacement,
    handleOpenChange,
  }
}

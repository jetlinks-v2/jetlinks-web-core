import {
  computed,
  getCurrentInstance,
  inject,
  nextTick,
  onMounted,
  ref,
  watch,
  type Ref,
} from 'vue'
import { Modal } from 'ant-design-vue'
import { omit } from 'lodash-es'
import { usePermission, type PermissionCodeType } from '@jetlinks-web/hooks'
import {
  BASE_TOOLTIP_OVERFLOW,
  DEFAULT_NO_PERMISSION_TITLE,
  mergeTooltipAlign,
  resolveTooltipPlacement,
  resolveTriggerElement,
  type PermissionTooltipConfig,
  type TooltipPlacement,
} from './tooltipPlacement'

type ModalConfirmConfig = Parameters<typeof Modal.confirm>[0]

export type PermissionPopConfirmConfig = Record<string, unknown> & {
  title?: unknown
  content?: unknown
  onConfirm?: (...args: any[]) => unknown
  onCancel?: (...args: any[]) => unknown
}

export interface UsePermissionButtonOptions {
  hasPermission: Ref<boolean | string | string[] | undefined>
  disabled: Ref<boolean | undefined>
  tooltip: Ref<PermissionTooltipConfig | null | undefined>
  noPermissionTitle: Ref<string | undefined>
  popConfirm: Ref<PermissionPopConfirmConfig | null | undefined>
  popConfirmBefore: Ref<((...args: any[]) => unknown) | undefined>
}

const EXCLUDED_NO_PERM_TOOLTIP_KEYS = [
  'title',
  'open',
  'visible',
  'disabled',
  'placement',
  'align',
  'onOpenChange',
] as const

const EXCLUDED_PERM_TOOLTIP_KEYS = ['placement', 'align', 'onOpenChange'] as const

const EXCLUDED_CONFIRM_KEYS = ['onConfirm', 'onCancel'] as const

/**
 * Encapsulate permission evaluation, localized no-permission tooltip copy,
 * viewport-aware tooltip placement, and secondary confirmation dialog handling.
 */
export function usePermissionButton(options: UsePermissionButtonOptions) {
  const instance = getCurrentInstance()
  const { hasPerm } = usePermission(options.hasPermission as Ref<PermissionCodeType>)

  const hasAccess = computed(() => {
    if (options.hasPermission.value === true || options.hasPermission.value === undefined) {
      return true
    }
    return hasPerm.value
  })

  const isDisabled = computed(() => (!hasAccess.value ? true : Boolean(options.disabled.value)))
  const hasTooltip = computed(() => !hasAccess.value || Boolean(options.tooltip.value))

  const localeData = inject<{
    antLocale?: { PermissionButton?: { hasPermission?: string } }
  }>('componentLocaleData', {})

  const noPermissionText = computed(() => (
    options.noPermissionTitle.value
    || localeData.antLocale?.PermissionButton?.hasPermission
    || DEFAULT_NO_PERMISSION_TITLE
  ))

  const placement = ref<TooltipPlacement>(options.tooltip.value?.placement || 'top')
  const align = ref<Record<string, unknown>>(
    mergeTooltipAlign({ overflow: { ...BASE_TOOLTIP_OVERFLOW } }, options.tooltip.value?.align),
  )

  let triggerTarget: unknown = null

  const setTriggerRef = (el: unknown) => {
    triggerTarget = el
  }

  const syncPlacement = () => {
    const preferredPlacement = options.tooltip.value?.placement
    const callerAlign = options.tooltip.value?.align
    const triggerEl = resolveTriggerElement(triggerTarget, instance)
    if (!triggerEl) {
      placement.value = preferredPlacement || 'top'
      align.value = mergeTooltipAlign({ overflow: { ...BASE_TOOLTIP_OVERFLOW } }, callerAlign)
      return
    }

    const hostEl = triggerEl.closest('.ant-tooltip-disabled-compatible-wrapper') || triggerEl
    const rect = hostEl.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) return

    const doc = hostEl.ownerDocument
    const viewportWidth = doc?.documentElement?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 0)
    if (!viewportWidth) return

    const resolved = resolveTooltipPlacement({
      triggerRect: {
        left: rect.left,
        right: rect.right,
        width: rect.width,
      },
      viewportWidth,
      preferredPlacement,
    })

    placement.value = resolved.placement
    align.value = mergeTooltipAlign(resolved.align, callerAlign)
  }

  const handleOpenChange = (open: boolean) => {
    if (open) {
      syncPlacement()
    }
    options.tooltip.value?.onOpenChange?.(open)
  }

  const tooltipProps = computed(() => {
    const rawTooltip = options.tooltip.value || {}
    if (!hasAccess.value) {
      return {
        ...omit(rawTooltip, [...EXCLUDED_NO_PERM_TOOLTIP_KEYS]),
        title: noPermissionText.value,
        placement: placement.value,
        align: align.value,
        onOpenChange: handleOpenChange,
      }
    }
    return {
      ...omit(rawTooltip, [...EXCLUDED_PERM_TOOLTIP_KEYS]),
      placement: placement.value,
      align: align.value,
      onOpenChange: handleOpenChange,
    }
  })

  const handleConfirmClick = async () => {
    const baseConfirm = options.popConfirm.value
    if (!hasAccess.value || isDisabled.value || !baseConfirm) {
      return
    }
    const beforeResult = await options.popConfirmBefore.value?.()
    const resolved = (
      beforeResult && typeof beforeResult === 'object'
        ? beforeResult
        : baseConfirm
    ) as PermissionPopConfirmConfig

    const confirmProps = {
      ...omit(resolved, [...EXCLUDED_CONFIRM_KEYS]),
      title: resolved.title,
      content: resolved.content,
      onOk: (...args: unknown[]) => resolved.onConfirm?.(...args),
      onCancel: (...args: unknown[]) => {
        resolved.onCancel?.(...args)
      },
    } as ModalConfirmConfig

    Modal.confirm(confirmProps)
  }

  onMounted(() => {
    if (hasTooltip.value) {
      void nextTick(syncPlacement)
    }
  })

  watch([hasTooltip, () => options.tooltip.value?.placement], ([active]) => {
    if (active) {
      void nextTick(syncPlacement)
    }
  })

  return {
    hasAccess,
    isDisabled,
    hasTooltip,
    noPermissionText,
    placement,
    align,
    tooltipProps,
    setTriggerRef,
    syncPlacement,
    handleOpenChange,
    handleConfirmClick,
  }
}

import { computed, getCurrentInstance, onBeforeUnmount, onDeactivated, ref, watch, type Ref } from 'vue'
import type { ActionAccess, ViewState } from '../types'

type ResetContext = { queues: Ref<readonly { objectName: string }[]>; active: Ref<boolean>; scope: Ref<string>; access: Ref<ActionAccess>; state: Ref<ViewState> }

/** 确认锁定完整身份与当时的显示范围；失活、隐藏、权限或数据变化均使确认失效。 */
export function useBufferQueueReset(context: ResetContext, emit: (objectName: string) => void) {
  const resetOpen = ref(false), resetTarget = ref('')
  let confirmedScope = '', trigger: HTMLElement | undefined
  const identities = computed(() => JSON.stringify(context.queues.value.map(queue => queue.objectName).sort()))
  const canReset = (objectName: string) => context.active.value && context.access.value.allowed && context.state.value.status !== 'loading' && context.queues.value.some(queue => queue.objectName === objectName)
  function cancel() { resetOpen.value = false; resetTarget.value = ''; confirmedScope = '' }
  function request(objectName: string, element?: HTMLElement) {
    if (!canReset(objectName)) return
    resetTarget.value = objectName; confirmedScope = context.scope.value; trigger = element; resetOpen.value = true
  }
  function confirm() {
    const target = resetTarget.value
    const allowed = resetOpen.value && confirmedScope === context.scope.value && canReset(target)
    cancel()
    if (allowed) emit(target)
  }
  function restoreFocus(fallback?: HTMLElement) {
    const target = trigger?.isConnected ? trigger : fallback
    if (target?.isConnected) target.focus()
    trigger = undefined
  }
  watch([identities, context.active, context.scope, () => context.access.value.allowed, () => context.state.value.status], cancel, { flush: 'sync' })
  if (getCurrentInstance()) {
    onDeactivated(() => { cancel(); trigger = undefined })
    onBeforeUnmount(() => { cancel(); trigger = undefined })
  }
  return { resetOpen, resetTarget, canReset, request, cancel, confirm, restoreFocus }
}

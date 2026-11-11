import { computed, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'
import type { Subscription } from 'rxjs'
import type { DataCapabilityRuntime, PersistedOperationBinding, PreparedOperation } from '../data-capability/types'
import type { ObjectReference } from './types'

/** Provider snapshots and confirms the target; the UI never re-resolves relations after confirmation. */
export function useObjectOperation(binding: Readonly<Ref<PersistedOperationBinding | undefined>>, runtime: () => DataCapabilityRuntime | undefined) {
  const input = shallowRef<Record<string, unknown>>({}), prepared = shallowRef<PreparedOperation>()
  const busy = shallowRef(false), failed = shallowRef(false), result = shallowRef<unknown>(), completed = shallowRef(false)
  const warning = shallowRef(false)
  const target = computed(() => prepared.value?.impacts?.[0] as ObjectReference | undefined)
  let generation = 0, subscription: Subscription | undefined
  function reset() { generation++; subscription?.unsubscribe(); prepared.value = undefined; input.value = {}; busy.value = false; failed.value = false; result.value = undefined; completed.value = false; warning.value = false }
  async function prepare() {
    if (!binding.value || busy.value) return
    const current = generation
    busy.value = true; failed.value = false; completed.value = false; warning.value = false; result.value = undefined
    try {
      const value = await runtime()!.prepareOperation({ ...binding.value, input: input.value })
      if (current === generation) prepared.value = value
    } catch { if (current === generation) failed.value = true }
    finally { if (current === generation) busy.value = false }
  }
  function execute() {
    const value = prepared.value, session = runtime()
    if (!value || !session || busy.value) return
    const current = generation
    busy.value = true; failed.value = false
    try {
      const confirmed = session.confirmOperation(value.id, { method: 'ui', confirmedAt: Date.now() })
      subscription = session.executeOperation(confirmed).events$.subscribe({
      next(event) {
        if (current !== generation) return
        if (event.type === 'result') result.value = event.result
        if (event.type === 'warning') warning.value = true
        if (event.type === 'completed') completed.value = true
      },
      error() { if (current === generation) { failed.value = true; busy.value = false; prepared.value = undefined } },
      complete() { if (current === generation) { busy.value = false; prepared.value = undefined } },
      })
    } catch { if (current === generation) { failed.value = true; busy.value = false; prepared.value = undefined } }
  }
  watch(binding, reset)
  onBeforeUnmount(reset)
  return { input, prepared, target, busy, failed, warning, result, completed, prepare, execute, reset }
}

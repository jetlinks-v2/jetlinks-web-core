import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { getDataCapabilityRequest, useDataCapabilityRequest } from '../data-capability/request'
import type { DataCapabilityRequest } from '../data-capability/types'

/** One dictionary per host request client; a failed read may be retried on the next visit. */
export function createValueUnitRegistry(request: DataCapabilityRequest) {
  const symbols = shallowRef<ReadonlyMap<string, string>>(new Map())
  let loaded = false
  let pending: Promise<void> | undefined
  return {
    format: (unit: string) => symbols.value.get(unit) ?? unit,
    load(): Promise<void> {
      if (loaded) return Promise.resolve()
      if (pending) return pending
      pending = (async () => {
        try {
          const response = await request.get('/protocol/units') as { status: number; result: Array<{ id: string; symbol: string }> }
          if (response.status !== 200 || !Array.isArray(response.result)) return
          symbols.value = new Map(response.result
            .filter(unit => typeof unit.id === 'string' && typeof unit.symbol === 'string')
            .map(unit => [unit.id, unit.symbol.trim()]))
          loaded = true
        } catch {
          // A missing dictionary leaves original metadata units readable; it never hides the value.
        } finally { pending = undefined }
      })()
      return pending
    },
  }
}
const registries = new WeakMap<DataCapabilityRequest, ReturnType<typeof createValueUnitRegistry>>()

/** Resolve declared unit IDs using the platform registry, without changing the measured value. */
export function useValueUnit(unit: MaybeRefOrGetter<string | undefined>) {
  const request = useDataCapabilityRequest() ?? getDataCapabilityRequest()
  let registry = registries.get(request)
  if (!registry) { registry = createValueUnitRegistry(request); registries.set(request, registry) }
  const units = registry
  watch(() => toValue(unit), value => { if (value) void units.load() }, { immediate: true })
  return computed(() => { const value = toValue(unit); return value ? units.format(value) : undefined })
}

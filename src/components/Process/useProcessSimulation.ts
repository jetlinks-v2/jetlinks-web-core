import { ref, shallowRef, watch, type Ref } from 'vue'
import type { ProcessApi, ProcessEvent, ProcessOperationState, ProcessSimulationResult, ProcessTemplate } from './types'
import { copyProcess } from './model'

/** 模拟每次重放同一事件序列，由后端纯推进核心产生动作意图，不补造成功结果。 */
export function useProcessSimulation(template: Readonly<Ref<ProcessTemplate>>, api: ProcessApi) {
  const now = ref(0), values = ref<Record<string, unknown>>({}), unavailable = ref<string[]>([]), stop = ref(false)
  const events = shallowRef<ProcessEvent[]>([]), result = shallowRef<ProcessSimulationResult>(), busy = ref(false), error = ref('')
  let generation = 0
  function reset() { generation++; now.value = 0; events.value = []; result.value = undefined; error.value = ''; busy.value = false; stop.value = false; unavailable.value = []; values.value = {} }
  watch(template, reset)
  async function advance(operation?: { id: string; state: ProcessOperationState }, due = false, resume = false) {
    if (busy.value || events.value.length >= 512) return
    const token = ++generation
    const time = due && result.value ? result.value.state.nextDueAt : Math.round(now.value * 1000)
    if (!Number.isSafeInteger(time) || time < (events.value.at(-1)?.now || 0)) { error.value = 'Simulation time must be monotonic'; return }
    const event: ProcessEvent = { now: time, observations: due || operation || resume ? {} : Object.fromEntries(Object.entries(template.value.inputs).map(([id, input]) => [id, {
      value: values.value[id] ?? (input.type === 'boolean' ? false : input.type === 'number' ? 0 : ''), epoch: 'simulation', progress: events.value.length + 1,
      observedAt: time, validUntil: time + 60000, quality: unavailable.value.includes(id) ? 'unavailable' as const : 'valid' as const, continuous: true, notification: true,
    }])), operations: operation ? { [operation.id]: { state: operation.state, output: {} } } : {}, stop: stop.value, recovering: false, resume }
    busy.value = true; error.value = ''
    try {
      const next = [...events.value, event], response = await api.simulate(copyProcess(template.value), next)
      if (token === generation) { events.value = next; result.value = response; now.value = time / 1000 }
    } catch (cause) { if (token === generation) error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { if (token === generation) busy.value = false }
  }
  return { now, values, unavailable, stop, result, events, busy, error, advance, reset }
}

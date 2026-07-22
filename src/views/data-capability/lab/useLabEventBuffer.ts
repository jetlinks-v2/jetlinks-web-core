import { reactive, ref } from 'vue'

const DEFAULT_MAX_LAB_EVENTS = 200

export function useLabEventBuffer(limit = DEFAULT_MAX_LAB_EVENTS) {
  const events = ref<unknown[]>([])
  const eventStats = reactive({ received: 0, dropped: 0, limit })

  const appendLabEvent = (event: unknown) => {
    eventStats.received += 1
    events.value.push(event)
    if (events.value.length > eventStats.limit) {
      const dropped = events.value.length - eventStats.limit
      events.value.splice(0, dropped)
      eventStats.dropped += dropped
    }
  }

  const resetEvents = () => {
    events.value = []
    eventStats.received = 0
    eventStats.dropped = 0
  }

  return { events, eventStats, appendLabEvent, resetEvents }
}

import { onBeforeUnmount, onMounted, readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'

export function useUiTicker(
  intervalMs: number,
  options: {
    enabled?: Readonly<Ref<boolean>> | boolean
    immediate?: boolean
  } = {},
) {
  const now = ref(Date.now())
  let timer: ReturnType<typeof globalThis.setInterval> | null = null

  const isEnabled = () => {
    if (options.enabled === undefined) return true
    return typeof options.enabled === 'boolean' ? options.enabled : options.enabled.value
  }

  const stop = () => {
    if (!timer) return
    globalThis.clearInterval(timer)
    timer = null
  }

  const tick = () => {
    now.value = Date.now()
  }

  const start = () => {
    if (timer || !isEnabled()) return
    if (options.immediate !== false) tick()
    timer = globalThis.setInterval(tick, intervalMs)
  }

  onMounted(start)
  onBeforeUnmount(stop)

  if (options.enabled && typeof options.enabled !== 'boolean') {
    watch(options.enabled, (enabled) => {
      if (enabled) start()
      else stop()
    }, { flush: 'post' })
  }

  return {
    now: readonly(now),
    start,
    stop,
    tick,
  }
}

import { computed, onBeforeUnmount, watch, type Ref } from 'vue'
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core'

export interface ObjectAutoRefreshOptions {
  active?: Readonly<Ref<boolean>>
  interval?: Readonly<Ref<number>>
}

/** Both direct values and relation bindings share the page's polling lifetime. */
export function useObjectAutoRefresh(options: ObjectAutoRefreshOptions, available: Readonly<Ref<boolean>>,
  refresh: () => void, cancel: () => void) {
  const visibility = useDocumentVisibility()
  const enabled = computed(() => (options.active?.value ?? true) && visibility.value !== 'hidden'
    && (options.interval?.value || 0) > 0 && available.value)
  const polling = useIntervalFn(() => { if (enabled.value) refresh() },
    computed(() => (options.interval?.value || 0) * 1000), { immediate: false })
  watch(enabled, value => {
    if (value) polling.resume()
    else { polling.pause(); cancel() }
  }, { immediate: true })
  onBeforeUnmount(() => { polling.pause(); cancel() })
}

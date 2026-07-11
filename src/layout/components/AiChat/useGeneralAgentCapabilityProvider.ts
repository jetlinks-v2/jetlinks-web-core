import { onBeforeUnmount, watch } from 'vue'
import {
  registerGeneralAgentCapabilityProvider,
  type GeneralAgentCapabilityProvider,
} from './generalAgentRuntime'

type MaybeProvider = GeneralAgentCapabilityProvider | undefined | null
type ProviderSource = MaybeProvider | (() => MaybeProvider)

const resolveProvider = (source: ProviderSource) => (
  typeof source === 'function' ? source() : source
)

/** Registers page-scoped general-agent abilities and disposes them with the page. */
export const useGeneralAgentCapabilityProvider = (source: ProviderSource) => {
  let unregister: (() => void) | undefined
  const stop = watch(
    () => resolveProvider(source),
    (provider) => {
      unregister?.()
      unregister = provider ? registerGeneralAgentCapabilityProvider(provider) : undefined
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    stop()
    unregister?.()
    unregister = undefined
  })
}

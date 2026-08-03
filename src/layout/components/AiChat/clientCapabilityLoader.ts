import {
  validateAiClientToolRoutingMetadata,
} from './clientToolRouting'

const CLIENT_CAPABILITY_LOAD = 'client-capability.load'

/** Resolves the loader from the exact model-facing catalog instead of assuming a runtime-specific id. */
export const resolveClientCapabilityLoaderToolId = (
  tools: Array<Record<string, any>> = [],
) => {
  const loader = tools.find((tool) => (
    validateAiClientToolRoutingMetadata(tool).metadata?.capabilities
      ?.includes(CLIENT_CAPABILITY_LOAD)
  ))
  return String(loader?.id || loader?.name || '').trim()
}

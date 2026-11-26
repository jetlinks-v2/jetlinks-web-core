import { DefaultDataCapabilityRegistry } from './internal/provider-registry'
import { createObjectCapabilityProvider } from '../object-capability/provider'

export { DefaultDataCapabilityRegistry } from './internal/provider-registry'

export const dataCapabilityRegistry = new DefaultDataCapabilityRegistry()
dataCapabilityRegistry.registerProvider(createObjectCapabilityProvider())

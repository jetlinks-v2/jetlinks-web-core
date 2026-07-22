import type {
  CapabilityAvailability,
  CapabilityContext,
  CapabilityDefinitionBase,
} from '../types'
import { AVAILABLE_CAPABILITY, createCapabilityError } from '../utils'

export async function resolveAvailability(
  definition: CapabilityDefinitionBase,
  context: CapabilityContext,
  phase?: 'discover' | 'configure' | 'execute',
): Promise<CapabilityAvailability> {
  if (!definition.availability) return AVAILABLE_CAPABILITY
  return definition.availability(context, phase)
}

// Runtime entry points must re-check execute availability before creating Provider instances.
export async function assertExecutable(
  definition: CapabilityDefinitionBase,
  context: CapabilityContext,
): Promise<void> {
  const availability = await resolveAvailability(definition, context, 'execute')
  if (!availability.executable) {
    throw createCapabilityError('capability.unavailable', availability.reason || 'Capability is unavailable', {
      capabilityId: definition.id,
      retryable: availability.retryable,
    })
  }
}

export async function assertConfigurable(
  definition: CapabilityDefinitionBase,
  context: CapabilityContext,
): Promise<void> {
  const availability = await resolveAvailability(definition, context, 'configure')
  if (!availability.configurable) {
    throw createCapabilityError('capability.unavailable', availability.reason || 'Capability is not configurable', {
      capabilityId: definition.id,
      retryable: availability.retryable,
    })
  }
}

import type {
  CapabilityAvailability,
  CapabilityChoice,
  CapabilityChoiceMetadata,
  CapabilityChoiceResult,
  CapabilityContext,
  CapabilityDirectoryDiagnostic,
  DataSourceDefinition,
  OperationDefinition,
  ResolvedCapability,
  ResolvedCapabilityCatalog,
} from '../types'
import { resolveAvailability } from './availability'

type SelectableCapability =
  | ResolvedCapability<DataSourceDefinition>
  | ResolvedCapability<OperationDefinition>

interface CapabilityChoiceProjection {
  choice: CapabilityChoice
  diagnostic?: CapabilityDirectoryDiagnostic
}

const AVAILABILITY_ERROR_MESSAGE = 'Capability availability could not be determined'

/** Projects callable definitions without leaking Provider functions or loading internals. */
export async function projectCapabilityChoices(
  catalog: ResolvedCapabilityCatalog,
  context: CapabilityContext,
): Promise<Pick<CapabilityChoiceResult, 'items' | 'diagnostics'>> {
  const selectable: SelectableCapability[] = [...catalog.sources, ...catalog.operations]
  const projected = await Promise.all(selectable.map(item => projectCapabilityChoice(item, context)))
  return {
    items: projected.map(item => item.choice),
    diagnostics: projected.flatMap(item => item.diagnostic ? [item.diagnostic] : []),
  }
}

async function projectCapabilityChoice(
  item: SelectableCapability,
  context: CapabilityContext,
): Promise<CapabilityChoiceProjection> {
  let configurable: CapabilityAvailability
  let executable: CapabilityAvailability
  let diagnostic: CapabilityDirectoryDiagnostic | undefined
  try {
    [configurable, executable] = await Promise.all([
      resolveAvailability(item.definition, context, 'configure'),
      resolveAvailability(item.definition, context, 'execute'),
    ])
  } catch (error) {
    configurable = { ...item.availability, configurable: false, reason: AVAILABILITY_ERROR_MESSAGE }
    executable = { ...item.availability, executable: false, reason: AVAILABILITY_ERROR_MESSAGE }
    diagnostic = {
      code: 'capability.availability_failed',
      message: AVAILABILITY_ERROR_MESSAGE,
      capabilityIds: [item.definition.id],
      retryable: resolveRetryable(error),
    }
  }

  const disabledReason = resolveDisabledReason(item.availability, configurable, executable)
  const base = {
    value: item.definition.id,
    label: item.definition.name,
    description: item.definition.description,
    version: item.definition.version,
    disabled: !!disabledReason,
    disabledReason,
    metadata: createChoiceMetadata(item.definition),
  }

  const choice: CapabilityChoice = item.definition.kind === 'data-source'
    ? {
        ...base,
        kind: 'data-source',
        contract: {
          modes: [...item.definition.modes],
          configSchema: item.definition.configSchema,
          paramsSchema: item.definition.querySchema,
          resultSchema: item.definition.outputSchema,
        },
      }
    : {
        ...base,
        kind: 'operation',
        contract: {
          action: item.definition.action,
          configSchema: item.definition.configSchema,
          paramsSchema: item.definition.inputSchema,
          resultSchema: item.definition.outputSchema,
          policy: { ...item.definition.policy },
        },
      }

  return { choice, diagnostic }
}

function createChoiceMetadata(definition: DataSourceDefinition | OperationDefinition): CapabilityChoiceMetadata {
  return {
    moduleId: definition.owner.moduleId,
    providerId: definition.owner.providerId,
    tags: [...(definition.tags || [])],
    facets: { ...(definition.facets || {}) },
  }
}

function resolveDisabledReason(
  discoverable: CapabilityAvailability,
  configurable: CapabilityAvailability,
  executable: CapabilityAvailability,
): string | undefined {
  if (!discoverable.discoverable) return discoverable.reason || 'Capability is not discoverable'
  if (!configurable.configurable) return configurable.reason || 'Capability cannot be configured'
  if (!executable.executable) return executable.reason || 'Capability cannot be executed'
  return undefined
}

function resolveRetryable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return true
  const retryable = (error as { retryable?: unknown }).retryable
  return typeof retryable === 'boolean' ? retryable : true
}

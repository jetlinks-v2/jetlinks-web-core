import type {
  CapabilityDefinitionBase,
  CapabilityContext,
  CapabilityRegistry,
  ContextValueDefinition,
  DataSourceDefinition,
  OperationDefinition,
  OptionSourceDefinition,
} from '../types'

export type ProviderDefinitionKind = 'sources' | 'operations' | 'contexts' | 'valueEditors' | 'optionSources'

/** Identifies the Provider registration that owns a definition. */
export interface ProviderOwnerStamp {
  token: string
  generation: number
}

/** Changes whenever a definition becomes the effective registration. */
export interface CapabilityMountStamp extends ProviderOwnerStamp {
  mountId: string
}

export interface ProviderDefinitionIds {
  mount: CapabilityMountStamp
  sources: Set<string>
  operations: Set<string>
  contexts: Set<string>
  valueEditors: Set<string>
  optionSources: Set<string>
}

export interface RuntimeRegistryAccess {
  readonly sources: CapabilityRegistry<DataSourceDefinition>
  readonly operations: CapabilityRegistry<OperationDefinition>
  readonly contexts: CapabilityRegistry<ContextValueDefinition>
  readonly optionSources: CapabilityRegistry<OptionSourceDefinition>
  ensureReady(context?: CapabilityContext, capabilityId?: string): Promise<void>
  getDefinitionRegistration(definition: CapabilityDefinitionBase): CapabilityMountStamp | undefined
  isMountActive(
    mount: CapabilityMountStamp | undefined,
    kind?: ProviderDefinitionKind,
    capabilityId?: string,
  ): boolean
}

export function sameMount(
  left: CapabilityMountStamp | undefined,
  right: CapabilityMountStamp | undefined,
): boolean {
  return !!left && !!right && left.mountId === right.mountId
}

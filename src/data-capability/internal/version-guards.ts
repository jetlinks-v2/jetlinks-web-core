import type {
  PersistedDataBinding,
  PersistedOperationBinding,
} from '../types'
import { createCapabilityError } from '../utils'
import { assertOutputMappingVersion } from '../mapping'

export function assertDataBindingVersion(binding: PersistedDataBinding): void {
  if (binding.version !== 1) {
    throw createCapabilityError('data_binding.version_unsupported', 'Data binding version is not supported', {
      capabilityId: binding.source?.capabilityId,
      details: { version: binding.version },
    })
  }
  assertOutputMappingVersion(binding.mapping)
  if (binding.plan && binding.plan.version !== 1) {
    throw createCapabilityError('data_source.plan.version_unsupported', 'Data source plan version is not supported', {
      capabilityId: binding.source.capabilityId,
      details: { version: binding.plan.version },
    })
  }
}

export function assertOperationBindingVersion(binding: PersistedOperationBinding): void {
  if (binding.version !== 1) {
    throw createCapabilityError('operation_binding.version_unsupported', 'Operation binding version is not supported', {
      capabilityId: binding.operation?.capabilityId,
      details: { version: binding.version },
    })
  }
}

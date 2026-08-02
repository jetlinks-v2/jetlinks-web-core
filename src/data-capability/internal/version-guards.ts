import type {
  PersistedDataBinding,
  PersistedOperationBinding,
} from '../types'
import { createCapabilityError } from '../utils'

export function assertDataBindingVersion(binding: PersistedDataBinding): void {
  if (binding.version !== 1) {
    throw createCapabilityError('data_binding.version_unsupported', 'Data binding version is not supported', {
      capabilityId: binding.source?.capabilityId,
      details: { version: binding.version },
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

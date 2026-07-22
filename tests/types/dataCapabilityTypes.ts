import type { PersistedOperationBinding } from '../../src/data-capability'

const validOperationBinding: PersistedOperationBinding = {
  version: 1,
  operation: { capabilityId: 'test.operation', version: 1 },
  policyOverride: {
    risk: 'high',
    confirmation: 'always',
    cancellation: 'before-dispatch',
    retry: 'never',
    batch: false,
    audit: true,
  },
}

const invalidConcurrencyOverride: PersistedOperationBinding = {
  version: 1,
  operation: { capabilityId: 'test.operation', version: 1 },
  policyOverride: {
    // @ts-expect-error concurrency is a Provider-owned execution fact.
    concurrency: 'serial',
  },
}

const invalidIdempotencyOverride: PersistedOperationBinding = {
  version: 1,
  operation: { capabilityId: 'test.operation', version: 1 },
  policyOverride: {
    // @ts-expect-error idempotency is a Provider-owned execution fact.
    idempotency: 'keyed',
  },
}

void validOperationBinding
void invalidConcurrencyOverride
void invalidIdempotencyOverride

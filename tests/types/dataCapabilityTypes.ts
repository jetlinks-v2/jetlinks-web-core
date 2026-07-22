import type {
  OptionSourceRef,
  PersistedOperationBinding,
  RuntimeOptionRequest,
} from '../../src/data-capability'

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

const staticOptionSource: OptionSourceRef = {
  type: 'static',
  options: [{ label: 'One', value: 1 }],
}

const providerOptionSource: OptionSourceRef = {
  type: 'provider',
  capability: { capabilityId: 'test.option', version: 1 },
  query: { fixed: true },
}

const dataSourceOptionSource: OptionSourceRef = {
  type: 'data-source',
  capability: { capabilityId: 'test.source', version: 1, config: {} },
  labelPath: ['name'],
  valuePath: ['id'],
}

const invalidLegacyOptionSource: OptionSourceRef = {
  type: 'provider',
  // @ts-expect-error dynamic refs use a nested versioned capability reference.
  capabilityId: 'test.option',
}

const invalidVersionlessProvider: OptionSourceRef = {
  type: 'provider',
  // @ts-expect-error every dynamic OptionSource reference must persist a version.
  capability: { capabilityId: 'test.option' },
}

// @ts-expect-error static OptionSource requires options.
const invalidStaticOptionSource: OptionSourceRef = {
  type: 'static',
}

const invalidProviderFields: OptionSourceRef = {
  type: 'provider',
  capability: { capabilityId: 'test.option', version: 1 },
  // @ts-expect-error Provider OptionSource already returns standard options and has no projection paths.
  labelPath: ['label'],
}

const validOptionRequest: RuntimeOptionRequest = {
  keyword: 'test',
  pageIndex: 0,
  pageSize: 20,
  signal: new AbortController().signal,
}

void staticOptionSource
void providerOptionSource
void dataSourceOptionSource
void invalidLegacyOptionSource
void invalidVersionlessProvider
void invalidStaticOptionSource
void invalidProviderFields
void validOptionRequest

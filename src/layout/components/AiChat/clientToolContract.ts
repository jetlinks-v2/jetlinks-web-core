import {
  AI_CLIENT_TOOL_PORT_VERSION,
  AI_CLIENT_TOOL_RESULT_DELIVERIES,
  defineAiClientToolRouting,
  type AiClientToolConsumerPort,
  type AiClientToolProducerPort,
  type AiClientToolRoutingDataAccessMode,
  type AiClientToolRoutingKind,
  type AiClientToolRoutingMetadata,
  type AiClientToolRoutingResultDelivery,
} from './clientToolRouting'
import {
  isCanonicalAiClientToolOutputField,
  normalizeAiClientToolOutputBindings,
  normalizeAiClientToolOutputFields,
  normalizeAiClientToolOrdering,
  withAiClientToolEvidence,
  type AiClientToolEvidenceOptions,
  type AiClientToolOutputBinding,
  type AiClientToolOutputField,
  type AiClientToolOrdering,
} from './clientToolResult'
import type { AiClientToolResultBindingDefinition } from './clientToolResultDelivery'
import {
  isSupportedAiClientToolBindingPath,
  normalizeAiClientToolRecordPath,
} from './clientToolBindingPath'

export const AI_CLIENT_TOOL_CONTRACT_VERSION = 'ai-client-tool-contract/v2'
export const AI_CLIENT_TOOL_CONTRACT_META_KEY = 'clientToolContract'

export const AI_CLIENT_TOOL_OUTPUT_KINDS = [
  'lookup',
  'record-set',
  'aggregate-series',
  'scalar-metric',
  'state-events',
  'artifact',
] as const

export type AiClientToolOutputKind = typeof AI_CLIENT_TOOL_OUTPUT_KINDS[number]

interface AiClientToolOutputContractBase {
  /** Closed, domain-neutral output category used by catalog diagnostics. */
  kind: AiClientToolOutputKind
  /** Canonical resource category; it is orthogonal to MIME type and shape. */
  type?: AiClientToolProducerPort['type']
  /** Stable logical binding name; it is not a JSON field or physical URI. */
  name: string
  /** Stable renderer-neutral shape owned by the producer. */
  shape: string
  /** Exact inline JSON path. Omit only when the output is materialized as a file at runtime. */
  path?: string
  /** Logical record collection inside the value selected by path/ref. */
  recordPath?: string
  label?: string
  mediaType?: string
  delivery?: AiClientToolRoutingResultDelivery
  fields?: AiClientToolOutputField[]
  ordering?: AiClientToolOrdering
}

export interface AiClientToolLookupOutput extends AiClientToolOutputContractBase {
  kind: 'lookup'
}

export interface AiClientToolRecordSetOutput extends AiClientToolOutputContractBase {
  kind: 'record-set'
}

export interface AiClientToolAggregateSeriesOutput extends AiClientToolOutputContractBase {
  kind: 'aggregate-series'
}

export interface AiClientToolScalarMetricOutput extends AiClientToolOutputContractBase {
  kind: 'scalar-metric'
}

export interface AiClientToolStateEventsOutput extends AiClientToolOutputContractBase {
  kind: 'state-events'
}

export interface AiClientToolArtifactOutput extends AiClientToolOutputContractBase {
  kind: 'artifact'
  mediaType: string
}

export type AiClientToolOutputContract =
  | AiClientToolLookupOutput
  | AiClientToolRecordSetOutput
  | AiClientToolAggregateSeriesOutput
  | AiClientToolScalarMetricOutput
  | AiClientToolStateEventsOutput
  | AiClientToolArtifactOutput

/** Producer-owned declaration from which browser and model-facing contracts are derived. */
export interface AiClientToolContractDefinition {
  routingKind: AiClientToolRoutingKind
  routing: Omit<
    AiClientToolRoutingMetadata,
    'portVersion' | 'consumerPorts' | 'producerPorts' |
    'accepts' | 'produces' | 'outputShapes' | 'prerequisites' | 'resultDeliveries'
  >
  inputs?: readonly AiClientToolConsumerPort[]
  outputs?: readonly AiClientToolOutputContract[]
}

/** Serializable catalog metadata retained only in the browser runtime. */
export interface AiClientToolContractMetadata {
  version: typeof AI_CLIENT_TOOL_CONTRACT_VERSION
  inputs: AiClientToolConsumerPort[]
  outputs: AiClientToolOutputContract[]
}

/** Contract fragment spread into the owning client-tool definition. */
export interface AiClientToolContractFragment {
  routing: AiClientToolRoutingMetadata
  _meta: {
    dataAccessMode?: AiClientToolRoutingDataAccessMode
    resultDelivery?: AiClientToolRoutingResultDelivery
    outputShape?: string | string[]
    cost?: AiClientToolRoutingMetadata['cost']
    prerequisites?: string[]
    resultBindings: AiClientToolResultBindingDefinition[]
    [AI_CLIENT_TOOL_CONTRACT_META_KEY]: AiClientToolContractMetadata
  }
}

const normalizedText = (value: unknown) => String(value || '').trim()

const unique = <T>(values: readonly T[]) => Array.from(new Set(values))

const validateOutputs = (outputs: readonly AiClientToolOutputContract[]) => {
  const names = new Set<string>()
  outputs.forEach((output) => {
    const name = normalizedText(output.name)
    const shape = normalizedText(output.shape)
    if (!name || !shape || !normalizedText(output.type) || !normalizedText(output.mediaType)) {
      throw new Error('Client tool output contract requires name, type, mediaType and shape')
    }
    const delivery = outputDelivery(output)
    if (output.path !== undefined && !isSupportedAiClientToolBindingPath(normalizedText(output.path))) {
      throw new Error(`Unsupported client tool output binding path: ${output.path}`)
    }
    if (output.recordPath !== undefined && !normalizeAiClientToolRecordPath(output.recordPath)) {
      throw new Error(`Unsupported client tool output record path: ${output.recordPath}`)
    }
    const fields = output.fields === undefined ? [] : normalizeAiClientToolOutputFields(output.fields)
    if (!fields || fields.length !== (output.fields?.length || 0)) {
      throw new Error(`Client tool output fields must use one complete canonical or released descriptor: ${name}`)
    }
    if (fields.some(isCanonicalAiClientToolOutputField) && output.recordPath === undefined) {
      throw new Error(`Canonical client tool output fields require an explicit recordPath: ${name}`)
    }
    if (output.ordering !== undefined && !normalizeAiClientToolOrdering(output.ordering, fields)) {
      throw new Error(`Client tool output ordering must reference declared fields: ${name}`)
    }
    if (delivery === 'file' && output.path !== undefined) {
      throw new Error(`File client tool output must not declare an inline binding path: ${name}`)
    }
    if (output.kind === 'artifact' && !normalizedText(output.mediaType)) {
      throw new Error(`Artifact client tool output requires a media type: ${name}`)
    }
    if (names.has(name)) {
      throw new Error(`Duplicate client tool output binding: ${name}`)
    }
    names.add(name)
  })
}

const validateInputs = (inputs: readonly AiClientToolConsumerPort[]) => {
  const names = new Set<string>()
  inputs.forEach((input) => {
    const name = normalizedText(input.name)
    if (!name || !normalizedText(input.type) || !normalizedText(input.mediaType)
      || !normalizedText(input.shape) || !normalizedText(input.sourcePolicy)) {
      throw new Error('Client tool input contract requires name, type, mediaType, shape and sourcePolicy')
    }
    if (names.has(name)) throw new Error(`Duplicate client tool input port: ${name}`)
    names.add(name)
  })
}

const copyInput = (input: AiClientToolConsumerPort): AiClientToolConsumerPort => ({
  name: normalizedText(input.name),
  type: input.type,
  mediaType: normalizedText(input.mediaType).toLowerCase(),
  shape: normalizedText(input.shape).toLowerCase(),
  required: input.required === true,
  sourcePolicy: input.sourcePolicy,
})

const copyOutput = (output: AiClientToolOutputContract): AiClientToolOutputContract => {
  if (output.kind === 'artifact' && !normalizedText(output.mediaType)) {
    throw new Error(`Artifact client tool output requires a media type: ${output.name}`)
  }
  const { fields: declaredFields, ordering: declaredOrdering, ...rest } = output
  const fields = declaredFields === undefined
    ? undefined
    : normalizeAiClientToolOutputFields(declaredFields)
  if (declaredFields !== undefined && !fields) {
    throw new Error(`Client tool output fields must use one complete canonical or released descriptor: ${output.name}`)
  }
  const ordering = declaredOrdering === undefined
    ? undefined
    : normalizeAiClientToolOrdering(declaredOrdering, fields)
  if (declaredOrdering !== undefined && !ordering) {
    throw new Error(`Client tool output ordering must reference declared fields: ${output.name}`)
  }
  const declaredRecordPath = output.recordPath === undefined
    ? undefined
    : normalizeAiClientToolRecordPath(output.recordPath)
  if (output.recordPath !== undefined && !declaredRecordPath) {
    throw new Error(`Unsupported client tool output record path: ${output.recordPath}`)
  }
  if (fields?.some(isCanonicalAiClientToolOutputField) && !declaredRecordPath) {
    throw new Error(`Canonical client tool output fields require an explicit recordPath: ${output.name}`)
  }
  return {
    ...rest,
    name: normalizedText(output.name),
    type: output.type || (output.kind === 'artifact'
      ? 'artifact'
      : output.kind === 'state-events' ? 'state' : 'structured-data'),
    mediaType: normalizedText(output.mediaType || 'application/json').toLowerCase(),
    shape: normalizedText(output.shape),
    ...(output.path ? { path: normalizedText(output.path) } : {}),
    ...(declaredRecordPath ? { recordPath: declaredRecordPath } : {}),
    ...(fields ? { fields } : {}),
    ...(ordering ? { ordering } : {}),
  } as AiClientToolOutputContract
}

const outputDelivery = (output: AiClientToolOutputContract): AiClientToolRoutingResultDelivery => (
  output.delivery || (output.kind === 'artifact' ? 'file' : 'inline')
)

/**
 * Creates the model-facing routing metadata, browser-only binding paths and typed catalog metadata
 * from one producer-owned source. It never infers semantics from tool ids, descriptions or result fields.
 */
export const defineAiClientToolContract = (
  definition: AiClientToolContractDefinition,
): AiClientToolContractFragment => {
  const inputs = (definition.inputs || []).map(copyInput)
  const outputs = (definition.outputs || []).map(copyOutput)
  validateInputs(inputs)
  validateOutputs(outputs)
  const deliveries = unique(outputs.map(outputDelivery))
  const routing = defineAiClientToolRouting(definition.routingKind, {
    ...definition.routing,
    portVersion: AI_CLIENT_TOOL_PORT_VERSION,
    ...(inputs.length ? {
      consumerPorts: inputs,
      accepts: inputs.map(input => input.name),
      ...(inputs.some(input => input.required) ? {
        prerequisites: inputs.filter(input => input.required).map(input => input.name),
      } : {}),
    } : {}),
    ...(outputs.length ? {
      producerPorts: outputs.map((output): AiClientToolProducerPort => ({
        name: output.name,
        type: output.type || 'structured-data',
        mediaType: output.mediaType || 'application/json',
        shape: output.shape,
      })),
      produces: outputs.map(output => output.name),
      outputShapes: outputs.map(output => output.shape),
      resultDeliveries: deliveries,
    } : {}),
  })
  const resultBindings = outputs.flatMap((output): AiClientToolResultBindingDefinition[] => (
    output.path && outputDelivery(output) !== 'file' ? [{
      name: output.name,
      type: output.type || 'structured-data',
      ...(output.label ? { label: output.label } : {}),
      path: output.path,
      shape: output.shape,
      ...(output.mediaType ? { mediaType: output.mediaType } : {}),
      ...(output.fields?.length ? { fields: output.fields.map(field => ({ ...field })) } : {}),
      ...(output.ordering ? { ordering: output.ordering } : {}),
    }] : []
  ))
  const outputShapes = outputs.map(output => output.shape)
  return {
    routing,
    _meta: {
      ...(routing.dataAccessModes?.length === 1 ? { dataAccessMode: routing.dataAccessModes[0] } : {}),
      ...(deliveries.length === 1 ? { resultDelivery: deliveries[0] } : {}),
      ...(outputShapes.length === 1
        ? { outputShape: outputShapes[0] }
        : outputShapes.length ? { outputShape: outputShapes } : {}),
      ...(routing.cost ? { cost: routing.cost } : {}),
      ...(routing.prerequisites?.length ? { prerequisites: [...routing.prerequisites] } : {}),
      resultBindings,
      [AI_CLIENT_TOOL_CONTRACT_META_KEY]: {
        version: AI_CLIENT_TOOL_CONTRACT_VERSION,
        inputs,
        outputs,
      },
    },
  }
}

export interface AiClientToolContractOutputState extends Omit<
  AiClientToolOutputBinding,
  'label' | 'shape' | 'recordPath' | 'fields' | 'ordering'
> {
  name: string
  /** Execution-specific user-facing label; stable name and shape still come from the declaration. */
  label?: string
}

/** Execution facts supplied after the owning producer has run. */
export interface AiClientToolContractEvidenceOptions extends Omit<
  AiClientToolEvidenceOptions,
  'outputBindings'
> {
  outputs: readonly AiClientToolContractOutputState[]
}

const outputContractByName = (
  contract: AiClientToolContractFragment,
  name: string,
) => contract._meta[AI_CLIENT_TOOL_CONTRACT_META_KEY].outputs.find(output => output.name === name)

/** Builds an execution binding from the same descriptor that produced routing and catalog metadata. */
export const createAiClientToolContractOutputBinding = (
  contract: AiClientToolContractFragment,
  state: AiClientToolContractOutputState,
): AiClientToolOutputBinding => {
  const output = outputContractByName(contract, state.name)
  if (!output) throw new Error(`Undeclared client tool output binding: ${state.name}`)
  const ref = normalizedText(state.ref)
  if (ref.startsWith('$')) {
    throw new Error(`Materialized client tool output reference must not be a JSONPath: ${state.name}`)
  }
  // A materialized reference is authoritative. Physical file paths must never leak into the
  // inline JSONPath field consumed by the backend resource extractor.
  const path = ref ? '' : normalizedText(state.path || output.path)
  if (path && !isSupportedAiClientToolBindingPath(path)) {
    throw new Error(`Unsupported client tool execution binding path: ${path}`)
  }
  if (!path && !ref) {
    throw new Error(`Client tool output binding has no inline path or materialized reference: ${state.name}`)
  }
  const recordPath = output.recordPath === undefined
    ? undefined
    : normalizeAiClientToolRecordPath(output.recordPath)
  const fields = output.fields?.map(field => ({ ...field }))
  const ordering = output.ordering
    ? normalizeAiClientToolOrdering(output.ordering, fields)
    : undefined
  const label = normalizedText(state.label) || normalizedText(output.label)
  const canonicalFields = !!fields?.length && fields.every(isCanonicalAiClientToolOutputField)
  const completeness = state.completeness || (canonicalFields
    ? state.complete ? 'complete' : state.continuation ? 'partial' : 'truncated'
    : undefined)
  const binding: AiClientToolOutputBinding = {
    name: output.name,
    type: output.type || 'structured-data',
    ...(label ? { label } : {}),
    ...(ref ? { ref } : {}),
    ...(path ? { path } : {}),
    ...(recordPath ? { recordPath } : {}),
    shape: output.shape,
    ...(state.mediaType || output.mediaType ? { mediaType: state.mediaType || output.mediaType } : {}),
    ...(Number.isFinite(state.recordCount) ? { recordCount: Number(state.recordCount) } : {}),
    complete: state.complete,
    ...(state.truncated !== undefined ? { truncated: state.truncated } : {}),
    ...(completeness ? { completeness } : {}),
    ...(completeness === 'partial' && state.continuation
      ? { continuation: { ...state.continuation } }
      : {}),
    ...(fields?.length ? { fields } : {}),
    ...(ordering ? { ordering } : {}),
    ...(state.requestedRange ? { requestedRange: { ...state.requestedRange } } : {}),
    ...(state.observedRange ? { observedRange: { ...state.observedRange } } : {}),
    ...(state.coverage ? { coverage: { ...state.coverage } } : {}),
    ...(state.metric ? { metric: { ...state.metric } } : {}),
  }
  const normalized = normalizeAiClientToolOutputBindings([binding])[0]
  if (!normalized) throw new Error(`Invalid client tool execution binding: ${state.name}`)
  return normalized
}

/** Attaches canonical evidence without allowing runtime code to restate logical output semantics. */
export const withAiClientToolContractEvidence = <T extends Record<string, unknown>>(
  result: T,
  contract: AiClientToolContractFragment,
  options: AiClientToolContractEvidenceOptions,
) => {
  const names = new Set<string>()
  const outputBindings = options.outputs.map((output) => {
    const name = normalizedText(output.name)
    if (names.has(name)) throw new Error(`Duplicate client tool execution binding: ${name}`)
    names.add(name)
    return createAiClientToolContractOutputBinding(contract, output)
  })
  return withAiClientToolEvidence(result, {
    ...options,
    outputBindings,
  })
}

export const isAiClientToolContractMetadata = (
  value: unknown,
): value is AiClientToolContractMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const metadata = value as Record<string, unknown>
  if (metadata.version !== AI_CLIENT_TOOL_CONTRACT_VERSION
    || !Array.isArray(metadata.inputs)
    || !Array.isArray(metadata.outputs)) return false
  const inputNames = new Set<string>()
  if (!metadata.inputs.every((input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return false
    const record = input as Record<string, unknown>
    const name = normalizedText(record.name)
    if (!name || inputNames.has(name)
      || !normalizedText(record.type)
      || !normalizedText(record.mediaType)
      || !normalizedText(record.shape)
      || typeof record.required !== 'boolean'
      || !normalizedText(record.sourcePolicy)) return false
    inputNames.add(name)
    return true
  })) return false
  const names = new Set<string>()
  return metadata.outputs.every((output) => {
      if (!output || typeof output !== 'object' || Array.isArray(output)) return false
      const record = output as Record<string, unknown>
      const kind = record.kind as AiClientToolOutputKind
      const name = normalizedText(record.name)
      const delivery = normalizedText(record.delivery)
      const path = record.path === undefined ? '' : normalizedText(record.path)
      const recordPath = record.recordPath === undefined
        ? undefined
        : normalizeAiClientToolRecordPath(record.recordPath)
      const fields = Array.isArray(record.fields)
        ? normalizeAiClientToolOutputFields(record.fields as AiClientToolOutputField[])
        : undefined
      const ordering = record.ordering === undefined
        ? undefined
        : normalizeAiClientToolOrdering(
            record.ordering,
            fields,
          )
      if (!AI_CLIENT_TOOL_OUTPUT_KINDS.includes(kind)
        || !name
        || names.has(name)
        || !normalizedText(record.type)
        || !normalizedText(record.mediaType)
        || !normalizedText(record.shape)
        || (delivery && !AI_CLIENT_TOOL_RESULT_DELIVERIES.includes(delivery as AiClientToolRoutingResultDelivery))
        || (record.path !== undefined && !isSupportedAiClientToolBindingPath(path))
        || (record.recordPath !== undefined && !recordPath)
        || (record.fields !== undefined && !Array.isArray(record.fields))
        || (Array.isArray(record.fields) && fields?.length !== record.fields.length)
        || (!!fields?.some(isCanonicalAiClientToolOutputField) && record.recordPath === undefined)
        || ((delivery === 'file' || (kind === 'artifact' && !delivery)) && record.path !== undefined)
        || (record.ordering !== undefined && !ordering)
        || (kind === 'artifact' && !normalizedText(record.mediaType))) return false
      names.add(name)
      return true
    })
}

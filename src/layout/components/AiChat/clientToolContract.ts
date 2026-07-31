import {
  AI_CLIENT_TOOL_RESULT_DELIVERIES,
  defineAiClientToolRouting,
  type AiClientToolRoutingDataAccessMode,
  type AiClientToolRoutingKind,
  type AiClientToolRoutingMetadata,
  type AiClientToolRoutingResultDelivery,
} from './clientToolRouting'
import {
  withAiClientToolEvidence,
  type AiClientToolEvidenceOptions,
  type AiClientToolOutputBinding,
  type AiClientToolOutputField,
} from './clientToolResult'
import type { AiClientToolResultBindingDefinition } from './clientToolResultDelivery'
import {
  isSupportedAiClientToolBindingPath,
  normalizeAiClientToolRecordPath,
} from './clientToolBindingPath'

export const AI_CLIENT_TOOL_CONTRACT_VERSION = 'ai-client-tool-contract/v1'
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
  /** Stable logical binding name; it is not a JSON field or physical URI. */
  name: string
  /** Stable renderer-neutral shape owned by the producer. */
  shape: string
  /** Exact inline JSON path. Omit only when the output is materialized as a file at runtime. */
  path?: string
  label?: string
  mediaType?: string
  delivery?: AiClientToolRoutingResultDelivery
  fields?: AiClientToolOutputField[]
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
    'produces' | 'outputShapes' | 'resultDeliveries'
  >
  outputs?: readonly AiClientToolOutputContract[]
}

/** Serializable catalog metadata retained only in the browser runtime. */
export interface AiClientToolContractMetadata {
  version: typeof AI_CLIENT_TOOL_CONTRACT_VERSION
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
    if (!name || !shape) {
      throw new Error('Client tool output contract requires a stable name and shape')
    }
    const delivery = outputDelivery(output)
    if (output.path !== undefined && !isSupportedAiClientToolBindingPath(normalizedText(output.path))) {
      throw new Error(`Unsupported client tool output binding path: ${output.path}`)
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

const copyOutput = (output: AiClientToolOutputContract): AiClientToolOutputContract => ({
  ...output,
  name: normalizedText(output.name),
  shape: normalizedText(output.shape),
  ...(output.path ? { path: normalizedText(output.path) } : {}),
  ...(output.fields ? { fields: output.fields.map(field => ({ ...field })) } : {}),
})

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
  const outputs = (definition.outputs || []).map(copyOutput)
  validateOutputs(outputs)
  const deliveries = unique(outputs.map(outputDelivery))
  const routing = defineAiClientToolRouting(definition.routingKind, {
    ...definition.routing,
    ...(outputs.length ? {
      produces: outputs.map(output => output.name),
      outputShapes: outputs.map(output => output.shape),
      resultDeliveries: deliveries,
    } : {}),
  })
  const resultBindings = outputs.flatMap((output): AiClientToolResultBindingDefinition[] => (
    output.path && outputDelivery(output) !== 'file' ? [{
      name: output.name,
      ...(output.label ? { label: output.label } : {}),
      path: output.path,
      shape: output.shape,
      ...(output.mediaType ? { mediaType: output.mediaType } : {}),
      ...(output.fields?.length ? { fields: output.fields.map(field => ({ ...field })) } : {}),
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
        outputs,
      },
    },
  }
}

export interface AiClientToolContractOutputState extends Omit<
  AiClientToolOutputBinding,
  'label' | 'shape'
> {
  name: string
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
  const recordPath = state.recordPath === undefined
    ? undefined
    : normalizeAiClientToolRecordPath(state.recordPath)
  if (state.recordPath !== undefined && !recordPath) {
    throw new Error(`Unsupported client tool record path: ${state.recordPath}`)
  }
  return {
    name: output.name,
    ...(output.label ? { label: output.label } : {}),
    ...(ref ? { ref } : {}),
    ...(path ? { path } : {}),
    ...(recordPath ? { recordPath } : {}),
    shape: output.shape,
    ...(state.mediaType || output.mediaType ? { mediaType: state.mediaType || output.mediaType } : {}),
    ...(Number.isFinite(state.recordCount) ? { recordCount: Number(state.recordCount) } : {}),
    complete: state.complete,
    ...(state.truncated !== undefined ? { truncated: state.truncated } : {}),
    ...(state.fields?.length
      ? { fields: state.fields.map(field => ({ ...field })) }
      : output.fields?.length ? { fields: output.fields.map(field => ({ ...field })) } : {}),
    ...(state.requestedRange ? { requestedRange: { ...state.requestedRange } } : {}),
    ...(state.observedRange ? { observedRange: { ...state.observedRange } } : {}),
    ...(state.coverage ? { coverage: { ...state.coverage } } : {}),
    ...(state.metric ? { metric: { ...state.metric } } : {}),
  }
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
  if (metadata.version !== AI_CLIENT_TOOL_CONTRACT_VERSION || !Array.isArray(metadata.outputs)) return false
  const names = new Set<string>()
  return metadata.outputs.every((output) => {
      if (!output || typeof output !== 'object' || Array.isArray(output)) return false
      const record = output as Record<string, unknown>
      const kind = record.kind as AiClientToolOutputKind
      const name = normalizedText(record.name)
      const delivery = normalizedText(record.delivery)
      const path = record.path === undefined ? '' : normalizedText(record.path)
      if (!AI_CLIENT_TOOL_OUTPUT_KINDS.includes(kind)
        || !name
        || names.has(name)
        || !normalizedText(record.shape)
        || (delivery && !AI_CLIENT_TOOL_RESULT_DELIVERIES.includes(delivery as AiClientToolRoutingResultDelivery))
        || (record.path !== undefined && !isSupportedAiClientToolBindingPath(path))
        || ((delivery === 'file' || (kind === 'artifact' && !delivery)) && record.path !== undefined)
        || (kind === 'artifact' && !normalizedText(record.mediaType))) return false
      names.add(name)
      return true
    })
}

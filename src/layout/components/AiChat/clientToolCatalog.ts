import {
  AI_CLIENT_TOOL_CONTRACT_META_KEY,
  diagnoseAiClientToolOutputPresentationCompatibility,
  isAiClientToolContractMetadata,
  type AiClientToolContractMetadata,
  type AiClientToolOutputKind,
} from './clientToolContract'
import type { GeneralAgentMarkdownPresentationCapability } from './generalAgentExtensions'
import {
  toAiClientToolSessionDefinition,
  validateAiClientToolResultBindings,
  validateAiClientToolRoutingCatalog,
  validateAiClientToolEffectMetadata,
  validateAiClientToolRoutingMetadata,
  type AiClientToolEffectStatus,
  type AiClientToolRoutingCatalogIssue,
  type AiClientToolRoutingCatalogValidationOptions,
  type AiClientToolRoutingMetadata,
  type AiClientToolRoutingSource,
  type AiClientToolRoutingStatus,
} from './clientToolRouting'
import {
  CLIENT_TOOL_DEFINITION_META_KEY,
  isCompiledClientToolDefinition,
} from './clientToolDefinition'

export const AI_CLIENT_TOOL_CATALOG_REPORT_VERSION = 'ai-client-tool-catalog-report/v1'
export const AI_CLIENT_TOOL_CATALOG_SNAPSHOT_VERSION = 'ai-client-tool-catalog-snapshot/v1'

export type AiClientToolCatalogContractStatus = 'typed' | 'legacy' | 'malformed'
export type AiClientToolCatalogAuthoringStatus =
  | 'facade'
  | 'typed-legacy'
  | 'routed-legacy'
  | 'plain-legacy'
  | 'remote-adapted'

/** Per-tool diagnostics; one malformed declaration never suppresses sibling tools. */
export interface AiClientToolCatalogToolReport {
  toolId: string
  routingStatus: AiClientToolRoutingStatus
  contractStatus: AiClientToolCatalogContractStatus
  authoringStatus: AiClientToolCatalogAuthoringStatus
  effectStatus: AiClientToolEffectStatus
  outputKinds: AiClientToolOutputKind[]
  issues: AiClientToolRoutingCatalogIssue[]
}

/** Machine-readable migration and CI baseline for one authorized client-tool catalog. */
export interface AiClientToolCatalogReport {
  version: typeof AI_CLIENT_TOOL_CATALOG_REPORT_VERSION
  valid: boolean
  summary: {
    total: number
    routed: number
    missingRouting: number
    malformedRouting: number
    typed: number
    legacy: number
    malformedContract: number
    facade: number
    typedLegacy: number
    routedLegacy: number
    plainLegacy: number
    remoteAdapted: number
    canonicalEffect: number
    legacyEffect: number
    missingEffect: number
    malformedEffect: number
    affectedTools: number
    issues: number
  }
  tools: AiClientToolCatalogToolReport[]
  issues: AiClientToolRoutingCatalogIssue[]
}

export interface AiClientToolCatalogSnapshot<T extends AiClientToolRoutingSource = AiClientToolRoutingSource> {
  version: typeof AI_CLIENT_TOOL_CATALOG_SNAPSHOT_VERSION
  definitions: T[]
  wireDefinitions: ReturnType<typeof toAiClientToolSessionDefinition>[]
  report: AiClientToolCatalogReport
  /** Exact canonical projection used for equality; it does not rely on a compact hash. */
  semanticFingerprint: string
  /** Compact telemetry identity for the exact semantic fingerprint. */
  semanticDigest: string
}

export interface AiClientToolCatalogOptions extends AiClientToolRoutingCatalogValidationOptions {
  /** Installed renderer descriptors used only for static output compatibility diagnostics. */
  presentationCapabilities?: readonly GeneralAgentMarkdownPresentationCapability[]
}

const text = (value: unknown) => String(value || '').trim()

const normalizeValueType = (value: unknown) => {
  if (!value) return { type: 'string' }
  return typeof value === 'string' ? { type: value } : value
}

const normalizeCatalogDefinition = <T extends AiClientToolRoutingSource>(tool: T): T => {
  const id = text(tool.id || tool.name)
  const inputs = Array.isArray(tool.inputs)
    ? tool.inputs.map(input => ({
      ...input,
      name: text(input.name || input.id),
      valueType: normalizeValueType(input.valueType),
    }))
    : []
  return {
    ...tool,
    id,
    name: id,
    inputs,
    output: normalizeValueType(tool.output || { type: 'object' }),
  }
}

const CATALOG_SET_FIELDS = new Set([
  'aliases', 'capabilities', 'accepts', 'produces', 'intents', 'notFor', 'stages',
  'dataAccessModes', 'resultDeliveries', 'outputShapes', 'prerequisites', 'validationHints',
])

const canonicalize = (value: unknown, parentKey = ''): unknown => {
  if (Array.isArray(value)) {
    const values = value.map(item => canonicalize(item, parentKey))
    return CATALOG_SET_FIELDS.has(parentKey)
      ? [...values].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
      : values
  }
  if (!value || typeof value !== 'object') {
    return typeof value === 'function' || value === undefined ? undefined : value
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined && typeof item !== 'function')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, canonicalize(item, key)]))
}

const compactDigest = (value: string) => {
  let left = 0x811c9dc5
  let right = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    left = Math.imul(left ^ code, 0x01000193)
    right = Math.imul(right ^ code, 0x85ebca6b)
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`
}

const contractMetadata = (tool: AiClientToolRoutingSource) => {
  const meta = tool._meta && typeof tool._meta === 'object' && !Array.isArray(tool._meta)
    ? tool._meta
    : undefined
  return meta?.[AI_CLIENT_TOOL_CONTRACT_META_KEY]
}

const authoringStatus = (
  tool: AiClientToolRoutingSource,
  routingStatus: AiClientToolRoutingStatus,
  typedContract: boolean,
): AiClientToolCatalogAuthoringStatus => {
  const meta = tool._meta && typeof tool._meta === 'object' && !Array.isArray(tool._meta)
    ? tool._meta
    : undefined
  if (isCompiledClientToolDefinition(meta?.[CLIENT_TOOL_DEFINITION_META_KEY])) return 'facade'
  if (meta?.clientToolAdapter && typeof meta.clientToolAdapter === 'object') return 'remote-adapted'
  if (typedContract) return 'typed-legacy'
  if (routingStatus === 'valid') return 'routed-legacy'
  return 'plain-legacy'
}

const normalizedList = (values: readonly unknown[] = []) => Array.from(new Set(
  values.map(value => text(value).toLowerCase()).filter(Boolean),
))

const sameOrderedList = (left: readonly string[], right: readonly string[]) => (
  left.length === right.length && left.every((value, index) => value === right[index])
)

const sameSet = (left: readonly string[], right: readonly string[]) => (
  left.length === right.length && left.every(value => right.includes(value))
)

const contractRoutingIssues = (
  toolId: string,
  contract: AiClientToolContractMetadata,
  routing: AiClientToolRoutingMetadata | undefined,
): AiClientToolRoutingCatalogIssue[] => {
  if (!routing) return []
  const produces = normalizedList(routing.produces)
  const shapes = normalizedList(routing.outputShapes)
  const deliveries = normalizedList(routing.resultDeliveries)
  const contractProduces = normalizedList(contract.outputs.map(output => output.name))
  const contractShapes = normalizedList(contract.outputs.map(output => output.shape))
  const contractDeliveries = Array.from(new Set(contract.outputs.map(output => (
    output.delivery || (output.kind === 'artifact' ? 'file' : 'inline')
  )))).map(value => value.toLowerCase())
  const issues: AiClientToolRoutingCatalogIssue[] = []
  const contractConsumes = normalizedList(contract.inputs.map(input => input.name))
  const routingConsumes = normalizedList(routing.consumerPorts?.map(input => input.name))
  const routingProducerNames = normalizedList(routing.producerPorts?.map(output => output.name))
  const routingProducerPorts = routing.producerPorts || []
  const contractProducerPorts = contract.outputs.map(output => ({
    name: output.name.toLowerCase(),
    type: (output.type || 'structured-data').toLowerCase(),
    mediaType: (output.mediaType || 'application/json').toLowerCase(),
    shape: output.shape.toLowerCase(),
    audience: output.audience,
  }))
  if (!sameOrderedList(routingConsumes, contractConsumes)
    || !sameOrderedList(routingProducerNames, contractProduces)
    || JSON.stringify(routingProducerPorts) !== JSON.stringify(contractProducerPorts)) {
    issues.push({
      toolId,
      code: 'typed_contract_port_mismatch',
      field: 'routing.consumerPorts/producerPorts',
      message: 'routing canonical ports must be generated from the typed contract',
    })
  }
  if (!sameOrderedList(produces, contractProduces)) {
    issues.push({
      toolId,
      code: 'typed_contract_routing_mismatch',
      field: 'routing.produces',
      message: 'routing produces must be generated from typed contract outputs',
    })
  }
  if (!sameOrderedList(shapes, contractShapes)) {
    issues.push({
      toolId,
      code: 'typed_contract_routing_mismatch',
      field: 'routing.outputShapes',
      message: 'routing output shapes must be generated from typed contract outputs',
    })
  }
  if (contract.outputs.length && !sameSet(deliveries, contractDeliveries)) {
    issues.push({
      toolId,
      code: 'typed_contract_routing_mismatch',
      field: 'routing.resultDeliveries',
      message: 'routing result deliveries must be generated from typed contract outputs',
    })
  }
  return issues
}

/**
 * Produces a deterministic, machine-readable catalog baseline. Missing routing remains observable but
 * non-blocking unless the caller enables requireRouting; malformed typed metadata is always reported.
 */
export const createAiClientToolCatalogReport = (
  tools: readonly AiClientToolRoutingSource[] = [],
  options: AiClientToolCatalogOptions = {},
): AiClientToolCatalogReport => {
  const issues = validateAiClientToolRoutingCatalog(tools, options)
  const toolsReport = tools.map((tool): AiClientToolCatalogToolReport => {
    const toolId = text(tool.id || tool.name)
    const routing = validateAiClientToolRoutingMetadata(tool)
    const effect = validateAiClientToolEffectMetadata(tool)
    effect.issues.forEach(issue => issues.push({ toolId, ...issue }))
    const rawContract = contractMetadata(tool)
    const typedContract = isAiClientToolContractMetadata(rawContract)
    const alignmentIssues = typedContract
      ? contractRoutingIssues(toolId, rawContract, routing.metadata)
      : []
    if (rawContract !== undefined && !typedContract) {
      issues.push({
        toolId,
        code: 'typed_contract_malformed',
        field: `_meta.${AI_CLIENT_TOOL_CONTRACT_META_KEY}`,
        message: 'typed client-tool contract metadata is malformed',
      })
    }
    issues.push(...alignmentIssues)
    if (typedContract && options.presentationCapabilities) {
      rawContract.outputs
        .filter(output => output.audience === 'client-presentation')
        .forEach((output) => {
          const compatible = options.presentationCapabilities!.filter(capability => (
            !diagnoseAiClientToolOutputPresentationCompatibility(output, capability).length
          ))
          if (!compatible.length) {
            issues.push({
              toolId,
              code: 'presentation_output_incompatible',
              field: `_meta.${AI_CLIENT_TOOL_CONTRACT_META_KEY}.outputs.${output.name}`,
              message: 'client-presentation output has no compatible installed renderer capability',
            })
          }
        })
    }
    const bindingIssues = options.requireResultBindings
      ? validateAiClientToolResultBindings(tool)
      : []
    const contractStatus: AiClientToolCatalogContractStatus = rawContract === undefined
      ? 'legacy'
      : typedContract && !alignmentIssues.length && !bindingIssues.length ? 'typed' : 'malformed'
    const toolIssues = issues.filter(issue => issue.toolId === toolId)
    bindingIssues.forEach((issue) => {
      if (!toolIssues.some(existing => existing.code === issue.code
        && existing.field === issue.field
        && existing.message === issue.message)) {
        const catalogIssue = { toolId, ...issue }
        issues.push(catalogIssue)
        toolIssues.push(catalogIssue)
      }
    })
    return {
      toolId,
      routingStatus: routing.status,
      contractStatus,
      authoringStatus: authoringStatus(tool, routing.status, typedContract),
      effectStatus: effect.status,
      outputKinds: typedContract
        ? Array.from(new Set(rawContract.outputs.map(output => output.kind)))
        : [],
      issues: toolIssues,
    }
  })
  const routed = toolsReport.filter(tool => tool.routingStatus === 'valid').length
  const malformedRouting = toolsReport.filter(tool => tool.routingStatus === 'malformed').length
  const typed = toolsReport.filter(tool => tool.contractStatus === 'typed').length
  const malformedContract = toolsReport.filter(tool => tool.contractStatus === 'malformed').length
  const authoringCounts = (status: AiClientToolCatalogAuthoringStatus) => (
    toolsReport.filter(tool => tool.authoringStatus === status).length
  )
  return {
    version: AI_CLIENT_TOOL_CATALOG_REPORT_VERSION,
    valid: issues.length === 0,
    summary: {
      total: toolsReport.length,
      routed,
      missingRouting: toolsReport.length - routed - malformedRouting,
      malformedRouting,
      typed,
      legacy: toolsReport.length - typed - malformedContract,
      malformedContract,
      facade: authoringCounts('facade'),
      typedLegacy: authoringCounts('typed-legacy'),
      routedLegacy: authoringCounts('routed-legacy'),
      plainLegacy: authoringCounts('plain-legacy'),
      remoteAdapted: authoringCounts('remote-adapted'),
      canonicalEffect: toolsReport.filter(tool => tool.effectStatus === 'canonical').length,
      legacyEffect: toolsReport.filter(tool => tool.effectStatus === 'legacy').length,
      missingEffect: toolsReport.filter(tool => tool.effectStatus === 'missing').length,
      malformedEffect: toolsReport.filter(tool => tool.effectStatus === 'malformed').length,
      affectedTools: toolsReport.filter(tool => tool.issues.length).length,
      issues: issues.length,
    },
    tools: toolsReport,
    issues,
  }
}

/**
 * Normalizes and serializes a complete authorized catalog once. Typed routing defects degrade
 * only typed capabilities; ambiguous identity or malformed effect metadata isolates that tool.
 */
export const createAiClientToolCatalogSnapshot = <T extends AiClientToolRoutingSource>(
  tools: readonly T[] = [],
  options: AiClientToolCatalogOptions = {},
): AiClientToolCatalogSnapshot<T> => {
  const normalized = tools.map(tool => normalizeCatalogDefinition(tool))
  const report = createAiClientToolCatalogReport(normalized, options)
  const isolatedIds = new Set(report.issues
    .filter(issue => issue.code === 'duplicate_tool_id' || issue.code === 'invalid_tool_id')
    .map(issue => issue.toolId))
  const admitted = normalized.flatMap((tool, index) => {
    const toolReport = report.tools[index]
    const admitted = !!toolReport?.toolId
      && !isolatedIds.has(toolReport.toolId)
      && toolReport.effectStatus !== 'malformed'
    if (!admitted) return []
    const wireSource = toolReport.routingStatus === 'malformed'
      || toolReport.contractStatus === 'malformed'
      ? { ...tool, routing: undefined }
      : tool
    return [{ definition: tool, wireDefinition: toAiClientToolSessionDefinition(wireSource) }]
  })
  const definitions = admitted.map(item => item.definition)
  const wireDefinitions = admitted.map(item => item.wireDefinition)
  const activeIds = new Set(definitions.map(tool => text(tool.id)))
  const semanticFingerprint = JSON.stringify(canonicalize({
    version: AI_CLIENT_TOOL_CATALOG_SNAPSHOT_VERSION,
    tools: report.tools.map(tool => ({
      toolId: tool.toolId,
      authoringStatus: tool.authoringStatus,
      routingStatus: tool.routingStatus,
      contractStatus: tool.contractStatus,
      effectStatus: tool.effectStatus,
      isolated: !activeIds.has(tool.toolId),
      issues: tool.issues.map(issue => ({ code: issue.code, field: issue.field })),
    })),
    wireDefinitions,
  }))
  return {
    version: AI_CLIENT_TOOL_CATALOG_SNAPSHOT_VERSION,
    definitions,
    wireDefinitions,
    report,
    semanticFingerprint,
    semanticDigest: compactDigest(semanticFingerprint),
  }
}

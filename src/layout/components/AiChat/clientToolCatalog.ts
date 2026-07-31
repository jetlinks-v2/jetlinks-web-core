import {
  AI_CLIENT_TOOL_CONTRACT_META_KEY,
  isAiClientToolContractMetadata,
  type AiClientToolContractMetadata,
  type AiClientToolOutputKind,
} from './clientToolContract'
import {
  validateAiClientToolResultBindings,
  validateAiClientToolRoutingCatalog,
  validateAiClientToolRoutingMetadata,
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
    affectedTools: number
    issues: number
  }
  tools: AiClientToolCatalogToolReport[]
  issues: AiClientToolRoutingCatalogIssue[]
}

const text = (value: unknown) => String(value || '').trim()

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
  options: AiClientToolRoutingCatalogValidationOptions = {},
): AiClientToolCatalogReport => {
  const issues = validateAiClientToolRoutingCatalog(tools, options)
  const toolsReport = tools.map((tool): AiClientToolCatalogToolReport => {
    const toolId = text(tool.id || tool.name)
    const routing = validateAiClientToolRoutingMetadata(tool)
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
      affectedTools: toolsReport.filter(tool => tool.issues.length).length,
      issues: issues.length,
    },
    tools: toolsReport,
    issues,
  }
}

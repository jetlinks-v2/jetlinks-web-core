import {
  defineAiClientToolFactory,
  defineAiClientTools,
  type AiClientToolDefinition,
  type AiClientToolFactory,
  type AiClientToolSource,
} from './clientTools'

export {
  CLIENT_TOOL_DEFINITION_META_KEY,
  CLIENT_TOOL_DEFINITION_VERSION,
  clientToolOutput,
  clientToolResult,
  defineClientToolAnalyticalProducer,
  defineClientToolBoundedAnalyticalProducer,
  defineClientToolScope,
  defineClientTool,
  defineClientToolStringArgumentBinding,
  isCompiledClientToolDefinition,
} from './clientToolDefinition'

/** Shared materialized-output helpers are re-exported so business tools never import runtime internals. */
export { createAiClientToolArtifact } from './clientToolResultDelivery'
export { toAiClientToolSessionDefinition } from './clientToolRouting'

export type { AiClientToolArtifact } from './clientToolResultDelivery'
export type { AiClientToolOutputField } from './clientToolResult'

export type {
  ClientToolActivation,
  ClientToolAnalyticalAuthoring,
  ClientToolBoundedAnalyticalCriterion,
  ClientToolAnalyticalCoverage,
  ClientToolAnalyticalMeasure,
  ClientToolAnalyticalOrdering,
  ClientToolAnalyticalProducerDefinition,
  ClientToolAnalyticalSemanticIntentBindingDefinition,
  ClientToolArtifactOutput,
  ClientToolBoundedAnalyticalProducerDefinition,
  ClientToolConfirmation,
  ClientToolConsumedResource,
  ClientToolDefinition,
  ClientToolDescription,
  ClientToolDetailOutput,
  ClientToolEffect,
  ClientToolEffectKind,
  ClientToolExecutionResult,
  ClientToolExternalActionEffect,
  ClientToolIdempotency,
  ClientToolInput,
  ClientToolInputAlternative,
  ClientToolInputCondition,
  ClientToolLookupOutput,
  ClientToolOutput,
  ClientToolOwner,
  ClientToolPresentation,
  ClientToolPreparedConfirmation,
  ClientToolPreparedExecution,
  ClientToolPreparationResult,
  ClientToolReadEffect,
  ClientToolRecordSetOutput,
  ClientToolScopeAuthoring,
  ClientToolScopeCoordinateDefinition,
  ClientToolScopeDefinition,
  ClientToolAggregateSeriesOutput,
  ClientToolStateChangeOutput,
  ClientToolSuccessOptions,
  ClientToolPartialOptions,
  ClientToolValueType,
  ClientToolWriteEffect,
  CompiledClientToolMetadata,
} from './clientToolDefinition'

/**
 * Public authoring result consumed by registries and runtimes.
 * Wire metadata remains compiler-owned even though the runtime executes this descriptor.
 */
export type CompiledClientTool<TContext = Record<string, unknown>> = AiClientToolDefinition<TContext>

export type ClientToolFactory<TContext = Record<string, unknown>> = AiClientToolFactory<TContext>

export type ClientToolSource<TContext = Record<string, unknown>> = AiClientToolSource<TContext>

/** Defers one tool compiler so an invalid sibling cannot poison the provider catalog. */
export const defineClientToolFactory = <TContext = Record<string, unknown>>(
  id: string,
  build: () => CompiledClientTool<TContext>,
) => defineAiClientToolFactory<TContext>(id, build)

/** Public list helper for tools compiled through defineClientTool. */
export function defineClientTools<TContext = Record<string, unknown>>(
  tools: readonly CompiledClientTool<TContext>[],
): CompiledClientTool<TContext>[]
export function defineClientTools<TContext = Record<string, unknown>>(
  tools: readonly ClientToolFactory<TContext>[],
): ClientToolFactory<TContext>[]
export function defineClientTools<TContext = Record<string, unknown>>(
  tools: readonly ClientToolSource<TContext>[],
): ClientToolSource<TContext>[]
export function defineClientTools<TContext = Record<string, unknown>>(
  tools: readonly ClientToolSource<TContext>[],
) {
  return defineAiClientTools<TContext>([...tools])
}

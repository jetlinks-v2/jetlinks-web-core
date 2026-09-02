import {
  defineAiClientTools,
  type AiClientToolDefinition,
} from './clientTools'

export {
  CLIENT_TOOL_DEFINITION_META_KEY,
  CLIENT_TOOL_DEFINITION_VERSION,
  clientToolOutput,
  clientToolResult,
  defineClientToolAnalyticalProducer,
  defineClientToolBoundedAnalyticalProducer,
  defineClientTool,
  isCompiledClientToolDefinition,
} from './clientToolDefinition'

export type {
  ClientToolActivation,
  ClientToolAnalyticalAuthoring,
  ClientToolBoundedAnalyticalCriterion,
  ClientToolAnalyticalCoverage,
  ClientToolAnalyticalMeasure,
  ClientToolAnalyticalOrdering,
  ClientToolAnalyticalProducerDefinition,
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

/** Public list helper for tools compiled through defineClientTool. */
export const defineClientTools = <TContext = Record<string, unknown>>(
  tools: readonly CompiledClientTool<TContext>[],
) => defineAiClientTools<TContext>([...tools])

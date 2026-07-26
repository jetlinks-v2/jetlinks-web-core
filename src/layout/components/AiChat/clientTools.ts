import { withAiClientToolSilentRequest } from '@jetlinks-web-core/utils/ai-client-tool-request';
import i18n from '@jetlinks-web-core/locales';
import { aiClientToolRegistry } from './clientToolRegistry';
import {
  deliverAiClientToolResult,
  type AiClientToolResultBindingDefinition,
} from './clientToolResultDelivery';
import {
  createAiClientToolFailureResult,
  normalizeAiClientToolOutputBindings,
} from './clientToolResult';
import type {
  AiClientToolFailureDisposition,
  AiClientToolRepair,
  AiClientToolRecoveryAction,
} from './clientToolResult';
import {
  AI_CLIENT_TOOL_ROUTING_EXPAND_KEY,
  normalizeAiClientToolRoutingMetadata,
} from './clientToolRouting';
import { defineAiClientToolContract } from './clientToolContract';
import type {
  AiClientToolRoutingDataAccessMode,
  AiClientToolRoutingResultDelivery,
  AiClientToolRoutingCost,
  AiClientToolRoutingMetadata,
} from './clientToolRouting';

export type {
  AiClientToolRoutingExposure,
  AiClientToolRoutingKind,
  AiClientToolRoutingCost,
  AiClientToolRoutingStage,
  AiClientToolRoutingDataAccessMode,
  AiClientToolRoutingResultDelivery,
  AiClientToolEvidencePolicy,
  AiClientToolRoutingHelp,
  AiClientToolRoutingIntentSection,
  AiClientToolRoutingMetadata,
} from './clientToolRouting';
export {
  AI_CLIENT_TOOL_ROUTING_STAGES,
  AI_CLIENT_TOOL_DATA_ACCESS_MODES,
  AI_CLIENT_TOOL_RESULT_DELIVERIES,
  defineAiClientToolRouting,
  validateAiClientToolRoutingMetadata,
  validateAiClientToolResultBindings,
  validateAiClientToolRoutingCatalog,
  toAiClientToolSessionDefinition,
  toAiClientToolSessionDefinitions,
} from './clientToolRouting';
export {
  AI_CLIENT_TOOL_CONTRACT_VERSION,
  AI_CLIENT_TOOL_CONTRACT_META_KEY,
  AI_CLIENT_TOOL_OUTPUT_KINDS,
  defineAiClientToolContract,
  createAiClientToolContractOutputBinding,
  withAiClientToolContractEvidence,
  isAiClientToolContractMetadata,
} from './clientToolContract';
export type {
  AiClientToolOutputKind,
  AiClientToolOutputContract,
  AiClientToolLookupOutput,
  AiClientToolRecordSetOutput,
  AiClientToolAggregateSeriesOutput,
  AiClientToolScalarMetricOutput,
  AiClientToolStateEventsOutput,
  AiClientToolArtifactOutput,
  AiClientToolContractDefinition,
  AiClientToolContractMetadata,
  AiClientToolContractFragment,
  AiClientToolContractOutputState,
  AiClientToolContractEvidenceOptions,
} from './clientToolContract';
export {
  AI_CLIENT_TOOL_CATALOG_REPORT_VERSION,
  createAiClientToolCatalogReport,
} from './clientToolCatalog';
export type {
  AiClientToolCatalogContractStatus,
  AiClientToolCatalogToolReport,
  AiClientToolCatalogReport,
} from './clientToolCatalog';
export {
  AI_CLIENT_TOOL_EVIDENCE_CONTRACT,
  createAiClientToolFailureResult,
  withAiClientToolEvidence,
} from './clientToolResult';
export {
  createAiClientToolArrayRecordSource,
  createAiClientToolRecordStream,
  createAiClientToolResultPath,
} from './clientToolResultDelivery';
export type {
  AiClientToolRecordConsumerContext,
  AiClientToolRecordDeliveryData,
  AiClientToolRecordDeliveryLimits,
  AiClientToolRecordLimitReason,
  AiClientToolRecordSource,
  AiClientToolRecordStream,
  AiClientToolRecordStreamOptions,
} from './clientToolResultDelivery';
export type {
  AiClientToolArtifactReference,
  AiClientToolClaim,
  AiClientToolEvidence,
  AiClientToolEvidenceOptions,
  AiClientToolMetricDescriptor,
  AiClientToolFailureDisposition,
  AiClientToolRecoveryAction,
  AiClientToolFieldSemanticRole,
  AiClientToolFailureOptions,
  AiClientToolOutputBinding,
  AiClientToolOutputField,
  AiClientToolRepair,
} from './clientToolResult';

export interface AiClientToolValueType {
  type: string;
  [key: string]: any;
}

export interface AiClientToolInput {
  id: string;
  name?: string;
  description?: string;
  required?: boolean;
  valueType?: string | AiClientToolValueType;
  [key: string]: any;
}

export interface AiClientToolCall {
  id: string;
  toolName: string;
  arguments?: Record<string, any>;
  sessionFiles?: AiClientToolSessionFileApi;
  /** Aborted when the conversation turn, socket, or client-tool request is cancelled. */
  signal?: AbortSignal;
  requestConfirmation?: (
    request: AiClientToolConfirmationRequest,
  ) => Promise<AiClientToolConfirmationResponse | void> | AiClientToolConfirmationResponse | void;
  raw?: Record<string, any>;
}

export interface AiClientToolConfirmationRequest {
  id: string;
  toolId: string;
  toolName: string;
  title: string;
  content: string;
  okText: string;
  cancelText: string;
  arguments: Record<string, any>;
}

export interface AiClientToolConfirmationResponse {
  approved?: boolean;
  optionId?: string;
  arguments?: Record<string, any>;
}

export interface AiClientToolConfirmOptions<TContext = Record<string, any>> {
  title?: string | ((args: Record<string, any>, context: TContext, call: AiClientToolCall) => string);
  content?: string | ((args: Record<string, any>, context: TContext, call: AiClientToolCall) => string);
  okText?: string;
  cancelText?: string;
  localConfirmation?: boolean;
  risk?: AiClientToolRisk;
  when?: (args: Record<string, any>, context: TContext, call: AiClientToolCall) => boolean;
}

export interface AiClientToolRisk {
  needsApproval?: boolean;
  readOnly?: boolean;
  parallelSafe?: boolean;
  deleteThreshold?: number;
  [key: string]: any;
}

/**
 * Declares how a client tool reads business data so the conversation layer can
 * plan bounded queries without inferring semantics from tool names.
 *
 * - `aggregate`: server-side counts, trends, distributions, rankings, or summaries.
 * - `records`: bounded record lists or result pages used as evidence or samples.
 * - `detail`: one known object's detail or a navigation action targeting it.
 * - `discovery`: available capabilities, scenes, labels, or other query vocabulary.
 */
export type AiClientToolDataAccessMode = AiClientToolRoutingDataAccessMode;

/** Declares whether a client tool returns inline data or materializes it in the session container. */
export type AiClientToolResultDelivery = AiClientToolRoutingResultDelivery;

/** Minimal session-file contract used by page-level tools without exposing session credentials. */
export interface AiClientToolSessionFileApi {
  capabilities?: () => Record<string, any>;
  toUri: (path: string) => string;
  upload: (
    path: string,
    body: ArrayBuffer | Blob | string,
    options?: { append?: boolean; charset?: string; maxBytes?: number; signal?: AbortSignal },
  ) => Promise<{ path?: string; uri?: string; size?: number; mimeType?: string; ok?: boolean }>;
  remove: (
    path: string,
    options?: { recursive?: boolean },
  ) => Promise<{ ok?: boolean; path?: string; uri?: string; recursive?: boolean }>;
}

/** Browser-runtime metadata. It must never be inferred into model-facing routing semantics. */
export interface AiClientToolMetadata {
  ownerModule?: string;
  capabilityGroup?: string;
  /** Local execution/delivery classification; model routing must declare its own routing contract. */
  dataAccessMode?: AiClientToolDataAccessMode;
  /** Explicit result-delivery semantics; file-backed tools must not expose model-driven paging. */
  resultDelivery?: AiClientToolResultDelivery;
  /** Stable model-facing output shape used for progressive step selection. */
  outputShape?: string | string[];
  /** Relative execution cost; it never changes permission or confirmation policy. */
  cost?: AiClientToolRoutingCost;
  /** Generic preconditions that should already be available before selection. */
  prerequisites?: string[];
  /** Exact inline result paths backing routing.produces; browser-only and never serialized to the server. */
  resultBindings?: AiClientToolResultBindingDefinition[];
  [key: string]: any;
}

export interface AiClientToolDefinition<TContext = Record<string, any>> {
  id: string;
  name?: string;
  displayName?: string;
  title?: string;
  label?: string;
  progressText?: string;
  progressDescription?: string;
  description?: string;
  help?: string | ((tool: AiClientToolDefinition<TContext>) => string);
  inputs?: AiClientToolInput[];
  output?: AiClientToolValueType | Record<string, any>;
  confirm?: boolean | AiClientToolConfirmOptions<TContext>;
  annotations?: Record<string, any>;
  risk?: AiClientToolRisk;
  routing?: AiClientToolRoutingMetadata;
  expands?: Record<string, any>;
  _meta?: AiClientToolMetadata;
  execute: (
    args: Record<string, any>,
    context: TContext,
    call: AiClientToolCall,
  ) => Promise<any> | any;
  [key: string]: any;
}

export type AiClientToolConfirmRuleMatcher<TTool> =
  | string
  | string[]
  | ((tool: TTool, type: string) => boolean);

export type AiClientToolConfirmRuleText<TContext, TTool> =
  | string
  | ((args: Record<string, any>, context: TContext, call: AiClientToolCall, tool: TTool) => string);

export interface AiClientToolConfirmRule<TTool, TContext = Record<string, any>> {
  match?: AiClientToolConfirmRuleMatcher<TTool>;
  title?: AiClientToolConfirmRuleText<TContext, TTool>;
  content?: AiClientToolConfirmRuleText<TContext, TTool>;
  okText?: string;
  cancelText?: string;
  localConfirmation?: boolean;
  risk?: AiClientToolRisk;
  when?: (args: Record<string, any>, context: TContext, call: AiClientToolCall, tool: TTool) => boolean;
}

export interface AiClientToolConfirmResolverOptions<TTool, TContext = Record<string, any>> {
  shouldConfirm?: (tool: TTool) => boolean;
  getType?: (tool: TTool) => string | undefined;
  getId?: (tool: TTool) => string | undefined;
  rules?: AiClientToolConfirmRule<TTool, TContext>[];
  defaultRule?: AiClientToolConfirmRule<TTool, TContext> | false;
}

export interface AiClientToolResultGuardOptions {
  enabled?: boolean;
  maxJsonLength?: number;
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
  maxDepth?: number;
}

export interface AiClientToolRuntimeOptions<TContext = Record<string, any>> {
  toolsName?: string;
  toolsDescription?: string;
  registeredToolScopes?: string | string[];
  extraTools?: AiClientToolDefinition<TContext>[] | (() => AiClientToolDefinition<TContext>[]);
  includeHelpTool?: boolean;
  helpToolId?: string;
  getContext?: () => TContext;
  resultGuard?: AiClientToolResultGuardOptions | false;
  riskDefaults?: AiClientToolRisk;
}

export interface AiClientToolRuntime {
  clientTools: Array<Record<string, any>>;
  clientToolsName: string;
  clientToolsDescription: string;
  handleClientToolCall: (call: AiClientToolCall) => Promise<any>;
  getToolHelp: (toolName: string) => string;
  getAllToolHelp: () => string;
}

const DEFAULT_HELP_TOOL_ID = 'client_tool_help';
const DEFAULT_RESULT_GUARD: Required<AiClientToolResultGuardOptions> = {
  enabled: true,
  maxJsonLength: 96 * 1024,
  maxStringLength: 4096,
  maxArrayLength: 40,
  maxObjectKeys: 80,
  maxDepth: 6,
};

const normalizeValueType = (valueType?: string | AiClientToolValueType) => {
  if (!valueType) {
    return { type: 'string' };
  }
  return typeof valueType === 'string' ? { type: valueType } : valueType;
};

const normalizeInput = (input: AiClientToolInput) => ({
  ...input,
  name: input.name || input.id,
  valueType: normalizeValueType(input.valueType),
});

const RISK_KEYS = ['needsApproval', 'readOnly', 'parallelSafe', 'deleteThreshold'] as const;

const isRecord = (value: unknown): value is Record<string, any> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const pickRisk = (risk?: AiClientToolRisk): Record<string, any> => {
  if (!isRecord(risk)) {
    return {};
  }
  const result: Record<string, any> = {};
  RISK_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(risk, key)) {
      result[key] = risk[key];
    }
  });
  return result;
};

const pickConfirmRisk = <TContext>(confirm?: AiClientToolDefinition<TContext>['confirm']) => (
  confirm && confirm !== true && isRecord(confirm.risk)
    ? pickRisk(confirm.risk)
    : {}
);

const riskFromAnnotations = (annotations?: Record<string, any>) => {
  const result: Record<string, any> = {};
  if (annotations?.destructiveHint === true || annotations?.readOnlyHint === false) {
    result.readOnly = false;
    result.parallelSafe = false;
  }
  if (annotations?.destructiveHint === true) {
    result.needsApproval = true;
  }
  if (annotations?.readOnlyHint === true) {
    result.readOnly = true;
    result.parallelSafe = true;
    result.needsApproval = false;
  }
  return result;
};

const resolveToolExpands = <TContext>(
  tool: AiClientToolDefinition<TContext>,
  options: AiClientToolRuntimeOptions<TContext>,
) => {
  const explicitExpands = isRecord(tool.expands) ? tool.expands : {};
  const routing = normalizeAiClientToolRoutingMetadata(tool);
  const toolRisk = pickRisk(tool.risk);
  const clientConfirmation = !!tool.confirm;
  const confirmationRisk = clientConfirmation ? { needsApproval: false, parallelSafe: false } : {};
  const resolved: Record<string, any> = {
    ...pickRisk(options.riskDefaults),
    ...riskFromAnnotations(tool.annotations),
    ...confirmationRisk,
    ...pickConfirmRisk(tool.confirm),
    ...toolRisk,
    ...explicitExpands,
    ...(routing ? { [AI_CLIENT_TOOL_ROUTING_EXPAND_KEY]: routing } : {}),
  };

  // Client tools are confirmed by the shared frontend component. The backend sees them as
  // non-HITL tools so it never renders a generic confirmation without page context.
  if (clientConfirmation) {
    resolved.needsApproval = false;
    resolved.parallelSafe = false;
  } else if (tool.annotations?.destructiveHint === true
    || resolved.readOnly === false
    || resolved.needsApproval === true) {
    resolved.parallelSafe = false;
  }

  return Object.keys(resolved).length ? resolved : undefined;
};

const normalizeTool = <TContext>(
  tool: AiClientToolDefinition<TContext>,
  options: AiClientToolRuntimeOptions<TContext>,
) => {
  const expands = resolveToolExpands(tool, options);
  return {
    id: tool.id,
    // The session tool identity must not change with locale or display copy.
    name: tool.id,
    ...(tool.displayName ? { displayName: tool.displayName } : {}),
    ...(tool.title ? { title: tool.title } : {}),
    ...(tool.label ? { label: tool.label } : {}),
    ...(tool.progressText ? { progressText: tool.progressText } : {}),
    ...(tool.progressDescription ? { progressDescription: tool.progressDescription } : {}),
    description: tool.description,
    inputs: (tool.inputs || []).map(normalizeInput),
    output: tool.output || { type: 'object' },
    ...(tool.annotations ? { annotations: tool.annotations } : {}),
    ...(expands ? { expands } : {}),
    ...(tool._meta ? { _meta: tool._meta } : {}),
  };
};

const createToolHelp = <TContext>(tool: AiClientToolDefinition<TContext>) => {
  if (typeof tool.help === 'function') {
    return tool.help(tool);
  }
  if (typeof tool.help === 'string' && tool.help.trim()) {
    return tool.help.trim();
  }

  const lines = [
    `## ${tool.name || tool.id}`,
    '',
    tool.description || '',
  ].filter(Boolean);

  const inputs = tool.inputs || [];
  if (inputs.length) {
    lines.push('', `### ${i18n.global.t('components.AiChat.toolHelp.parameters')}`);
    inputs.forEach((input) => {
      const required = input.required ? i18n.global.t('components.AiChat.toolHelp.requiredSuffix') : '';
      const valueType = normalizeValueType(input.valueType);
      const typeLabel = i18n.global.t('components.AiChat.toolHelp.inputType', [valueType.type, required]);
      lines.push(`- ${input.id}: ${input.description || input.name || ''}${typeLabel}`);
    });
  }

  return lines.join('\n');
};

export const defineAiClientTools = <TContext = Record<string, any>>(
  tools: AiClientToolDefinition<TContext>[],
) => tools;

/** Builds browser-only binding metadata from owning-tool JSON paths without inferring result fields at runtime. */
export type AiClientToolResultBindingMetadata = Omit<
  AiClientToolResultBindingDefinition,
  'name' | 'path' | 'shape'
>;

export const defineAiClientToolResultBindings = (
  routing: AiClientToolRoutingMetadata,
  paths: Readonly<Record<string, string>>,
  metadata: Readonly<Record<string, AiClientToolResultBindingMetadata>> = {},
): AiClientToolResultBindingDefinition[] => {
  const produces = routing.produces || [];
  const shapes = routing.outputShapes || [];
  return produces.flatMap((name, index) => {
    const path = String(paths[name] || '').trim();
    const shape = String(shapes.length === 1 ? shapes[0] : shapes[index] || '').trim();
    return path && shape ? [{ name, path, shape, ...(metadata[name] || {}) }] : [];
  });
};

const normalizeConfirmRuleText = <TTool, TContext>(
  value: AiClientToolConfirmRuleText<TContext, TTool> | undefined,
  tool: TTool,
) => {
  if (typeof value !== 'function') {
    return value;
  }
  return (
    args: Record<string, any>,
    context: TContext,
    call: AiClientToolCall,
  ) => value(args, context, call, tool);
};

const normalizeConfirmRuleWhen = <TTool, TContext>(
  value: AiClientToolConfirmRule<TTool, TContext>['when'],
  tool: TTool,
) => {
  if (!value) {
    return undefined;
  }
  return (
    args: Record<string, any>,
    context: TContext,
    call: AiClientToolCall,
  ) => value(args, context, call, tool);
};

const confirmRuleToOptions = <TTool, TContext>(
  rule: AiClientToolConfirmRule<TTool, TContext>,
  tool: TTool,
): AiClientToolConfirmOptions<TContext> => ({
  title: normalizeConfirmRuleText(rule.title, tool),
  content: normalizeConfirmRuleText(rule.content, tool),
  okText: rule.okText,
  cancelText: rule.cancelText,
  localConfirmation: rule.localConfirmation,
  risk: rule.risk,
  when: normalizeConfirmRuleWhen(rule.when, tool),
});

const matchConfirmRule = <TTool, TContext>(
  rule: AiClientToolConfirmRule<TTool, TContext>,
  tool: TTool,
  type: string,
  id: string,
) => {
  const matcher = rule.match;
  if (!matcher) {
    return true;
  }
  if (typeof matcher === 'function') {
    return matcher(tool, type);
  }
  const candidates = Array.isArray(matcher) ? matcher : [matcher];
  return candidates.some((candidate) => candidate === type || candidate === id);
};

/**
 * Creates a reusable mapper from page-level tool metadata to AiChat confirmation options.
 *
 * Business modules keep their action labels and argument formatting in local rule config, while
 * AiChat owns the shared confirmation contract, risk metadata and local-confirmation switch.
 */
export const createAiClientToolConfirmResolver = <
  TTool extends Record<string, any>,
  TContext = Record<string, any>,
>(
  options: AiClientToolConfirmResolverOptions<TTool, TContext>,
) => (tool: TTool): AiClientToolConfirmOptions<TContext> | false => {
  if (options.shouldConfirm && !options.shouldConfirm(tool)) {
    return false;
  }

  const id = String(options.getId?.(tool) || tool.id || tool.name || '').trim();
  const type = String(options.getType?.(tool) || id).trim();
  const rules = options.rules || [];
  const matched = rules.find((rule) => matchConfirmRule(rule, tool, type, id));
  if (matched) {
    return confirmRuleToOptions(matched, tool);
  }
  if (options.defaultRule === false || !options.defaultRule) {
    return false;
  }
  return confirmRuleToOptions(options.defaultRule, tool);
};

const mergeToolDefinitions = <TContext = Record<string, any>>(
  tools: AiClientToolDefinition<TContext>[],
) => {
  const result: AiClientToolDefinition<TContext>[] = [];
  const indexMap = new Map<string, number>();
  tools.forEach((tool) => {
    if (!tool?.id) {
      return;
    }
    const index = indexMap.get(tool.id);
    if (index === undefined) {
      indexMap.set(tool.id, result.length);
      result.push(tool);
    } else {
      throw new Error(`Duplicate client tool id: ${tool.id}`);
    }
  });
  return result;
};

const safeJsonStringify = (value: unknown) => {
  const seen = new WeakSet<object>();
  try {
    const json = JSON.stringify(value, (_key, item) => {
      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
          stack: item.stack,
        };
      }
      if (typeof item === 'bigint') {
        return String(item);
      }
      if (typeof item === 'function') {
        return '[function]';
      }
      if (item && typeof item === 'object') {
        if (seen.has(item)) {
          return '[circular]';
        }
        seen.add(item);
      }
      return item;
    });
    return typeof json === 'string' ? json : String(json);
  } catch (error) {
    return JSON.stringify({
      unserializable: true,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const normalizeResultGuardOptions = (
  options?: AiClientToolResultGuardOptions | false,
): Required<AiClientToolResultGuardOptions> | false => {
  if (options === false || options?.enabled === false) {
    return false;
  }
  return {
    ...DEFAULT_RESULT_GUARD,
    ...options,
    enabled: true,
  };
};

const createClientToolConfirmationRejectedResult = (
  toolName: string,
  response?: AiClientToolConfirmationResponse,
) => ({
  ...createAiClientToolFailureResult({
    code: 'client_tool.user_rejected',
    message: String(i18n.global.t('components.AiChat.confirm.rejected')),
    failureDisposition: 'permission/user',
    recoveryAction: 'terminal',
    retryable: false,
  }),
  ok: false,
  toolName,
  status: 'rejected',
  rejected: true,
  cancelledByUser: true,
  reason: 'user_rejected_confirmation',
  optionId: response?.optionId,
});

const CLIENT_TOOL_FAILURE_DISPOSITIONS = new Set<AiClientToolFailureDisposition>([
  'request', 'tool', 'dependency', 'permission/user',
]);
const CLIENT_TOOL_RECOVERY_ACTIONS = new Set<AiClientToolRecoveryAction>([
  'retry', 'repair', 'clarify', 'terminal',
]);

const failureRecord = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
);

export const isAiClientToolCancellationError = (error: unknown) => {
  const source = failureRecord(error);
  const code = String(source.code || source.name || '').trim().toLowerCase();
  return code === 'aborterror'
    || code === 'client_tool_aborted'
    || code === 'err_canceled'
    || code === 'err_cancelled';
};

const normalizeClientToolExecutionError = (error: any, toolName: string) => {
  if (error?.code === 'CLIENT_TOOL_CONFIRM_CANCELLED') {
    return createClientToolConfirmationRejectedResult(toolName);
  }
  const responseData = failureRecord(error?.response?.data);
  const status = Number(error?.status || error?.response?.status);
  const code = String(error?.code || responseData.code || 'client_tool.execution_failed');
  const message = String(error?.message || responseData.message || error);
  const permissionFailure = status === 401 || status === 403;
  const repairableRequest = status === 400 || status === 409 || status === 422;
  const retryableDependency = status === 408 || status === 429 || status >= 500;
  const explicitDisposition = String(
    error?.failureDisposition || responseData.failureDisposition || '',
  ).trim().toLowerCase() as AiClientToolFailureDisposition;
  const explicitRecoveryAction = String(
    error?.recoveryAction || responseData.recoveryAction || '',
  ).trim().toLowerCase() as AiClientToolRecoveryAction;
  const failureDisposition: AiClientToolFailureDisposition = CLIENT_TOOL_FAILURE_DISPOSITIONS.has(explicitDisposition)
    ? explicitDisposition
    : permissionFailure
    ? 'permission/user'
    : repairableRequest
      ? 'request'
      : retryableDependency
        ? 'dependency'
        : 'tool';
  const recoveryAction: AiClientToolRecoveryAction = CLIENT_TOOL_RECOVERY_ACTIONS.has(explicitRecoveryAction)
    ? explicitRecoveryAction
    : permissionFailure
    ? 'terminal'
    : repairableRequest
      ? 'repair'
      : retryableDependency
        ? 'retry'
        : 'terminal';
  const explicitRepair = failureRecord(error?.repair || responseData.repair);
  const repair = explicitRepair.field
    || Array.isArray(explicitRepair.preserveArguments)
    || Number.isFinite(explicitRepair.maxAttempts)
    ? explicitRepair as AiClientToolRepair
    : recoveryAction === 'repair' ? { maxAttempts: 1 } : undefined;
  return {
    ...createAiClientToolFailureResult({
      code,
      message,
      failureDisposition,
      recoveryAction,
      retryable: typeof error?.retryable === 'boolean'
        ? error.retryable
        : typeof responseData.retryable === 'boolean'
          ? responseData.retryable
          : retryableDependency || repairableRequest,
      ...(repair ? { repair } : {}),
      details: {
        name: error?.name,
        ...(Number.isFinite(status) ? { status } : {}),
        type: responseData.errorType || responseData.type,
      },
    }),
    ok: false,
    toolName,
  };
};

const resolveToolResultBindings = <TContext>(
  tool: AiClientToolDefinition<TContext>,
): AiClientToolResultBindingDefinition[] => {
  const declared = Array.isArray(tool._meta?.resultBindings)
    ? tool._meta.resultBindings
    : [];
  return declared;
};

const resolveConfirmText = <TContext>(
  value: AiClientToolConfirmOptions<TContext>['title'] | AiClientToolConfirmOptions<TContext>['content'],
  args: Record<string, any>,
  context: TContext,
  call: AiClientToolCall,
) => (typeof value === 'function' ? value(args, context, call) : value);

const resolveToolDisplayName = <TContext>(tool: AiClientToolDefinition<TContext>) => (
  String(tool.displayName || tool.title || tool.label || tool.name || tool.id || '').trim()
);

const createClientToolConfirmationHandlerMissingError = () => {
  const error = new Error('client tool confirmation handler unavailable');
  (error as any).code = 'CLIENT_TOOL_CONFIRM_HANDLER_UNAVAILABLE';
  return error;
};

const requestAiClientToolConfirmation = async <TContext>(
  tool: AiClientToolDefinition<TContext>,
  args: Record<string, any>,
  context: TContext,
  call: AiClientToolCall,
): Promise<AiClientToolConfirmationResponse | undefined> => {
  if (!tool.confirm) {
    return undefined;
  }

  const options: AiClientToolConfirmOptions<TContext> = tool.confirm === true ? {} : tool.confirm;
  if (options.when && !options.when(args, context, call)) {
    return undefined;
  }
  const title = resolveConfirmText(options.title, args, context, call)
    || resolveToolDisplayName(tool);
  const content = resolveConfirmText(options.content, args, context, call) || '';

  if (!call.requestConfirmation) {
    throw createClientToolConfirmationHandlerMissingError();
  }

  const response = await call.requestConfirmation({
    id: call.id,
    toolId: tool.id,
    toolName: tool.name || tool.id,
    title,
    content,
    okText: options.okText || i18n.global.t('verify.confirm'),
    cancelText: options.cancelText || i18n.global.t('verify.cancel'),
    arguments: args,
  });

  if (!response) {
    return undefined;
  }
  if (response.approved === false) {
    return response;
  }

  return response;
};

const truncateString = (value: string, maxLength: number) => (
  value.length > maxLength
    ? `${value.slice(0, Math.max(0, maxLength))}... [truncated ${value.length - maxLength} chars]`
    : value
);

const compactClientToolValue = (
  value: unknown,
  options: Required<AiClientToolResultGuardOptions>,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return truncateString(value, options.maxStringLength);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: truncateString(value.message, Math.min(options.maxStringLength, 1000)),
    };
  }
  if (typeof value === 'function') {
    return '[function]';
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (seen.has(value)) {
    return { truncated: true, reason: 'circular' };
  }
  seen.add(value);
  if (depth >= options.maxDepth) {
    return {
      truncated: true,
      reason: 'maxDepth',
      keys: Object.keys(value as Record<string, unknown>).slice(0, 20),
    };
  }
  if (Array.isArray(value)) {
    const items = value
      .slice(0, options.maxArrayLength)
      .map((item) => compactClientToolValue(item, options, depth + 1, seen));
    if (value.length > options.maxArrayLength) {
      items.push({
        truncated: true,
        omitted: value.length - options.maxArrayLength,
      });
    }
    return items;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const result: Record<string, unknown> = {};
  entries.slice(0, options.maxObjectKeys).forEach(([key, item]) => {
    result[key] = compactClientToolValue(item, options, depth + 1, seen);
  });
  if (entries.length > options.maxObjectKeys) {
    result.__truncatedKeys = entries.length - options.maxObjectKeys;
  }
  return result;
};

/**
 * Keeps browser-side tool replies small enough for JSON-RPC over WebSocket.
 *
 * Client tools can read logs, files or trace frames from the current page; returning those raw
 * payloads inline risks closing the chat WebSocket. The guard preserves the shape where possible
 * and adds metadata only when the serialized result crosses the configured budget.
 */
export const guardAiClientToolResult = (
  value: unknown,
  guardOptions?: AiClientToolResultGuardOptions | false,
  toolName?: string,
) => {
  const options = normalizeResultGuardOptions(guardOptions);
  if (!options) {
    return value;
  }
  const json = safeJsonStringify(value);
  if (json.length <= options.maxJsonLength) {
    return value;
  }

  let compacted = compactClientToolValue(value, options);
  let compactedJson = safeJsonStringify(compacted);
  if (compactedJson.length > options.maxJsonLength) {
    const strictOptions = {
      ...options,
      maxStringLength: Math.min(options.maxStringLength, 1200),
      maxArrayLength: Math.min(options.maxArrayLength, 12),
      maxObjectKeys: Math.min(options.maxObjectKeys, 32),
      maxDepth: Math.min(options.maxDepth, 4),
    };
    compacted = compactClientToolValue(value, strictOptions);
    compactedJson = safeJsonStringify(compacted);
  }
  if (compactedJson.length > options.maxJsonLength) {
    compacted = {
      preview: truncateString(compactedJson, Math.max(1000, options.maxJsonLength - 1024)),
    };
    compactedJson = safeJsonStringify(compacted);
  }

  const source = isRecord(value) ? value : {};
  const failure = source.success === false || source.ok === false;
  const sourceEvidence = isRecord(source.evidence) ? source.evidence : {};
  const outputBindings = normalizeAiClientToolOutputBindings([
    ...(Array.isArray(sourceEvidence.outputBindings) ? sourceEvidence.outputBindings : []),
    ...(Array.isArray(source.outputBindings) ? source.outputBindings : []),
  ]);
  const bindingNames = new Set<string>();
  const guardedBindings = outputBindings.flatMap((binding) => {
    if (bindingNames.has(binding.name)) return [];
    bindingNames.add(binding.name);
    return [binding.ref
      ? binding
      : { ...binding, complete: false, truncated: true }];
  });
  const completeExternalResult = guardedBindings.length > 0
    && guardedBindings.every(binding => !!binding.ref && binding.complete && binding.truncated !== true);
  const guardedComplete = !failure && completeExternalResult && source.complete === true;
  const guardedEvidence = Object.keys(sourceEvidence).length
    ? compactClientToolValue({
        ...sourceEvidence,
        complete: guardedComplete,
        truncated: !guardedComplete,
        ...(!guardedComplete ? { limitReason: 'client_tool_result_too_large' } : {}),
        ...(guardedBindings.length ? { outputBindings: guardedBindings } : {}),
      }, options)
    : undefined;
  const failureKeys = [
    'success', 'ok', 'code', 'message', 'failureDisposition', 'recoveryAction',
    'retryable', 'repair', 'status', 'toolName',
  ];
  const failureContract = failure
    ? Object.fromEntries(failureKeys
        .filter(key => source[key] !== undefined)
        .map(key => [key, compactClientToolValue(source[key], options)]))
    : {};

  return {
    ...failureContract,
    ...(!failure ? {
      success: true,
      complete: guardedComplete,
      truncated: !guardedComplete,
      status: guardedComplete ? source.status : 'partial',
    } : {}),
    ...(isRecord(guardedEvidence) ? { evidence: guardedEvidence } : {}),
    ...(guardedBindings.length ? { outputBindings: guardedBindings } : {}),
    result: compacted,
    meta: {
      toolName,
      truncated: true,
      reason: 'client_tool_result_too_large',
      originalJsonLength: json.length,
      returnedJsonLength: compactedJson.length,
      maxJsonLength: options.maxJsonLength,
    },
  };
};

/**
 * Builds the client-side tool contract consumed by AgentConversation.
 *
 * Page modules declare tools as pure descriptors plus execute functions; this runtime exposes only
 * normalized descriptors to the agent session and keeps the executable handlers in the browser.
 */
export const createAiClientToolRuntime = <TContext = Record<string, any>>(
  tools: AiClientToolDefinition<TContext>[],
  options: AiClientToolRuntimeOptions<TContext> = {},
): AiClientToolRuntime => {
  const helpToolId = options.helpToolId || DEFAULT_HELP_TOOL_ID;
  const resolvedExtraTools = typeof options.extraTools === 'function'
    ? options.extraTools()
    : (options.extraTools || []);
  const extraTools = Array.isArray(resolvedExtraTools) ? resolvedExtraTools : [];
  const registeredTools = aiClientToolRegistry.getTools<TContext>(options.registeredToolScopes);
  const sourceTools = mergeToolDefinitions([...tools, ...extraTools, ...registeredTools]);
  const toolMap = new Map<string, AiClientToolDefinition<TContext>>();

  sourceTools.forEach((tool) => {
    toolMap.set(tool.id, tool);
    if (tool.name) {
      toolMap.set(tool.name, tool);
    }
  });

  const getToolHelp = (toolName: string) => {
    const tool = toolMap.get(toolName);
    if (!tool) {
      return i18n.global.t('components.AiChat.toolHelp.notFound', [toolName]);
    }
    return createToolHelp(tool);
  };

  const getAllToolHelp = () => sourceTools.map(createToolHelp).join('\n\n');

  const helpToolContract = defineAiClientToolContract({
    routingKind: 'discovery',
    routing: {
      capabilities: ['client-tool.help.read'],
      accepts: ['tool-id'],
      evidencePolicy: 'none',
    },
    outputs: [{
      kind: 'lookup',
      name: 'client-tool-help',
      shape: 'tool.help',
      path: '$.help',
    }],
  });
  const helpTool: AiClientToolDefinition<TContext> = {
    id: helpToolId,
    name: helpToolId,
    description: i18n.global.t('components.AiChat.toolHelp.description'),
    help: i18n.global.t('components.AiChat.toolHelp.help'),
    ...helpToolContract,
    inputs: [
      {
        id: 'toolName',
        name: 'toolName',
        description: i18n.global.t('components.AiChat.toolHelp.toolNameDescription'),
        required: false,
        valueType: 'string',
      },
    ],
    output: { type: 'object' },
    execute: (args = {}) => {
      const toolName = String(args.toolName || '').trim();
      return {
        toolName: toolName || undefined,
        help: toolName ? getToolHelp(toolName) : getAllToolHelp(),
      };
    },
  };

  if (options.includeHelpTool !== false) {
    toolMap.set(helpTool.id, helpTool);
    if (helpTool.name) {
      toolMap.set(helpTool.name, helpTool);
    }
  }

  if (options.includeHelpTool !== false && sourceTools.some(tool => tool.id === helpTool.id)) {
    throw new Error(`Duplicate client tool id: ${helpTool.id}`);
  }
  const runtimeTools = options.includeHelpTool === false ? sourceTools : [...sourceTools, helpTool];
  const runtimeToolMap = new Map<string, AiClientToolDefinition<TContext>>();
  runtimeTools.forEach((tool) => {
    runtimeToolMap.set(tool.id, tool);
    if (tool.name) {
      runtimeToolMap.set(tool.name, tool);
    }
  });

  const handleClientToolCall = async (call: AiClientToolCall) => {
    const tool = runtimeToolMap.get(call.toolName);
    if (!tool) {
      throw new Error(`Unsupported client tool: ${call.toolName}`);
    }
    const context = options.getContext?.() || ({} as TContext);
    let result: unknown;
    try {
      const args = call.arguments || {};
      const confirmation = await requestAiClientToolConfirmation(tool, args, context, call);
      if (confirmation?.approved === false) {
        result = createClientToolConfirmationRejectedResult(tool.id, confirmation);
      } else {
        const executionArgs = confirmation?.arguments || args;
        result = await withAiClientToolSilentRequest(async () => {
          const executionCall = {
            ...call,
            arguments: executionArgs,
          };
          const executionResult = await tool.execute(
            executionArgs,
            context,
            executionCall,
          );
          const routing = normalizeAiClientToolRoutingMetadata(tool);
          return deliverAiClientToolResult(executionResult, {
            call: executionCall,
            resultDelivery: tool._meta?.resultDelivery,
            ...(routing?.produces?.length === 1 ? { bindingName: routing.produces[0] } : {}),
            ...(routing?.outputShapes?.length === 1 ? { outputShape: routing.outputShapes[0] } : {}),
            outputBindings: resolveToolResultBindings(tool),
          });
        });
      }
    } catch (error) {
      if (call.signal?.aborted || isAiClientToolCancellationError(error)) {
        throw error;
      }
      // API failures inside a page tool are still tool results; keep the chat session alive and
      // let the agent explain the failed business call instead of surfacing a global connection error.
      result = normalizeClientToolExecutionError(error, tool.id);
    }
    return guardAiClientToolResult(result, options.resultGuard, tool.id);
  };

  return {
    clientTools: runtimeTools.map((tool) => normalizeTool(tool, options)),
    clientToolsName: options.toolsName || 'frontend-client-tools',
    clientToolsDescription: options.toolsDescription || i18n.global.t('components.AiChat.clientToolsDescription'),
    handleClientToolCall,
    getToolHelp,
    getAllToolHelp,
  };
};

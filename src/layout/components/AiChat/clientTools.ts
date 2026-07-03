import { withAiClientToolSilentRequest } from '@jetlinks-web-core/utils';
import i18n from '@jetlinks-web-core/locales';
import { aiClientToolRegistry } from './clientToolRegistry';

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
  sessionFiles?: Record<string, any>;
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
  when?: (args: Record<string, any>, context: TContext, call: AiClientToolCall) => boolean;
}

export interface AiClientToolDefinition<TContext = Record<string, any>> {
  id: string;
  name?: string;
  description?: string;
  help?: string | ((tool: AiClientToolDefinition<TContext>) => string);
  inputs?: AiClientToolInput[];
  output?: AiClientToolValueType | Record<string, any>;
  confirm?: boolean | AiClientToolConfirmOptions<TContext>;
  execute: (
    args: Record<string, any>,
    context: TContext,
    call: AiClientToolCall,
  ) => Promise<any> | any;
  [key: string]: any;
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

const normalizeTool = <TContext>(tool: AiClientToolDefinition<TContext>) => ({
  id: tool.id,
  name: tool.name || tool.id,
  description: tool.description,
  inputs: (tool.inputs || []).map(normalizeInput),
  output: tool.output || { type: 'object' },
  ...(tool.confirm ? { requiresConfirmation: true } : {}),
});

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
      result[index] = tool;
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

const normalizeClientToolExecutionError = (error: any, toolName: string) => ({
  ok: false,
  toolName,
  error: {
    name: error?.name,
    message: error?.message || String(error),
    status: error?.status || error?.response?.status,
    code: error?.code || error?.response?.data?.code,
    type: error?.response?.data?.errorType || error?.response?.data?.type,
  },
});

const resolveConfirmText = <TContext>(
  value: AiClientToolConfirmOptions<TContext>['title'] | AiClientToolConfirmOptions<TContext>['content'],
  args: Record<string, any>,
  context: TContext,
  call: AiClientToolCall,
) => (typeof value === 'function' ? value(args, context, call) : value);

const createClientToolConfirmationError = () => {
  const error = new Error('client tool execution cancelled by user');
  (error as any).code = 'CLIENT_TOOL_CONFIRM_CANCELLED';
  return error;
};

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
): Promise<Record<string, any> | undefined> => {
  if (!tool.confirm) {
    return undefined;
  }

  const options: AiClientToolConfirmOptions<TContext> = tool.confirm === true ? {} : tool.confirm;
  if (options.when && !options.when(args, context, call)) {
    return undefined;
  }
  const title = resolveConfirmText(options.title, args, context, call)
    || i18n.global.t('components.AiChat.confirm.title', [tool.name || tool.id]);
  const content = resolveConfirmText(options.content, args, context, call)
    || i18n.global.t('components.AiChat.confirm.content');

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

  if (response?.approved === false) {
    throw createClientToolConfirmationError();
  }

  return response?.arguments;
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

  return {
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

  const helpTool: AiClientToolDefinition<TContext> = {
    id: helpToolId,
    name: helpToolId,
    description: i18n.global.t('components.AiChat.toolHelp.description'),
    help: i18n.global.t('components.AiChat.toolHelp.help'),
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
      const confirmedArgs = await requestAiClientToolConfirmation(tool, args, context, call);
      const executionArgs = confirmedArgs || args;
      result = await withAiClientToolSilentRequest(() => tool.execute(
        executionArgs,
        context,
        {
          ...call,
          arguments: executionArgs,
        },
      ));
    } catch (error) {
      // API failures inside a page tool are still tool results; keep the chat session alive and
      // let the agent explain the failed business call instead of surfacing a global connection error.
      result = normalizeClientToolExecutionError(error, tool.id);
    }
    return guardAiClientToolResult(result, options.resultGuard, tool.id);
  };

  return {
    clientTools: runtimeTools.map(normalizeTool),
    clientToolsName: options.toolsName || 'frontend-client-tools',
    clientToolsDescription: options.toolsDescription || i18n.global.t('components.AiChat.clientToolsDescription'),
    handleClientToolCall,
    getToolHelp,
    getAllToolHelp,
  };
};

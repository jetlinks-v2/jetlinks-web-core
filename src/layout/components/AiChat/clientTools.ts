import { withAiClientToolSilentRequest } from '@jetlinks-web-core/utils';

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
  raw?: Record<string, any>;
}

export interface AiClientToolDefinition<TContext = Record<string, any>> {
  id: string;
  name?: string;
  description?: string;
  help?: string | ((tool: AiClientToolDefinition<TContext>) => string);
  inputs?: AiClientToolInput[];
  output?: AiClientToolValueType | Record<string, any>;
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
    lines.push('', '### 参数');
    inputs.forEach((input) => {
      const required = input.required ? '，必填' : '';
      const valueType = normalizeValueType(input.valueType);
      lines.push(`- ${input.id}: ${input.description || input.name || ''}（${valueType.type}${required}）`);
    });
  }

  return lines.join('\n');
};

export const defineAiClientTools = <TContext = Record<string, any>>(
  tools: AiClientToolDefinition<TContext>[],
) => tools;

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
  const toolMap = new Map<string, AiClientToolDefinition<TContext>>();

  tools.forEach((tool) => {
    toolMap.set(tool.id, tool);
    if (tool.name) {
      toolMap.set(tool.name, tool);
    }
  });

  const getToolHelp = (toolName: string) => {
    const tool = toolMap.get(toolName);
    if (!tool) {
      return `未找到工具：${toolName}`;
    }
    return createToolHelp(tool);
  };

  const getAllToolHelp = () => tools.map(createToolHelp).join('\n\n');

  const helpTool: AiClientToolDefinition<TContext> = {
    id: helpToolId,
    name: helpToolId,
    description: '获取当前页面已暴露给智能体的前端工具说明。可传 toolName 获取单个工具 help。',
    help: '获取工具说明。传入 toolName 返回单个工具说明；不传返回当前页面全部业务工具说明。',
    inputs: [
      {
        id: 'toolName',
        name: 'toolName',
        description: '工具 ID；为空时返回全部工具说明。',
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

  const runtimeTools = options.includeHelpTool === false ? tools : [...tools, helpTool];
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
      result = await withAiClientToolSilentRequest(() => tool.execute(call.arguments || {}, context, call));
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
    clientToolsDescription: options.toolsDescription || '当前前端页面提供的智能体工具。',
    handleClientToolCall,
    getToolHelp,
    getAllToolHelp,
  };
};

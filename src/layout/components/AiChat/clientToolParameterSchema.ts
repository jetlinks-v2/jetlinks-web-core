export const AI_CLIENT_TOOL_PARAMETER_SCHEMA_EXPAND_KEY = '_schema'

/** Canonical root JSON Schema constraints merged with generated client-tool input properties. */
export interface AiClientToolParameterSchema {
  type?: 'object'
  properties?: Record<string, unknown>
  required?: string[]
  oneOf?: Array<Record<string, unknown>>
  anyOf?: Array<Record<string, unknown>>
  allOf?: Array<Record<string, unknown>>
  [key: string]: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
)

/** Serializes typed root constraints without allowing a second raw `_schema` source. */
export const mergeAiClientToolParameterSchema = (
  toolId: string,
  parameterSchema?: AiClientToolParameterSchema,
  expands?: Record<string, unknown>,
): Record<string, unknown> => {
  const explicitExpands = isRecord(expands) ? expands : {}
  const schema = isRecord(parameterSchema) ? parameterSchema : undefined
  if (schema && Object.prototype.hasOwnProperty.call(
    explicitExpands,
    AI_CLIENT_TOOL_PARAMETER_SCHEMA_EXPAND_KEY,
  )) {
    throw new Error(
      `Client tool ${toolId} declares parameterSchema and expands.${AI_CLIENT_TOOL_PARAMETER_SCHEMA_EXPAND_KEY}`,
    )
  }
  return {
    ...(schema ? { [AI_CLIENT_TOOL_PARAMETER_SCHEMA_EXPAND_KEY]: schema } : {}),
    ...explicitExpands,
  }
}

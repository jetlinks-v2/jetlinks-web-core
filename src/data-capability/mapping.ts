import type {
  CapabilitySchema,
  DataPathMapping,
  OutputMapping,
  OutputMappingValue,
} from './types'
import { createCapabilityError, getByPath } from './utils'
import { capabilitySchemaValidator } from './validation'

export interface OutputMappingExecutionOptions {
  targetSchema?: CapabilitySchema
  capabilityId?: string
}

/** Executes the serializable mapping subset shared by preview, Runtime and the thin Client. */
export function applyOutputMapping(
  data: unknown,
  mapping?: OutputMapping,
  options: OutputMappingExecutionOptions = {},
): unknown {
  if (mapping?.format && Object.keys(mapping.format).length) {
    throw createCapabilityError('output_mapping.format_unsupported', 'Output mapping format is not supported yet', {
      capabilityId: options.capabilityId,
    })
  }

  const result = mapping ? projectMappingFields(data, mapping.fields, options.capabilityId) : data
  capabilitySchemaValidator.assert(options.targetSchema, result, {
    phase: 'output',
    capabilityId: options.capabilityId,
  })
  return result
}

function projectMappingFields(
  data: unknown,
  fields: Record<string, OutputMappingValue>,
  capabilityId?: string,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, mapping]) => [
    key,
    projectMappingValue(data, mapping, capabilityId),
  ]))
}

function projectMappingValue(data: unknown, mapping: OutputMappingValue, capabilityId?: string): unknown {
  const runtimeMapping = mapping as unknown as RuntimeOutputMapping
  switch (runtimeMapping.kind) {
    case 'path':
      return projectPath(data, runtimeMapping as DataPathMapping)
    case 'object': {
      if (!runtimeMapping.fields) throw invalidMappingRule(runtimeMapping.kind, capabilityId)
      return projectMappingFields(data, runtimeMapping.fields, capabilityId)
    }
    case 'each': {
      const source = runtimeMapping.path?.length ? getByPath(data, runtimeMapping.path) : data
      if (source === undefined) return undefined
      if (!Array.isArray(source)) {
        throw createCapabilityError('output_mapping.each_source_invalid', 'Output mapping each source must be an array', {
          capabilityId,
          details: { path: runtimeMapping.path || [] },
        })
      }
      if (!runtimeMapping.item) throw invalidMappingRule(runtimeMapping.kind, capabilityId)
      return source.map(item => projectMappingValue(item, runtimeMapping.item!, capabilityId))
    }
    case 'literal':
      return runtimeMapping.value
    case 'default': {
      if (!runtimeMapping.source) throw invalidMappingRule(runtimeMapping.kind, capabilityId)
      const value = projectMappingValue(data, runtimeMapping.source, capabilityId)
      return value === undefined ? runtimeMapping.value : value
    }
    case 'expression':
      throw createCapabilityError('output_mapping.expression_unsupported', 'Output mapping expression is not supported', {
        capabilityId,
      })
    case 'coerce':
      throw createCapabilityError('output_mapping.coerce_unsupported', 'Output mapping coercion is not supported yet', {
        capabilityId,
      })
    default:
      throw createCapabilityError('output_mapping.kind_unsupported', 'Output mapping kind is not supported', {
        capabilityId,
        details: { kind: runtimeMapping.kind },
      })
  }
}

interface RuntimeOutputMapping {
  kind?: string
  path?: Array<string | number>
  fields?: Record<string, OutputMappingValue>
  item?: OutputMappingValue
  source?: OutputMappingValue
  value?: unknown
  defaultValue?: unknown
}

function invalidMappingRule(kind: string, capabilityId?: string) {
  return createCapabilityError('output_mapping.rule_invalid', 'Output mapping rule is invalid', {
    capabilityId,
    details: { kind },
  })
}

function projectPath(data: unknown, mapping: DataPathMapping): unknown {
  const value = getByPath(data, mapping.path)
  return value === undefined ? mapping.defaultValue : value
}

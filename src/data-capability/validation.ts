import type {
  CapabilityError,
  CapabilitySchema,
  DataPath,
} from './types'
import { createCapabilityError } from './utils'

export type CapabilityValidationPhase = 'config' | 'query' | 'input' | 'output' | 'option-query'
export type CapabilityValidationKeyword = 'type' | 'required' | 'enum' | 'const'

export interface CapabilityValidationIssue {
  phase: CapabilityValidationPhase
  path: DataPath
  keyword: CapabilityValidationKeyword
  expected: unknown
}

export interface CapabilityValidationOptions {
  phase: CapabilityValidationPhase
  capabilityId?: string
}

const REDACTED_EXPECTATION = '<redacted>'
const DEFAULT_MAX_VALIDATION_ISSUES = 100

/** Validates the supported schema subset without coercing or mutating the input value. */
export class CapabilitySchemaValidator {
  validate(
    schema: CapabilitySchema | undefined,
    value: unknown,
    phase: CapabilityValidationPhase,
    maxIssues = DEFAULT_MAX_VALIDATION_ISSUES,
  ): CapabilityValidationIssue[] {
    if (!schema || maxIssues <= 0) return []
    const issues: CapabilityValidationIssue[] = []
    this.validateNode(schema, value, phase, [], false, issues, maxIssues)
    return issues
  }

  assert(
    schema: CapabilitySchema | undefined,
    value: unknown,
    options: CapabilityValidationOptions,
  ): void {
    const issue = this.validate(schema, value, options.phase, 1)[0]
    if (issue) throw this.toError(issue, options.capabilityId)
  }

  toError(issue: CapabilityValidationIssue, capabilityId?: string): CapabilityError {
    return createCapabilityError('capability.validation_failed', 'Capability value does not match schema', {
      capabilityId,
      details: { ...issue },
    })
  }

  private validateNode(
    schema: CapabilitySchema,
    value: unknown,
    phase: CapabilityValidationPhase,
    path: DataPath,
    parentSensitive: boolean,
    issues: CapabilityValidationIssue[],
    maxIssues: number,
  ): void {
    if (issues.length >= maxIssues) return
    const sensitive = parentSensitive || schema.sensitive === true
    if (!matchesType(value, schema.type)) {
      issues.push({ phase, path: [...path], keyword: 'type', expected: schema.type })
      return
    }

    if (schema.const !== undefined && !equalSchemaValue(value, schema.const)) {
      issues.push({
        phase,
        path: [...path],
        keyword: 'const',
        expected: sensitive ? REDACTED_EXPECTATION : schema.const,
      })
    }
    if (schema.enum && !schema.enum.some(candidate => equalSchemaValue(value, candidate))) {
      issues.push({
        phase,
        path: [...path],
        keyword: 'enum',
        expected: sensitive ? REDACTED_EXPECTATION : schema.enum,
      })
    }

    if (schema.type === 'object') {
      const record = value as Record<string, unknown>
      for (const key of schema.required || []) {
        if (issues.length >= maxIssues) break
        if (!Object.prototype.hasOwnProperty.call(record, key) || record[key] === undefined) {
          issues.push({ phase, path: [...path, key], keyword: 'required', expected: key })
        }
      }
      for (const [key, propertySchema] of Object.entries(schema.properties || {})) {
        if (issues.length >= maxIssues) break
        if (!Object.prototype.hasOwnProperty.call(record, key) || record[key] === undefined) continue
        this.validateNode(propertySchema, record[key], phase, [...path, key], sensitive, issues, maxIssues)
      }
    } else if (schema.type === 'array' && schema.items) {
      const items = value as unknown[]
      for (let index = 0; index < items.length && issues.length < maxIssues; index += 1) {
        this.validateNode(schema.items, items[index], phase, [...path, index], sensitive, issues, maxIssues)
      }
    }
  }
}

function matchesType(value: unknown, type: CapabilitySchema['type']): boolean {
  switch (type) {
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'array':
      return Array.isArray(value)
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'null':
      return value === null
    default:
      return false
  }
}

function equalSchemaValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => equalSchemaValue(value, right[index]))
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return leftKeys.length === rightKeys.length
    && leftKeys.every(key => Object.prototype.hasOwnProperty.call(rightRecord, key)
      && equalSchemaValue(leftRecord[key], rightRecord[key]))
}

export const capabilitySchemaValidator = new CapabilitySchemaValidator()

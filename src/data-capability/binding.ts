import { firstValueFrom, isObservable } from 'rxjs'
import type {
  BindingRuntimeContext,
  CapabilityRegistry,
  ContextValueDefinition,
  DataPath,
  ValueBinding,
} from './types'
import { createCapabilityError, getByPath, isValueBinding } from './utils'

export class BindingResolver {
  constructor(
    private readonly contexts: CapabilityRegistry<ContextValueDefinition>,
  ) {}

  async resolveRecord(
    values: Record<string, ValueBinding | unknown> | undefined,
    context: BindingRuntimeContext,
  ): Promise<Record<string, unknown> | undefined> {
    if (!values) return undefined
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(values)) {
      result[key] = await this.resolve(value, context)
    }
    return result
  }

  async resolve(value: ValueBinding | unknown, context: BindingRuntimeContext): Promise<unknown> {
    if (!isValueBinding(value)) return value

    switch (value.kind) {
      case 'literal':
        return value.value
      case 'parameter':
        return getByPath(context.parameters?.[value.parameterId], value.path)
      case 'context':
        return this.resolveContext(value, context)
      case 'output':
        return getByPath(context.outputs?.[value.nodeId], value.path)
      case 'expression':
        return this.resolveExpression(value)
      default:
        return undefined
    }
  }

  private async resolveContext(binding: Extract<ValueBinding, { kind: 'context' }>, context: BindingRuntimeContext) {
    const definition = this.contexts.get(binding.providerId)
    if (!definition) return undefined
    const resolved = definition.resolve(binding, context)
    const value = isObservable(resolved) ? await firstValueFrom(resolved) : await resolved
    return getByPath(value, binding.path)
  }

  private resolveExpression(binding: Extract<ValueBinding, { kind: 'expression' }>) {
    throw createCapabilityError('expression.unsupported', 'Expression binding is not supported yet', {
      details: {
        language: binding.language,
      },
    })
  }
}

export { getByPath }
export type { DataPath }

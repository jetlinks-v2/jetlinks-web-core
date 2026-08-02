import { EmptyError, isObservable, type Observable, type Subscription } from 'rxjs'
import type {
  BindingRuntimeContext,
  CapabilityRegistry,
  ContextValueDefinition,
  DataPath,
  OutputBinding,
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
        return this.resolveOutput(value, context)
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
    const value = isObservable(resolved)
      ? await firstObservableValue(resolved, context.signal)
      : await resolved
    return getByPath(value, binding.path)
  }

  private resolveOutput(binding: OutputBinding, context: BindingRuntimeContext): unknown {
    const output = context.outputs?.[binding.nodeId]
    // Presence, rather than value, distinguishes a registered undefined output from a dangling binding.
    const hasOutput = binding.port === undefined
      ? !!output && Object.prototype.hasOwnProperty.call(output, 'default')
      : !!output?.ports && Object.prototype.hasOwnProperty.call(output.ports, binding.port)
    if (!hasOutput) {
      throw createCapabilityError('binding.output_not_found', 'Runtime output is not available', {
        details: {
          nodeId: binding.nodeId,
          ...(binding.port === undefined ? {} : { port: binding.port }),
        },
      })
    }
    const value = binding.port === undefined ? output?.default : output?.ports?.[binding.port]
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

function firstObservableValue(source: Observable<unknown>, signal?: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false
    let subscription: Subscription | undefined
    const cleanup = () => signal?.removeEventListener('abort', abort)
    const settle = (handler: (value?: unknown) => void, value?: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      handler(value)
      queueMicrotask(() => subscription?.unsubscribe())
    }
    const abort = () => settle(
      reject,
      createCapabilityError('runtime.aborted', 'Runtime binding resolution has been aborted'),
    )
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) {
      abort()
      return
    }
    subscription = source.subscribe({
      next: value => settle(resolve, value),
      error: error => settle(reject, error),
      complete: () => settle(reject, new EmptyError()),
    })
    if (signal?.aborted) abort()
  })
}

export { getByPath }
export type { DataPath }

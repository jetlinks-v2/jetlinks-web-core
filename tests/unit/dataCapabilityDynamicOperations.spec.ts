import assert from 'node:assert/strict'
import { lastValueFrom, of, toArray } from 'rxjs'
import type { OperationDefinition, DataCapabilityRequest, CapabilityContext } from '../../src/data-capability/types'

Object.defineProperty(globalThis, 'window', { value: {}, configurable: true })
const { DefaultDataCapabilityRegistry } = await import('../../src/data-capability/registry')
const registry = new DefaultDataCapabilityRegistry({ loadModuleProviders: false })
const id = 'test.dynamic-action.apply'
let executed = 0, discovered = 0
const definition = (context: CapabilityContext): OperationDefinition => ({
  id, kind: 'operation', version: 1, name: 'Apply', action: 'invoke',
  owner: { moduleId: 'test-module', providerId: 'test-provider' },
  policy: { risk: 'low', confirmation: 'always', idempotency: 'none', cancellation: 'before-dispatch', retry: 'never', concurrency: 'drop-while-running' },
  create: () => ({ execute() { executed++; return of({ type: 'result' as const, result: context.request }, { type: 'completed' as const }) } }),
})
const unregister = registry.registerProvider({
  id: 'test-provider', owner: { moduleId: 'test-module', providerId: 'test-provider' }, load: () => ({}),
  dynamicOperations: {
    namespace: 'test.dynamic-action',
    async discover(context) { discovered++; return { operations: [definition(context)] } },
    async resolve(key, context) { return key === id ? definition(context) : undefined },
  },
})
const createRequest = (): DataCapabilityRequest => ({ async get() { throw new Error('No HTTP') }, async post() { throw new Error('No HTTP') } })
const requestA = createRequest(), requestB = createRequest()
const first = registry.createRuntime({ runtimeId: 'action-a', request: requestA })
const second = registry.createRuntime({ runtimeId: 'action-b', request: requestB })
const binding = { version: 1 as const, operation: { capabilityId: id, version: 1 } }
const [a, b] = await Promise.all([first.prepareOperation(binding), second.prepareOperation(binding)])
assert.equal(executed, 0)
assert.equal(discovered, 0)
assert.equal(registry.operations.get(id), undefined)
for (const [runtime, prepared, request] of [[first, a, requestA], [second, b, requestB]] as const) {
  const confirmed = runtime.confirmOperation(prepared.id, { method: 'ui' })
  const events = await lastValueFrom(runtime.executeOperation(confirmed).events$.pipe(toArray()))
  assert.ok(events.some(event => event.type === 'result' && event.result === request))
}
assert.equal(executed, 2)
const catalog = await registry.resolveCapabilityChoices({}, { kinds: ['operation'] })
assert.equal(catalog.items.length, 1)
assert.equal(discovered, 1)
unregister()
await assert.rejects(first.prepareOperation(binding))
await first.dispose()
await second.dispose()
console.log('dynamicOperations: saved ID, caller isolation, explicit confirmation and unregister passed')

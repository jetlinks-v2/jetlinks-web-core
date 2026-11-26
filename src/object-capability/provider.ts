import { defer, map } from 'rxjs'
import type { CapabilityContext, DataCapabilityProvider, DataSourceDefinition, DataSourceRequest, RuntimeContext, OperationDefinition, PreparedOperation } from '../data-capability/types'
import type { VariableObjectSpec } from '../types/relation'
import { getByPath } from '../data-capability/utils'
import { objectCapabilitiesApi } from './api'
import { objectCapabilityId, objectMembers, objectValueSchema, parseObjectCapabilityId, sameObjectMember } from './metadata'
import type { ObjectCapabilityValue, ObjectFunctionMetadata, ObjectMember, ObjectReference } from './types'

const owner = { moduleId: 'jetlinks-web-core', providerId: 'object-capabilities' }
const actionPolicy: OperationDefinition['policy'] = {
  risk: 'medium', confirmation: 'always', idempotency: 'none', cancellation: 'before-dispatch',
  retry: 'never', concurrency: 'drop-while-running',
}
interface ObjectBindingConfig { object?: VariableObjectSpec }

async function targets(config: unknown, context: CapabilityContext, signal?: AbortSignal) {
  const spec = (config as ObjectBindingConfig | undefined)?.object
  const current = context.attributes?.object as ObjectReference | undefined
  if (!spec) {
    if (!current) throw new Error('请先选择对象')
    return { objects: [current], limited: false }
  }
  let objectId = spec.objectId
  if (spec.objectSource?.source === 'fixed') objectId = spec.objectSource.value
  if (spec.objectSource?.source === 'upper') {
    const key = spec.objectSource.upperKey
    const value = (context.parameters?.[key] ?? getByPath(context.parameters, key.split('.'))) as ObjectReference | string | undefined
    objectId = typeof value === 'string' ? value : value?.id
  }
  if (!objectId) throw new Error('当前对象暂不可用')
  const result = await objectCapabilitiesApi(context).resolve({ objectType: spec.objectType, objectId, related: spec.related }, signal)
  return { ...result, objects: result.objects.map(object => current?.type === object.type && current.id === object.id
    ? { ...object, name: current.name } : object) }
}

function source(member: ObjectMember): DataSourceDefinition {
  return {
    id: objectCapabilityId(member.ref), kind: 'data-source', version: 1, name: member.name,
    description: member.description, owner, modes: ['snapshot'], facets: { objectMember: member.ref },
    querySchema: member.ref.kind === 'query' && (member.metadata as ObjectFunctionMetadata).inputs?.length ? inputSchema(member) : undefined,
    create: config => ({
      query<T>(request: DataSourceRequest, context: RuntimeContext) {
        return defer(async () => {
          const api = objectCapabilitiesApi(context)
          const resolved = await targets(config, context, request.signal)
          const values: ObjectCapabilityValue['values'] = []
          // Resolution is bounded at the original relation service. Sequential reads retain source backpressure.
          for (const object of resolved.objects) {
            if (object.type !== member.ref.type) throw new Error('所选数据不适用于当前对象')
            const actual = objectMembers(object.type, await api.models(object.type, object.id, request.signal))
              .find(value => sameObjectMember(value.ref, member.ref))
            if (!actual) throw new Error('所选数据暂不可用')
            const value = member.ref.kind === 'property'
              ? (await api.properties(object, member.ref.providerId, [member.ref.id], request.signal))[0]?.value
              : await api.command(object, member.ref.providerId, member.ref.id, request.query || {}, true, request.signal)
            values.push({ object, value, metadata: actual.metadata })
          }
          return { data: { values, limited: resolved.limited } as T }
        })
      },
    }),
  }
}

function inputSchema(member: ObjectMember) {
  return { type: 'object' as const, properties: Object.fromEntries(((member.metadata as ObjectFunctionMetadata).inputs || [])
    .flatMap(input => {
      const schema = objectValueSchema(input.valueType)
      return schema ? [[input.id, { ...schema, title: input.name || input.id }]] : []
    })) }
}

function operation(member: ObjectMember): OperationDefinition {
  const id = objectCapabilityId(member.ref)
  return {
    id, kind: 'operation', version: 1, name: member.name, description: member.description,
    owner, action: 'invoke', inputSchema: inputSchema(member), outputSchema: { type: 'array', items: member.schema }, policy: actionPolicy,
    facets: { objectMember: member.ref },
    create: config => ({
      async prepare(request, context): Promise<PreparedOperation> {
        const result = await targets(config, context, request.signal)
        if (result.limited || result.objects.length !== 1) throw new Error('请选择一个对象后执行')
        const object = result.objects[0]
        if (object.type !== member.ref.type) throw new Error('所选操作不适用于当前对象')
        return { id: crypto.randomUUID(), capabilityId: id, request: { ...request, config: { target: object } },
          policy: actionPolicy, summary: member.name, impacts: [object] }
      },
      execute(prepared, context) {
        const object = (prepared.request.config as { target: ObjectReference }).target
        return defer(() => objectCapabilitiesApi(context).command(object, member.ref.providerId, member.ref.id,
          prepared.request.input || {}, false, context.signal)).pipe(map(result => ({ type: 'result' as const, result })))
      },
    }),
  }
}

/** One built-in adapter for every object type; business modules only contribute original semantics and presentations. */
export function createObjectCapabilityProvider(): DataCapabilityProvider {
  const pending = new WeakMap<CapabilityContext, Promise<ObjectMember[]>>()
  const discover = (context: CapabilityContext) => {
    if (pending.has(context)) return pending.get(context)!
    const object = context.attributes?.object as ObjectReference | undefined
    const task = object ? objectCapabilitiesApi(context).models(object.type, object.id).then(models => objectMembers(object.type, models)) : Promise.resolve([])
    pending.set(context, task)
    void task.finally(() => pending.delete(context)).catch(() => {})
    return task
  }
  const resolve = async (id: string, context: CapabilityContext) => {
    const ref = parseObjectCapabilityId(id)
    const object = context.attributes?.object as ObjectReference | undefined
    const models = await objectCapabilitiesApi(context).models(ref.type, object?.type === ref.type ? object.id : undefined)
    return objectMembers(ref.type, models).find(member => sameObjectMember(member.ref, ref))
  }
  return {
    id: owner.providerId, owner, load: () => ({}),
    dynamicSources: { namespace: 'object.read',
      async discover(context) { return { sources: (await discover(context)).filter(m => m.ref.kind !== 'action').map(source) } },
      async resolve(id, context) { const member = await resolve(id, context); return member && member.ref.kind !== 'action' ? source(member) : undefined },
    },
    dynamicOperations: { namespace: 'object.action',
      async discover(context) { return { operations: (await discover(context)).filter(m => m.ref.kind === 'action').map(operation) } },
      async resolve(id, context) { const member = await resolve(id, context); return member?.ref.kind === 'action' ? operation(member) : undefined },
    },
  }
}

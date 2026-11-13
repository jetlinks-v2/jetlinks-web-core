import { getDataCapabilityRequest } from '../data-capability/request'
import type { CapabilityContext } from '../data-capability/types'
import type { ObjectSpec } from '../types/relation'
import type { ObjectProviderModel, ObjectReference } from './types'

/** All calls retain the host's request identity, locale and deployment context. */
export function objectCapabilitiesApi(context: CapabilityContext) {
  const http = getDataCapabilityRequest(context)
  const part = encodeURIComponent
  async function read<T>(operation: Promise<unknown>): Promise<T> {
    const response = await operation as { status: number; result: T; message?: string }
    if (response.status !== 200) throw new Error(response.message || String(response.status))
    return response.result
  }
  const root = (object: ObjectReference) => `/relation/objects/${part(object.type)}/${part(object.id)}`
  return {
    /** Existing source query applies its own asset scope; do not add a provider access preflight. */
    objects: async (type: string, ids: string[], signal?: AbortSignal) => {
      const page = await read<{ data: Array<{ id: string; name?: string }> }>(http.post('/relation/objects/_query', {
        type, query: { paging: true, pageIndex: 0, pageSize: ids.length, terms: [{ column: 'id', termType: 'in', value: ids }] },
      }, { signal, hiddenError: true }))
      return page.data
    },
    models: (type: string, id?: string, signal?: AbortSignal) => read<ObjectProviderModel[]>(http.get(
      `/relation/objects/${part(type)}${id === undefined ? '' : `/${part(id)}`}/providers`, undefined, { signal, hiddenError: true })),
    properties: (object: ObjectReference, providerId: string, keys: string[], signal?: AbortSignal) =>
      read<Array<{ property: string; value: unknown; providerId: string }>>(http.post(`${root(object)}/properties/_query`, { keys },
        { params: { providerId }, signal, hiddenError: true })),
    command: (object: ObjectReference, providerId: string, command: string, input: Record<string, unknown>, query: boolean, signal?: AbortSignal) =>
      read<unknown[]>(http.post(`${root(object)}/commands/${part(command)}${query ? '/_query' : ''}`, input,
        { params: { providerId }, signal, hiddenError: true })),
    resolve: (spec: ObjectSpec, signal?: AbortSignal) => read<{ objects: ObjectReference[]; limited: boolean }>(
      http.post('/relation/objects/_resolve', spec, { signal, hiddenError: true })),
  }
}

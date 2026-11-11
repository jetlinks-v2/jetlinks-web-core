import { request } from '@jetlinks-web/core'
import type { RelatedObjectQuery, RelationObjectPage } from '../types/relation'

async function read(operation: Promise<unknown>): Promise<RelationObjectPage> {
  const response = (await operation) as { status: number; result: RelationObjectPage; message?: string }
  if (response.status !== 200) throw new Error(response.message || String(response.status))
  return response.result
}

/** 来源对象与关系的统一分页入口，保留来源授权及实例语义，不读取本体工作台接口。 */
export const relationObjectsApi = {
  objects: (type: string, query: Record<string, unknown>) =>
    read(request.post('/relation/objects/_query', { type, query })),
  related: (query: RelatedObjectQuery) => read(request.post('/relation/objects/related/_query', query))
}

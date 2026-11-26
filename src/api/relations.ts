import { request, type Request } from '@jetlinks-web/core'
import { firstValueFrom, fromEvent, map, take, takeUntil, timeout, toArray } from 'rxjs'
import { createRuntimeNdJson } from '../utils/ndjson'
import type { ObjectSpec, RelationInfo, RelationObjectData, RelationObjectResult, RelationObjectType } from '../types/relation'

const path = encodeURIComponent
const options = { hiddenError: true }
const http: Pick<Request, 'get' | 'post'> = request

/** 保留平台认证、语言、项目请求上下文；失败不冒充空目录。 */
function result<T>(response: { result: T; success?: boolean; status?: number; message?: string }): T {
  if (response.success === false || response.status && response.status >= 400) {
    throw new Error(response.message || String(response.status))
  }
  return response.result
}

export const relationApi = {
  types: async () => result(await http.get<RelationObjectType[]>('/relation/types', undefined, options)),
  relations: async (type: string) => result(await http.get<RelationInfo[]>(`/relation/${path(type)}/relations/_all`, undefined, options)),
  /** 使用不返回总数的批查询；pageSize 限制每次读取，不下载全部实例。 */
  objects: async (type: string, keyword: string, pageIndex = 0) => result(await http.post<RelationObjectData[]>(
    '/relation/objects/_query/no-paging', {
      type, query: { paging: true, pageIndex, pageSize: 20,
        terms: keyword.trim() ? [{ column: 'name', termType: 'like', value: `%${keyword.trim()}%` }] : [] },
    }, options)),
  /** _parse 没有分页协议。读取多一条识别截断，取消或超时终止流，绝不把预览数当总数。 */
  preview: async (spec: ObjectSpec, signal: AbortSignal) => {
    const rows = await firstValueFrom(createRuntimeNdJson().post('/relation/_parse', { ...spec, properties: ['name'] }).pipe(
      map((item: unknown) => {
        const envelope = item as { result?: RelationObjectResult; success?: boolean; status?: number; message?: string }
        if (envelope.success === false || envelope.status && envelope.status >= 400) throw new Error(envelope.message || String(envelope.status))
        return envelope.result ?? item as RelationObjectResult
      }),
      take(21), toArray(), timeout(15000), takeUntil(fromEvent(signal, 'abort')),
    ))
    const data = [...new Map(rows.slice(0, 20).map(row => [JSON.stringify([row.type, row.id]), row])).values()]
    return { data, limited: rows.length > 20 }
  },
}

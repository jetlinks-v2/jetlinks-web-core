/** Only the object source is simulated. Every /process request reaches the real HTTP controller and database. */
const objects = [{ id: 'D1', name: '一号送风机' }, { id: 'D2', name: '二号送风机' }]
async function send(method: string, path: string, body?: unknown, options?: { params?: Record<string, unknown>; signal?: AbortSignal }) {
  if (path.startsWith('/relation/')) {
    let value: unknown
    if (path === '/relation/types') value = [{ id: 'device', name: '设备' }, { id: 'product', name: '产品' }, { id: 'space', name: '空间' }]
    else if (path.endsWith('/providers')) value = [{ providerId: 'device', name: '物模型', metadata: {
      properties: [{ id: 'pressure', name: '风压到位', valueType: { type: 'boolean' } }],
      functions: [{ id: 'operate', name: '启动风机', inputs: [], output: { type: 'object' }, expands: { functionKind: 'action' } }],
    } }]
    else if (path.endsWith('/_query/no-paging')) value = objects
    else if (path.endsWith('/_query')) value = { data: objects, total: objects.length }
    else throw new Error(`Unimplemented fixture source: ${path}`)
    return { status: 200, result: value }
  }
  const url = new URL(path, window.location.origin)
  Object.entries(options?.params || {}).forEach(([key, value]) => { if (value !== undefined) url.searchParams.set(key, String(value)) })
  const response = await fetch(url, { method, signal: options?.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  if (!response.ok) throw new Error((await response.text()) || String(response.status))
  return response.json()
}
export const request = {
  get: (url: string, params?: Record<string, unknown>, options?: {signal?: AbortSignal}) => send('GET', url, undefined, {...options,params}),
  post: (url: string, body?: unknown, options?: {params?:Record<string,unknown>;signal?:AbortSignal}) => send('POST', url, body, options),
  remove: (url: string, body?: unknown, options?: {params?:Record<string,unknown>}) => send('DELETE', url, body, options),
}
export function createNdJson() { throw new Error('Streaming object resolution is outside this browser fixture') }
export const wsClient = {subscribe: () => { throw new Error('Media streaming is outside this browser fixture') }}

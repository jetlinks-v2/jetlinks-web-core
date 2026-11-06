import { createNdJson } from '@jetlinks-web/core'
import { getRequestBaseApi, getRequestHeaders } from './request-context'
import { langKey } from './consts'

/** 长连接与普通请求共用项目、应用、认证和语言上下文；取消沿用平台 reader。 */
export const createRuntimeNdJson = (onRequest?: () => void) => createNdJson({
  langKey,
  handleRequest(config) {
    const headers = new Headers(config.headers)
    Object.entries(getRequestHeaders()).forEach(([key, value]) => headers.set(key, value))
    headers.set('Accept', 'application/x-ndjson')
    headers.set('Content-Type', 'application/json')
    onRequest?.()
    return { ...config, baseURL: getRequestBaseApi(), headers }
  },
})

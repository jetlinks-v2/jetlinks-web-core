import { request } from '@jetlinks-web/core'
import type { AxiosResponseRewrite } from '@jetlinks-web/types'

export interface AuthorizationDimension {
  id?: string
  name?: string
  type: string | { id: string }
  options?: {
    applicationId?: string
    ignore?: boolean
  }
}

export interface CurrentAuthorization {
  user?: { id?: string; name?: string }
  dimensions: AuthorizationDimension[]
}

/** 默认入口与账号资料读取时禁用应用 Scope，取得当前账号完整的角色和应用维度。 */
export const getMe_api = (options: { applicationScope?: false; hiddenError?: boolean; signal?: AbortSignal } = {}): Promise<AxiosResponseRewrite<CurrentAuthorization>> => (
  request.get('/authorize/me', undefined, options)
)

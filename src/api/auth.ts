import { request } from '@jetlinks-web/core'
import type { AxiosResponseRewrite } from '@jetlinks-web/types'

export interface AuthorizationDimension {
  type: string | { id: string }
  options?: {
    applicationId?: string
    ignore?: boolean
  }
}

export interface CurrentAuthorization {
  user?: { name?: string }
  dimensions: AuthorizationDimension[]
}

/** 默认入口判断必须禁用应用 Scope，避免把已裁剪的角色误认为完整身份。 */
export const getMe_api = (options: { applicationScope?: false } = {}): Promise<AxiosResponseRewrite<CurrentAuthorization>> => (
  request.get('/authorize/me', undefined, options)
)

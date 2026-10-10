import { request } from '@jetlinks-web/core'
import type { BasicLayoutVariant } from '@jetlinks-web-core/layout/runtime/layoutVariant'

export interface BusinessApplicationConfiguration {
  layoutVariant?: BasicLayoutVariant
  [key: string]: unknown
}

export interface BusinessApplicationEntity {
  id: string
  projectId: string
  templateId: string
  name: string
  icon?: string
  description?: string
  configuration?: BusinessApplicationConfiguration
  state?: string | { value: string; text?: string }
}

export const uiList = () => request.get('/system/resources/ui', undefined, { applicationScope: false })

/** 确认裸路径的入口身份时，避免把尚未确认的应用 ID 当作租户域名发送。 */
export const getMyBusinessApplications = (options: { tenantDomain?: false } = {}) => (
  // Older deployments may not expose this optional endpoint; the store handles fallback.
  request.get<BusinessApplicationEntity[]>('/business-application/me', undefined, {
    hiddenError: true,
    applicationScope: false,
    ...options,
  })
)

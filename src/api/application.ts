import { request } from '@jetlinks-web/core'

export interface BusinessApplicationEntity {
  id: string
  projectId: string
  templateId: string
  name: string
  icon?: string
  description?: string
  configuration?: Record<string, unknown>
  state?: string | { value: string; text?: string }
}

export const uiList = () => request.get('/system/resources/ui')

export const getMyBusinessApplications = () => (
  // Older deployments may not expose this optional endpoint; the store handles fallback.
  request.get<BusinessApplicationEntity[]>('/business-application/me', undefined, {
    hiddenError: true,
  })
)

import type { PermissionScope } from './components/data'

export type TokenDialogMode = 'add' | 'edit' | 'view'
export type TokenPermissionMode = 'follow' | 'readonly' | 'custom'

export interface StoredTokenScope {
  permissions?: PermissionScope[] | null
  attributes?: Record<string, unknown>
  dimensions?: unknown[]
  [key: string]: unknown
}

export interface TokenGrantScope extends StoredTokenScope {
  permissions: PermissionScope[]
}

export interface TokenPermissionSelection {
  mode: TokenPermissionMode
  permissions: PermissionScope[]
}

export interface TokenFormData {
  id?: string
  name: string
  expires: number | string | null
  description: string
  scope: TokenGrantScope
  sourceType: string
  sourceId: string
  sourceTypeName?: string
}

export type PersonalToken = Partial<Omit<TokenFormData, 'scope'>> & {
  id: string
  scope?: StoredTokenScope | null
  creatorName?: string
  createTime?: number | string
  status?: string
}

export interface TokenDialogProps {
  visible: boolean
  mode: TokenDialogMode
  token: PersonalToken | null
}

export type TokenDialogEmit = (event: 'close' | 'save', data?: TokenFormData, revokeAccessTokens?: boolean) => void

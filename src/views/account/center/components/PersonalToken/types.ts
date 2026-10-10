import type { PermissionScope } from './components/data'

export type TokenDialogMode = 'add' | 'edit' | 'view'

export interface TokenFormData {
  id?: string
  name: string
  expires: number | string | null
  description: string
  scope: { permissions: PermissionScope[] }
  sourceType: string
  sourceId: string
  sourceTypeName?: string
}

export type PersonalToken = Partial<TokenFormData> & {
  id: string
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

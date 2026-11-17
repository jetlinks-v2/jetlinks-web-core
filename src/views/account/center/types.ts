import type { CenterTabKey } from './data'

export type CenterContentKey = Exclude<CenterTabKey, 'HomeView' | 'BindThirdAccount'> | 'BasicInfo'
export type AccountEditTarget = 'email-section' | 'phone-section'
export type ContactVerificationState = 'loading' | 'ready' | 'unavailable' | 'failed'

export interface AccountContact {
  value: string
  verified: boolean
  notificationValue?: string
  notificationSeparate?: boolean
}

export interface AccountCardItem {
  key: string
  label: string
  value: string
  editTarget?: AccountEditTarget
  tags?: string[]
  /** 组织字段的缺项状态由资料映射提供，不以翻译后的展示值判断。 */
  unassigned?: boolean
}

export interface AccountCardProfile {
  name: string
  username: string
  avatar?: string
  items: AccountCardItem[]
  thirdAccounts: AccountCardItem[]
  contacts?: { mobile: AccountContact; email: AccountContact }
  canEdit: boolean
  canConfigureHome: boolean
}

import type { CenterTabKey } from './data'

export type CenterContentKey = Exclude<CenterTabKey, 'HomeView' | 'BindThirdAccount'>
export type AccountEditTarget = 'email-section' | 'phone-section'

export interface AccountCardItem {
  key: string
  label: string
  value: string
  editTarget?: AccountEditTarget
}

export interface AccountCardProfile {
  name: string
  username: string
  avatar?: string
  items: AccountCardItem[]
  thirdAccounts: AccountCardItem[]
  canEdit: boolean
  canConfigureHome: boolean
}

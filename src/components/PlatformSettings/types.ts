import type { InlineEditResult } from '../InlineEditForm'

export interface PlatformSettingsModel {
  title: string
  logo: string
  ico: string
  background: string
  recordNumber: string
  showRecordNumber: boolean
  apiKey: string
  webKey: string
  secretKey: string
  'base-path': string
}
export type PlatformSettingKey = keyof PlatformSettingsModel
export type PlatformSettingsMode = 'detail' | 'form'
export type PlatformSettingsPatch = Partial<PlatformSettingsModel>
export type PlatformSettingsErrors = Partial<Record<PlatformSettingKey, string>>
export type PlatformSettingsSubmit = (patch: PlatformSettingsPatch) => Promise<InlineEditResult>
export interface PlatformSettingsAssets { logo: string; ico: string; background: string }
export interface PlatformSettingsScope { scope: string; properties: Record<string, unknown> }
export type PlatformSettingsScopes = Record<'front' | 'amap' | 'paths', Record<string, unknown>>
export type SettingsTranslate = (key: string) => string

export interface PlatformSettingsSource {
  load: () => Promise<PlatformSettingsScopes>
  save: (scopes: PlatformSettingsScope[]) => Promise<{ success: boolean }>
}

export interface PlatformSettingsSectionProps {
  model: PlatformSettingsModel
  saved: PlatformSettingsModel
  mode: PlatformSettingsMode
  busy?: boolean
  disabled?: boolean
  errors?: PlatformSettingsErrors
  hidden?: readonly string[]
  submit: PlatformSettingsSubmit
}

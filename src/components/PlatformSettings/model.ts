import type { PlatformSettingKey, PlatformSettingsErrors, PlatformSettingsModel, PlatformSettingsPatch, PlatformSettingsScopes, SettingsTranslate } from './types'

const strings = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
export const settingsFieldScopes: Record<PlatformSettingKey, keyof PlatformSettingsScopes> = {
  title: 'front', logo: 'front', ico: 'front', background: 'front', recordNumber: 'front', showRecordNumber: 'front',
  apiKey: 'amap', webKey: 'amap', secretKey: 'amap', 'base-path': 'paths',
}

/** Defaults are display/draft values only; hidden fields are never materialized by an unrelated save. */
export function toSettingsModel(scopes: PlatformSettingsScopes, baseUrl: string): PlatformSettingsModel {
  const { front, amap, paths } = scopes
  return {
    title: strings(front.title), logo: strings(front.logo, 'images/login/logo.png'),
    ico: strings(front.ico, 'favicon.ico'), background: strings(front.background),
    recordNumber: strings(front.recordNumber), showRecordNumber: front.showRecordNumber === true,
    apiKey: strings(amap.apiKey), webKey: strings(amap.webKey), secretKey: strings(amap.secretKey),
    'base-path': strings(paths['base-path'], baseUrl),
  }
}

export function visibleSettingsKeys(hidden: readonly string[]): PlatformSettingKey[] {
  return (Object.keys(settingsFieldScopes) as PlatformSettingKey[]).filter(key =>
    !hidden.includes(key) && !(key === 'recordNumber' && hidden.includes('showRecordNumber')))
}

/** Merge only requested keys into the saved scope, preserving extension and deployment configuration. */
export function mergeSettingsPatch(scopes: PlatformSettingsScopes, patch: PlatformSettingsPatch) {
  const result: PlatformSettingsScopes = { front: { ...scopes.front }, amap: { ...scopes.amap }, paths: { ...scopes.paths } }
  const changed = new Set<keyof PlatformSettingsScopes>()
  for (const key of Object.keys(patch) as PlatformSettingKey[]) {
    const scope = settingsFieldScopes[key]
    if (!scope) continue
    result[scope][key] = patch[key]
    changed.add(scope)
  }
  return { scopes: result, payload: [...changed].map(scope => ({ scope, properties: result[scope] })) }
}

export function validateSettings(model: PlatformSettingsModel, keys: readonly PlatformSettingKey[], t: SettingsTranslate): PlatformSettingsErrors {
  const errors: PlatformSettingsErrors = {}
  if (keys.includes('title')) {
    if (!model.title.trim()) errors.title = t('PlatformSettings.nameRequired')
    else if (model.title.length > 64) errors.title = t('PlatformSettings.nameLength')
  }
  if ((keys.includes('recordNumber') || keys.includes('showRecordNumber')) && model.showRecordNumber && !model.recordNumber.trim()) {
    errors.recordNumber = t('PlatformSettings.recordRequired')
  }
  if (keys.includes('base-path')) {
    try {
      const url = new URL(model['base-path'])
      if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) throw new Error('url')
    } catch { errors['base-path'] = t('PlatformSettings.addressInvalid') }
  }
  if (keys.includes('apiKey') || keys.includes('secretKey')) {
    if (!!model.apiKey.trim() !== !!model.secretKey.trim()) {
      errors.apiKey = errors.secretKey = t('PlatformSettings.mapPairRequired')
    }
  }
  if ((keys.includes('apiKey') || keys.includes('webKey')) && model.apiKey && model.webKey && model.apiKey.trim() === model.webKey.trim()) {
    errors.webKey = t('PlatformSettings.mapKeysDifferent')
  }
  return errors
}

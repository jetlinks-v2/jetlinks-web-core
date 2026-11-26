import { frontLanguageOptions, type FrontLanguage } from '../languageOptions'

export const builtInLanguageOptions = frontLanguageOptions
export type BuiltInLanguage = FrontLanguage

export const DEFAULT_LANGUAGE: BuiltInLanguage = 'zh'

// 额外语种只声明 BCP 47 代码，不需要对应的 i18n JSON。
const machineLanguages: readonly string[] = []

export function canonicalLanguage(value?: string | null): string | undefined {
  if (!value?.trim()) return undefined
  try {
    return Intl.getCanonicalLocales(value.trim().replaceAll('_', '-'))[0]
  } catch {
    return undefined
  }
}

export function builtInLanguage(value?: string | null): BuiltInLanguage | undefined {
  const base = canonicalLanguage(value)?.split('-')[0]
  return builtInLanguageOptions.find(option => option.value === base)?.value
}

export function machineLanguage(value?: string | null): string | undefined {
  const tag = canonicalLanguage(value)
  return tag && machineLanguages.find(language => canonicalLanguage(language) === tag) ? tag : undefined
}

export const machineLanguageOptions = machineLanguages.flatMap(value => {
  const tag = machineLanguage(value)
  if (!tag || builtInLanguageOptions.some(option => option.value === tag)) return []
  return [{ value: tag, label: new Intl.DisplayNames([tag], { type: 'language' }).of(tag) || tag }]
})

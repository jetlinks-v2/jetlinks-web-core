import type { I18nTextMessages } from './types'

const normalize = (locale: string) => locale.replace(/_/g, '-').toLowerCase()

/** 区域语言优先，其次主语言；空翻译视为未配置，由调用方决定默认文案。 */
export function translatedI18nText(messages: I18nTextMessages | undefined, locale: string) {
  const current = normalize(locale)
  for (const language of [current, current.split('-')[0]]) {
    const entry = Object.entries(messages ?? {}).find(([key, text]) => normalize(key) === language && text.trim())
    if (entry) return entry[1]
  }
}

export function resolveI18nText(value: string | undefined, messages: I18nTextMessages | undefined, locale: string) {
  return translatedI18nText(messages, locale) ?? value ?? ''
}

/** 原位修改只更新当前语言，不覆盖默认文案或其他语言；保留已有区域语言键。 */
export function updateI18nText(messages: I18nTextMessages | undefined, locale: string, value: string): I18nTextMessages {
  const language = Object.keys(messages ?? {}).find(key => normalize(key) === normalize(locale)) ?? normalize(locale).split('-')[0]
  const next = { ...messages }
  if (value.trim()) next[language] = value.trim()
  else delete next[language]
  return next
}

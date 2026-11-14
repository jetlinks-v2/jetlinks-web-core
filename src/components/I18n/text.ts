import type { I18nTextMessages } from './types'

/** 展示文字先匹配完整语言，再匹配语言族，最后使用作者填写的缺省内容。 */
export function i18nText(value: string | undefined, messages: I18nTextMessages | undefined, locale: string): string {
  const language = locale.replace(/_/g, '-').toLowerCase()
  return messages?.[locale] || messages?.[language] || messages?.[language.split('-')[0]] || value || ''
}

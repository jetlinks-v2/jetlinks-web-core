import type { DocumentHelpConfiguration } from '../api/document'

type DocumentHelpContent = Pick<DocumentHelpConfiguration, 'content' | 'i18nMessages'>

/** 当前语言优先，缺译只回退兼容正文；不将旧正文认定为某个语言。 */
export function resolveDocumentHelpContent(configuration: DocumentHelpContent | undefined, locale: string): string {
  const normalizedLocale = String(locale || '').replace('_', '-').toLowerCase()
  const messages = configuration?.i18nMessages?.content
  const candidates = [messages?.[normalizedLocale], messages?.[normalizedLocale.split('-')[0]], configuration?.content]
  return candidates.find(value => typeof value === 'string' && value.trim()) || ''
}

/** 配置状态覆盖所有语言，避免当前语言缺译时误删其他语言正文。 */
export function hasDocumentHelpContent(configuration: DocumentHelpContent | undefined): boolean {
  return [configuration?.content, ...Object.values(configuration?.i18nMessages?.content || {})]
    .some(value => typeof value === 'string' && Boolean(value.trim()))
}

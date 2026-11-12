import i18n from '@jetlinks-web-core/locales'
import { USER_CENTER_MENU_DATA } from '../views/init-home/data/baseMenu'

type MenuLocaleItem = {
  code?: string
  name?: string
  describe?: string
  i18nName?: string
  i18nDescribe?: string
  i18nMessages?: Record<string, unknown>
}

type MenuTextField = 'name' | 'describe'

const asRecord = (value: unknown): Record<string, unknown> | undefined => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
)

const japaneseText = (value: unknown): string | undefined => {
  const messages = asRecord(value)
  const text = messages?.ja || messages?.ja_JP
  return typeof text === 'string' && text.trim() ? text : undefined
}

const identity = (item: MenuLocaleItem, field: MenuTextField) => (
  JSON.stringify([item.code, item.name, field, item[field]])
)

/** 默认菜单仅补齐日文显示；名称或说明已被定制、服务端已有译文时，保留服务端结果。 */
export const createMenuLocaleResolver = (definitions: unknown[], getLocale: () => string) => {
  const defaults = new Map<string, string>()
  const ambiguous = new Set<string>()
  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collect)
      return
    }
    const record = asRecord(value)
    if (!record) return
    const item = record as MenuLocaleItem
    if (item.code && item.name) {
      for (const field of ['name', 'describe'] as const) {
        const translated = japaneseText(item.i18nMessages?.[field])
        if (!item[field] || !translated) continue
        const key = identity(item, field)
        if (defaults.has(key) && defaults.get(key) !== translated) ambiguous.add(key)
        defaults.set(key, translated)
      }
    }
    collect(record.children)
  }
  definitions.forEach(collect)

  return (item: MenuLocaleItem, field: MenuTextField = 'name') => {
    const localized = field === 'name' ? item.i18nName : item.i18nDescribe
    const original = item[field]
    if (getLocale().split(/[-_]/)[0] !== 'ja') return localized || original

    const explicit = japaneseText(item.i18nMessages?.[field])
      || (field === 'name' ? japaneseText(item.i18nMessages) : undefined)
    if (explicit) return explicit
    if (localized && localized !== original) return localized

    const key = identity(item, field)
    return (!ambiguous.has(key) && defaults.get(key)) || localized || original
  }
}

const baseMenus = import.meta.glob('../../../modules/**/baseMenu.json', { eager: true, import: 'default' })

export const getMenuLocaleText = createMenuLocaleResolver(
  [USER_CENTER_MENU_DATA, ...Object.values(baseMenus)],
  () => i18n.global.locale.value,
)

import { resolveI18nText, translatedI18nText } from '../I18n/text'
import type { I18nMessages } from '../I18n/types'
import type { FormField, FormLayoutItem } from './types'

/** 只解析展示属性，不转换业务值或修改宿主元数据。 */
export function formText(source: { i18nMessages?: I18nMessages } & Partial<Record<'label' | 'description' | 'unit', string>>, property: 'label' | 'description' | 'unit', locale: string) {
  return resolveI18nText(source[property], source.i18nMessages?.[property], locale)
}

/** 布局当前语言覆盖优先，缺失时用布局默认名，再继承字段的本地化名称。 */
export function formLabel(field: FormField, item: FormLayoutItem, locale: string) {
  return translatedI18nText(item.i18nMessages?.label, locale) ?? item.label ?? formText(field, 'label', locale)
}

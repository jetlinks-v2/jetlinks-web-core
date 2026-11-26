import dayjs from 'dayjs'
import type { FormAccess, FormField, FormLayout, FormLayoutItem, FormOption } from './types'

/** 静态只读、布局只读和会话权限取交集，页面配置不能提升权限。 */
export function fieldAccess(field: FormField, item: FormLayoutItem, access?: FormAccess) {
  const current = access?.[field.key]
  const declared = Object.hasOwn(access ?? {}, field.key) ? current ?? 'write' : 'write'
  if (declared === 'hidden' || declared === 'denied') return declared
  return declared === 'read' || field.readonly || item.readonly ? 'read' : 'write'
}

export function isEmpty(value: unknown) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

/** 仅格式化展示，数值精度及单位设置不参与提交值转换。 */
export function displayValue(field: FormField, item: FormLayoutItem, value: unknown, locale: string) {
  if (isEmpty(value)) return ''
  if (field.type === 'number' && typeof value === 'number' && Number.isFinite(value)) {
    return new Intl.NumberFormat(locale, { useGrouping: !!item.thousands, minimumFractionDigits: item.digits, maximumFractionDigits: item.digits ?? 20 }).format(value)
  }
  if ((field.type === 'date' || field.type === 'datetime') && typeof value === 'string') {
    const date = dayjs(value)
    return date.isValid() ? date.format(item.dateFormat || (field.type === 'date' ? 'YYYY.MM.DD' : 'YYYY.MM.DD HH:mm')) : value
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

/** 选项以原始稳定值匹配，不能把数字、布尔值和同名字符串混为一项。 */
export function selectedOptions(field: FormField, value: unknown): FormOption[] {
  const values = field.multiple ? (Array.isArray(value) ? value : []) : [value]
  return values.map(value => field.options?.find(option => Object.is(option.value, value)) ?? { value: value as FormOption['value'], label: String(value) })
}

export function optionColor(option: FormOption, item: FormLayoutItem) {
  return item.optionColors?.find(entry => Object.is(entry.value, option.value))?.color || option.color
}

/** 唯一一套移动逻辑同时处理字段库加入、同区排序与跨分区移动。 */
export function moveField(layout: FormLayout, key: string, sectionId: string, beforeKey?: string): FormLayout {
  if (!layout.sections.some(section => section.id === sectionId) || key === beforeKey) return layout
  const item = layout.sections.flatMap(section => section.items).find(item => item.key === key) ?? { key }
  const sections = layout.sections.map(section => {
    const items = section.items.filter(entry => entry.key !== key)
    if (section.id === sectionId) {
      const index = beforeKey ? items.findIndex(entry => entry.key === beforeKey) : -1
      items.splice(index < 0 ? items.length : index, 0, item)
    }
    return { ...section, items }
  })
  return { ...layout, sections }
}

import { i18nText } from '../../I18n/text'
import type { I18nMessages } from '../../I18n/types'
import type { MetricParameter, MetricTemplate } from '../types'
import { parameterElements } from '../parameterPresentation'

/** 枚举翻译按稳定编码关联，重排选项不会交换显示文字。 */
export function parameterEnumField(id:string, value:string) { return `parameter.${id}.enum.${encodeURIComponent(value)}` }
export function localizedParameter(parameter:MetricParameter, messages:I18nMessages, locale:string):MetricParameter {
  const text = (field:string, value?:string) => i18nText(value, messages[field], locale)
  return { ...parameter, name:text(`parameter.${parameter.id}.name`, parameter.name), description:text(`parameter.${parameter.id}.description`, parameter.description),
    valueType:parameter.valueType?.type === 'enum' ? { ...parameter.valueType,
      elements:parameterElements(parameter).map(item => ({ ...item, text:text(parameterEnumField(parameter.id, item.value), item.text ?? item.label) })) } : parameter.valueType }
}

export function templateMessages(template: MetricTemplate): I18nMessages {
  return (template.options?.i18nMessages || {}) as I18nMessages
}

/** 仅生成展示视图；表单、公式及保存继续使用原始模板，语言切换不改写草稿。 */
export function localizedTemplate(template: MetricTemplate, locale: string): MetricTemplate {
  const messages = templateMessages(template)
  const text = (field: string, value?: string) => i18nText(value, messages[field], locale)
  return { ...template, name: text('name', template.name),
    options: { ...template.options, description: text('description', String(template.options?.description || '')), notes: text('notes', String(template.options?.notes || '')) },
    inputDefinitions: template.inputDefinitions.map(item => ({ ...item, name: text(`input.${item.id}.name`, item.name) })),
    parameterDefinitions: template.parameterDefinitions.map(item => localizedParameter(item, messages, locale)),
    definitions: template.definitions.map(item => ({ ...item, name: text(`rule.${item.id}.name`, typeof item.name === 'string' ? item.name : undefined) })),
    outputs: template.outputs.map(item => ({ ...item, label: text(`output.${item.metricId}.label`, item.label) })) }
}

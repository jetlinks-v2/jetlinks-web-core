import type { I18nMessages } from '../I18n/types'

/** 字段 key 是宿主分配的不透明标识，点号不会被解释为对象路径。 */
export interface FormField {
  key: string
  label: string
  i18nMessages?: I18nMessages
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'enum' | 'boolean' | 'custom'
  description?: string
  unit?: string
  readonly?: boolean
  required?: boolean
  multiple?: boolean
  options?: FormOption[]
  /** 对应宿主提供的 value-{renderer} / editor-{renderer} 插槽。 */
  renderer?: string
}

export interface FormOption {
  value: string | number | boolean
  label: string
  i18nMessages?: I18nMessages
  color?: string
}

/** 只保存界面配置，不复制字段定义、数据或当前用户权限。 */
export interface FormLayoutItem {
  key: string
  label?: string
  i18nMessages?: I18nMessages
  span?: 1 | 2
  readonly?: boolean
  display?: 'auto' | 'text' | 'tags' | 'paragraph'
  editor?: 'auto' | 'list' | 'tags'
  digits?: number
  thousands?: boolean
  hideUnit?: boolean
  dateFormat?: string
  optionColors?: { value: FormOption['value']; color: string }[]
}

export interface FormSection {
  id: string
  label: string
  i18nMessages?: I18nMessages
  items: FormLayoutItem[]
}

export interface FormLayout {
  version: 1
  sections: FormSection[]
}

export type FormValues = Record<string, unknown>
export type FormAccess = Partial<Record<string, 'write' | 'read' | 'denied' | 'hidden'>>
export interface FormSubmitResult {
  /** 可选的服务端规范化字段值，仍以字段 key 索引。 */
  values?: FormValues
  /** 返回字段错误时保留全部草稿；业务整体错误可直接 reject。 */
  errors?: Record<string, string>
}
export type FormSubmit = (changes: FormValues) => Promise<FormSubmitResult | void>
export type FormValidate = (value: unknown, field: FormField, values: FormValues) => string | undefined

export interface FormValueSlot {
  field: FormField
  item: FormLayoutItem
  value: unknown
}
export interface FormEditorSlot extends FormValueSlot {
  update: (value: unknown) => void
  confirm: () => void
  cancel: () => void
}

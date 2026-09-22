/** 单个字段按语言保存的文本，以及按字段组织的多语言表单值。 */
export type I18nTextMessages = Record<string, string>
export type I18nMessages = Record<string, I18nTextMessages>

export interface I18nTextFieldProps {
  value?: string
  i18nMessages?: I18nMessages
  field: string
  label: string
  i18nMaxLength?: number
  textarea?: boolean
}

export interface I18nTextFieldEmits {
  (event: 'update:value', value: string): void
  (event: 'update:i18nMessages', value: I18nMessages): void
}

export interface I18nTextDialogProps {
  visible: boolean
  title: string
  data?: I18nTextMessages
  displayValue?: string
  maxLength?: number
  textarea?: boolean
}

export interface I18nTextDialogEmits {
  (event: 'update:visible', value: boolean): void
  (event: 'confirm', value: I18nTextMessages): void
}

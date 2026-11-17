export interface InlineEditOption {
  label: string
  value: string | number
}

/** Values are JSON data; value is the editable draft and initialValue is its saved baseline. */
export interface InlineEditFieldDefinition {
  key: string
  label: string
  value: unknown
  initialValue: unknown
  editor?: 'text' | 'number' | 'select' | 'password' | 'custom' | 'textarea'
  displayValue?: string
  placeholder?: string
  hint?: string
  error?: string
  required?: boolean
  readonly?: boolean
  /** Manual triggers render a static value; the host opens the editor through editField(key). */
  editTrigger?: 'value' | 'manual'
  fullWidth?: boolean
  secretSet?: boolean
  options?: InlineEditOption[]
  min?: number
  max?: number
  precision?: number
  maxLength?: number
}

export interface InlineEditGroup {
  key: string
  title?: string
  fields: InlineEditFieldDefinition[]
}

export interface InlineEditMessages {
  save: string
  cancel: string
  empty: string
  saving: string
  failed: string
}

export interface InlineEditResult { ok: boolean; error?: string }
export type InlineEditSubmit = (key: string, value: unknown) => Promise<InlineEditResult>

export interface InlineEditFieldProps {
  field: InlineEditFieldDefinition
  mode: 'detail' | 'form'
  disabled: boolean
  busy: boolean
  messages: InlineEditMessages
  submit?: InlineEditSubmit
}

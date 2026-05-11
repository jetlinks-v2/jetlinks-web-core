export type OutputSchemaFieldType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'enum'
  | 'bbox'
  | 'array'
  | 'object'

export interface OutputSchemaField {
  key: string
  label: string
  type: OutputSchemaFieldType
  unit?: string
  enumValues?: string[]
  min?: number
  max?: number
  description?: string
  variableName?: string
}

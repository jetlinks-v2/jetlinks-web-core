import { parse, stringify } from 'yaml'
export type ConfigurationFormat = 'yaml' | 'json'
export function encodeConfiguration(value: unknown, format: ConfigurationFormat): string {
  return format === 'yaml' ? stringify(value) : JSON.stringify(value, null, 2)
}
export function decodeConfiguration(text: string, format: ConfigurationFormat): unknown {
  return format === 'yaml' ? parse(text) : JSON.parse(text)
}
/** 管理员文本编辑转换到唯一 DTO；规则语义由后端编译器检查。 */
export function configurationObject(text: string, format: ConfigurationFormat): Record<string, unknown> {
  const value = decodeConfiguration(text, format)
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('Configuration must be an object')
  return value as Record<string, unknown>
}


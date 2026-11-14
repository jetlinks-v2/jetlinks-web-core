import { copy } from './service'
import type { MetricInputSemantics } from './types'

/** 与后端 MetricInputSemantics 相同，只匹配来源显式声明，不推测名称或同义词。 */
export function metricSourceMatchesSemantics(required:MetricInputSemantics | undefined, metadata:Record<string,unknown> = {}):boolean {
  if (!required) return true
  const types = Array.isArray(metadata.semanticTypes) ? metadata.semanticTypes : []
  return (!required.semanticId || required.semanticId === metadata.semanticId)
    && (!required.semanticRole || required.semanticRole === metadata.semanticRole)
    && (required.semanticTypes || []).every(type=>types.includes(type))
}

/** 来源目录使用 JSON Schema，编辑器使用平台 valueType；只按声明转换，不猜业务字段含义。 */
export function metricSourceSchema(schema:Record<string,unknown>):Record<string,unknown> {
  if (Array.isArray(schema.properties) || Array.isArray(schema.elements) || schema.elementType) return copy(schema)
  if (Array.isArray(schema.enum)) return { type:'enum',elements:schema.enum.map((value,index)=>({value,text:Array.isArray(schema.enumNames) ? schema.enumNames[index] : String(value)})) }
  const type = schema.type === 'integer' ? 'long' : schema.type === 'number' ? 'double'
    : schema.type === 'string' && ['date','date-time'].includes(String(schema.format)) ? 'date' : schema.type
  if (type === 'object') return { type,properties:Object.entries(schema.properties || {}).map(([id,field])=>({id,name:(field as Record<string,unknown>).title || id,valueType:metricSourceSchema(field as Record<string,unknown>)})) }
  if (type === 'array') return { type,elementType:metricSourceSchema((schema.items || {}) as Record<string,unknown>) }
  return { ...schema,type }
}
export function metricSourceField(schema:Record<string,unknown>,path:string):Record<string,unknown> | undefined {
  if (path === '$') return schema
  let field:Record<string,unknown> | undefined = schema
  for (const id of path.split('.')) field = Array.isArray(field?.properties) ? field.properties.find(item=>item.id === id)?.valueType : undefined
  return field
}

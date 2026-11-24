export interface SourceSemantics { semanticId?:string; semanticTypes?:string[]; semanticRole?:string }
export interface SourceReference {
  provider: string
  sourceType: string
  configuration: Record<string, unknown>
  subject?: {type:string;id:string}
}

/** 只匹配来源显式声明，不推测名称或同义词。 */
export function sourceMatchesSemantics(required:SourceSemantics | undefined, metadata:Record<string,unknown> = {}):boolean {
  if (!required) return true
  const types = Array.isArray(metadata.semanticTypes) ? metadata.semanticTypes : []
  return (!required.semanticId || required.semanticId === metadata.semanticId)
    && (!required.semanticRole || required.semanticRole === metadata.semanticRole)
    && (required.semanticTypes || []).every(type=>types.includes(type))
}

const numericTypes = new Set(['byte','short','int','long','bigint','float','double','number','integer','decimal'])
const unitText = (value:unknown) => typeof value === 'string' ? value.normalize('NFKC') : undefined
/** 平台枚举编码序列化为字符串，按其显式编码类型比较，不把普通文本编码当作数值。 */
function enumCode(schema:Record<string,unknown>, value:unknown):unknown {
  const type = (schema.valueType as Record<string,unknown> | undefined)?.type
  if (numericTypes.has(String(type)) && typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  if (type === 'boolean' && (value === 'true' || value === 'false')) return value === 'true'
  return value
}
/** 数值类型可参与同一算式，未知类型不按名称推断兼容性。 */
export function sourceMatchesType(required:Record<string,unknown> | undefined, actual:Record<string,unknown> | undefined):boolean {
  if (!required?.type) return true
  if (!actual?.type) return false
  if (required.unit && unitText(required.unit) !== unitText(actual.unit)) return false
  if (required.type === 'object' && actual.type === 'object') {
    const fields = new Map((Array.isArray(actual.properties) ? actual.properties : []).map(field=>[field.id,field.valueType]))
    return (Array.isArray(required.properties) ? required.properties : []).every(field=>fields.has(field.id) && sourceMatchesType(field.valueType,fields.get(field.id)))
  }
  if (required.type === 'array' && actual.type === 'array') return sourceMatchesType(required.elementType as Record<string,unknown> | undefined,actual.elementType as Record<string,unknown> | undefined)
  if (required.type === 'enum' && actual.type === 'enum' && Array.isArray(required.elements) && required.elements.length) {
    return Array.isArray(actual.elements) && actual.elements.length > 0 && actual.elements.every(item=>(required.elements as {value:unknown}[]).some(option=>enumCode(required,option.value) === enumCode(actual,item.value)))
  }
  return required.type === actual.type || numericTypes.has(String(required.type)) && numericTypes.has(String(actual.type))
    || actual.type === 'enum' && Array.isArray(actual.elements) && actual.elements.length > 0
      && actual.elements.every(item=>numericTypes.has(String(required.type)) ? typeof enumCode(actual,item.value) === 'number' : typeof enumCode(actual,item.value) === required.type)
}

import type { ExpressionNode, ExpressionFunction } from './types'

export type ExpressionPath = (string | number)[]
export interface ExpressionValueMeaning { schema?:Record<string,unknown>; unit?:string }
export interface ExpressionReference extends ExpressionValueMeaning { id:string; path:string[]; label:string; displayLabel?:string }
export interface ExpressionResultLabel { value:string|number|boolean; label:string }
export interface ExpressionEditorContext { references:ExpressionReference[]; functions:ExpressionFunction[]; resultLabels?:ExpressionResultLabel[]; disabled?:boolean }
export interface ExpressionValueChoice { label:string; node:Extract<ExpressionNode,{type:'literal'}> }

/** 枚举的底层标量类型保持不变，显示名称不参与比较或保存。 */
export function enumChoices(schema?:Record<string,unknown>):ExpressionValueChoice[]|undefined {
  if(schema?.type !== 'enum' || !Array.isArray(schema.elements))return
  const underlying=typeof schema.valueType === 'object' ? (schema.valueType as Record<string,unknown>)?.type : schema.valueType
  return schema.elements.flatMap((item:{value?:unknown;text?:string;label?:string})=>{
    if(!['string','number','boolean'].includes(typeof item.value))return []
    const value=item.value as string|number|boolean
    const numeric=['int','long','double','float','decimal','bigint'].includes(String(underlying))
    const valueType=numeric ? underlying === 'float' ? 'double' : underlying : typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? Number.isInteger(value) ? 'int' : 'double' : 'string'
    return [{label:String(item.text ?? item.label ?? value),node:{type:'literal' as const,valueType:valueType as ExpressionValueChoice['node']['valueType'],value:numeric ? String(value) : value}}]
  })
}

/** 枚举属于比较位置，不属于相同编码的所有常量；独立选区只在上下文无歧义时复用候选。 */
export function expressionValueChoices(root:ExpressionNode,target:ExpressionNode|undefined,context:ExpressionEditorContext):ExpressionValueChoice[]|undefined {
  return target ? expressionValueChoiceLookup(root,context)(target) : undefined
}

/** 同一文档渲染/校验只遍历一次；位置身份优先，独立片段仍要求所有同值位置无歧义。 */
export function expressionValueChoiceLookup(root:ExpressionNode,context:ExpressionEditorContext) {
  const key=(node:ExpressionNode)=>JSON.stringify(node),matches=new Map<ExpressionNode,ExpressionValueChoice[][]>(),occurrences=new Map<string,ExpressionNode[]>()
  const references=new Map(context.references.map(ref=>[JSON.stringify([ref.id,...ref.path]),enumChoices(ref.schema)]))
  const choices=(node:ExpressionNode)=>node.type === 'reference' ? references.get(JSON.stringify([node.id,...node.path])) : undefined
  const accept=(node:ExpressionNode,items:ExpressionValueChoice[]|undefined)=>{
    if(items){const list=matches.get(node) || [];list.push(items);matches.set(node,list)}
    if(node.type === 'call' && node.function === 'data.of')node.arguments.forEach(child=>accept(child,items))
  }
  const visit=(node:ExpressionNode)=>{
    const identity=key(node),list=occurrences.get(identity) || []
    list.push(node);occurrences.set(identity,list)
    if(node.type === 'binary') {if(['eq','ne'].includes(node.operator)){accept(node.left,choices(node.right));accept(node.right,choices(node.left))}visit(node.left);visit(node.right)}
    else if(node.type === 'unary')visit(node.operand)
    else if(node.type === 'logical')node.operands.forEach(visit)
    else if(node.type === 'conditional'){visit(node.condition);visit(node.whenTrue);visit(node.whenFalse)}
    else if(node.type === 'call') {if(node.function === 'data.contains'){accept(node.arguments[0],choices(node.arguments[1]));accept(node.arguments[1],choices(node.arguments[0]))}node.arguments.forEach(visit)}
  }
  visit(root)
  return (target:ExpressionNode):ExpressionValueChoice[]|undefined=>{
    const nodes=occurrences.get(key(target)) || [],exact=nodes.includes(target)
    if(!exact && nodes.some(node=>!matches.has(node)))return
    const lists=exact ? matches.get(target) || [] : nodes.flatMap(node=>matches.get(node) || [])
    return lists.length ? lists[0].filter(item=>lists.every(list=>list.some(other=>String(other.node.value) === String(item.node.value) && other.node.valueType === item.node.valueType))) : undefined
  }
}

/** 只检查新编辑的显式常量；空值用于缺失判断，引用之间的比较不被改写。 */
export function validEnumLiterals(root:ExpressionNode,context:ExpressionEditorContext):boolean {
  const choices=expressionValueChoiceLookup(root,context)
  const visit=(node:ExpressionNode):boolean=>{
    if(node.type === 'literal') {const items=choices(node);return node.valueType === 'null' || !items || items.some(item=>String(item.node.value) === String(node.value) && (item.node.valueType === 'string') === (node.valueType === 'string'))}
    if(node.type === 'reference')return true
    if(node.type === 'unary')return visit(node.operand)
    if(node.type === 'binary')return visit(node.left) && visit(node.right)
    if(node.type === 'logical')return node.operands.every(visit)
    if(node.type === 'conditional')return visit(node.condition) && visit(node.whenTrue) && visit(node.whenFalse)
    return node.arguments.every(visit)
  }
  return visit(root)
}
/** 沿用已有精度类型；非法草稿留在输入区，不提交半棵树。 */
export function validLiteral(node:Extract<ExpressionNode,{type:'literal'}>,value:string):boolean {
  if (node.valueType === 'string') return true
  if (!value.trim()) return false
  if (['int','long','bigint'].includes(node.valueType)) {
    if (!/^[+-]?\d+$/.test(value)) return false
    const n=BigInt(value)
    return node.valueType === 'bigint' || (node.valueType === 'int' ? n >= -2147483648n && n <= 2147483647n : n >= -9223372036854775808n && n <= 9223372036854775807n)
  }
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && (node.valueType === 'decimal' || Number.isFinite(Number(value)))
}

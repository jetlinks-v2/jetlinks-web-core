import type { ExpressionNode } from './types'
import type { ExpressionEditorContext } from './editor'
import type { ExpressionTranslate } from './document'

export type ExpressionValueType = 'number'|'boolean'|'string'|'object'|'array'|'null'|'unknown'
export interface ExpressionTypeIssue { key:string; node:ExpressionNode; name?:string; index?:number; expected?:string }
type Types = Set<ExpressionValueType>

export const normalizeExpressionType=(value:unknown):ExpressionValueType=>typeof value !== 'string' ? 'unknown' : ['byte','short','int','long','float','double','decimal','bigint','number','date'].includes(value) ? 'number' : ['boolean','string','object','array','null'].includes(value) ? value as ExpressionValueType : 'unknown'

/** 只推导声明类型，不求值；未知类型不能掩盖另一个分支中已知的非法类型。 */
function analyze(root:ExpressionNode,context:ExpressionEditorContext) {
  let error:ExpressionTypeIssue|undefined
  const one=(type:ExpressionValueType):Types=>new Set([type])
  const union=(...values:Types[]):Types=>new Set(values.flatMap(value=>[...value]))
  const incompatible=(actual:Types,expected:readonly ExpressionValueType[])=>[...actual].some(type=>type !== 'unknown' && !expected.includes(type))
  const requireType=(node:ExpressionNode,actual:Types,expected:ExpressionValueType,key:string,details:Partial<ExpressionTypeIssue>={})=>{
    if(!error && incompatible(actual,[expected]))error={key,node,expected,...details}
  }
  function visit(node:ExpressionNode):Types {
    if(node.type === 'literal')return one(normalizeExpressionType(node.valueType))
    if(node.type === 'reference') {
      const schema=context.references.find(item=>item.id === node.id && JSON.stringify(item.path) === JSON.stringify(node.path))?.schema
      const type=schema?.type === 'enum' ? typeof schema.valueType === 'object' ? (schema.valueType as Record<string,unknown>)?.type : schema.valueType : schema?.type
      return one(normalizeExpressionType(type))
    }
    if(node.type === 'unary') {
      const expected=node.operator === 'not' ? 'boolean' : 'number'
      requireType(node.operand,visit(node.operand),expected,expected === 'number' ? 'numericOperand' : 'booleanOperand')
      return one(expected)
    }
    if(node.type === 'binary') {
      const left=visit(node.left),right=visit(node.right)
      if(['eq','ne'].includes(node.operator))return one('boolean')
      if(['gt','ge','lt','le'].includes(node.operator)) {
        if(!error && (incompatible(left,['number','string']) || incompatible(right,['number','string']) || [...left].some(a=>a !== 'unknown' && [...right].some(b=>b !== 'unknown' && a !== b))))error={key:'comparisonOperands',node}
        return one('boolean')
      }
      requireType(node.left,left,'number','numericOperand');requireType(node.right,right,'number','numericOperand')
      return one('number')
    }
    if(node.type === 'logical') {
      node.operands.forEach(child=>requireType(child,visit(child),'boolean','booleanOperand'))
      return one('boolean')
    }
    if(node.type === 'conditional') {
      requireType(node.condition,visit(node.condition),'boolean','booleanOperand')
      return union(visit(node.whenTrue),visit(node.whenFalse))
    }
    const fn=context.functions.find(item=>item.id === node.function)
    const args=node.arguments.map(visit)
    if(fn)args.forEach((types,index)=>{
      const parameter=fn.parameters?.[Math.min(index,fn.parameters.length-1)]
      const expected=normalizeExpressionType(parameter?.valueType)
      if(expected !== 'unknown')requireType(node.arguments[index],types,expected,'functionArgumentType',{name:fn.name,index:index+1})
    })
    // 两个短路函数的结果由候选值决定，不能将 any 降为未知后放过已知类型错误。
    if(node.function === 'data.coalesce') {
      const types:Types=new Set()
      for(let i=0;i<args.length;i++) {
        for(const type of args[i])if(type !== 'null' || i === args.length-1)types.add(type)
        if(!args[i].has('null') && !args[i].has('unknown'))break
      }
      return types
    }
    if(node.function === 'data.nullif')return union(args[0] || one('unknown'),one('null'))
    return one(normalizeExpressionType(fn?.returnType))
  }
  const types=visit(root)
  return {types,error,incompatible}
}

/** 整式遵循宿主声明；选区和条件片段只校验内部运算，不能套用整式结果约束。 */
export function validateExpressionTypes(root:ExpressionNode,context:ExpressionEditorContext,checkResult=true):ExpressionTypeIssue|undefined {
  const {types,error,incompatible}=analyze(root,context)
  return error || (checkResult && context.resultTypes?.length && incompatible(types,context.resultTypes) ? {key:'resultTypeMismatch',node:root,expected:context.resultTypes.join('|')} : undefined)
}

/** 编辑候选复用同一推导；异构分支保持未知，完整校验仍保留全部分支类型。 */
export function expressionNodeType(node:ExpressionNode,context:ExpressionEditorContext):ExpressionValueType {
  const {types}=analyze(node,context)
  if(types.size>1)types.delete('null')
  return types.size === 1 ? [...types][0] : 'unknown'
}

export function expressionValidationMessage(issue:{key?:string;message?:string;name?:string;index?:number;expected?:string},t:ExpressionTranslate):string {
  const expected=issue.expected?.split('|').map(type=>t(type === 'string' ? 'text' : type === 'null' ? 'emptyValue' : type)).join(' '+t('or')+' ')
  const key=issue.key || issue.message || 'incompleteFormula'
  return t(key === 'incomplete' ? 'incompleteFormula' : key,{name:issue.name,index:issue.index,expected})
}

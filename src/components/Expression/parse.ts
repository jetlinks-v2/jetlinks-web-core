import { parseExpression } from '@babel/parser'
import type { ExpressionNode } from './types'
import type { ExpressionEditorContext } from './editor'
import type { ExpressionDocument, ExpressionToken, ExpressionTranslate } from './document'
import { projectExpressionTokens } from './document'
import { validLiteral,validEnumLiterals } from './editor'

export interface ExpressionDiagnostic { key:string; from:number; to:number; name?:string }
type Syntax=ReturnType<typeof parseExpression>
function logicalParts(node:Syntax):Syntax[] {
  const parts:Syntax[]=[]
  const collect=(item:Syntax)=>{if(item.type === 'LogicalExpression' && node.type === 'LogicalExpression' && item.operator === node.operator) {collect(item.left as Syntax);collect(item.right as Syntax)} else parts.push(item)}
  collect(node);return parts
}
const operators:Record<string,string>={'+':'add','-':'subtract','*':'multiply','/':'divide','%':'mod','==':'eq','!=':'ne','>':'gt','>=':'ge','<':'lt','<=':'le'}

/** 成熟解析器只负责语法；仅白名单节点可转为原AST，绝不在浏览器执行脚本。 */
export function parseExpressionDocument(text:string,document:ExpressionDocument,context:ExpressionEditorContext,previous:ExpressionNode,t:ExpressionTranslate):{node?:ExpressionNode;error?:ExpressionDiagnostic;document?:ExpressionDocument} {
  const next:ExpressionDocument={...document,text,tokens:[],spans:[]}
  let at={from:0,to:Math.max(1,text.length)}
  const fail=(key:string,name?:string):never=>{throw {key,...at,name}}
  function convert(node:Syntax,hint?:ExpressionNode):ExpressionNode {
    at={from:node.start || 0,to:node.end || text.length}
    const raw=text.slice(at.from,at.to)
    const anchor=document.spans.find(item=>item.from === at.from && item.to === at.to && item.text === raw)
    if (anchor) {
      const spans=document.spans.filter(item=>item.from >= at.from && item.to <= at.to)
      const owners=new Set(spans.map(item=>item.node))
      // 父级装饰可能与子树共享边界；位置相同不代表装饰属于子树。
      next.tokens.push(...document.tokens.filter(item=>owners.has(item.node) && item.from >= at.from && item.to <= at.to))
      next.spans.push(...spans)
      return anchor.node
    }
    const from=at.from,to=at.to
    const result=convertValue(node,hint,raw)
    next.spans.push({from,to,text:raw,node:result})
    // 位置来自解析器；仅为当前节点生成一个装饰，不重复投影整棵子树。
    const add=(kind:ExpressionToken['kind'],label:string,start:number,end:number,title?:string)=>next.tokens.push({kind,label,from:start,to:end,text:text.slice(start,end),node:result,path:[],title})
    if (node.type === 'ParenthesizedExpression') return result
    if (result.type === 'reference' && node.type === 'ArrayExpression') add('reference',(node.elements[0] as {value:string}).value,from,to)
    else if (result.type === 'literal') add('literal',raw,from,to)
    else if (node.type === 'CallExpression' && result.type === 'call') {const fn=context.functions.find(item=>item.id === result.function);add('function',fn?.name || result.function.split('.').at(-1) || result.function,node.callee.start!,node.callee.end!,fn?.description)}
    else if (node.type === 'LogicalExpression' && result.type === 'logical') {
      const items=logicalParts(node)
      items.slice(1).forEach((item,index)=>{const start=items[index].end!,end=item.start!,offset=text.slice(start,end).indexOf(node.operator);add('operator',node.operator,start+offset,start+offset+node.operator.length)})
    } else if (node.type === 'BinaryExpression') {
      const start=node.left.end!,end=node.right.start!,middle=text.slice(start,end),offset=middle.indexOf(node.operator)
      add('operator',node.operator,start+offset,start+offset+node.operator.length)
    } else if (node.type === 'UnaryExpression') add('operator',node.operator,from,from+node.operator.length)
    else if (node.type === 'ConditionalExpression') {
      const thenAt=text.indexOf('?',node.test.end!),elseAt=text.indexOf(':',node.consequent.end!)
      add('keyword','?',thenAt,thenAt+1)
      add('keyword',':',elseAt,elseAt+1)
    }
    return result
  }
  function convertValue(node:Syntax,hint:ExpressionNode|undefined,raw:string):ExpressionNode {
    const literal=(value:unknown,valueType:Extract<ExpressionNode,{type:'literal'}>['valueType']):ExpressionNode=>({type:'literal',valueType,value})
    const number=(value:string):ExpressionNode=>{
      const old=hint?.type === 'literal' && ['int','long','bigint','decimal','double'].includes(hint.valueType) ? hint : undefined
      const integer=/^[+-]?\d+$/.test(value) ? BigInt(value) : undefined
      const valueType=old && validLiteral(old,value) ? old.valueType : (integer !== undefined ? integer >= -2147483648n && integer <= 2147483647n ? 'int' : integer >= -9223372036854775808n && integer <= 9223372036854775807n ? 'long' : 'bigint' : 'decimal')
      const result={type:'literal' as const,valueType,value}
      if (!validLiteral(result,value)) fail('invalidNumber')
      return result
    }
    switch(node.type) {
      case 'ParenthesizedExpression': return convert(node.expression as Syntax,hint)
      case 'NumericLiteral': return number(raw)
      case 'BigIntLiteral': return literal(raw.replace(/n$/,''),'bigint')
      case 'NullLiteral': return literal(null,'null')
      case 'BooleanLiteral': return literal(node.value,'boolean')
      case 'StringLiteral': return literal(node.value,'string')
      case 'ArrayExpression': {
        if (node.elements.length !== 1 || node.elements[0]?.type !== 'StringLiteral') return fail('unknownReference')
        return document.references.get(node.elements[0].value) || fail('unknownReference',node.elements[0].value)
      }
      case 'UnaryExpression': {
        if (!['+','-','!'].includes(node.operator)) return fail('unsupportedExpression')
        if (hint?.type === 'literal' && node.argument.type === 'NumericLiteral' && node.operator !== '!') return number(`${node.operator}${text.slice(node.argument.start!,node.argument.end!)}`)
        return {type:'unary',operator:node.operator === '-' ? 'negate' : node.operator === '+' ? 'positive' : 'not',operand:convert(node.argument as Syntax,hint?.type === 'unary' ? hint.operand : undefined)}
      }
      case 'BinaryExpression': {
        const operator=operators[node.operator]
        if (!operator) return fail('unsupportedExpression')
        const old=hint?.type === 'binary' ? hint : undefined
        return {type:'binary',operator,left:convert(node.left as Syntax,old?.left),right:convert(node.right as Syntax,old?.right)}
      }
      case 'LogicalExpression': {
        if (!['&&','||'].includes(node.operator)) return fail('unsupportedExpression')
        const old=hint?.type === 'logical' ? hint : undefined
        const operands=logicalParts(node)
        return {type:'logical',operator:node.operator === '&&' ? 'and' : 'or',operands:operands.map((item,index)=>convert(item,old?.operands[index]))}
      }
      case 'ConditionalExpression': {
        const old=hint?.type === 'conditional' ? hint : undefined
        return {type:'conditional',condition:convert(node.test as Syntax,old?.condition),whenTrue:convert(node.consequent as Syntax,old?.whenTrue),whenFalse:convert(node.alternate as Syntax,old?.whenFalse)}
      }
      case 'CallExpression': {
        if (node.callee.type !== 'Identifier') return fail('unknownFunction')
        // 条件函数是输入记法，直接降为原条件树，不能作为预求值的普通函数执行。
        if(node.callee.name === 'IF' || node.callee.name === 'IFS') {
          const args=node.arguments,old=hint?.type === 'conditional' ? hint : undefined
          if(node.callee.name === 'IF') {
            if(args.length !== 3)return fail('functionArguments','IF')
            return {type:'conditional',condition:convert(args[0] as Syntax,old?.condition),whenTrue:convert(args[1] as Syntax,old?.whenTrue),whenFalse:convert(args[2] as Syntax,old?.whenFalse)}
          }
          if(args.length < 4 || args.length%2)return fail('functionArguments','IFS')
          const fallback=args.at(-2)
          if(fallback?.type !== 'BooleanLiteral' || fallback.value !== true)return fail('conditionalDefault')
          const branch=(index:number,previous?:ExpressionNode):ExpressionNode=>{
            if(index === args.length-2)return convert(args[index+1] as Syntax,previous)
            const old=previous?.type === 'conditional' ? previous : undefined
            return {type:'conditional',condition:convert(args[index] as Syntax,old?.condition),whenTrue:convert(args[index+1] as Syntax,old?.whenTrue),whenFalse:branch(index+2,old?.whenFalse)}
          }
          return branch(0,hint)
        }
        const id=document.functions.get(node.callee.name)
        if (!id) return fail('unknownFunction',node.callee.name)
        const fn=context.functions.find(item=>item.id === id)
        if (fn && (node.arguments.length < fn.minimumArguments || node.arguments.length > fn.maximumArguments)) return fail('functionArguments',fn.name)
        const old=hint?.type === 'call' ? hint : undefined
        return {type:'call',function:id,arguments:node.arguments.map((item,index)=>convert(item as Syntax,old?.arguments[index]))}
      }
      default:return fail('unsupportedExpression')
    }
  }
  try {
    if (!text.trim()) return {error:{key:'incomplete',from:0,to:1}}
    if (text.length > 16000) return {error:{key:'expressionTooLong',from:0,to:text.length}}
    const node=convert(parseExpression(text,{createParenthesizedExpressions:true}),previous)
    if(!validEnumLiterals(node,context))fail('invalidEnumValue')
    return {node,document:{...next,tokens:projectExpressionTokens(next,node,context,t).sort((a,b)=>a.from-b.from || a.to-b.to)}}
  } catch(error) {
    const item=error as ExpressionDiagnostic & {pos?:number}
    return {error:item.key ? item : {key:'incomplete',from:item.pos || 0,to:(item.pos || 0)+1}}
  }
}

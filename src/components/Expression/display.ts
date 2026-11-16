import type { ExpressionNode, StructuredExpression } from './types'

const operators:Record<string,string> = {add:'+',subtract:'-',multiply:'*',divide:'/',mod:'%',eq:'==',ne:'!=',gt:'>',ge:'>=',lt:'<',le:'<='}
const quote=(value:string)=>`'${value.replaceAll("'","''")}'`
/** 只读/数学输入投影；保存与后端执行始终消费原树，不保存这份文本。 */
export function expressionText(expression:StructuredExpression,reference?:(node:Extract<ExpressionNode,{type:'reference'}>)=>string|undefined):string {
  function text(node:ExpressionNode):string {
    switch(node.type) {
      case 'literal': return node.valueType === 'null' ? 'null' : node.valueType === 'string' ? quote(String(node.value)) : String(node.value)
      case 'reference': return reference?.(node) || (node.id === 'params' ? 'params' : node.id.replace(/[^a-zA-Z0-9_]/g,'_'))+node.path.map(field=>`[${quote(field)}]`).join('')
      case 'unary': return `${{positive:'+',negate:'-',not:'!'}[node.operator]}(${text(node.operand)})`
      case 'binary': return `(${text(node.left)} ${operators[node.operator] || node.operator} ${text(node.right)})`
      case 'logical': return `(${node.operands.map(text).join(node.operator === 'and' ? ' && ' : ' || ')})`
      case 'conditional': return `(${text(node.condition)} ? ${text(node.whenTrue)} : ${text(node.whenFalse)})`
      case 'call': return `$${node.function}(${node.arguments.map(text).join(', ')})`
    }
  }
  return text(expression.root)
}

/** 非默认数值类型保留在树编辑器中，避免数学输入把 decimal/小 long 隐式改为 double/int。 */
export function supportsMathProjection(node:ExpressionNode):boolean {
  switch(node.type) {
    case 'literal': {
      if (!['int','long','double'].includes(node.valueType)) return false
      const value=String(node.value), fractional=/[.eE]/.test(value)
      if (fractional) return node.valueType === 'double'
      if (!/^-?\d+$/.test(value)) return false
      const integer=BigInt(value)
      return node.valueType === (integer >= -2147483648n && integer <= 2147483647n ? 'int' : 'long')
    }
    case 'reference': return true
    case 'conditional': return false
    case 'unary': return supportsMathProjection(node.operand)
    case 'binary': return supportsMathProjection(node.left) && supportsMathProjection(node.right)
    case 'logical': return node.operands.length === 2 && node.operands.every(supportsMathProjection)
    case 'call': return /^math\.(abs|min|max|round|sqrt)$/.test(node.function) && node.arguments.every(supportsMathProjection)
  }
}

export function expressionReferences(root:ExpressionNode):Extract<ExpressionNode,{type:'reference'}>[] {
  switch(root.type) {
    case 'reference': return [root]
    case 'literal': return []
    case 'unary': return expressionReferences(root.operand)
    case 'binary': return [...expressionReferences(root.left),...expressionReferences(root.right)]
    case 'logical': return root.operands.flatMap(expressionReferences)
    case 'conditional': return [root.condition,root.whenTrue,root.whenFalse].flatMap(expressionReferences)
    case 'call': return root.arguments.flatMap(expressionReferences)
  }
}

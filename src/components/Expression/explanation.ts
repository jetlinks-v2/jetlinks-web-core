import type { ExpressionExplanation } from './types'

export interface ExplanationReading { label?:string; text:string }
export type ExplanationFormatter = (node:ExpressionExplanation, relative?:ExpressionExplanation)=>ExplanationReading
const symbols:Record<string,string> = { and:'∧',or:'∨',eq:'=',ne:'≠',gt:'>',ge:'≥',lt:'<',le:'≤',add:'+',subtract:'−',multiply:'×',divide:'÷',mod:'%',not:'¬','==':'=','!=':'≠','&&':'∧','||':'∨','*':'×','/':'÷' }

/** 只投影后端树，不判断表达式、推断未知分支或重算函数。 */
export function explanationText(node:ExpressionExplanation, format:ExplanationFormatter):string {
  if (node.kind === 'read' || node.kind === 'literal') {
    const item = format(node)
    return item.label ? `${item.label}（${item.text}）` : item.text
  }
  const values = node.children.filter(item=>item.state !== 'skipped').map(child=> {
    if (child.kind === 'literal') return format(child,node.children.find(item=>item.kind === 'read')).text
    return explanationText(child,format)
  })
  const symbol = symbols[node.operation || ''] || node.operation || ''
  if (node.kind === 'call') return `${symbol}(${values.join('，')})`
  if (!values.length) return node.expression || format(node).text
  // 短路后的逻辑节点可能只剩一个参与项；只有一元操作才显示前缀。
  if (values.length === 1) return ['and','or','&&','||'].includes(node.operation || '') ? values[0] : `${symbol}${values[0]}`
  return values.join(` ${symbol} `)
}

export function explanationDecisions(root:ExpressionExplanation) {
  const rows:Array<{condition:ExpressionExplanation; selected:boolean|undefined}> = []
  let node = root
  while (node.kind === 'condition' && node.children.length === 3) {
    const condition = node.children[0]
    const selected = condition.state === 'available' && typeof condition.value === 'boolean' ? condition.value : undefined
    rows.push({condition,selected})
    if (selected === undefined) break
    node = node.children[selected ? 1 : 2]
  }
  return {rows, result:node}
}

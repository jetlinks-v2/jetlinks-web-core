import type { ExpressionNode,StructuredExpression } from './types'

export interface ArithmeticStep { operator:'add'|'subtract'|'multiply'|'divide'; value:string|null }
export type ArithmeticSteps = [ArithmeticStep,ArithmeticStep]
const operators=['add','subtract','multiply','divide']
const scalar=(value:unknown):value is string=>typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value))

/** 属性预处理与数采共用的两步投影；只描述运算，不在浏览器求值或舍入。 */
export function readArithmeticSteps(expression:StructuredExpression,reference:Extract<ExpressionNode,{type:'reference'}>):ArithmeticSteps|undefined {
  let node=expression.root
  const steps:ArithmeticStep[]=[]
  while(node.type === 'binary' && steps.length<2 && operators.includes(node.operator)
    && node.right.type === 'literal' && !['string','boolean','null'].includes(node.right.valueType) && scalar(String(node.right.value))) {
    steps.unshift({operator:node.operator as ArithmeticStep['operator'],value:String(node.right.value)})
    node=node.left
  }
  if(node.type !== 'reference' || node.id !== reference.id || JSON.stringify(node.path)!==JSON.stringify(reference.path))return
  if(!steps.length)steps.push({operator:'multiply',value:'1'})
  if(steps.length === 1)steps.push({operator:'add',value:'0'})
  return steps as ArithmeticSteps
}

export function buildArithmeticSteps(steps:ArithmeticSteps,reference:Extract<ExpressionNode,{type:'reference'}>):StructuredExpression|undefined {
  let root:ExpressionNode=reference
  for(const step of steps) {
    if(!operators.includes(step.operator) || !scalar(step.value) || step.operator === 'divide' && Number(step.value) === 0)return
    root={type:'binary',operator:step.operator,left:root,right:{type:'literal',valueType:'decimal',value:step.value}}
  }
  return {version:1,root}
}

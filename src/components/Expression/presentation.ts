import type { ExpressionDocument, ExpressionToken } from './document'
import { referenceKey } from './document'
import type { ExpressionEditorContext } from './editor'
import type { ExpressionNode, ExpressionExplanation } from './types'
import type { ExplanationFormatter } from './explanation'
export type ExpressionOutcome = 'true'|'false'|'unknown'|'skipped'
export interface ExpressionFact { text:string; state:string; title?:string; selected?:boolean; outcome?:ExpressionOutcome; resultText?:string }
export interface ExpressionPart { text:string; token?:ExpressionToken; fact?:ExpressionFact; outcome?:ExpressionOutcome }
export const outcomeIcons:Record<ExpressionOutcome,string>={true:'CheckOutlined',false:'CloseOutlined',unknown:'QuestionCircleOutlined',skipped:'EllipsisOutlined'}
export const outcomeLabels:Record<ExpressionOutcome,string>={true:'conditionTrue',false:'conditionFalse',unknown:'conditionUnknown',skipped:'notUsed'}

export function referenceIcon(token:ExpressionToken,context:ExpressionEditorContext):string {
  if (token.node.type !== 'reference') return 'FunctionOutlined'
  const schema=context.references.find(item=>referenceKey(item) === referenceKey(token.node as Extract<ExpressionNode,{type:'reference'}>))?.schema
  const type=String(schema?.type || '')
  return ['date','datetime','timestamp'].includes(type) ? 'CalendarOutlined' : ['int','long','bigint','double','float','number','decimal'].includes(type) ? 'NumberOutlined' : ['boolean','enum'].includes(type) ? 'CheckSquareOutlined' : type === 'object' ? 'ApartmentOutlined' : 'FieldStringOutlined'
}

/** 反显与编辑共用相同分段；只读图上不创建编辑器。 */
export function documentParts(document:ExpressionDocument,facts=new Map<string,ExpressionFact>(),conditions=false) {
  const parts:ExpressionPart[]=[]
  const events:Array<{from:number;to:number;token?:ExpressionToken;outcome?:ExpressionOutcome}>=document.tokens.map(token=>({from:token.from,to:token.to,token}))
  if(conditions) {
    const comparisons=new Map(document.tokens.filter(token=>token.kind === 'operator' && token.node.type === 'binary' && ['eq','ne','gt','ge','lt','le'].includes(token.node.operator)).map(token=>[token.node,token]))
    for(const span of document.spans) {
      const token=comparisons.get(span.node),outcome=token && facts.get(JSON.stringify(token.path))?.outcome
      if(outcome)events.push({from:span.to,to:span.to,outcome})
    }
    events.sort((a,b)=>a.from-b.from || a.to-b.to)
  }
  let cursor=0
  for (const event of events) {
    if (event.from > cursor) parts.push({text:document.text.slice(cursor,event.from)})
    if(event.outcome) {parts.push({text:'',outcome:event.outcome});cursor=event.to;continue}
    const token=event.token!
    const path=token.branch ? [...token.path,token.branch] : token.path
    let fact=facts.get(JSON.stringify(path))
    if (!fact) {const prefix=path.slice();while(prefix.length && !fact) {prefix.pop();const ancestor=facts.get(JSON.stringify(prefix));if(ancestor?.state === 'skipped')fact=ancestor}}
    if(token.branch && fact)fact={...fact,text:''}
    parts.push({text:token.label,token,fact});cursor=event.to
  }
  if (cursor < document.text.length) parts.push({text:document.text.slice(cursor)})
  return parts
}

/** 仅按已记录解释的同形节点投影，不执行条件，也不以当前值补齐历史。 */
export function explanationFacts(root:ExpressionNode,explanation:ExpressionExplanation,format:ExplanationFormatter) {
  const facts=new Map<string,ExpressionFact>()
  const operators:Record<string,string>={'+':'add','-':'subtract','*':'multiply','/':'divide','%':'mod','==':'eq','!=':'ne','>':'gt','>=':'ge','<':'lt','<=':'le','&&':'and','||':'or','!':'not'}
  function visit(node:ExpressionNode,record:ExpressionExplanation,path:(string|number)[]):boolean {
    const key=JSON.stringify(path)
    if(record.state === 'skipped') {facts.set(key,{state:'skipped',text:'',outcome:'skipped'});return true}
    const fact=():ExpressionFact=>({...facts.get(key),state:record.state,text:'',outcome:record.state === 'available' && typeof record.value === 'boolean' ? String(record.value) as ExpressionOutcome : 'unknown',resultText:record.state === 'available' ? format(record).text : undefined})
    if(node.type === 'reference' && record.kind === 'read') {
      if(JSON.stringify([node.id,...node.path]) !== JSON.stringify(record.path))return false
      const value=format(record);facts.set(key,{...fact(),text:value.text,title:value.label});return true
    }
    let children:Array<[ExpressionNode,(string|number)[]]>=[]
    if(['binary','logical','unary'].includes(node.type)) {
      const expected=(node as Extract<ExpressionNode,{operator:unknown}>).operator,actual=operators[record.operation || ''] || record.operation
      if(actual !== expected && !(node.type === 'unary' && (expected === 'positive' && record.operation === '+' || expected === 'negate' && record.operation === '-')))return false
    }
    if(node.type === 'call' && record.operation !== node.function)return false
    if(node.type === 'conditional' && record.kind === 'condition') {
      children=[[node.condition,[...path,'condition']],[node.whenTrue,[...path,'whenTrue']],[node.whenFalse,[...path,'whenFalse']]]
    }
    else if(node.type === 'binary' && record.kind === 'operator') children=[[node.left,[...path,'left']],[node.right,[...path,'right']]]
    else if(node.type === 'logical' && record.kind === 'operator') children=node.operands.map((item,index)=>[item,[...path,'operands',index]])
    else if(node.type === 'unary' && record.kind === 'operator') children=[[node.operand,[...path,'operand']]]
    else if(node.type === 'call' && record.kind === 'call') children=node.arguments.map((item,index)=>[item,[...path,'arguments',index]])
    else if(!(node.type === 'literal' && record.kind === 'literal')) return false
    if(children.length !== record.children.length) return false
    if(!children.every(([child,childPath],index)=>visit(child,record.children[index],childPath)))return false
    facts.set(key,fact())
    if(node.type === 'conditional') {
      const condition=record.children[0]
      if(condition?.state === 'available' && typeof condition.value === 'boolean') {
        const selected=JSON.stringify([...path,condition.value ? 'whenTrue' : 'whenFalse'])
        const branch=facts.get(selected)
        if(branch && branch.state !== 'skipped')facts.set(selected,{...branch,selected:true})
      }
    }
    return true
  }
  if(!visit(root,explanation,[]))facts.clear()
  return facts
}

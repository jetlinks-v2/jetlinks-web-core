import type { ExpressionDocument, ExpressionToken } from './document'
import { referenceKey } from './document'
import type { ExpressionEditorContext } from './editor'
import type { ExpressionNode, ExpressionExplanation } from './types'
import type { ExplanationFormatter } from './explanation'
export type ExpressionOutcome = 'true'|'false'|'unknown'|'skipped'
export interface ExpressionFact { text:string; state:string; title?:string; selected?:boolean; outcome?:ExpressionOutcome; resultText?:string }
export interface ExpressionPart { text:string; token?:ExpressionToken; fact?:ExpressionFact; outcome?:ExpressionOutcome }
export const outcomeLabels:Record<ExpressionOutcome,string>={true:'conditionTrue',false:'conditionFalse',unknown:'conditionUnknown',skipped:'notUsed'}
export const outcomeText:Record<ExpressionOutcome,string>={true:'outcomeMet',false:'outcomeNotMet',unknown:'outcomeUnknown',skipped:'outcomeSkipped'}

/** 数值代入只用于声明明确的纯数值算式；条件、状态、日期等始终保留业务名称。 */
export function canSubstituteNumbers(node:ExpressionNode,context:ExpressionEditorContext):boolean {
  const numeric=(type:unknown)=>['int','long','bigint','double','float','number','decimal'].includes(String(type))
  switch(node.type) {
    case 'literal':return numeric(node.valueType)
    case 'reference':return numeric(context.references.find(item=>referenceKey(item) === referenceKey(node))?.schema?.type)
    case 'unary':return node.operator !== 'not' && canSubstituteNumbers(node.operand,context)
    case 'binary':return ['add','subtract','multiply','divide','mod'].includes(node.operator) && canSubstituteNumbers(node.left,context) && canSubstituteNumbers(node.right,context)
    case 'call':return numeric(context.functions.find(item=>item.id === node.function)?.returnType) && node.arguments.every(item=>canSubstituteNumbers(item,context))
    default:return false
  }
}

/** 就近取值与展开对照使用同一份冻结事实；重复引用合并，短路项不伪造取值。 */
export function recordedReadings(parts:ExpressionPart[],path:(string|number)[]=[]) {
  const readings=new Map<string,{key:string;label:string;text:string;title?:string}>()
  for(const part of parts) {
    const token=part.token
    if(token?.node.type !== 'reference' || part.fact?.state !== 'available' || !path.every((key,index)=>token.path[index] === key))continue
    const key=referenceKey(token.node),text=part.fact.text
    // 未记录项由悬浮说明与展开数据区表达；空值有格式化后的明确文本。
    if(!text)continue
    const identity=JSON.stringify([key,text])
    if(!readings.has(identity))readings.set(identity,{key,label:token.label,text,title:part.fact.title || token.title})
  }
  return [...readings.values()]
}

export function referenceIcon(token:ExpressionToken,context:ExpressionEditorContext):string {
  if (token.node.type !== 'reference') return 'FunctionOutlined'
  const reference=context.references.find(item=>referenceKey(item) === referenceKey(token.node as Extract<ExpressionNode,{type:'reference'}>))
  if(reference?.icon)return reference.icon
  const schema=reference?.schema
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
    let children:Array<[ExpressionNode,(string|number)[]]>=[],childRecords=record.children
    if(['binary','logical','unary'].includes(node.type)) {
      const expected=(node as Extract<ExpressionNode,{operator:unknown}>).operator,actual=operators[record.operation || ''] || record.operation
      if(actual !== expected && !(node.type === 'unary' && (expected === 'positive' && record.operation === '+' || expected === 'negate' && record.operation === '-')))return false
    }
    if(node.type === 'call' && record.operation !== node.function)return false
    if(node.type === 'conditional' && record.kind === 'condition') {
      children=[[node.condition,[...path,'condition']],[node.whenTrue,[...path,'whenTrue']],[node.whenFalse,[...path,'whenFalse']]]
    }
    else if(node.type === 'binary' && record.kind === 'operator') children=[[node.left,[...path,'left']],[node.right,[...path,'right']]]
    else if(node.type === 'logical' && record.kind === 'operator') {
      // 编辑树使用多项逻辑，SpEL 解释使用二叉树；只展开同一运算，保留顺序和短路事实。
      const operands:Array<[ExpressionNode,(string|number)[]]>=[],records:ExpressionExplanation[]=[]
      const collectNode=(item:ExpressionNode,itemPath:(string|number)[])=>{
        if(item.type === 'logical' && item.operator === node.operator) item.operands.forEach((child,index)=>collectNode(child,[...itemPath,'operands',index]))
        else operands.push([item,itemPath])
      }
      const collectRecord=(item:ExpressionExplanation)=>{
        if(item.kind === 'operator' && (operators[item.operation || ''] || item.operation) === node.operator && item.children.length) item.children.forEach(collectRecord)
        else records.push(item)
      }
      collectNode(node,path);collectRecord(record)
      children=operands;childRecords=records
    }
    else if(node.type === 'unary' && record.kind === 'operator') children=[[node.operand,[...path,'operand']]]
    else if(node.type === 'call' && record.kind === 'call') children=node.arguments.map((item,index)=>[item,[...path,'arguments',index]])
    else if(!(node.type === 'literal' && record.kind === 'literal')) return false
    if(children.length !== childRecords.length) return false
    if(!children.every(([child,childPath],index)=>visit(child,childRecords[index],childPath)))return false
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

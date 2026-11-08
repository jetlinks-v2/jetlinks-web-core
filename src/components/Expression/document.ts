import type { ExpressionNode, ExpressionFunction } from './types'
import type { ExpressionEditorContext } from './editor'

export interface ExpressionSpan { from:number; to:number; node:ExpressionNode; text:string }
export interface ExpressionToken { from:number; to:number; text:string; label:string; kind:'reference'|'function'|'keyword'|'operator'|'literal'; node:ExpressionNode; path:(string|number)[]; title?:string; meaning?:string; branch?:'condition'|'whenTrue'|'whenFalse' }
export interface ExpressionDocument { text:string; tokens:ExpressionToken[]; spans:ExpressionSpan[]; references:Map<string,Extract<ExpressionNode,{type:'reference'}>>; functions:Map<string,string> }
export type ExpressionTranslate=(key:string,params?:Record<string,unknown>)=>string
export const expressionSigns:Record<string,string>={add:'+',subtract:'−',multiply:'×',divide:'÷',mod:'%',eq:'=',ne:'≠',gt:'>',ge:'≥',lt:'<',le:'≤'}
const signs=expressionSigns
const sourceSigns:Record<string,string>={...signs,subtract:'-',multiply:'*',divide:'/',eq:'==',ne:'!=',ge:'>=',le:'<='}
export const referenceKey=(node:{id:string;path:string[]})=>JSON.stringify([node.id,...node.path])

/** 分支标签和返回值含义只作投影；编辑、反显与增量解析共用，不改原式或取值。 */
export function projectExpressionTokens(document:ExpressionDocument,root:ExpressionNode,context:ExpressionEditorContext,t:ExpressionTranslate):ExpressionToken[] {
  const results=new Set<ExpressionNode>(),operands=new Set<ExpressionNode>()
  function visit(node:ExpressionNode,result:boolean) {
    if(node.type === 'conditional') {
      visit(node.condition,false);visit(node.whenTrue,result);visit(node.whenFalse,result)
    } else if(node.type === 'literal') (result ? results : operands).add(node)
    else if(node.type === 'binary') {visit(node.left,false);visit(node.right,false)}
    else if(node.type === 'unary')visit(node.operand,false)
    else if(node.type === 'logical')node.operands.forEach(item=>visit(item,false))
    else if(node.type === 'call')node.arguments.forEach(item=>visit(item,false))
  }
  visit(root,true)
  return document.tokens.map(token=>{
    const node=token.node
    if(token.kind === 'keyword' && node.type === 'conditional') {
      const branch:NonNullable<ExpressionToken['branch']>=token.text === '?' ? 'whenTrue' : 'whenFalse'
      return {...token,branch,label:token.text,title:t(branch === 'whenTrue' ? 'then' : 'otherwise')}
    }
    const meaning=node.type === 'literal' && results.has(node) && !operands.has(node) ? context.resultLabels?.find(item=>
      typeof item.value === (node.valueType === 'boolean' ? 'boolean' : node.valueType === 'string' ? 'string' : 'number') && String(item.value) === String(node.value))?.label : undefined
    return {...token,meaning}
  })
}

/** 业务名称只属于文档投影；保存仍保留稳定引用及原始数值类型。 */
export function expressionDocument(root:ExpressionNode,context:ExpressionEditorContext,t:ExpressionTranslate):ExpressionDocument {
  const document:ExpressionDocument={text:'',tokens:[],spans:[],references:new Map(),functions:new Map()}
  const aliases=new Map<string,string>(),used=new Set<string>(),functionAliases=new Map<string,string>()
  const names=new Map<string,Set<string>>()
  for(const reference of context.references) {
    const name=reference.displayLabel || reference.label || reference.id
    if(!names.has(name))names.set(name,new Set())
    names.get(name)!.add(referenceKey(reference))
  }
  for (const reference of context.references) {
    const key=referenceKey(reference)
    if (aliases.has(key)) continue
    const base=reference.label || reference.id
    let alias=base,index=1
    while(used.has(alias)) alias=`${base} · ${++index}`
    used.add(alias);aliases.set(key,alias);document.references.set(alias,{type:'reference',id:reference.id,path:reference.path})
  }
  const reserveFunction=(id:string,label:string)=>{
    if (functionAliases.has(id)) return functionAliases.get(id)!
    // 标题可包含标点和空格；文档使用可解析别名，行内渲染仍保留完整业务名。
    const base=(label || id.split('.').at(-1) || 'fn').replace(/[^\p{L}\p{N}_$]/gu,'_') || 'fn'
    let alias=/^[\p{L}_$]/u.test(base) && !['if','else','return','new','null','true','false','delete','typeof','void','await','yield','class','function','var','let','const','for','while','do','switch','case','break','continue','throw','try','catch','finally','import','export','default','extends','super','this','in','instanceof','with','debugger','enum'].includes(base) ? base : `f_${base}`,index=1
    const initial=alias
    while(document.functions.has(alias) || ['IF','IFS'].includes(alias)) alias=`${initial}_${++index}`
    functionAliases.set(id,alias);document.functions.set(alias,id);return alias
  }
  context.functions.forEach(item=>reserveFunction(item.id,item.name))
  function append(text:string) {document.text+=text}
  function token(text:string,label:string,kind:ExpressionToken['kind'],node:ExpressionNode,path:(string|number)[],title?:string,branch?:ExpressionToken['branch']) {
    const from=document.text.length;append(text);document.tokens.push({from,to:document.text.length,text,label,kind,node,path,title,branch})
  }
  function priority(node:ExpressionNode):number {
    return node.type === 'conditional' ? 1 : node.type === 'logical' ? node.operator === 'or' ? 2 : 3
      : node.type === 'binary' ? ['eq','ne'].includes(node.operator) ? 4 : ['gt','ge','lt','le'].includes(node.operator) ? 5 : ['add','subtract'].includes(node.operator) ? 6 : 7 : 9
  }
  function render(node:ExpressionNode,path:(string|number)[],depth:number,required=0) {
    const from=document.text.length
    const level=priority(node),wrapped=level < required
    if(wrapped)append(node.type === 'conditional' ? `(\n${'  '.repeat(depth)}` : '(')
    const child=(value:ExpressionNode,key:string|number,parent=0,indent=depth)=>{
      render(value,[...path,key],indent,parent)
    }
    switch(node.type) {
      case 'literal': {
        const text=node.valueType === 'string' ? JSON.stringify(node.value) : node.valueType === 'null' ? 'null' : String(node.value)
        token(text,text,'literal',node,path);break
      }
      case 'reference': {
        const key=referenceKey(node)
        let alias=aliases.get(key)
        if (!alias) {alias=node.path.length ? `${node.id} / ${node.path.join(' / ')}` : node.id;while(document.references.has(alias)) alias+=' ·';document.references.set(alias,node);aliases.set(key,alias)}
        const reference=context.references.find(item=>referenceKey(item) === key)
        // 简称仅改变显示；重名使用完整来源，复制与补全仍使用无歧义别名。
        const short=reference?.displayLabel
        const label=short && names.get(short)?.size === 1 ? short : alias
        token(`[${JSON.stringify(alias)}]`,label,'reference',node,path,[reference?.label,reference?.unit].filter(Boolean).join(' · '));break
      }
      case 'unary': token({positive:'+',negate:'-',not:'!'}[node.operator],{positive:'+',negate:'-',not:'!'}[node.operator],'operator',node,path);append('(');child(node.operand,'operand');append(')');break
      case 'binary': child(node.left,'left',level);append(' ');token(sourceSigns[node.operator] || node.operator,sourceSigns[node.operator] || node.operator,'operator',node,path);append(' ');child(node.right,'right',level+1);break
      case 'logical': node.operands.forEach((item,index)=>{if(index) {append(' ');token(node.operator === 'and' ? '&&' : '||',node.operator === 'and' ? '&&' : '||','operator',node,path);append(' ')}render(item,[...path,'operands',index],depth,level+1)});break
      case 'conditional': {
        child(node.condition,'condition',2);append(' ');token('?','?','keyword',node,path,undefined,'whenTrue');append(' ');child(node.whenTrue,'whenTrue',2,depth+1);append(`\n${'  '.repeat(depth)}`);token(':',':','keyword',node,path,undefined,'whenFalse');append(' ');child(node.whenFalse,'whenFalse',0,depth);break
      }
      case 'call': {
        const fn=context.functions.find(item=>item.id === node.function),label=fn?.name || node.function.split('.').at(-1) || node.function
        token(reserveFunction(node.function,label),label,'function',node,path,fn?.description);append('(');node.arguments.forEach((item,index)=>{if(index)append(', ');render(item,[...path,'arguments',index],depth)});append(')');break
      }
    }
    if(wrapped)append(node.type === 'conditional' ? `\n${'  '.repeat(Math.max(0,depth-1))})` : ')')
    document.spans.push({from,to:document.text.length,node,text:document.text.slice(from)})
  }
  render(root,[],0)
  document.tokens=projectExpressionTokens(document,root,context,t)
  return document
}

/** 补全项与文档引用共用别名表，复制到同一模板也不依赖节点下标。 */
export function expressionCompletions(document:ExpressionDocument,functions:ExpressionFunction[],t:ExpressionTranslate):Array<{label:string;apply:string;type:string;detail?:string}> {
  const references=new Map(Array.from(document.references,([label,node])=>[referenceKey(node),label]))
  const calls=new Map(Array.from(document.functions,([alias,id])=>[id,alias]))
  return [...Array.from(references.values(),label=>({label,apply:`[${JSON.stringify(label)}]`,type:'variable'})),
    ...Array.from(calls,([id,alias])=>{const fn=functions.find(item=>item.id === id);return {label:fn?.name || id,apply:`${alias}()`,type:'function',detail:fn?.description}}),
    {label:'IF',apply:'IF(true, 0, 0)',type:'function',detail:t('ifFunction')},
    {label:'IFS',apply:'IFS(true, 0, true, 0)',type:'function',detail:t('ifsFunction')},
    {label:t('noValue'),apply:'null',type:'keyword'}, {label:t('yes'),apply:'true',type:'keyword'}, {label:t('no'),apply:'false',type:'keyword'}]
}

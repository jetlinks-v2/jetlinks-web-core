import type { ExpressionNode } from './types'
import type { ExpressionEditorContext } from './editor'
import { enumChoices,expressionValueChoiceLookup } from './editor'
import { expressionDocument, referenceKey, type ExpressionTranslate } from './document'
import { parseExpressionDocument } from './parse'
import type { ExpressionFact } from './presentation'

export function mathEnumChoices(context:ExpressionEditorContext) {
  return context.references.flatMap(ref=>enumChoices(ref.schema) || []).map((item,index)=>({...item,macro:`JLenum${mathReferenceMacro(index).slice(2)}`}))
}

/** 数学编辑和回放共用同一投影；LaTeX 仅作输入/排版，保存和执行仍使用原树。 */
export function expressionMath(root:ExpressionNode,context:ExpressionEditorContext,t:ExpressionTranslate,facts=new Map<string,ExpressionFact>(),meanings=true,options:{showSkipped?:boolean}={}) {
  const document=expressionDocument(root,context,t)
  const escape=(value:string)=>value.replace(/[\\{}%$&#_^~]/g,char=>`\\${char}`)
  const label=(value:string)=>`\\text{${escape(value)}}`
  const macros:Record<string,{def:string;expand:boolean;captureSelection:boolean}>={}
  const enumValues=mathEnumChoices(context)
  const valueChoices=expressionValueChoiceLookup(root,context)
  enumValues.forEach(item=>{macros[item.macro]={def:`\\class{expression-math-constant is-enum}{${label(item.label)}}`,expand:false,captureSelection:true}})
  const inspections:Array<{title:string;reference?:string}>=[]
  let skipped=0
  const inspect=(value:string,title:string,reference?:string)=>{
    if(!facts.size && !meanings)return value
    const index=inspections.push({title,reference})-1
    return `\\htmlData{expression-inspect=${index}}{${value}}`
  }
  const references=new Map<string,string>()
  for(const [name,node] of document.references) {
    const index=context.references.findIndex(item=>referenceKey(item) === referenceKey(node))
    if(index < 0)throw new Error('unknownReference')
    const macro=mathReferenceMacro(index),reference=context.references[index]
    const short=reference.displayLabel
    const display=short && context.references.filter(item=>(item.displayLabel || item.label) === short).length === 1 ? short : name
    references.set(referenceKey(node),macro)
    macros[macro]={def:`\\htmlData{expression-reference-index=${index}}{\\class{expression-math-reference${node.id === 'params' ? ' is-parameter' : ''}}{${label(display)}}}`,expand:false,captureSelection:true}
  }
  macros.JLotherwise={def:`\\class{expression-math-default}{${label(t('otherwise'))}}`,expand:false,captureSelection:true}
  for(const [macro,key] of Object.entries({JLand:'and',JLor:'or',JLnot:'not'}))macros[macro]={def:`\\mathbin{\\class{expression-math-logic}{${label(t(key))}}}`,expand:false,captureSelection:true}
  context.resultLabels?.forEach((item,index)=>{macros[`JLmeaning${mathReferenceMacro(index).slice(2)}`]={def:`\\class{expression-math-meaning}{\\scriptsize ${label(item.label)}}`,expand:false,captureSelection:true}})
  const functions=new Map(Array.from(document.functions,([alias,id])=>[id,alias]))
  const signs:Record<string,string>={add:'+',subtract:'-',multiply:'\\times ',mod:'\\bmod ',eq:'=',ne:'\\ne ',gt:'>',ge:'\\ge ',lt:'<',le:'\\le '}
  const priority=(node:ExpressionNode)=>node.type === 'conditional' ? 0 : node.type === 'logical' ? node.operator === 'or' ? 1 : 2 : node.type === 'binary' ? ['eq','ne','gt','ge','lt','le'].includes(node.operator) ? 3 : ['add','subtract'].includes(node.operator) ? 4 : 5 : 7
  const factAt=(path:(string|number)[])=>{
    const direct=facts.get(JSON.stringify(path))
    if(direct)return direct
    const parent=path.slice()
    while(parent.length) {parent.pop();const fact=facts.get(JSON.stringify(parent));if(fact?.state === 'skipped')return fact}
  }
  function render(node:ExpressionNode,path:(string|number)[],required=0,result=false):string {
    const child=(item:ExpressionNode,key:string|number,parent=0,isResult=false)=>render(item,[...path,key],parent,isResult)
    const fact=factAt(path)
    let value:string
    switch(node.type) {
      case 'literal': {
        value=node.valueType === 'null' ? result ? '\\JLemptyResult' : '\\JLemptyValue' : node.valueType === 'boolean' ? node.value ? '\\JLtrue' : '\\JLfalse' : node.valueType === 'string' ? `\\class{expression-math-constant is-text}{${label(JSON.stringify(node.value))}}` : String(node.value)
        const choice=valueChoices(node)?.find(item=>String(item.node.value) === String(node.value) && (item.node.valueType === 'string') === (node.valueType === 'string'))
        const enumeration=choice && enumValues.find(item=>item.label === choice.label && JSON.stringify(item.node) === JSON.stringify(choice.node))
        if(enumeration)value=`\\${enumeration.macro}`
        const meaning=result && meanings ? context.resultLabels?.findIndex(item=>typeof item.value === typeof node.value && String(item.value) === String(node.value) || typeof item.value === 'number' && !['string','boolean','null'].includes(node.valueType) && String(item.value) === String(node.value)) : undefined
        if(meaning !== undefined && meaning >= 0)value+=`\\;\\JLmeaning${mathReferenceMacro(meaning).slice(2)}`
        break
      }
      case 'reference': {
        value=`\\${references.get(referenceKey(node))}`
        const reference=context.references.find(item=>referenceKey(item) === referenceKey(node))
        if(fact?.state === 'available' && fact.text)value=`\\class{expression-math-reference is-recorded${node.id === 'params' ? ' is-parameter' : ''}}{${label(fact.text)}}`
        value=inspect(value,[reference?.label || node.id,reference?.description,reference?.unit,facts.size ? fact?.state === 'skipped' ? t('notUsed') : fact?.state === 'available' ? fact.text : t('valueNotRecorded') : undefined].filter(Boolean).join('\n'),referenceKey(node))
        break
      }
      case 'unary': value=`${{positive:'+',negate:'-',not:'\\JLnot '}[node.operator]}\\left(${child(node.operand,'operand')}\\right)`;break
      case 'binary':
        value=['eq','ne'].includes(node.operator) && node.right.type === 'literal' && node.right.valueType === 'null'
          ? `${child(node.left,'left',priority(node))}\\;\\${node.operator === 'eq' ? 'JLmissing' : 'JLpresent'}`
          : node.operator === 'divide' ? `\\dfrac{${child(node.left,'left')}}{${child(node.right,'right')}}` : `${child(node.left,'left',priority(node))}${signs[node.operator] || fail()}${child(node.right,'right',priority(node)+1)}`
        break
      case 'logical': value=node.operands.map((item,index)=>render(item,[...path,'operands',index],priority(node)+1)).join(node.operator === 'and' ? '\\JLand ' : '\\JLor ');break
      case 'call': {
        const alias=functions.get(node.function)
        if(!alias)throw new Error('unknownFunction')
        value=node.function === 'math.sqrt' && node.arguments.length === 1 ? `\\sqrt{${render(node.arguments[0],[...path,'arguments',0])}}` : `\\operatorname{${alias}}\\left(${node.arguments.map((item,index)=>render(item,[...path,'arguments',index])).join(',')}\\right)`
        // 中间结果仅放在悬浮说明，完整算式始终保留；不在浏览器执行函数。
        value=inspect(value,[context.functions.find(item=>item.id === node.function)?.name || alias,context.functions.find(item=>item.id === node.function)?.description,facts.size ? fact?.state === 'skipped' ? t('notUsed') : fact?.state === 'available' && fact.resultText ? `${t('result')}: ${fact.resultText}` : t('valueNotRecorded') : undefined].filter(Boolean).join('\n'))
        break
      }
      case 'conditional': {
        const rows:string[]=[],branches:Array<{value:ExpressionNode;path:(string|number)[];condition?:ExpressionNode;conditionPath?:(string|number)[];skipped:boolean}>=[]
        let branch:ExpressionNode=node,branchPath=path
        const outcome=(path:(string|number)[])=>{
          const fact=factAt(path),symbol=fact?.state === 'skipped' ? '\\cdots' : fact?.outcome === 'true' ? '\\checkmark' : fact?.outcome === 'false' ? '\\times' : fact?.outcome === 'unknown' ? '?' : ''
          return symbol ? `\\;\\class{expression-math-outcome is-${fact?.outcome || 'skipped'}}{${symbol}}` : ''
        }
        while(branch.type === 'conditional') {
          branches.push({value:branch.whenTrue,path:[...branchPath,'whenTrue'],condition:branch.condition,conditionPath:[...branchPath,'condition'],skipped:factAt(branchPath)?.state === 'skipped'})
          branch=branch.whenFalse;branchPath=[...branchPath,'whenFalse']
        }
        branches.push({value:branch,path:branchPath,skipped:factAt(branchPath)?.state === 'skipped'})
        let folding=false
        for(const row of branches) {
          if(row.skipped)skipped++
          if(row.skipped && !options.showSkipped) {
            if(!folding)rows.push('\\class{expression-math-fold}{\\cdots} & \\class{expression-math-fold}{\\cdots}')
            folding=true;continue
          }
          folding=false
          const condition=row.condition ? `${render(row.condition,row.conditionPath!)}${outcome(row.conditionPath!)}` : `\\JLotherwise${facts.get(JSON.stringify(row.path))?.selected ? '\\;\\class{expression-math-outcome is-true}{\\checkmark}' : ''}`
          rows.push(`${render(row.value,row.path,0,true)} & ${condition}`)
        }
        value=`\\begin{cases}${rows.join('\\\\')}\\end{cases}`
        break
      }
    }
    if(facts.size) {
      const state=fact?.state === 'skipped' ? 'is-skipped' : fact?.selected ? 'is-selected' : fact?.outcome === 'false' ? 'is-false' : fact && fact.state !== 'available' ? 'is-unknown' : ''
      if(state)value=`\\class{expression-math-fact ${state}}{${value}}`
    }
    return priority(node) < required ? `\\left(${value}\\right)` : value
  }
  const latex=render(root,[],0,true),result=facts.get('[]')
  // 先登记实际公式的说明，常量宏不能抢占引用或函数的悬浮标记。
  for(const [macro,key] of Object.entries({JLmissing:'missing',JLpresent:'present',JLemptyValue:'emptyValue',JLemptyResult:'noValue',JLtrue:'yes',JLfalse:'no'})) {
    const kind=macro === 'JLtrue' || macro === 'JLfalse' ? 'constant is-boolean' : macro === 'JLmissing' || macro === 'JLpresent' ? 'predicate' : 'constant is-empty'
    const content=`\\class{expression-math-${kind}}{${label(t(key))}}`
    const hint=macro === 'JLemptyResult' ? 'noValueHint' : macro === 'JLemptyValue' ? 'emptyValueHint' : kind.includes('boolean') ? 'booleanValue' : undefined
    macros[macro]={def:hint ? inspect(content,t(hint)) : content,expand:false,captureSelection:true}
  }
  return {latex,macros,document,inspections,skipped,result:result?.state === 'available' ? result.resultText : undefined}
}

function fail():never {throw new Error('unsupportedExpression')}

/** 字母宏保持 MathLive 原子选区稳定，与既有变量选择器共享编号。 */
export function mathReferenceMacro(index:number):string {
  let letters=''
  do {letters=String.fromCharCode(97+index%26)+letters;index=Math.floor(index/26)-1}while(index>=0)
  return `JL${letters}`
}

/** 只将受支持的数学输入还原为成熟解析器的输入文本；不在浏览器求值。 */
export function parseMathExpression(latex:string,root:ExpressionNode,context:ExpressionEditorContext,t:ExpressionTranslate):ExpressionNode {
  return createMathParser(root,context,t)(latex)
}

/** 解析目录属于当前文档；选区片段共用别名、枚举和函数目录，不在每次指针移动时重建。 */
export function createMathParser(root:ExpressionNode,context:ExpressionEditorContext,t:ExpressionTranslate) {
  const document=expressionDocument(root,context,t)
  const enumValues=new Map(mathEnumChoices(context).map(item=>[item.macro,item.node]))
  const aliases=new Map(Array.from(document.references,([alias,node])=>[referenceKey(node),alias]))
  const references=new Map(context.references.map((item,index)=>[mathReferenceMacro(index),aliases.get(referenceKey(item))]))
  return (latex:string):ExpressionNode=>{
  if(latex.length > 16000)throw new Error('expressionTooLong')
  let at=0
  const skip=()=>{while(/\s/.test(latex[at] || '') && at<latex.length)at++}
  function group():string {
    skip();if(latex[at++] !== '{')throw new Error('incomplete')
    let depth=1,content=''
    while(at<latex.length && depth) {
      const char=latex[at++]
      if(char === '\\' && /[{}%$&#_^~\\]/.test(latex[at] || '')) {content+=latex[at++];continue}
      if(char === '{')depth++
      if(char === '}')depth--
      if(depth)content+=char
    }
    if(depth)throw new Error('incomplete')
    return content
  }
  function read(end?:string):string {
    let output=''
    while(at<latex.length) {
      skip()
      if(at>=latex.length)break
      if(end && latex.startsWith(end,at)) {at+=end.length;return output}
      if(latex[at] === '&' || latex.startsWith('\\\\',at) || latex.startsWith('\\end{cases}',at))return output
      const char=latex[at++]
      if(char === '{') {output+=`(${read('}')})`;continue}
      if(char !== '\\') {output+=char;continue}
      const command=latex.slice(at).match(/^[a-zA-Z]+|^[,;! ]/)
      if(!command)throw new Error('unsupportedExpression')
      at+=command[0].length
      const name=command[0],reference=references.get(name)
      if(reference) {output+=`[${JSON.stringify(reference)}]`;continue}
      const enumeration=enumValues.get(name)
      if(enumeration){output+=enumeration.valueType === 'string' ? JSON.stringify(enumeration.value) : String(enumeration.value);continue}
      if(name === 'JLotherwise') {output+='__otherwise';continue}
      if(name === 'JLemptyValue' || name === 'JLemptyResult') {output+='null';continue}
      if(name === 'JLtrue' || name === 'JLfalse') {output+=name === 'JLtrue' ? 'true' : 'false';continue}
      if(name === 'JLand' || name === 'JLor' || name === 'JLnot') {output+={JLand:'&&',JLor:'||',JLnot:'!'}[name];continue}
      if(name === 'JLmissing' || name === 'JLpresent') {output+=name === 'JLmissing' ? '==null' : '!=null';continue}
      // 只忽略自身生成的说明编号；内容仍经过受控解析，任意 HTML 属性不放行。
      if(name === 'htmlData') {
        if(!/^expression-inspect=\d+$/.test(group()))throw new Error('unsupportedExpression')
        skip();if(latex[at++] !== '{')throw new Error('incomplete');output+=read('}');continue
      }
      if(name === 'class') {
        if(group() !== 'expression-math-constant is-text')throw new Error('unsupportedExpression')
        skip();if(latex[at++] !== '{')throw new Error('incomplete');output+=read('}');continue
      }
      if(context.resultLabels?.some((_item,index)=>name === `JLmeaning${mathReferenceMacro(index).slice(2)}`))continue
      if(['left','right',',',';','!',' '].includes(name))continue
      const signs:Record<string,string>={times:'*',cdot:'*',div:'/',bmod:'%',land:'&&',wedge:'&&',lor:'||',vee:'||',lnot:'!',neg:'!',ne:'!=',neq:'!=',le:'<=',leq:'<=',ge:'>=',geq:'>=',lt:'<',gt:'>'}
      if(signs[name]) {output+=signs[name];continue}
      if(['frac','dfrac','tfrac'].includes(name)) {
        skip();if(latex[at++] !== '{')throw new Error('incomplete');const numerator=read('}')
        skip();if(latex[at++] !== '{')throw new Error('incomplete');const denominator=read('}')
        output+=`((${numerator})/(${denominator}))`;continue
      }
      if(name === 'mathord') {skip();if(latex[at++] !== '{')throw new Error('incomplete');output+=`(${read('}')})`;continue}
      if(name === 'sqrt') {
        const alias=Array.from(document.functions).find(([,id])=>id === 'math.sqrt')?.[0]
        if(!alias)throw new Error('unknownFunction')
        skip();if(latex[at++] !== '{')throw new Error('incomplete');output+=`${alias}(${read('}')})`;continue
      }
      if(name === 'operatorname' || name === 'mathrm') {
        const content=group().replace(/^\\mathrm\{(.+)\}$/,'$1')
        if(!document.functions.has(content) && !['IF','IFS','true','false','null'].includes(content))throw new Error('unknownFunction')
        output+=content;continue
      }
      if(name === 'text') {
        const content=group()
        // MathLive 将文本模式的双引号正规化为 TeX 的两个单引号；仅还原字符串边界。
        const value=content.startsWith("''") && content.endsWith("''") ? `"${content.slice(2,-2)}"` : content
        JSON.parse(value);output+=value;continue
      }
      if(name === 'begin') {
        if(group() !== 'cases')throw new Error('unsupportedExpression')
        const rows:Array<{value:string;condition:string}>=[]
        while(at<latex.length) {
          const value=read();skip();if(latex[at++] !== '&')throw new Error('incomplete')
          const condition=read();rows.push({value,condition:condition.trim()});skip()
          if(latex.startsWith('\\end{cases}',at)) {at+='\\end{cases}'.length;break}
          if(!latex.startsWith('\\\\',at))throw new Error('incomplete')
          at+=2
        }
        const fallback=rows.pop()
        if(!rows.length || fallback?.condition !== '__otherwise' || rows.some(row=>row.condition === '__otherwise'))throw new Error('conditionalDefault')
        output+=rows.reduceRight((otherwise,row)=>`((${row.condition})?(${row.value}):(${otherwise}))`,fallback.value)
        continue
      }
      throw new Error('unsupportedExpression')
    }
    if(end)throw new Error('incomplete')
    return output
  }
  const source=read()
  if(at !== latex.length)throw new Error('incomplete')
  // 数学等号和逻辑符号只在这里正规化；字符串与引用名称不参与字符替换。
  const normalized=source.replace(/"(?:\\.|[^"\\])*"|\["(?:\\.|[^"\\])*"\]|(?<![=!<>])=(?!=)/g,token=>token === '=' ? '==' : token)
  const parsed=parseExpressionDocument(normalized,{...document,spans:[],tokens:[]},context,root,t)
  if(!parsed.node)throw new Error(parsed.error?.key || 'incomplete')
  return parsed.node
  }
}

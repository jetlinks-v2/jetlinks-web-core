import type { ExpressionEditorContext } from './editor'
import type { ExpressionNode } from './types'
import { expressionDocument, referenceKey, type ExpressionTranslate } from './document'
import { expressionMath, mathEnumChoices, mathReferenceMacro } from './math'

const escapeText=(value:string)=>value.replace(/[\\{}%$&#_^~]/g,char=>`\\${char}`)
const unescapeText=(value:string)=>value.replace(/\\([\\{}%$&#_^~])/g,'$1')
const constants:Record<string,string>={JLotherwise:'\\operatorname{otherwise}',JLemptyValue:'\\operatorname{null}',JLemptyResult:'\\operatorname{null}',JLtrue:'\\operatorname{true}',JLfalse:'\\operatorname{false}',JLand:'\\land ',JLor:'\\lor ',JLnot:'\\lnot ',JLmissing:'=\\operatorname{null}',JLpresent:'\\ne \\operatorname{null}'}
const commands=new Set(['left','right',',',';','!',' ','times','cdot','div','bmod','land','wedge','lor','vee','lnot','neg','ne','neq','le','leq','ge','geq','lt','gt','frac','dfrac','tfrac','mathord','sqrt'])

/** Only strips the usual math delimiters; arbitrary TeX documents are not an import format. */
export function unwrapMathLatex(value:string) {
  const text=value.trim()
  const delimiters=[['$$','$$'],['$','$'],['\\[','\\]'],['\\(','\\)'],['\\begin{equation*}','\\end{equation*}']]
  const pair=delimiters.find(([start,end])=>text.startsWith(start) && text.endsWith(end) && text.length>=start.length+end.length)
  return pair ? text.slice(pair[0].length,-pair[1].length).trim() : text
}

/** Read-only views export the definition, never the recorded or simulated substitution. */
export function expressionLatex(root:ExpressionNode,context:ExpressionEditorContext,t:ExpressionTranslate):string {
  return createMathTransfer(root,context,t).copy(expressionMath(root,context,t,undefined,false).latex)
}

/**
 * Clipboard LaTeX uses stable ids, not MathLive's local macro indexes or translated labels.
 * This token adapter also handles selections which are not complete expressions (e.g. `+`).
 * Parsing and validation of the resulting full formula remain in the shared math parser.
 */
export function createMathTransfer(root:ExpressionNode,context:ExpressionEditorContext,t:ExpressionTranslate) {
  const document=expressionDocument(root,context,t)
  const functions=new Map(Array.from(document.functions,([alias,id])=>[id,alias]))
  const refs=new Map(context.references.map((item,index)=>[mathReferenceMacro(index),item]))
  const enums=new Map(mathEnumChoices(context).map(item=>[item.macro,item.node]))
  const literal=(node:Extract<ExpressionNode,{type:'literal'}>)=>node.valueType === 'string' ? `\\text{${escapeText(JSON.stringify(node.value))}}` : node.valueType === 'null' || node.valueType === 'boolean' ? `\\operatorname{${String(node.value)}}` : String(node.value)
  function convert(source:string,direction:'copy'|'paste'):string {
    if(source.length>16000)throw new Error('expressionTooLong')
    let at=0,output=''
    const skip=()=>{while(at<source.length && /\s/.test(source[at]))at++}
    function group():string {
      skip();if(source[at++] !== '{')throw new Error('incomplete')
      const start=at;let depth=1
      while(at<source.length) {
        const char=source[at++]
        if(char === '\\' && /[\\{}%$&#_^~]/.test(source[at] || '')){at++;continue}
        if(char === '{')depth++
        if(char === '}' && --depth === 0)return source.slice(start,at-1)
      }
      throw new Error('incomplete')
    }
    const textValue=()=>{
      const text=unescapeText(group())
      const value=JSON.parse(text.startsWith("''") && text.endsWith("''") ? `"${text.slice(2,-2)}"` : text)
      if(typeof value !== 'string')throw new Error('unsupportedExpression')
      return value as string
    }
    while(at<source.length) {
      if(source[at] !== '\\') {
        if(direction === 'paste' && /[#%$]/.test(source[at]))throw new Error('unsupportedExpression')
        output+=source[at++];continue
      }
      at++
      if(source[at] === '\\'){output+='\\\\';at++;continue}
      const command=source.slice(at).match(/^[a-zA-Z]+|^[,;! ]/)?.[0]
      if(!command)throw new Error('unsupportedExpression')
      at+=command.length
      if(direction === 'copy') {
        const ref=refs.get(command),enumeration=enums.get(command)
        if(ref) {output+=`\\mathrm{${escapeText(ref.id)}}${ref.path.map(part=>`\\left[\\text{${escapeText(JSON.stringify(part))}}\\right]`).join('')}`;continue}
        if(enumeration){output+=literal(enumeration);continue}
        if(constants[command]){output+=constants[command];continue}
        if(command.startsWith('JLmeaning'))continue
        if(command === 'class') {
          if(group() !== 'expression-math-constant is-text')throw new Error('unsupportedExpression')
          output+=convert(group(),direction);continue
        }
      }
      if(command === 'text') {output+=`\\text{${escapeText(JSON.stringify(textValue()))}}`;continue}
      if(command === 'operatorname' || command === 'mathrm') {
        const name=unescapeText(group().replace(/^\\mathrm\{(.*)\}$/s,'$1'))
        if(direction === 'paste' && command === 'mathrm') {
          const path:string[]=[]
          skip()
          while(source.startsWith('\\left[',at) || source[at] === '[') {
            at+=source[at] === '[' ? 1 : '\\left['.length;skip()
            if(!source.startsWith('\\text',at))throw new Error('unknownReference')
            at+='\\text'.length;path.push(textValue());skip()
            if(source.startsWith('\\right]',at))at+='\\right]'.length
            else if(source[at++] !== ']')throw new Error('unknownReference')
            skip()
          }
          const index=context.references.findIndex(item=>referenceKey(item) === referenceKey({id:name,path}))
          if(index<0)throw new Error('unknownReference')
          output+=`\\${mathReferenceMacro(index)} `;continue
        }
        if(['IF','IFS','null','true','false','otherwise'].includes(name)) {
          output+=name === 'otherwise' && direction === 'paste' ? '\\JLotherwise' : `\\operatorname{${name}}`;continue
        }
        const id=direction === 'copy' ? document.functions.get(name) : name
        const alias=id && functions.get(id)
        if(!id || !alias)throw new Error('unknownFunction')
        output+=`\\operatorname{${direction === 'copy' ? escapeText(id) : alias}}`;continue
      }
      if(command === 'begin' || command === 'end') {
        if(group() !== 'cases')throw new Error('unsupportedExpression')
        output+=`\\${command}{cases}`;continue
      }
      if(!commands.has(command))throw new Error('unsupportedExpression')
      output+=`\\${command}`
    }
    return output
  }
  return {copy:(latex:string)=>convert(latex,'copy'),paste:(latex:string)=>convert(unwrapMathLatex(latex),'paste')}
}

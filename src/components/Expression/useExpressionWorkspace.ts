import { computed, nextTick, ref, watch } from 'vue'
import type { ExpressionNode, ExpressionExplanation } from './types'
import type { ExpressionEditorContext } from './editor'
import type { ExplanationFormatter } from './explanation'
import { expressionDocument, referenceKey, type ExpressionTranslate } from './document'
import { documentParts, explanationFacts, referenceIcon } from './presentation'

/** 对照仅投影公式引用与已记录事实；展开移动原编辑器，保留草稿及撤销历史。 */
export function useExpressionWorkspace(props:{node:ExpressionNode;context:ExpressionEditorContext;explanation?:ExpressionExplanation;format?:ExplanationFormatter;stationary?:boolean},t:ExpressionTranslate) {
  const expanded=ref(false),active=ref<string>(),content=ref<HTMLElement>(),modalHost=ref<HTMLElement>()
  const trigger=ref<{ $el:HTMLElement }>()
  const stableDialog=ref<HTMLDialogElement>()
  // 自定义元素在 reparent 时会销毁内部会话；原位原生 dialog 进入 top layer，保留选区与撤销。
  watch([expanded,stableDialog],([open,dialog],previous)=>{
    if(!props.stationary || typeof dialog?.showModal !== 'function')return
    if(dialog.open)dialog.close()
    if(open)dialog.showModal()
    else {dialog.open=true;if(previous?.[0])void restoreFocus()}
  },{flush:'post'})
  const rows=computed(()=>{
    const document=expressionDocument(props.node,props.context,t)
    const facts=props.explanation && props.format ? explanationFacts(props.node,props.explanation,props.format) : new Map()
    const rows=new Map<string,{key:string;label:string;source:string;icon:string;parameter:boolean;type:string;unit?:string;values:string[];skipped:boolean;recorded:boolean}>()
    for(const part of documentParts(document,facts)) {
      if(part.token?.node.type !== 'reference')continue
      const token=part.token,node=token.node as Extract<ExpressionNode,{type:'reference'}>,key=referenceKey(node)
      const reference=props.context.references.find(item=>referenceKey(item) === key)
      let row=rows.get(key)
      if(!row) {
        row={key,label:token.label,source:reference?.label || token.label,icon:referenceIcon(token,props.context),parameter:node.id === 'params',type:referenceType(String(reference?.schema?.type || ''),t),unit:reference?.unit,values:[],skipped:true,recorded:false}
        rows.set(key,row)
      }
      if(part.fact?.state !== 'skipped')row.skipped=false
      if(part.fact)row.recorded=true
      if(part.fact?.text && part.fact.state !== 'skipped' && !row.values.includes(part.fact.text))row.values.push(part.fact.text)
    }
    return [...rows.values()]
  })
  // 只切换展示类，不改编辑器文档、选区或装饰坐标。
  function highlight(key?:string) {
    if(active.value === key)return
    active.value=key
    content.value?.querySelectorAll<HTMLElement>('[data-expression-reference]').forEach(element=>{
      element.classList.toggle('is-related',!!key && element.dataset.expressionReference === key)
    })
  }
  function track(event:Event) {
    const target=(event.target as HTMLElement).closest<HTMLElement>('[data-expression-reference]')
    highlight(target?.dataset.expressionReference)
  }
  watch(()=>[props.node,props.explanation],()=>highlight())
  async function restoreFocus() {await nextTick();trigger.value?.$el?.focus()}
  return {expanded,active,content,modalHost,stableDialog,trigger,rows,highlight,track,restoreFocus}
}

/** 类型名只用于用户辨认数据，保持与公式插入目录相同的角色。 */
function referenceType(type:string,t:ExpressionTranslate):string {
  if(['int','long','bigint','double','float','decimal','number'].includes(type))return t('number')
  if(['date','datetime','timestamp'].includes(type))return t('date')
  if(type === 'boolean')return t('boolean')
  if(type === 'enum')return t('state')
  if(type === 'object' || type === 'array')return t('dataGroup')
  return type === 'string' ? t('text') : t('reference')
}

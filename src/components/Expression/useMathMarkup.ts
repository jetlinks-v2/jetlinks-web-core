import { onMounted, onScopeDispose, shallowRef, watch, type Ref } from 'vue'
import type { expressionMath } from './math'

type Projection=Pick<ReturnType<typeof expressionMath>,'latex'|'macros'> & Partial<Pick<ReturnType<typeof expressionMath>,'inspections'>>
let renderer:Promise<typeof import('mathlive')>|undefined

/** 复用 MathLive 静态排版；无编辑器实例、求值器或远程资源，刷新只替换排版。 */
export function useMathMarkup(projection:Ref<Projection|undefined>,element?:Ref<HTMLElement|undefined>) {
  const markup=shallowRef('')
  const engine=shallowRef<typeof import('mathlive')>()
  const hint=shallowRef<{title:string;style:{left:string;top:string;width:string;height:string}}>()
  let pending:ReturnType<typeof setTimeout>|undefined,target:HTMLElement|undefined
  function hideHint() {clearTimeout(pending);pending=undefined;target=undefined;hint.value=undefined}
  function inspect(event:Event,immediate=false) {
    const anchor=(event.target as HTMLElement).closest<HTMLElement>('[data-expression-inspect]')
    if(!anchor || !element?.value?.contains(anchor)) {hideHint();return}
    if(target === anchor && (pending || hint.value))return
    hideHint();target=anchor
    const item=projection.value?.inspections?.[Number(anchor.dataset.expressionInspect)]
    if(!item?.title)return
    const show=()=>{
      pending=undefined
      if(target !== anchor || !element?.value)return
      const origin=element.value.getBoundingClientRect(),bounds=anchor.getBoundingClientRect()
      hint.value={title:item.title,style:{left:`${bounds.left-origin.left}px`,top:`${bounds.top-origin.top}px`,width:`${bounds.width}px`,height:`${bounds.height}px`}}
    }
    if(immediate)show();else pending=setTimeout(show,100)
  }
  const popupContainer=(trigger:HTMLElement)=>trigger.closest<HTMLElement>('dialog:modal, [role="dialog"], [role="alertdialog"]') || trigger.ownerDocument.body
  onScopeDispose(hideHint)
  watch([projection,engine],()=>{
    if(!projection.value || !engine.value) {markup.value='';return}
    try {markup.value=engine.value.convertLatexToMarkup(projection.value.latex,{macros:projection.value.macros})}catch {markup.value=''}
  },{immediate:true})
  // 语义锚点共用一个平台气泡，不给每个数学原子创建组件，也不依赖原生 title。
  if(element)watch([markup,projection,element],()=>{
    hideHint()
    element.value?.querySelectorAll<HTMLElement>('[data-expression-inspect]').forEach(target=>{
      const item=projection.value?.inspections?.[Number(target.dataset.expressionInspect)]
      if(!item)return
      target.removeAttribute('title');target.tabIndex=0;target.setAttribute('aria-label',item.title)
      if(item.reference)target.setAttribute('data-expression-reference',item.reference)
    })
  },{flush:'post'})
  onMounted(async()=>{
    if(typeof document === 'undefined')return
    try {
      renderer ??= Promise.all([import('mathlive'),import('mathlive/fonts.css'),import('mathlive/static.css')]).then(([module])=>module).catch(error=>{renderer=undefined;throw error})
      engine.value=await renderer
    }catch { /* 排版不可用时保留原公式文本。 */ }
  })
  return {markup,hint,inspect,hideHint,popupContainer}
}

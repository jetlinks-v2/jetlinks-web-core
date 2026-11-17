import { onMounted, shallowRef, watch, type Ref } from 'vue'
import type { expressionMath } from './math'

type Projection=ReturnType<typeof expressionMath>
let renderer:Promise<typeof import('mathlive')>|undefined

/** 复用 MathLive 静态排版；无编辑器实例、求值器或远程资源，刷新只替换排版。 */
export function useMathMarkup(projection:Ref<Projection|undefined>,element?:Ref<HTMLElement|undefined>) {
  const markup=shallowRef('')
  const engine=shallowRef<typeof import('mathlive')>()
  watch([projection,engine],()=>{
    if(!projection.value || !engine.value) {markup.value='';return}
    try {markup.value=engine.value.convertLatexToMarkup(projection.value.latex,{macros:projection.value.macros})}catch {markup.value=''}
  },{immediate:true})
  // MathLive 提供稳定的数据锚点；原生悬浮说明不增加浮层实例，也不改变数学排版。
  if(element)watch([markup,projection,element],()=>{
    element.value?.querySelectorAll<HTMLElement>('[data-expression-inspect]').forEach(target=>{
      const item=projection.value?.inspections[Number(target.dataset.expressionInspect)]
      if(!item)return
      target.title=item.title;target.tabIndex=0;target.setAttribute('aria-label',item.title)
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
  return {markup}
}

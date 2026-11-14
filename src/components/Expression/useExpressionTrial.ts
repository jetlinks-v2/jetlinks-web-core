import { computed,onBeforeUnmount,reactive,shallowRef,ref,watch } from 'vue'
import type { StructuredExpression,ExpressionEvaluation,ExpressionEvaluationRequest } from './types'
import type { ExpressionEditorContext } from './editor'
import { expressionReferences } from './display'
import { referenceKey } from './document'

export interface ExpressionTrialProps { modelValue:StructuredExpression;context:ExpressionEditorContext;evaluate:(request:ExpressionEvaluationRequest)=>Promise<ExpressionEvaluation>;numeric?:boolean;disabled?:boolean;samples?:Record<string,unknown>;inline?:boolean;automatic?:boolean }
/** 模拟数据独立于保存配置；任一输入变化立即使旧结果失效，迟到响应不得覆盖。 */
export function useExpressionTrial(props:ExpressionTrialProps) {
  const values=reactive<Record<string,unknown>>({}),result=shallowRef<ExpressionEvaluation>(),loading=ref(false),error=ref('')
  let revision=0,timer:ReturnType<typeof setTimeout>|undefined
  const references=computed(()=> {
    const keys=new Set(expressionReferences(props.modelValue.root).map(referenceKey))
    const ids=new Set<string>()
    return props.context.references.filter(item=>keys.has(referenceKey(item))).flatMap(item=>{
      if(ids.has(item.id))return []
      ids.add(item.id)
      return [item.path.length ? props.context.references.find(root=>root.id === item.id && !root.path.length) || {...item,path:[],label:item.id,schema:{type:'object'}} : item]
    })
  })
  const invalidate=()=>{revision++;result.value=undefined;error.value='';loading.value=false}
  watch(()=>[props.modelValue,values,props.context,props.disabled],invalidate,{deep:true,flush:'sync'})
  watch(()=>props.samples,samples=>{Object.keys(values).forEach(key=>delete values[key]);Object.assign(values,samples)},{immediate:true,deep:true})
  // Automatic hosts debounce edits and invalidate in-flight results through the same manual trial path.
  watch(()=>[props.modelValue,values,props.context,props.disabled,props.automatic],()=>{
    clearTimeout(timer)
    if(props.automatic && !props.disabled && references.value.every(item=>Object.hasOwn(values,item.id))) timer=setTimeout(()=>void run(),350)
  },{deep:true,immediate:true})
  onBeforeUnmount(()=>{revision++;clearTimeout(timer)})
  async function run() {
    clearTimeout(timer)
    if(props.disabled || loading.value)return
    const current=++revision
    result.value=undefined;error.value='';loading.value=true
    // 数字以文本传输，由后端依声明恢复精度；空值也显式传递。
    const variables:Record<string,unknown>={},variableTypes:Record<string,string>={}
    try {
      for(const reference of references.value) {
        const type=String(reference.schema?.type || '')
        const value=values[reference.id]
        variables[reference.id]=['object','array'].includes(type) && typeof value === 'string' && value.trim() ? JSON.parse(value) : value ?? null
        variableTypes[reference.id]=type
      }
      const value=await props.evaluate({expression:JSON.parse(JSON.stringify(props.modelValue)),variables,variableTypes,numeric:props.numeric})
      if(current === revision)result.value=value
    } catch(failed) {if(current === revision)error.value=failed instanceof Error ? failed.message : String(failed)}
    finally {if(current === revision)loading.value=false}
  }
  return {values,result,loading,error,references,run}
}

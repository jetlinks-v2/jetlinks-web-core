import { watch, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { expressionFunctions } from '../../api/expression'
import type { ExpressionFunction } from './types'

const functions=shallowRef<ExpressionFunction[]>([]),error=shallowRef(false)
let loadedLocale:string|undefined,pending:Promise<void>|undefined
/** 同页多个公式共享目录及并发请求；键入和局部展开不重新请求。 */
async function refresh(language:string) {
  if (pending) {await pending;if(loadedLocale === language)return}
  error.value=false
  pending=expressionFunctions().then(result=>{functions.value=result;loadedLocale=language},()=>{error.value=true}).finally(()=>{pending=undefined})
  return pending
}
export function useExpressionFunctions() {
  const {locale}=useI18n()
  watch(locale,language=>{if(loadedLocale !== language)void refresh(language)},{immediate:true})
  return {functions,error,refresh:()=>refresh(locale.value)}
}

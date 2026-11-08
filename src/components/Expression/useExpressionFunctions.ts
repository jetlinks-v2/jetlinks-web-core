import { onMounted, shallowRef } from 'vue'
import { expressionFunctions } from '../../api/expression'
import type { ExpressionFunction } from './types'

const functions=shallowRef<ExpressionFunction[]>([]),error=shallowRef(false)
let loaded=false,pending:Promise<void>|undefined
/** 同页多个公式共享目录及并发请求；键入和局部展开不重新请求。 */
async function refresh() {
  if (pending) return pending
  error.value=false
  pending=expressionFunctions().then(result=>{functions.value=result;loaded=true},()=>{error.value=true}).finally(()=>{pending=undefined})
  return pending
}
export function useExpressionFunctions() {
  onMounted(()=>{if (!loaded && !error.value) void refresh()})
  return {functions,error,refresh}
}

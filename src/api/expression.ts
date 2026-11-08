import { request,type Request } from '@jetlinks-web/core'
import type { ExpressionFunction } from '../components/Expression/types'

let pending:Promise<ExpressionFunction[]>|undefined
const http:Pick<Request,'get'>=request
/** 全局声明目录共享一次请求，不包含用户选择、业务绑定或执行数据。 */
export function expressionFunctions():Promise<ExpressionFunction[]> {
  if (!pending) pending=http.get<ExpressionFunction[]>('/script/expression/functions',undefined,{hiddenError:true}).then((response:{result:ExpressionFunction[];status?:number;message?:string})=>{
    if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
    return response.result
  }).catch(error=>{pending=undefined;throw error})
  return pending
}

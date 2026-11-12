import { request,type Request } from '@jetlinks-web/core'
import type { ExpressionFunction,ExpressionEvaluationRequest,ExpressionEvaluation } from '../components/Expression/types'

const http:Pick<Request,'get'|'post'>=request
/** 仅提交结构树和显式模拟参数；前端不计算结果或过程。 */
export function evaluateExpression(input:ExpressionEvaluationRequest):Promise<ExpressionEvaluation> {
  return http.post<ExpressionEvaluation>('/script/expression/_evaluate',input,{hiddenError:true}).then((response:{result:ExpressionEvaluation;status?:number;message?:string})=>{
    if(response.status && response.status >= 400)throw new Error(response.message || String(response.status))
    return response.result
  })
}
/** 全局声明目录共享一次请求，不包含用户选择、业务绑定或执行数据。 */
export function expressionFunctions():Promise<ExpressionFunction[]> {
  return http.get<ExpressionFunction[]>('/script/expression/functions',undefined,{hiddenError:true}).then((response:{result:ExpressionFunction[];status?:number;message?:string})=>{
    if (response.status && response.status >= 400) throw new Error(response.message || String(response.status))
    return response.result
  })
}

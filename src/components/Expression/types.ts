/** 与 script-component 的 version=1 保存契约一致，不包含生成脚本和页面编辑状态。 */
export interface StructuredExpression { version: 1; root: ExpressionNode }
export type ExpressionNode =
  | { type:'literal'; valueType:'null'|'boolean'|'string'|'int'|'long'|'bigint'|'decimal'|'double'; value:unknown }
  | { type:'reference'; id:string; path:string[] }
  | { type:'unary'; operator:'positive'|'negate'|'not'; operand:ExpressionNode }
  | { type:'binary'; operator:string; left:ExpressionNode; right:ExpressionNode }
  | { type:'logical'; operator:'and'|'or'; operands:ExpressionNode[] }
  | { type:'conditional'; condition:ExpressionNode; whenTrue:ExpressionNode; whenFalse:ExpressionNode }
  | { type:'call'; function:string; arguments:ExpressionNode[] }

export interface ExpressionFunction {
  /** Host icon name, or text: followed by a short mathematical symbol. Rendered as plain text. */
  icon?:string
  id:string; name:string; description:string; returnType:string
  parameters:{id:string;name:string;valueType:string}[]
  minimumArguments:number; maximumArguments:number
}

/** 后端根据冻结输入推导的解释，不代表运行时逐节点跟踪。 */
export interface ExpressionExplanation {
  kind:string; expression?:string; operation?:string; state:string; value:unknown
  path:string[]; children:ExpressionExplanation[]
}
export interface ExpressionEvaluation { value:unknown; explanation:ExpressionExplanation; error?:string|null }
export interface ExpressionEvaluationRequest { expression:StructuredExpression; variables:Record<string,unknown>; variableTypes:Record<string,string>; numeric?:boolean; resultType?:Record<string,unknown> }

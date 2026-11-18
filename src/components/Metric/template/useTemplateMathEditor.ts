import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { metricMessages } from '../messages'
import type { ExpressionFunction,StructuredExpression } from '../../Expression/types'
import type { ExpressionReference,ExpressionResultLabel } from '../../Expression/editor'
import type { MathEditorProps } from '../../Expression/useMathEditor'
import { expressionText } from '../../Expression/display'
import { expressionToTree,formulaReferencePath,type FormulaReference } from './formula'
import { referenceKey } from '../../Expression/document'

export interface TemplateMathEditorProps { modelValue:string; tree?:StructuredExpression; references:FormulaReference[]; disabled?:boolean; conditions?:boolean; functions?:ExpressionFunction[]; functionsError?:boolean; forceSource?:boolean; hideMode?:boolean; empty?:boolean; resultLabels?:ExpressionResultLabel[] }
export type FormulaChange={expression:string;expressionTree?:StructuredExpression;metricIds?:string[]}
/** 编辑与反显共用来源身份和说明，字段路径及枚举类型不随显示名称变化。 */
export function templateExpressionReferences(references:FormulaReference[],locale:string):ExpressionReference[] {
  const messages=metricMessages[locale.startsWith('en') ? 'en' : 'zh']
  return references.map(item=>({...formulaReferencePath(item),label:item.label,displayLabel:item.displayLabel,schema:item.schema,unit:item.unit,icon:item.group === 'parameter' ? 'SlidersOutlined' : 'DatabaseOutlined',group:messages[item.group === 'parameter' ? 'formulaParameters' : 'formulaData']}))
}
/** 指标只适配历史源码和引用身份，MathLive 交互由公共编辑器负责。 */
export function useTemplateMathContext(props:TemplateMathEditorProps) {
  const {locale}=useI18n()
  return computed<MathEditorProps>(()=>({
    modelValue:props.tree,disabled:props.disabled,conditions:props.conditions,functionsError:props.functionsError,
    forceSource:props.forceSource,hideMode:props.hideMode,empty:props.empty,
    context:{references:templateExpressionReferences(props.references,String(locale.value)),functions:props.functions || [],resultLabels:props.resultLabels},
    source:{text:props.modelValue,parse:source=>expressionToTree(source,props.references),format:tree=>expressionText(tree,node=>props.references.find(item=>referenceKey(formulaReferencePath(item)) === referenceKey(node))?.expression)}
  }))
}

import { StateField,StateEffect } from '@codemirror/state'
import type { ExpressionNode } from './types'
import type { ExpressionEditorContext } from './editor'
import { expressionDocument,type ExpressionDocument,type ExpressionTranslate } from './document'
import { parseExpressionDocument,type ExpressionDiagnostic } from './parse'

export interface FormulaModel { document:ExpressionDocument; node:ExpressionNode; empty?:boolean; error?:ExpressionDiagnostic }

/** 编辑状态与文档一起撤销；不让组合输入或分组撤销丢失数值类型。 */
export function createFormulaState(node:()=>ExpressionNode,context:()=>ExpressionEditorContext,t:ExpressionTranslate,empty:()=>boolean=()=>false) {
  const initial=():FormulaModel=>{
    const document=expressionDocument(node(),context(),t)
    // 空草稿仍持有引用目录，不将用于编辑器初始化的占位节点提交给模板。
    return {document:empty() ? {...document,text:'',tokens:[],spans:[]} : document,node:node(),empty:empty()}
  }
  const restore=StateEffect.define<FormulaModel>()
  const field=StateField.define<FormulaModel>({
    create:initial,
    update(value,tr) {
      const text=tr.newDoc.toString()
      // 一次撤销可能合并多个操作，只接收与还原后的文档相符的元数据。
      const replacement=[...tr.effects].reverse().find(effect=>effect.is(restore) && effect.value.document.text === text)
      if(replacement)return replacement.value as FormulaModel
      if(!tr.docChanged)return value
      const map=(item:{from:number;to:number})=>({from:tr.changes.mapPos(item.from,1),to:tr.changes.mapPos(item.to,-1)})
      const document={...value.document,text,tokens:value.document.tokens.filter(item=>!tr.changes.touchesRange(item.from,item.to)).map(item=>({...item,...map(item)})).filter(item=>item.from <= item.to && text.slice(item.from,item.to) === item.text),spans:value.document.spans.filter(item=>!tr.changes.touchesRange(item.from,item.to)).map(item=>({...item,...map(item)}))}
      const parsed=parseExpressionDocument(text,document,context(),value.node,t)
      return {document:parsed.document || document,node:parsed.node || value.node,empty:!text.trim(),error:parsed.error}
    },
  })
  return {field,restore,initial}
}

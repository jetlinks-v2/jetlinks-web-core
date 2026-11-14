import { expressionDocument, type ExpressionTranslate } from './document'
import { documentParts, type ExpressionFact, type ExpressionOutcome, type ExpressionPart } from './presentation'
import type { ExpressionEditorContext } from './editor'
import type { ExpressionNode } from './types'

export interface ExpressionBranch {
  key:string
  depth:number
  label:string
  condition?:ExpressionPart[]
  result?:ExpressionPart[]
  value?:string
  outcome?:ExpressionOutcome
  selected:boolean
  skipped:boolean
}

/** 只展开原条件树的布局；判断与短路状态全部来自匹配的后端解释。 */
export function expressionBranches(root:ExpressionNode,context:ExpressionEditorContext,t:ExpressionTranslate,facts:Map<string,ExpressionFact>) {
  const rows:ExpressionBranch[]=[]
  type Path=(string|number)[]
  const fact=(path:Path)=>facts.get(JSON.stringify(path))
  function parts(node:ExpressionNode,path:Path,conditions=false,result=false) {
    const document=expressionDocument(node,result ? context : {...context,resultLabels:undefined},t)
    // 子公式保留全局引用名，取值仍按原树路径查找，重名及嵌套读取不串值。
    document.tokens.forEach(token=>{token.path=[...path,...token.path]})
    return documentParts(document,facts,conditions)
  }
  function visit(node:ExpressionNode,path:Path,depth:number,label:string,inheritedSkip=false) {
    const skipped=inheritedSkip || fact(path)?.state === 'skipped'
    if(node.type !== 'conditional') {
      rows.push({key:JSON.stringify(path),depth,label,result:parts(node,path,false,true),outcome:skipped ? 'skipped' : undefined,
        value:!['literal','reference'].includes(node.type) ? fact(path)?.resultText : undefined,
        selected:!skipped && !!fact(path)?.selected,skipped});return
    }
    const conditionPath=[...path,'condition'],resultPath=[...path,'whenTrue'],fallbackPath=[...path,'whenFalse']
    rows.push({key:JSON.stringify(path),depth,label,condition:parts(node.condition,conditionPath,node.condition.type === 'logical'),
      result:parts(node.whenTrue,resultPath,false,true),
      value:!['conditional','literal','reference'].includes(node.whenTrue.type) ? fact(resultPath)?.resultText : undefined,
      outcome:skipped ? 'skipped' : fact(conditionPath)?.outcome,
      selected:!skipped && !!fact(resultPath)?.selected,skipped})
    visit(node.whenFalse,fallbackPath,depth,':',skipped)
  }
  visit(root,[],0,'')
  return rows
}

/** 连续未参与分支折为同一处入口，不改变已判断条件及命中分支的顺序。 */
export function branchGroups(rows:ExpressionBranch[]) {
  const groups:Array<{key:string;rows:ExpressionBranch[];skipped:boolean}>=[]
  for(const row of rows) {
    const previous=groups.at(-1)
    if(row.skipped && previous?.skipped)previous.rows.push(row)
    else groups.push({key:row.key,rows:[row],skipped:row.skipped})
  }
  return groups
}

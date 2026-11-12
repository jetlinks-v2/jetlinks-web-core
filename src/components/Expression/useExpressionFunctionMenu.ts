import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpressionFunction } from './types'

export type FunctionOption=ExpressionFunction & {disabled?:boolean}
/** 只对已有目录按用途分组；稳定函数ID仍是编辑、执行和解释的唯一身份。 */
export function useExpressionFunctionMenu(props:{functions:FunctionOption[]}) {
  const {t}=useI18n({useScope:'local',messages:{
    zh:{search:'搜索函数',empty:'没有匹配的函数',condition:'条件取值',math:'数值处理',stats:'数据统计',data:'集合与转换',other:'其他函数',single:'条件取值',multiple:'多分支取值',singleHint:'满足条件时取一个值，否则取另一个值',multipleHint:'按顺序判断，取首个满足条件的结果'},
    en:{search:'Search functions',empty:'No matching functions',condition:'Conditions',math:'Numeric',stats:'Statistics',data:'Sets and conversion',other:'Other',single:'Conditional value',multiple:'Multiple branches',singleHint:'Choose between two values by a condition',multipleHint:'Use the first matching condition'},
  }})
  const query=ref('')
  const groups=computed(()=>{
    const categories=[{id:'math',icon:'FunctionOutlined',items:props.functions.filter(fn=>fn.id.startsWith('math.'))},{id:'stats',icon:'BarChartOutlined',items:props.functions.filter(fn=>fn.id.startsWith('stats.'))},{id:'data',icon:'GroupOutlined',items:props.functions.filter(fn=>fn.id.startsWith('data.'))},{id:'other',icon:'FunctionOutlined',items:props.functions.filter(fn=>!['math.','stats.','data.'].some(prefix=>fn.id.startsWith(prefix)))}]
    const search=query.value.trim().toLocaleLowerCase()
    return categories.map(group=>({...group,label:t(group.id),items:group.items.filter(item=>`${item.name} ${item.id} ${item.description}`.toLocaleLowerCase().includes(search))})).filter(group=>group.items.length)
  })
  const first=computed(()=>groups.value.flatMap(group=>group.items).find(item=>!item.disabled))
  return {t,query,groups,first}
}

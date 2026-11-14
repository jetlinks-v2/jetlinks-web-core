import { computed,ref } from 'vue'

export interface ExpressionCandidate {id:string|number;name:string;description?:string;icon?:string;disabled?:boolean}
export interface CandidateGroup {id:string;label?:string;icon?:string;items:ExpressionCandidate[]}

/** All formula candidates share one search surface; their owning editor supplies groups and applicability. */
export function useExpressionCandidateMenu(props:{groups:CandidateGroup[]}) {
  const query=ref('')
  const groups=computed(()=>{
    const search=query.value.trim().toLocaleLowerCase()
    return props.groups.map(group=>({...group,items:group.items.filter(item=>`${item.name} ${item.id} ${item.description || ''}`.toLocaleLowerCase().includes(search))})).filter(group=>group.items.length)
  })
  const first=computed(()=>groups.value.flatMap(group=>group.items).find(item=>!item.disabled))
  return {query,groups,first}
}

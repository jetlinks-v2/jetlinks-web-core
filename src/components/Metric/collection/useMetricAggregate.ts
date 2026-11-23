import { computed,onActivated,onDeactivated,onScopeDispose,ref,watch,type Ref } from 'vue'
import { metricApi } from '../api'
import { errorText } from '../service'
import type { MetricApi,MetricContext } from '../types'
import type { MetricAggregateResult,MetricAggregateScope } from './types'

/** One bounded scope request, no device fan-out. Keep existing charts mounted while refreshing. */
export function useMetricAggregate(context:Ref<MetricContext>,scope:Ref<MetricAggregateScope>,api:MetricApi=metricApi) {
  const result=ref<MetricAggregateResult>(),error=ref(''),loading=ref(false),range=ref(3600000),customRange=ref<[number,number]>(),descendants=ref(true)
  const directory=computed(()=>result.value?.groups),selectedTemplates=ref<string[]>()
  const preferenceKey=()=>context.value.preferenceScope ? 'metric-aggregate:'+JSON.stringify([context.value.preferenceScope,context.value.ownerType,context.value.ownerId,scope.value.memberType,...(scope.value.kind==='linked' ? ['linked'] : [])]) : undefined
  function restoreTemplates(groups:Array<{templateId:string}>) {
    const allowed=new Set(groups.map(item=>item.templateId))
    try {const key=preferenceKey(),saved=key ? JSON.parse(localStorage.getItem(key) || 'null') : null
      selectedTemplates.value=Array.isArray(saved) ? [...new Set(saved.filter(id=>typeof id==='string' && allowed.has(id)))].slice(0,128) : undefined
      if(!selectedTemplates.value?.length)selectedTemplates.value=undefined
    } catch {selectedTemplates.value=undefined}
  }
  function selectTemplates(ids?:string[]) {
    const allowed=new Set(directory.value?.map(item=>item.templateId) || result.value?.groups.map(item=>item.templateId))
    selectedTemplates.value=ids?.filter(id=>allowed.has(id)).slice(0,128)
    if(!selectedTemplates.value?.length)selectedTemplates.value=undefined
    try {const key=preferenceKey();if(key)localStorage.setItem(key,JSON.stringify(selectedTemplates.value || null))} catch { /* Optional preference storage. */ }
    // 统计已返回该范围的有界分组，筛选只改变卡片，不再扫描成员目录。
  }
  let epoch=0,running=false,pending=false,active=true,disposed=false,timer:ReturnType<typeof setTimeout> | undefined
  const visibleGroups=ref(new Set<string>()),elements=new Map<string,Element>()
  const observer=typeof IntersectionObserver==='undefined' ? undefined : new IntersectionObserver(changes=>{
    const next=new Set(visibleGroups.value)
    for(const change of changes){const id=[...elements].find(([,element])=>element===change.target)?.[0];if(id)change.isIntersecting ? next.add(id) : next.delete(id)}
    visibleGroups.value=next
  },{rootMargin:'160px'})
  function observe(id:string,element:Element | null){
    const previous=elements.get(id);if(previous===element)return
    if(previous)observer?.unobserve(previous)
    elements.delete(id)
    if(element){elements.set(id,element);observer?.observe(element)}
  }
  const visible=()=>active && !disposed && (typeof document==='undefined' || !document.hidden)
  function schedule(delay=15000) { if(timer)clearTimeout(timer);timer=undefined;if(visible())timer=setTimeout(()=>{void refresh()},delay) }
  async function refresh() {
    if(!visible())return
    if(running){pending=true;return}
    running=true;loading.value=true
    const current=epoch,to=customRange.value?.[1] ?? Date.now(),from=customRange.value?.[0] ?? to-range.value
    try {
      const linked=scope.value.kind==='linked'
      const depth=scope.value.tree && descendants.value ? 'descendants' : scope.value.tree && scope.value.memberType===context.value.ownerType ? 'children' : 'self'
      const interval=Math.max(1000,Math.ceil((to-from)/120))
      const data=linked
        ? await api.aggregateLinked!({objectType:context.value.ownerType,objectId:context.value.ownerId,targetType:scope.value.memberType,from,to,interval})
        : await api.aggregate!({rootType:context.value.ownerType,rootId:context.value.ownerId,memberType:scope.value.memberType,
          depth,from,to,interval})
      if(current===epoch && !disposed){
        {
          if(!result.value)restoreTemplates(data.groups)
          else if(selectedTemplates.value){
            const allowed=new Set(data.groups.map(item=>item.templateId))
            selectedTemplates.value=selectedTemplates.value.filter(id=>allowed.has(id))
            if(!selectedTemplates.value.length)selectedTemplates.value=undefined
          }
        }
        result.value=data;error.value=''
      }
    } catch(cause){if(current===epoch && !disposed){
      error.value=errorText(cause)
      // 撤权后清掉已读内容；普通网络失败保留上次结果并由页面标注。
      const failure=cause as {status?:number;response?:{status?:number}} | undefined
      if([401,403].includes(failure?.response?.status ?? failure?.status ?? 0)){result.value=undefined}
    }}
    finally {running=false;if(!disposed){loading.value=false;const queued=pending;pending=false;schedule(queued ? 0 : 15000)}}
  }
  watch(()=>JSON.stringify([context.value.preferenceScope,context.value.ownerType,context.value.ownerId,scope.value.kind,scope.value.memberType,scope.value.tree,descendants.value]),()=>{selectedTemplates.value=undefined})
  watch(()=>JSON.stringify([context.value.preferenceScope,context.value.ownerType,context.value.ownerId,scope.value.kind,scope.value.memberType,scope.value.tree,range.value,customRange.value,descendants.value]),()=>{
    epoch++;result.value=undefined;error.value='';schedule(0)
  },{immediate:true})
  const visibility=()=>{if(visible())schedule(0);else if(timer)clearTimeout(timer)}
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibility)
  onActivated(()=>{active=true;schedule(0)})
  onDeactivated(()=>{active=false;epoch++;pending=false;loading.value=false;if(timer)clearTimeout(timer)})
  onScopeDispose(()=>{disposed=true;epoch++;observer?.disconnect();if(timer)clearTimeout(timer);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility)})
  return {result,directory,selectedTemplates,selectTemplates,error,loading,range,customRange,descendants,refresh,observe,isVisible:(id:string)=>!observer || visibleGroups.value.has(id)}
}

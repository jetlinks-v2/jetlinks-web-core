import { onActivated,onDeactivated,onScopeDispose,ref,watch,type Ref } from 'vue'
import { metricApi } from '../api'
import { errorText } from '../service'
import type { MetricApi,MetricContext } from '../types'
import type { MetricAggregateResult,MetricReadScopeOption } from './types'

/** One bounded scope request, no device fan-out. Keep existing charts mounted while refreshing. */
export function useMetricAggregate(context:Ref<MetricContext>,scope:Ref<MetricReadScopeOption>,api:MetricApi=metricApi) {
  const result=ref<MetricAggregateResult>(),error=ref(''),loading=ref(false),range=ref(3600000),customRange=ref<[number,number]>(),descendants=ref(true)
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
      if(!api.aggregate)throw new Error('Metric aggregation unavailable')
      const data=await api.aggregate({rootType:context.value.ownerType,rootId:context.value.ownerId,memberType:scope.value.memberType,
        depth:descendants.value ? 'descendants' : scope.value.memberType===context.value.ownerType ? 'children' : 'self',from,to,interval:Math.max(1000,Math.ceil((to-from)/120))})
      if(current===epoch && !disposed){result.value=data;error.value=''}
    } catch(cause){if(current===epoch && !disposed)error.value=errorText(cause)}
    finally {running=false;if(!disposed){loading.value=false;const queued=pending;pending=false;schedule(queued ? 0 : 15000)}}
  }
  watch(()=>JSON.stringify([context.value.ownerType,context.value.ownerId,scope.value.memberType,range.value,customRange.value,descendants.value]),()=>{
    epoch++;result.value=undefined;error.value='';schedule(0)
  },{immediate:true})
  const visibility=()=>{if(visible())schedule(0);else if(timer)clearTimeout(timer)}
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibility)
  onActivated(()=>{active=true;schedule(0)})
  onDeactivated(()=>{active=false;if(timer)clearTimeout(timer)})
  onScopeDispose(()=>{disposed=true;epoch++;observer?.disconnect();if(timer)clearTimeout(timer);if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility)})
  return {result,error,loading,range,customRange,descendants,refresh,observe,isVisible:(id:string)=>!observer || visibleGroups.value.has(id)}
}

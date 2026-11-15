import {computed,onScopeDispose,ref,watch,type Ref} from 'vue'
import {useDiagnosticQuery} from '../../../hooks/useDiagnosticQuery'
import {metricApi} from '../api'
import {errorText} from '../service'
import {collectMetricResources} from '../extensions/registry'
import type {MetricApi,MetricContext,MetricObjectBindingPage,MetricSourcePicker} from '../types'
import type {MetricAggregateResult} from '../collection/types'

/** 对象切换使旧请求失效；关联写入原宿主，汇总只发一个有界数据库请求。 */
export function useMetricBindings(context:Ref<MetricContext>,picker:Ref<MetricSourcePicker | undefined>,api:MetricApi=metricApi) {
  const page=useDiagnosticQuery<MetricObjectBindingPage>(),aggregate=useDiagnosticQuery<MetricAggregateResult>()
  const busy=ref(false),mutationError=ref(''),targetType=ref(''),range=ref(3600000),customRange=ref<[number,number]>()
  const key=computed(()=>JSON.stringify([context.value.ownerType,context.value.ownerId]))
  const types=computed(()=>[...new Set([...(page.data.value?.items.map(item=>item.reference.targetType) || []),
    ...(context.value.readScopes?.map(scope=>scope.memberType) || []),
    ...collectMetricResources().dimensions.map(item=>item.provider.ownerType)])])
  async function refresh(cursor?:string) {
    const owner={...context.value},previous=cursor ? page.data.value?.items || [] : []
    await page.run(async()=>{
      const value=await api.objectBindings!(owner.ownerType,owner.ownerId,cursor)
      return {...value,items:[...previous,...value.items]}
    },!!owner.ownerId)
  }
  async function summarize() {
    const owner={...context.value},type=targetType.value,to=customRange.value?.[1] ?? Date.now(),from=customRange.value?.[0] ?? to-range.value
    await aggregate.run(()=>api.aggregateLinked!({objectType:owner.ownerType,objectId:owner.ownerId,targetType:type,from,to,
      interval:Math.max(1000,Math.ceil((to-from)/120))}),!!type)
  }
  async function add(invalidMessage:string) {
    if (!picker.value || busy.value) return
    const current=key.value,owner={...context.value}
    const selected=await picker.value({context:{...owner,targetType:owner.ownerType,targetId:owner.ownerId,scope:'single'},purpose:'reference',
      input:{id:'metric',source:{kind:'metric'}},hint:{sources:['metric']}})
    if (!selected || current!==key.value) return
    const value=selected.mapping
    if (value.kind!=='metric' || !value.configId || !value.id || !value.thingType || !value.thingId || value.thingId==='*') {
      mutationError.value=invalidMessage; return
    }
    await mutate(()=>api.bindObjectMetric!({objectType:owner.ownerType,objectId:owner.ownerId,configId:value.configId!,
      outputId:value.id,targetType:value.thingType!,targetId:value.thingId!}),current)
  }
  async function mutate(action:()=>Promise<unknown>,current=key.value) {
    if (busy.value) return
    busy.value=true;mutationError.value=''
    try {await action();if(current===key.value)await refresh()}
    catch(error){if(current===key.value)mutationError.value=errorText(error)}
    finally {busy.value=false}
  }
  function remove(id:string) {
    const owner={...context.value}
    return mutate(()=>api.unbindObjectMetric!(owner.ownerType,owner.ownerId,id))
  }
  watch(key,()=>{picker.value?.cancel?.();page.clear();aggregate.clear();targetType.value='';mutationError.value='';void refresh()},{immediate:true})
  watch(types,values=>{if(!values.includes(targetType.value))targetType.value=values[0] || ''})
  watch([targetType,range,customRange],()=>{aggregate.clear();if(targetType.value)void summarize()})
  onScopeDispose(()=>picker.value?.cancel?.())
  return {page,aggregate,busy,mutationError,targetType,types,range,customRange,refresh,summarize,add,remove}
}

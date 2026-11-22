import { computed, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue'
import { objectCapabilitiesApi } from '../../object-capability/api'
import { objectMembers } from '../../object-capability/metadata'
import { useDataCapabilityRequest, getDataCapabilityRequest } from '../../data-capability/request'
import type { ObjectFunctionMetadata } from '../../object-capability/types'
import type { MetricConfig, MetricTemplate } from '../Metric/types'
import type { ProcessMember, ProcessObject } from './types'

export function useProcessMembers(object: Readonly<Ref<ProcessObject | undefined>>) {
  const request = useDataCapabilityRequest(), members = shallowRef<ProcessMember[]>([]), loading = ref(false), error = ref(''), nextCursor = ref<string>()
  const http = getDataCapabilityRequest({request})
  let generation = 0, controller = new AbortController()
  async function metrics(current: ProcessObject, cursor: string | undefined, token: number) {
    const response = await objectCapabilitiesApi({ request }).command(current, 'metrics', 'QueryObjectMetricOutputs', {cursor}, true, controller.signal)
    const page = response[0] as {items: {configId:string;name:string;state:string;template:MetricTemplate;outputs:string[]}[];nextCursor?:string} | undefined
    if (token !== generation) return
    nextCursor.value = page?.nextCursor
    const additions: ProcessMember[] = []
    for (const item of page?.items || []) if (item.state === 'enabled') for (const id of item.outputs) {
      const output = item.template.outputs.find(output => (output.property || output.metricId) === id)
      if (!output) continue
      additions.push({ref:{type:current.type,providerId:`metric:${item.configId}`,kind:'metric',id},name:output.label || id,sourceName:item.name,
        metadata:{id,output:{type:output.valueType || 'double'}},source:{provider:'metric-results',sourceType:'metric',configuration:{configId:item.configId}}})
    }
    members.value = [...members.value,...additions]
  }
  async function load() {
    const token = ++generation; controller.abort(); controller = new AbortController(); members.value = []; error.value = ''; nextCursor.value = undefined
    if (!object.value) { loading.value = false; return }
    loading.value = true
    try {
      const current = object.value, rows = await objectCapabilitiesApi({ request }).models(current.type, current.id === '$subject' ? undefined : current.id, controller.signal)
      if (token !== generation) return
      members.value = objectMembers(current.type, rows)
      for (const row of rows) for (const raw of row.metadata.events || []) {
        const event = raw as {id:string;name?:string;valueType?:Record<string,unknown>;type?:Record<string,unknown>;expands?:Record<string,unknown>}
        members.value.push({ref:{type:current.type,providerId:row.providerId,kind:'event',id:event.id},name:event.name || event.id,sourceName:row.name,
          metadata:{id:event.id,output:event.valueType || event.type,expands:event.expands} as ObjectFunctionMetadata})
      }
      if (current.id !== '$subject' && rows.some(row => row.providerId === 'metrics')) await metrics(current, undefined, token)
    } catch (cause) { if (token === generation) error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { if (token === generation) loading.value = false }
  }
  async function more() {
    if (!object.value || !nextCursor.value || loading.value) return
    loading.value = true; error.value = ''; const token = generation
    try { await metrics(object.value,nextCursor.value,token) }
    catch (cause) { if (token === generation) error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { if (token === generation) loading.value = false }
  }
  async function resolve(member: ProcessMember): Promise<ProcessMember | undefined> {
    if (!member.source || !object.value) return member
    const token = generation, current = object.value, configId = String(member.source.configuration.configId)
    const response = await http.get<MetricConfig>(`/metric/configs/${encodeURIComponent(configId)}`, {targetType:current.type,targetId:current.id}, {signal:controller.signal,hiddenError:true})
    if (token !== generation) return
    if (response.status !== 200) throw new Error(String(response.status))
    return {...member,source:{...member.source,configuration:{...member.source.configuration,dataVersion:response.result.dataVersion}}}
  }
  watch(() => JSON.stringify(object.value), load, { immediate: true })
  onBeforeUnmount(() => { generation++; controller.abort() })
  return { members: computed(() => members.value), loading, error, load, more, nextCursor, resolve }
}

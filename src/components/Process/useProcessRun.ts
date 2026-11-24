import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import type { ProcessApi, ProcessHistory, ProcessOperation, ProcessRun } from './types'
import { processId } from './model'
export function useProcessRun(id: Readonly<Ref<string>>, api: ProcessApi) {
  const run = shallowRef<ProcessRun>(), history = shallowRef<ProcessHistory[]>([]), operations = shallowRef<ProcessOperation[]>([])
  const loading = ref(false), error = ref(''), historyPage = ref(0), operationPage = ref(0), moreHistory = ref(false), moreOperations = ref(false)
  let generation = 0
  let resumeRequest = ''
  const resuming = ref(false)
  const resolution = ref<{operationId:string;decision:'completed' | 'rejected';reason:string}>(), resolving = ref(false)
  const resolutionRequests = new Map<string,string>()
  function beginResolution(operationId:string) { resolution.value = {operationId,decision:'completed',reason:''} }
  async function resolve() {
    const value = resolution.value
    if (!value?.reason.trim() || resolving.value) return
    const current = id.value, token = generation, key = JSON.stringify([current,value])
    const request = resolutionRequests.get(key) || processId(); resolutionRequests.set(key,request)
    resolving.value = true; error.value = ''
    try {
      await api.resolve(current,value.operationId,request,value.decision,value.reason)
      if (token === generation) { resolutionRequests.delete(key); resolution.value = undefined; await load() }
    } catch (cause) { if (token === generation) error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { resolving.value = false }
  }
  async function resume() {
    if (resuming.value) return
    const current = id.value, token = generation
    resumeRequest ||= processId(); resuming.value = true; error.value = ''
    try { await api.resume(current,resumeRequest); if (token === generation) { resumeRequest = ''; await load() } }
    catch (cause) { if (token === generation) error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { resuming.value = false }
  }
  async function load() {
    const token = ++generation; loading.value = true; error.value = ''; run.value = undefined; history.value = []; operations.value = []
    if (!id.value) { loading.value = false; return }
    try {
      const current = id.value, results = await Promise.allSettled([api.run(current),api.history(current,historyPage.value),api.operations(current,operationPage.value)])
      if (token !== generation) return
      const [execution,records,actions] = results
      if (execution.status === 'fulfilled') run.value = execution.value
      if (records.status === 'fulfilled') { moreHistory.value = records.value.length === 100; history.value = records.value.flatMap(item => JSON.parse(item.entriesJson) as ProcessHistory[]) }
      if (actions.status === 'fulfilled') { moreOperations.value = actions.value.length === 100; operations.value = actions.value }
      error.value = results.filter((item): item is PromiseRejectedResult => item.status === 'rejected').map(item => item.reason instanceof Error ? item.reason.message : String(item.reason)).join('; ')
    } catch (cause) { if (token === generation) error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { if (token === generation) loading.value = false }
  }
  watch(id, () => { resumeRequest = ''; resolution.value = undefined; resolutionRequests.clear(); historyPage.value = 0; operationPage.value = 0; void load() }, { immediate:true })
  watch([historyPage,operationPage], load)
  onBeforeUnmount(() => { generation++ })
  function operationName(operation: ProcessOperation): string {
    const prepared = JSON.parse(operation.preparedJson) as {action:{capability:string}}
    return prepared.action.capability
  }
  return {run,history,operations,loading,error,historyPage,operationPage,moreHistory,moreOperations,load,operationName,resume,resuming,resolution,resolving,beginResolution,resolve}
}

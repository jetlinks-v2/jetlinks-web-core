import { ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import type { ProcessApi, ProcessHistory, ProcessOperation, ProcessRun } from './types'
export function useProcessRun(id: Readonly<Ref<string>>, api: ProcessApi) {
  const run = shallowRef<ProcessRun>(), history = shallowRef<ProcessHistory[]>([]), operations = shallowRef<ProcessOperation[]>([])
  const loading = ref(false), error = ref(''), historyPage = ref(0), operationPage = ref(0), moreHistory = ref(false), moreOperations = ref(false)
  let generation = 0
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
  watch(id, () => { historyPage.value = 0; operationPage.value = 0; void load() }, { immediate:true })
  watch([historyPage,operationPage], load)
  onBeforeUnmount(() => { generation++ })
  function operationName(operation: ProcessOperation): string {
    const prepared = JSON.parse(operation.preparedJson) as {action:{capability:string}}
    return prepared.action.capability
  }
  return {run,history,operations,loading,error,historyPage,operationPage,moreHistory,moreOperations,load,operationName}
}

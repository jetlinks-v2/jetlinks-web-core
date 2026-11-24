import { computed, ref, shallowRef, watch, onBeforeUnmount, type Ref } from 'vue'
import type { ProcessApi, ProcessAssignment, ProcessBinding, ProcessConfigEntity, ProcessObject, ProcessRunRow, ProcessTemplate, ProcessTemplateEntity } from './types'
import { copyProcess, processId, readProcessTemplate } from './model'

export function useProcessManagement(object: Readonly<Ref<ProcessObject | undefined>>, api: ProcessApi) {
  const configurations = shallowRef<ProcessConfigEntity[]>([]), assignments = shallowRef<ProcessAssignment[]>([]), runs = shallowRef<ProcessRunRow[]>([])
  const page = ref(0), total = ref(0), runPage = ref(0), assignmentCursor = ref<string>(), moreAssignments = ref(false)
  const loading = ref(false), busy = ref(false), error = ref(''), binding = shallowRef<ProcessBinding>(), template = shallowRef<ProcessTemplate>()
  const editorOpen = ref(false), templateOpen = ref(false), templates = shallowRef<ProcessTemplateEntity[]>([]), templatePage = ref(0), templateTotal = ref(0)
  const runId = ref(''), selectedTemplate = ref('')
  const complete = computed(() => !!binding.value && !!template.value && !!binding.value.slot.trim()
    && Object.keys(template.value.inputs).every(id => !!binding.value?.inputs[id]) && Object.keys(template.value.actions).every(id => !!binding.value?.actions[id]))
  const requests = new Map<string, string>()
  let generation = 0, disposed = false, editorGeneration = 0
  const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
  async function load() {
    const current = object.value, token = ++generation; error.value = ''; configurations.value = []; assignments.value = []; runs.value = []
    if (!current) { loading.value = false; return }
    loading.value = true
    try {
      const results = await Promise.allSettled([api.configurations(current,page.value),api.assignments(current,assignmentCursor.value),api.runs(current,runPage.value)])
      if (disposed || token !== generation) return
      const [configs,effective,executions] = results
      if (configs.status === 'fulfilled') { configurations.value = configs.value.data; total.value = configs.value.total }
      if (effective.status === 'fulfilled') { assignments.value = effective.value; moreAssignments.value = effective.value.length === 50 }
      if (executions.status === 'fulfilled') runs.value = executions.value
      error.value = results.filter((item): item is PromiseRejectedResult => item.status === 'rejected').map(item => message(item.reason)).join('; ')
    } finally { if (!disposed && token === generation) loading.value = false }
  }
  async function listTemplates() {
    busy.value = true; error.value = ''
    try { const result = await api.templates(templatePage.value,true); if (!disposed) { templates.value = result.data; templateTotal.value = result.total; templateOpen.value = true } }
    catch (cause) { if (!disposed) error.value = message(cause) }
    finally { if (!disposed) busy.value = false }
  }
  function useTemplate(row: ProcessTemplateEntity) {
    const current = object.value
    if (!current) return
    editorGeneration++; template.value = readProcessTemplate(row); selectedTemplate.value = row.id
    binding.value = {id:processId(),owner:{type:current.type,id:current.id},slot:'',revision:0,generation:1,application:'self',priority:0,enabled:true,
      templateId:row.templateId,templateVersion:row.version,parameters:{},inputs:{},actions:{}}
    templateOpen.value = false; editorOpen.value = true
  }
  async function edit(row: ProcessConfigEntity) {
    const token = ++editorGeneration; busy.value = true; error.value = ''
    try {
      const next = JSON.parse(row.bindingJson) as ProcessBinding
      const found = await api.resolveTemplate(next.templateId,next.templateVersion)
      if (token === editorGeneration && !disposed) { binding.value = next; template.value = readProcessTemplate(found); editorOpen.value = true }
    } catch (cause) { if (token === editorGeneration && !disposed) error.value = message(cause) }
    finally { if (!disposed) busy.value = false }
  }
  async function mutate(action: () => Promise<unknown>) {
    if (busy.value) return
    const token = generation; busy.value = true; error.value = ''
    try { const result = await action(); if (!disposed && token === generation) await load(); return {result} }
    catch (cause) { if (!disposed && token === generation) error.value = message(cause) }
    finally { if (!disposed) busy.value = false }
  }
  async function save() {
    if (!binding.value || !complete.value) return
    const value = copyProcess(binding.value), token = editorGeneration
    const result = await mutate(() => api.saveBinding(value,value.revision))
    if (result && token === editorGeneration && !disposed) editorOpen.value = false
  }
  const remove = (row: ProcessConfigEntity) => mutate(() => api.removeBinding(row.id,row.revision))
  async function execute(kind: 'start' | 'stop' | 'reconcile', id: string) {
    const current = object.value
    if (!current) return
    const key = JSON.stringify([current.type,current.id,kind,id]), requestId = requests.get(key) || processId(); requests.set(key,requestId)
    const result = await mutate(() => kind === 'start' ? api.start(current,id,requestId) : api[kind](id,requestId))
    if (result) { requests.delete(key); if (kind === 'start' && object.value?.type === current.type && object.value.id === current.id) runId.value = (result.result as {runId:string}).runId }
  }
  watch(() => JSON.stringify(object.value), () => { editorGeneration++; page.value = 0; runPage.value = 0; assignmentCursor.value = undefined; editorOpen.value = false; runId.value = ''; templateOpen.value = false; void load() },{immediate:true})
  onBeforeUnmount(() => { disposed = true; generation++; editorGeneration++ })
  return {configurations,assignments,runs,page,total,runPage,assignmentCursor,moreAssignments,loading,busy,error,binding,template,editorOpen,templateOpen,templates,templatePage,templateTotal,runId,selectedTemplate,complete,load,listTemplates,useTemplate,edit,save,remove,execute}
}

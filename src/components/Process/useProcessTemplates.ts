import { computed, ref, shallowRef, onBeforeUnmount } from 'vue'
import type { ProcessApi, ProcessTemplate, ProcessTemplateEntity } from './types'
import { copyProcess, newProcess, readProcessTemplate } from './model'

export function useProcessTemplates(api: ProcessApi) {
  const rows = shallowRef<ProcessTemplateEntity[]>([]), total = ref(0), page = ref(0), loading = ref(false), busy = ref(false), error = ref('')
  const selected = shallowRef<ProcessTemplateEntity>(), draft = shallowRef<ProcessTemplate>(), baseline = ref(''), simulationOpen = ref(false)
  const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value)
  let generation = 0, editorGeneration = 0, disposed = false
  const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)
  async function load() {
    const token = ++generation; loading.value = true; error.value = ''
    try { const data = await api.templates(page.value); if (!disposed && token === generation) { rows.value = data.data; total.value = data.total } }
    catch (cause) { if (!disposed && token === generation) error.value = message(cause) }
    finally { if (!disposed && token === generation) loading.value = false }
  }
  function open(row: ProcessTemplateEntity) { editorGeneration++; selected.value = row; draft.value = readProcessTemplate(row); baseline.value = JSON.stringify(draft.value); error.value = '' }
  function create() { editorGeneration++; selected.value = undefined; draft.value = newProcess(); baseline.value = JSON.stringify(draft.value); error.value = '' }
  function close() {
    if (busy.value) return
    editorGeneration++; draft.value = undefined; selected.value = undefined; baseline.value = ''; simulationOpen.value = false; error.value = ''
  }
  function newVersion() {
    if (!draft.value) return
    editorGeneration++; selected.value = undefined; draft.value = { ...copyProcess(draft.value), version: `${draft.value.version}-next` }; baseline.value = ''; error.value = ''
  }
  async function action(kind: 'save' | 'publish' | 'validate') {
    if (!draft.value || busy.value) return
    const token = editorGeneration; busy.value = true; error.value = ''
    try {
      if (kind === 'validate') await api.validate(copyProcess(draft.value))
      else {
        let row = selected.value
        if (!row?.published && (dirty.value || !row)) row = await api.saveTemplate(copyProcess(draft.value), row?.revision || 0)
        if (kind === 'publish' && row && !row.published) row = await api.publish(row.id, row.revision)
        if (!disposed && token === editorGeneration && row) open(row)
        await load()
      }
      return true
    } catch (cause) { if (!disposed && token === editorGeneration) error.value = message(cause); return false }
    finally { if (!disposed) busy.value = false }
  }
  onBeforeUnmount(() => { disposed = true; generation++; editorGeneration++ })
  void load()
  return { rows, total, page, loading, busy, error, selected, draft, dirty, simulationOpen, load, open, create, close, newVersion, action }
}

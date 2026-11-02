import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { metricApi } from './api'
import { copy, createConfig, editableParameters, errorText, MetricActivationError, parameterOverrides, saveAndActivate, templateKey } from './service'
import { useMetricPresentation } from './extensions/useMetricPresentation'
import { normalizePresentation } from './extensions/presentationSettings'
import type { MetricApi, MetricConfig, MetricContext, MetricSourcePicker, MetricTemplateEntity, MetricTemplateInput } from './types'

export function useMetricEditor(
  context: Ref<MetricContext>, initial: Ref<MetricConfig | undefined>,
  picker: Ref<MetricSourcePicker | undefined>, api: MetricApi = metricApi
) {
  const draft = ref<MetricConfig>(copy(initial.value || createConfig(context.value)))
  const templates = ref<MetricTemplateEntity[]>([])
  const step = ref(initial.value ? 1 : 0)
  const loading = ref(false)
  const saving = ref(false)
  const choosing = ref('')
  const error = ref('')
  const errorKind = ref<'load' | 'save' | 'activation' | 'binding' | 'presentation' | ''>('')
  const sourceLabels = ref<Record<string, string>>({})
  const savedSnapshot = ref<MetricConfig>()
  const snapshotLoading = ref(false)
  const selectedTemplate = computed(() => templates.value.find(item =>
    item.template.id === draft.value.templateId && item.template.version === draft.value.templateVersion)?.template)
  const parameters = computed(() => editableParameters(selectedTemplate.value))
  const presentation = useMetricPresentation(selectedTemplate, draft)
  const extensionFailed = ref(false)
  watch(presentation.provider, () => { extensionFailed.value = false })
  const templateSelection = computed({
    get: () => draft.value.templateId ? templateKey({ id: draft.value.templateId, version: draft.value.templateVersion }) : undefined,
    set: (key: string | undefined) => {
      if (!key) return
      const template = templates.value.find(item => templateKey(item.template) === key)?.template
      if (!template) return
      draft.value = { ...draft.value, templateId: template.id, templateVersion: template.version,
        inputMappings: {}, parameters: {} }
      sourceLabels.value = {}
    }
  })
  let generation = 0
  async function load() {
    const token = ++generation
    loading.value = true
    error.value = ''
    try {
      const config = draft.value
      const [catalog, fixed] = await Promise.allSettled([
        api.selectable(), config.id ? api.configTemplate(config.id) : Promise.resolve(undefined)
      ])
      const list = catalog.status === 'fulfilled' ? catalog.value : []
      if (config.id && fixed.status === 'rejected') throw fixed.reason
      if (fixed.status === 'fulfilled' && fixed.value && !list.some(item => item.template.id === config.templateId && item.template.version === config.templateVersion)) {
        list.unshift({ id: config.id!, name: fixed.value.name, available: false, released: true, template: fixed.value })
      }
      if (catalog.status === 'rejected' && !list.length) throw catalog.reason
      if (token === generation) templates.value = list
    } catch (cause) { if (token === generation) { error.value = errorText(cause); errorKind.value = 'load' } }
    finally { if (token === generation) loading.value = false }
  }
  async function choose(input: MetricTemplateInput) {
    if (!context.value.editable || !picker.value) return
    choosing.value = input.id
    error.value = ''
    try {
      const token = generation
      const version = templateKey({ id: draft.value.templateId, version: draft.value.templateVersion })
      const selection = await picker.value({ context: context.value, input, mapping: draft.value.inputMappings[input.id] })
      if (context.value.editable && selection && token === generation && version === templateKey({ id: draft.value.templateId, version: draft.value.templateVersion })) {
        draft.value.inputMappings[input.id] = copy(selection.mapping)
        sourceLabels.value[input.id] = selection.label || ''
      }
    } catch (cause) { error.value = errorText(cause) }
    finally { choosing.value = '' }
  }
  async function readSaved() {
    if (!draft.value.id) return
    snapshotLoading.value = true
    try { savedSnapshot.value = await api.getConfig(draft.value.id) }
    catch (cause) { error.value = errorText(cause) }
    finally { snapshotLoading.value = false }
  }
  function useSaved() {
    if (!savedSnapshot.value) return
    draft.value = copy(savedSnapshot.value)
    savedSnapshot.value = undefined
    error.value = ''
    errorKind.value = ''
    sourceLabels.value = {}
    void load()
  }
  function bindingsReady() {
    return selectedTemplate.value?.inputDefinitions.every(input => !!draft.value.inputMappings[input.id])
  }
  function next() {
    error.value = ''
    if (!selectedTemplate.value) { errorKind.value = 'binding'; return false }
    if (step.value === 1 && !bindingsReady()) { errorKind.value = 'binding'; return false }
    errorKind.value = ''
    step.value = Math.min(3, step.value + 1)
    return true
  }
  async function save(activate: boolean): Promise<MetricConfig | undefined> {
    if (!context.value.editable || saving.value) return
    const template = selectedTemplate.value
    if (!template || !bindingsReady()) { errorKind.value = 'binding'; return }
    if (presentation.missing.value || extensionFailed.value) { errorKind.value = 'presentation'; return }
    saving.value = true
    error.value = ''
    errorKind.value = ''
    try {
      const saved = await saveAndActivate(api, {
        ...copy(draft.value), parameters: parameterOverrides(template, draft.value.parameters), presentation: normalizePresentation(draft.value.presentation)
      }, activate)
      draft.value = saved
      return saved
    } catch (cause) {
      if (cause instanceof MetricActivationError) {
        draft.value = cause.configuration
        errorKind.value = 'activation'
      } else errorKind.value = 'save'
      error.value = errorText(cause)
    } finally { saving.value = false }
  }
  watch(initial, value => { draft.value = copy(value || createConfig(context.value)); step.value = value ? 1 : 0; void load() }, { immediate: true })
  onScopeDispose(() => { generation++ })
  return { draft, templates, selectedTemplate, templateSelection, parameters, step, loading, saving, choosing,
    error, errorKind, sourceLabels, savedSnapshot, snapshotLoading, presentation, extensionFailed, load, choose, next, save, readSaved, useSaved }
}

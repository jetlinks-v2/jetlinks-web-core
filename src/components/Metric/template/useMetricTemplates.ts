import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { metricApi } from '../api'
import { copy, errorText } from '../service'
import { configurationObject, encodeConfiguration, type ConfigurationFormat } from './configurationText'
import type { MetricApi, MetricConfig, MetricSimulationRequest, MetricSimulationResponse, MetricTemplate, MetricTemplateEntity } from '../types'

const emptyTemplate = (): MetricTemplate => ({
  id: '', version: '1', name: '', enabled: true, inputDefinitions: [], parameterDefinitions: [],
  parameters: {}, definitions: [], outputs: [], options: {}
})
export function useMetricTemplates(editable: Ref<boolean>, api: MetricApi = metricApi) {
  const entities = ref<MetricTemplateEntity[]>([])
  const total = ref(0)
  const page = ref(1)
  const selected = ref<MetricTemplateEntity>()
  const draft = ref<MetricTemplate>()
  const mode = ref<'form' | 'full'>('form')
  const format = ref<ConfigurationFormat>('yaml')
  const fullText = ref('')
  const simulationText = ref('')
  const simulationResponse = ref<MetricSimulationResponse>()
  const simulationResults = computed(() => simulationResponse.value?.results || [])
  const error = ref('')
  const simulationError = ref('')
  const loading = ref(false)
  const saving = ref(false)
  const simulating = ref(false)
  const savedText = ref('')
  const readOnly = computed(() => !editable.value || selected.value?.released === true)
  const hasChanges = computed(() => {
    if (!draft.value || readOnly.value) return false
    try { return JSON.stringify(prepared()) !== savedText.value }
    catch { return true }
  })
  let generation = 0
  let simulationGeneration = 0
  // 规则或样本变化即作废旧结果，也截断已发出的试算响应。
  function invalidateSimulation() {
    simulationGeneration++
    simulationResponse.value = undefined
    simulationError.value = ''
    simulating.value = false
  }
  watch([draft, fullText, simulationText, editable], invalidateSimulation, { deep: true, flush: 'sync' })
  async function load() {
    const token = ++generation
    loading.value = true
    error.value = ''
    try {
      const result = await api.queryTemplates({ pageIndex: page.value - 1, pageSize: 20, sorts: [{ name: 'modifyTime', order: 'desc' }] })
      if (token === generation) { entities.value = result.data; total.value = result.total }
    } catch (cause) { if (token === generation) error.value = errorText(cause) }
    finally { if (token === generation) loading.value = false }
  }
  function open(entity?: MetricTemplateEntity) {
    if (saving.value) return
    simulationGeneration++
    simulating.value = false
    selected.value = entity ? copy(entity) : undefined
    draft.value = entity ? copy(entity.template) : emptyTemplate()
    fullText.value = encodeConfiguration(draft.value, format.value)
    savedText.value = JSON.stringify(draft.value)
    mode.value = 'form'
    error.value = ''
    simulationResponse.value = undefined
    simulationError.value = ''
    const template = draft.value
    const configuration: MetricConfig = {
      ownerType: 'simulation', ownerId: 'simulation', slot: 'simulation',
      targetType: template.thingType || 'simulation', targetId: 'simulation',
      templateId: template.id, templateVersion: template.version, state: 'disabled', revision: 0,
      inputMappings: {}, parameters: {}
    }
    simulationText.value = encodeConfiguration({ configuration, samples: [] }, format.value)
  }
  function prepared(): MetricTemplate {
    if (!draft.value) throw new Error('No template selected')
    if (mode.value === 'full') {
      const value = configurationObject(fullText.value, format.value)
      // 仅检查可视编辑需要的容器结构；计算语义仍由服务端编译。
      for (const key of ['inputDefinitions', 'parameterDefinitions', 'definitions', 'outputs']) {
        const items = value[key]
        if (items !== undefined && (!Array.isArray(items) || items.some(item => !item || typeof item !== 'object' || Array.isArray(item)))) {
          throw new Error(`${key} must be an array of objects`)
        }
      }
      if (value.parameters !== undefined && (!value.parameters || typeof value.parameters !== 'object' || Array.isArray(value.parameters))) throw new Error('parameters must be an object')
      const defaults: Record<string, unknown> = { id: '', version: '', name: '', inputDefinitions: [], parameterDefinitions: [], parameters: {}, definitions: [], outputs: [] }
      for (const key of Object.keys(defaults)) if (value[key] === undefined) value[key] = defaults[key]
      return value as unknown as MetricTemplate
    }
    return copy(draft.value)
  }
  function switchMode(next: 'form' | 'full') {
    if (next === mode.value) return
    try {
      draft.value = prepared()
      fullText.value = encodeConfiguration(draft.value, format.value)
      mode.value = next
      error.value = ''
    } catch (cause) { error.value = errorText(cause) }
  }
  function switchFormat(next: ConfigurationFormat) {
    if (next === format.value) return
    try {
      const template = prepared()
      const facts = configurationObject(simulationText.value, format.value)
      fullText.value = encodeConfiguration(template, next)
      simulationText.value = encodeConfiguration(facts, next)
      draft.value = template
      format.value = next
      error.value = ''
    } catch (cause) { error.value = errorText(cause) }
  }
  async function save(): Promise<MetricTemplateEntity | undefined> {
    if (readOnly.value || saving.value) return
    saving.value = true
    error.value = ''
    try {
      const entity = await api.saveTemplate(prepared())
      selected.value = entity
      draft.value = copy(entity.template)
      fullText.value = encodeConfiguration(entity.template, format.value)
      savedText.value = JSON.stringify(entity.template)
      await load()
      return entity
    } catch (cause) { error.value = errorText(cause) }
    finally { saving.value = false }
  }
  async function release() {
    if (readOnly.value || saving.value) return
    const entity = await save()
    if (!entity || readOnly.value) return
    saving.value = true
    try {
      await api.releaseTemplate(entity.id)
      selected.value = { ...entity, released: true }
      await load()
    } catch (cause) { error.value = errorText(cause) }
    finally { saving.value = false }
  }
  function newVersion() {
    if (!selected.value || !editable.value || saving.value) return
    const template = copy(selected.value.template)
    template.version = ''
    open({ ...selected.value, template, released: false })
    selected.value = undefined
  }
  async function setAvailable(available: boolean) {
    if (!selected.value || !editable.value || saving.value) return
    saving.value = true
    try { await api.setAvailable(selected.value.id, available); selected.value.available = available; await load() }
    catch (cause) { error.value = errorText(cause) }
    finally { saving.value = false }
  }
  async function removeDraft(): Promise<boolean> {
    if (readOnly.value || saving.value || !selected.value?.id) return false
    saving.value = true
    error.value = ''
    try {
      await api.removeTemplate(selected.value.id)
      selected.value = undefined
      draft.value = undefined
      simulationGeneration++
      simulationResponse.value = undefined
      await load()
      return true
    } catch (cause) { error.value = errorText(cause); return false }
    finally { saving.value = false }
  }
  async function simulate() {
    if (!editable.value) return
    const token = ++simulationGeneration
    simulating.value = true
    simulationError.value = ''
    simulationResponse.value = undefined
    try {
      const facts = configurationObject(simulationText.value, format.value)
      const response = await api.simulate({ ...facts, template: prepared(), includeIntermediate: true, includeRecords: true } as unknown as MetricSimulationRequest)
      if (token === simulationGeneration) {
        simulationResponse.value = response
        simulationError.value = response.error || ''
      }
    } catch (cause) { if (token === simulationGeneration) simulationError.value = errorText(cause) }
    finally { if (token === simulationGeneration) simulating.value = false }
  }
  onScopeDispose(() => { generation++; simulationGeneration++ })
  return { entities, total, page, selected, draft, mode, format, fullText, simulationText,
    simulationResults, simulationResponse, error, simulationError, loading, saving, simulating, readOnly, hasChanges,
    load, open, switchMode, switchFormat, save, release, newVersion, setAvailable, removeDraft, simulate, invalidateSimulation }
}

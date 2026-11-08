import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { metricApi } from '../api'
import { copy, errorText } from '../service'
import { configurationObject, configurationSnapshot, encodeConfiguration, type ConfigurationFormat } from './configurationText'
import type { ValueTranslate } from '../valueSemantics'
import type { MetricApi, MetricCalculatorDescriptor, MetricConfig, MetricSimulationRequest, MetricSimulationResponse, MetricTemplate, MetricTemplateCategory, MetricTemplateEntity, MetricTemplateStarter } from '../types'

const emptyTemplate = (): MetricTemplate => ({
  id: '', version: '1', name: '', enabled: true, inputDefinitions: [], parameterDefinitions: [],
  parameters: {}, definitions: [], outputs: [], options: {}
})
export function useMetricTemplates(editable: Ref<boolean>, api: MetricApi = metricApi, t: ValueTranslate = key => key) {
  const entities = ref<MetricTemplateEntity[]>([])
  const categories = ref<MetricTemplateCategory[]>([])
  const categoriesLoading = ref(false)
  const categoryError = ref('')
  const calculators = ref<MetricCalculatorDescriptor[]>([])
  const calculatorError = ref('')
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
  const savedText = ref<string>()
  const readOnly = computed(() => !editable.value)
  const hasChanges = computed(() => {
    if (!draft.value || readOnly.value) return false
    try { return configurationSnapshot(prepared()) !== savedText.value }
    catch { return true }
  })
  let generation = 0
  let categoryGeneration = 0
  let calculatorGeneration = 0
  let simulationGeneration = 0
  let simulationRequest = 0
  // 规则或样本变化即作废旧结果，也截断已发出的试算响应。
  function invalidateSimulation() {
    simulationGeneration++
    simulationResponse.value = undefined
    simulationError.value = ''
  }
  watch([draft, fullText, simulationText, editable], invalidateSimulation, { deep: true, flush: 'sync' })
  async function load() {
    const token = ++generation
    loading.value = true
    error.value = ''
    try {
      // 分类目录需要完整集合，不能把一页数据当成全部场景。
      const result = await api.queryTemplates({ paging: false, sorts: [{ name: 'modifyTime', order: 'desc' }] })
      if (token === generation) entities.value = result.data
    } catch (cause) { if (token === generation) error.value = errorText(cause) }
    finally { if (token === generation) loading.value = false }
  }
  /** 字典维护和语言切换后重新读取；失败不覆盖分类，更不重置编辑中的模板。 */
  async function loadCategories() {
    const token = ++categoryGeneration
    categoriesLoading.value = true
    categoryError.value = ''
    try {
      const values = await api.templateCategories()
      if (token === categoryGeneration) categories.value = values
    } catch (cause) { if (token === categoryGeneration) categoryError.value = errorText(cause) }
    finally { if (token === categoryGeneration) categoriesLoading.value = false }
  }
  /** 元数据失败不阻断模板读取；未知算法保持原声明，在高级模式中继续编辑。 */
  async function loadCalculators() {
    const token = ++calculatorGeneration
    calculatorError.value = ''
    try {
      const values = await api.calculators()
      if (token === calculatorGeneration) calculators.value = values
    } catch (cause) { if (token === calculatorGeneration) calculatorError.value = errorText(cause) }
  }
  function open(entity?: MetricTemplateEntity, starter?: MetricTemplateStarter) {
    if (saving.value) return
    simulationGeneration++
    simulating.value = false
    selected.value = entity ? copy(entity) : undefined
    draft.value = entity ? copy(entity.draft || entity.template) : starter ? { ...copy(starter.template), id: `${starter.template.id}-${crypto.randomUUID().slice(0, 8)}` } : emptyTemplate()
    if (!entity && starter) draft.value.options = { ...draft.value.options, ...(starter.groupId ? { category:starter.groupId } : {}), ...(starter.icon ? { icon:starter.icon } : {}) }
    fullText.value = encodeConfiguration(draft.value, format.value)
    savedText.value = configurationSnapshot(draft.value)
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
    const facts = starter?.simulation ? copy(starter.simulation) : { configuration, samples: [] }
    facts.configuration.templateId = template.id
    facts.configuration.templateVersion = template.version
    simulationText.value = encodeConfiguration(facts, format.value)
  }
  function prepared(): MetricTemplate {
    if (!draft.value) throw new Error(t('templateRequired'))
    if (mode.value === 'full') {
      const value = configurationObject(fullText.value, format.value, t('invalidObject'))
      // 仅检查可视编辑需要的容器结构；计算语义仍由服务端编译。
      const sections = { inputDefinitions:'inputs', parameterDefinitions:'parameters', definitions:'rules', outputs:'outputs' }
      for (const [key, section] of Object.entries(sections)) {
        const items = value[key]
        if (items !== undefined && (!Array.isArray(items) || items.some(item => !item || typeof item !== 'object' || Array.isArray(item)))) {
          throw new Error(t('templateConfigurationArray', { section:t(section), field:key }))
        }
      }
      if (value.parameters !== undefined && (!value.parameters || typeof value.parameters !== 'object' || Array.isArray(value.parameters))) throw new Error(t('templateConfigurationParameters'))
      const defaults: Record<string, unknown> = { id: '', version: '', name: '', inputDefinitions: [], parameterDefinitions: [], parameters: {}, definitions: [], outputs: [] }
      for (const key of Object.keys(defaults)) if (value[key] === undefined) value[key] = defaults[key]
      const result = value as unknown as MetricTemplate
      if (selected.value?.released && (result.id !== selected.value.template.id || result.version !== selected.value.template.version)) {
        throw new Error(t('publishedTemplateIdentityLocked'))
      }
      return result
    }
    return copy(draft.value)
  }
  /** 关闭编辑会话同时作废迟到的试算反馈，首页列表及滚动容器保持不变。 */
  function close() {
    if (saving.value) return
    invalidateSimulation()
    simulating.value = false
    selected.value = undefined
    draft.value = undefined
    fullText.value = ''
    error.value = ''
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
      const entity = await api.saveTemplate(prepared(), selected.value?.editRevision)
      selected.value = entity
      draft.value = copy(entity.draft || entity.template)
      fullText.value = encodeConfiguration(draft.value, format.value)
      savedText.value = configurationSnapshot(draft.value)
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
      const published = await api.releaseTemplate(entity.id, entity.editRevision)
      selected.value = published || { ...entity, released: true, draft: null }
      draft.value = copy(selected.value.template)
      fullText.value = encodeConfiguration(draft.value, format.value)
      savedText.value = configurationSnapshot(draft.value)
      await load()
    } catch (cause) { error.value = errorText(cause) }
    finally { saving.value = false }
  }
  function newVersion() {
    if (!selected.value || !editable.value || saving.value) return
    try {
      const template = prepared()
      template.version = ''
      open({ ...selected.value, template, draft: null, released: false })
      selected.value = undefined
    } catch (cause) { error.value = errorText(cause) }
  }
  async function setAvailable(available: boolean) {
    if (!selected.value || !editable.value || saving.value) return
    saving.value = true
    try { await api.setAvailable(selected.value.id, available); selected.value.available = available; await load() }
    catch (cause) { error.value = errorText(cause) }
    finally { saving.value = false }
  }
  async function removeDraft(): Promise<boolean> {
    if (readOnly.value || saving.value || !selected.value?.id || selected.value.released) return false
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
  async function discardDraft() {
    if (readOnly.value || saving.value || !selected.value?.draft) return
    saving.value = true
    error.value = ''
    try {
      const entity = await api.discardTemplateDraft(selected.value.id, selected.value.editRevision || 0)
      selected.value = entity
      draft.value = copy(entity.template)
      fullText.value = encodeConfiguration(draft.value, format.value)
      savedText.value = configurationSnapshot(draft.value)
      await load()
    } catch (cause) { error.value = errorText(cause) }
    finally { saving.value = false }
  }
  async function simulate() {
    if (!editable.value) return
    const token = ++simulationGeneration
    const request = ++simulationRequest
    simulating.value = true
    simulationError.value = ''
    simulationResponse.value = undefined
    try {
      const facts = configurationObject(simulationText.value, format.value)
      const template = prepared()
      const response = await api.simulate({ ...facts, template, configuration: { ...(facts.configuration as MetricConfig), templateId: template.id, templateVersion: template.version }, includeIntermediate: true, includeRecords: true } as unknown as MetricSimulationRequest)
      if (token === simulationGeneration) {
        simulationResponse.value = response
        simulationError.value = response.error || ''
      }
    } catch (cause) { if (token === simulationGeneration) simulationError.value = errorText(cause) }
    finally { if (request === simulationRequest) simulating.value = false }
  }
  onScopeDispose(() => { generation++; categoryGeneration++; simulationGeneration++; calculatorGeneration++ })
  return { categories, categoriesLoading, categoryError, loadCategories, calculators, calculatorError, loadCalculators, entities, selected, draft, mode, format, fullText, simulationText,
    simulationResults, simulationResponse, error, simulationError, loading, saving, simulating, readOnly, hasChanges,
    load, open, close, switchMode, switchFormat, save, release, newVersion, setAvailable, removeDraft, discardDraft, simulate, invalidateSimulation }
}

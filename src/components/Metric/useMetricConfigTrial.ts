import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { metricApi } from './api'
import { copy, errorText } from './service'
import { useTemplateSimulation } from './template/useTemplateSimulation'
import type { SimulationFacts } from './template/simulation'
import type { MetricApi, MetricConfig, MetricSimulationResponse, MetricTemplate } from './types'

/** 业务试算只提交固定模板引用与显式样本；过程展示复用模板试算的索引与虚拟时钟。 */
export function useMetricConfigTrial(template:Ref<MetricTemplate | undefined>, configuration:Ref<MetricConfig>, editable:Ref<boolean>, api:Pick<MetricApi,'simulateConfig'> = metricApi, ready:() => boolean = () => true) {
  const text = ref('')
  const format = ref<'json'>('json')
  const response = ref<MetricSimulationResponse>()
  const results = computed(() => response.value?.results || [])
  const loading = ref(false)
  const error = ref('')
  const active = ref(false)
  let generation = 0
  const supported = computed(() => configuration.value.scope !== 'children' && Object.values(configuration.value.inputMappings).every(mapping => mapping.kind !== 'metric' || !!mapping.configId))
  function invalidate() { generation++; response.value = undefined; error.value = '' }
  const trial = useTemplateSimulation({ template, text, format, response, results, loading, invalidate,
    execution:{ run:execute, enabled:() => editable.value && supported.value && ready(), autoEnabled:() => active.value } })
  const bindings = computed(() => JSON.stringify([configuration.value.templateId, configuration.value.templateVersion, configuration.value.templateRevision, configuration.value.scope, configuration.value.inputMappings]))
  watch([bindings, () => JSON.stringify(configuration.value.parameters)], ([key], old) => {
    const previous = old && key === old[0] ? trial.facts : undefined
    if (!previous) trial.cancel()
    text.value = JSON.stringify({ configuration:copy(configuration.value), samples:previous?.samples || [], endAt:previous?.endAt })
    invalidate()
    if (previous) trial.schedule()
    else trial.reset()
  }, { immediate:true, flush:'sync' })
  watch(text, invalidate, { flush:'sync' })
  watch(supported, value => { if (!value) { active.value = false; invalidate() } })
  watch(editable, value => { if (!value) { active.value = false; text.value = ''; invalidate() } })
  watch(active, value => { if (!value) { trial.cancel(); invalidate() } }, { flush:'sync' })
  async function execute() {
    if (loading.value || !editable.value || !supported.value || trial.invalid || !trial.facts) return
    const token = ++generation
    loading.value = true; error.value = ''; response.value = undefined
    try {
      const facts = trial.facts as SimulationFacts
      const value = await api.simulateConfig({ configuration:copy(configuration.value), samples:copy(facts.samples),
        endAt:typeof facts.endAt === 'number' ? facts.endAt : undefined, includeIntermediate:true, includeRecords:true })
      if (token === generation) { response.value = value; error.value = value.error || '' }
    } catch (cause) { if (token === generation) error.value = errorText(cause) }
    finally { loading.value = false }
  }
  onScopeDispose(invalidate)
  return { trial, active, supported, run:trial.run, error }
}

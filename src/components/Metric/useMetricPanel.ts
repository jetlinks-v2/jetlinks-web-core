import { computed, onActivated, onDeactivated, onMounted, onScopeDispose, ref, watch, type Ref } from 'vue'
import { metricApi } from './api'
import { copy, errorText, outputId, templateKey } from './service'
import { loadMetricLatest } from './extensions/latestBatch'
import type { MetricApi, MetricConfig, MetricContext, MetricLatest, MetricReference, MetricRuntime, MetricTemplate, MetricValue } from './types'

/** 一个面板管理一个对象；旧请求不得回填切换后的对象。轮询随页面可见性暂停。 */
export function useMetricPanel(context: Ref<MetricContext>, api: MetricApi = metricApi, initialReference?: Ref<MetricReference | undefined>) {
  const configurations = ref<MetricConfig[]>([])
  const templates = ref<Record<string, MetricTemplate>>({})
  const outputs = ref<Record<string, Record<string, MetricValue>>>({})
  const runtimes = ref<Record<string, MetricRuntime>>({})
  const itemErrors = ref<Record<string, string>>({})
  const inaccessibleIds = ref<string[]>([])
  const latestErrors = ref<Record<string, string>>({})
  const actionError = ref('')
  const loading = ref(false)
  const error = ref('')
  const busyId = ref('')
  const selectedId = ref('')
  const selectedOutputId = ref('')
  const editorOpen = ref(false)
  const editing = ref<MetricConfig>()
  let focusReturn: MetricReference | undefined
  let initialSelectionPending = true
  let generation = 0
  let ownerEpoch = 0
  let writeSequence = 0
  let active = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | undefined
  let scheduleGeneration = 0
  const selected = computed(() => configurations.value.find(config => config.id === selectedId.value))
  const selectedOutput = computed(() => templates.value[selectedId.value]?.outputs.find(output => outputId(output) === selectedOutputId.value))
  const reference = computed<MetricReference | undefined>(() => selected.value?.id && selectedOutput.value && !inaccessibleIds.value.includes(selected.value.id) && !latestErrors.value[selected.value.id]
    ? { configId: selected.value.id, outputId: outputId(selectedOutput.value) } : undefined)
  const selectedLatest = computed<MetricLatest | undefined>(() => reference.value ? {
    configId: reference.value.configId, outputs: outputs.value[reference.value.configId] || {}, runtime: runtimes.value[reference.value.configId]
  } : undefined)
  const cards = computed(() => configurations.value.flatMap(config => config.id
    ? (templates.value[config.id]?.outputs || []).map(output => ({ config, output, reference: { configId: config.id!, outputId: outputId(output) } })) : []))

  /** 手动选择或关闭会消费返回定位；后续轮询、prop 变化和恢复权限都不能重开详情。 */
  function closeDetail() { initialSelectionPending = false; selectedId.value = ''; selectedOutputId.value = ''; focusReturn = undefined }
  function select(configId: string, output: string) {
    initialSelectionPending = false
    if (!configurations.value.some(config => config.id === configId) || inaccessibleIds.value.includes(configId) || latestErrors.value[configId]
      || !templates.value[configId]?.outputs.some(item => outputId(item) === output)) return
    editorOpen.value = false
    editing.value = undefined
    focusReturn = undefined
    selectedId.value = configId
    selectedOutputId.value = output
  }
  /** 趋势和编辑共用一个抽屉；保存后回到刷新后的概览，不自动加载某个输出的历史。 */
  function openEditor(config?: MetricConfig) {
    if (!context.value.editable) return
    closeDetail()
    editing.value = config ? copy(config) : undefined
    editorOpen.value = true
  }
  function closeDrawer() { closeDetail(); editorOpen.value = false; editing.value = undefined }
  /** 仅主动关闭趋势时记录回焦目标；程序关闭、切换对象及进入编辑都会撤销它。 */
  function dismissDrawer() {
    const target = reference.value
    closeDrawer()
    focusReturn = target
  }
  /** 由抽屉退场事件消费，关闭期间撤权或重新打开详情后不恢复旧焦点。 */
  function takeFocusReference(): MetricReference | undefined {
    const target = focusReturn
    focusReturn = undefined
    return target && !editorOpen.value && !reference.value && !error.value && cards.value.some(card =>
      card.reference.configId === target.configId && card.reference.outputId === target.outputId)
      && !inaccessibleIds.value.includes(target.configId) && !latestErrors.value[target.configId] ? target : undefined
  }
  async function refreshAfterWrite(current: () => boolean) {
    if (inFlight) await inFlight
    if (current()) await refresh()
  }
  async function saved() {
    if (!active) return
    const epoch = ownerEpoch
    const operation = writeSequence
    closeDrawer()
    await refreshAfterWrite(() => active && epoch === ownerEpoch && operation === writeSequence)
  }

  /** 写入只属于发起时的对象与操作；轮询不改变该身份，退场和对象切换会撤销它。 */
  async function writeConfig(config: MetricConfig, action: (id: string) => Promise<unknown>, feedback = error, onSaved?: () => void): Promise<boolean> {
    if (!active || !context.value.editable || !config.id) return false
    const epoch = ownerEpoch
    const operation = ++writeSequence
    const current = () => active && epoch === ownerEpoch && operation === writeSequence
    busyId.value = config.id
    feedback.value = ''
    try {
      await action(config.id)
      if (current()) {
        onSaved?.()
        await refreshAfterWrite(current)
      }
      return true
    } catch (cause) {
      if (current()) feedback.value = errorText(cause)
      return false
    } finally { if (current()) busyId.value = '' }
  }
  function invalidateWrites() { ownerEpoch++; busyId.value = '' }

  /** Manual refresh, activation and poll share one owner request; an owner switch detaches the old task. */
  function refresh(): Promise<void> {
    if (inFlight) return inFlight
    const task = readSnapshot()
    inFlight = task
    void task.finally(() => { if (inFlight === task) inFlight = undefined })
    return task
  }
  async function readSnapshot() {
    const token = ++generation
    const owner = copy(context.value)
    loading.value = !configurations.value.length
    error.value = ''
    try {
      const configs = await api.byOwner(owner.ownerType, owner.ownerId)
      const metadata: Record<string, MetricTemplate> = {}
      const errors: Record<string, string> = {}
      const cache = new Map(Object.values(templates.value).map(template => [templateKey(template), template]))
      for (const config of configs) {
        if (!config.id) continue
        const key = templateKey({ id: config.templateId, version: config.templateVersion })
        try {
          const template = cache.get(key) || await api.configTemplate(config.id)
          cache.set(key, template)
          metadata[config.id] = template
        } catch (cause) { errors[config.id] = errorText(cause) }
      }
      const ids = configs.flatMap(config => config.id ? [config.id] : [])
      const latest = await loadMetricLatest(api, ids, outputs.value, inaccessibleIds.value, () => token === generation, runtimes.value)
      if (token !== generation || !latest) return
      configurations.value = configs
      templates.value = metadata
      itemErrors.value = errors
      outputs.value = latest.outputs
      runtimes.value = latest.runtimes
      latestErrors.value = latest.errors
      inaccessibleIds.value = latest.inaccessibleIds
      // 退场期间撤销过的目标不因随后恢复可读而重新获得焦点。
      if (focusReturn && (!cards.value.some(card => card.reference.configId === focusReturn?.configId
        && card.reference.outputId === focusReturn?.outputId) || inaccessibleIds.value.includes(focusReturn.configId) || latestErrors.value[focusReturn.configId])) focusReturn = undefined
      // 已有草稿同样服从成功读取后的权限集合；临时读取失败和未保存新增不据此丢弃编辑。
      const editingId = editing.value?.id
      if (editingId && (!ids.includes(editingId) || (!latest.errors[editingId] && inaccessibleIds.value.includes(editingId)))) closeDrawer()
      // 返回引用只用于首次定位，必须先经过当前对象、固定模板和最新值的可读性边界。
      if (initialSelectionPending) {
        const initial = initialReference?.value
        if (initial && configs.some(config => config.id === initial.configId) && !inaccessibleIds.value.includes(initial.configId) && !latest.errors[initial.configId]
          && metadata[initial.configId]?.outputs.some(output => outputId(output) === initial.outputId)) select(initial.configId, initial.outputId)
        // 仅目标引用的暂时读取失败保留重试；成功撤权、对象/输出不存在仍消费定位。
        const retryable = initial && ids.includes(initial.configId) && (latest.errors[initial.configId]
          || (!inaccessibleIds.value.includes(initial.configId) && errors[initial.configId]))
        if (!retryable) initialSelectionPending = false
      }
      if (selectedId.value && !reference.value) closeDetail()
    } catch (cause) {
      if (token === generation) {
        error.value = errorText(cause)
        if (selectedId.value) closeDetail()
      }
    } finally { if (token === generation) loading.value = false }
  }
  async function setEnabled(config: MetricConfig, enabled: boolean) {
    await writeConfig(config, () => api.saveConfig({ ...copy(config), state: enabled ? 'enabled' : 'disabled' }))
  }
  async function remove(config: MetricConfig): Promise<boolean> {
    return writeConfig(config, id => api.removeConfig(id), actionError, () => {
      if (selectedId.value === config.id || editing.value?.id === config.id) closeDrawer()
    })
  }
  function stop() { scheduleGeneration++; if (timer) clearTimeout(timer); timer = undefined }
  async function poll() {
    stop()
    const scheduleToken = scheduleGeneration
    if (!active || document.hidden) return
    await refresh()
    if (scheduleToken === scheduleGeneration && active && !document.hidden) timer = setTimeout(poll, 15000)
  }
  function visibility() { document.hidden ? stop() : void poll() }
  watch(() => [context.value.ownerType, context.value.ownerId], () => {
    generation++
    invalidateWrites()
    inFlight = undefined
    configurations.value = []
    templates.value = {}
    outputs.value = {}
    runtimes.value = {}
    itemErrors.value = {}
    inaccessibleIds.value = []
    latestErrors.value = {}
    actionError.value = ''
    // owner 变化撤销旧详情和草稿；initialReference 只在本次面板首次读取成功时消费。
    closeDrawer()
    void poll()
  }, { flush: 'sync' })
  watch(() => context.value.editable, editable => { if (!editable && editorOpen.value) closeDrawer() }, { flush: 'sync' })
  onMounted(() => { document.addEventListener('visibilitychange', visibility); void poll() })
  onActivated(() => { if (!active) { active = true; void poll() } })
  onDeactivated(() => { active = false; generation++; invalidateWrites(); stop() })
  onScopeDispose(() => { active = false; generation++; invalidateWrites(); stop(); document.removeEventListener('visibilitychange', visibility) })
  async function rename(config: MetricConfig, name: string) {
    await writeConfig(config, () => api.saveConfig({ ...copy(config), name }))
  }
  return { configurations, templates, outputs, runtimes, selectedLatest, itemErrors, inaccessibleIds, latestErrors, actionError, loading, error, busyId, selectedId, selectedOutputId,
    selected, selectedOutput, reference, cards, select, closeDetail, editorOpen, editing, openEditor, closeDrawer, dismissDrawer, takeFocusReference, saved, refresh, setEnabled, rename, remove }
}

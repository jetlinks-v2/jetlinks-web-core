import { computed, markRaw, onBeforeUnmount, reactive, ref, shallowRef, type Component } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  dataCapabilityRegistry,
  type CapabilityKind,
  type CapabilityQuery,
  type DataCapabilityRuntime,
  type DataConnection,
  type LazyComponentDefinition,
  type PersistedDataBinding,
  type PersistedOperationBinding,
  type PreparedOperation,
  type ResolvedCapabilityCatalog,
} from '@jetlinks-web-core/data-capability'

export interface LabCapabilityItem {
  id: string
  kind: CapabilityKind
  name: string
  owner: { moduleId: string; providerId: string }
  availability: { executable: boolean }
  definition: Record<string, unknown>
}

export function useDataCapabilityLab() {
  const context = reactive({ scopeId: 'data-capability-lab' })
  const query = reactive<CapabilityQuery>({ includeUnavailable: true })
  const selectedKind = ref<CapabilityKind>()
  const catalog = ref<ResolvedCapabilityCatalog>()
  const selectedCapability = ref<LabCapabilityItem>()
  const runtime = ref<DataCapabilityRuntime>()
  const connection = ref<DataConnection>()
  const preparedOperation = ref<PreparedOperation>()
  const loading = ref(false)
  const activeTab = ref('definition')
  const draftConfig = ref('{}')
  const draftQuery = ref('{}')
  const draftInput = ref('{}')
  const events = ref<unknown[]>([])
  const result = ref<unknown>()
  const componentPreview = shallowRef<Component>()
  const componentExtraProps = ref<Record<string, unknown>>({})
  const componentLoading = ref(false)
  const componentError = ref<string>()

  const capabilityItems = computed(() => {
    const rows: LabCapabilityItem[] = []
    const append = (kind: CapabilityKind, items: any[] = []) => {
      items.forEach((item) => rows.push({
        id: item.definition.id,
        kind,
        name: item.definition.name,
        owner: item.definition.owner,
        availability: item.availability,
        definition: item.definition,
      }))
    }
    append('data-source', catalog.value?.sources)
    append('operation', catalog.value?.operations)
    append('context-value', catalog.value?.contexts)
    append('value-editor', catalog.value?.valueEditors)
    append('option-source', catalog.value?.optionSources)
    return rows
  })

  const currentFixture = computed(() => ({
    context,
    query: buildQuery(),
    selected: selectedCapability.value && {
      id: selectedCapability.value.id,
      kind: selectedCapability.value.kind,
    },
    config: safeParseJson(draftConfig.value),
    queryInput: safeParseJson(draftQuery.value),
    operationInput: safeParseJson(draftInput.value),
  }))

  const componentPreviewProps = computed(() => ({
    ...componentExtraProps.value,
    capability: selectedCapability.value,
    context,
    config: safeParseJson(draftConfig.value),
    query: safeParseJson(draftQuery.value),
    input: safeParseJson(draftInput.value),
    result: result.value,
    events: events.value,
    mode: 'lab',
  }))

  const loadCatalog = async () => {
    loading.value = true
    try {
      catalog.value = await dataCapabilityRegistry.resolveCatalog(context, buildQuery())
    } finally {
      loading.value = false
    }
  }

  const buildQuery = (): CapabilityQuery => ({
    ...query,
    kinds: selectedKind.value ? [selectedKind.value] : undefined,
  })

  const selectCapability = (item: LabCapabilityItem) => {
    stopConnection()
    selectedCapability.value = item
    preparedOperation.value = undefined
    result.value = undefined
    events.value = []
    void refreshComponentPreview()
  }

  const refreshComponentPreview = async () => {
    const componentDefinition = resolvePreviewComponent(selectedCapability.value)
    componentPreview.value = undefined
    componentExtraProps.value = {}
    componentError.value = undefined
    if (!componentDefinition) return

    componentLoading.value = true
    try {
      const loaded = await componentDefinition.loader()
      const component = loaded && typeof loaded === 'object' && 'default' in loaded ? loaded.default : loaded
      componentPreview.value = markRaw(component as Component)
      componentExtraProps.value = componentDefinition.props || {}
      activeTab.value = 'component'
    } catch (error) {
      componentError.value = error instanceof Error ? error.message : String(error)
    } finally {
      componentLoading.value = false
    }
  }

  const runPreview = async () => {
    result.value = await getRuntime().preview({ binding: buildDataBinding(), timeout: 5000, limit: 20 })
  }

  const runQuery = async () => {
    result.value = await getRuntime().query(buildDataBinding(), { timeout: 5000, limit: 20 })
  }

  const runConnect = () => {
    stopConnection()
    connection.value = getRuntime().connect({
      consumerId: 'data-capability-lab',
      binding: buildDataBinding(),
      options: { timeout: 5000, limit: 20 },
    })
    connection.value.events$.subscribe(event => {
      events.value = [...events.value, event]
      if (event.type === 'data') result.value = event.result
    })
  }

  const runOptionSource = async () => {
    const capability = selectedCapability.value
    if (!capability || capability.kind !== 'option-source') return
    const source = dataCapabilityRegistry.optionSources.get(capability.id)
    result.value = await source?.query({ query: parseJson(draftQuery.value) as Record<string, unknown> }, context)
  }

  const prepareOperation = async () => {
    preparedOperation.value = await getRuntime().prepareOperation(buildOperationBinding())
    result.value = preparedOperation.value
  }

  const executeOperation = () => {
    if (!preparedOperation.value) return
    Modal.confirm({
      title: '确认执行操作？',
      content: `将执行 ${preparedOperation.value.capabilityId}，请确认该操作允许在测试环境执行。`,
      onOk() {
        const execution = getRuntime().executeOperation(preparedOperation.value!)
        execution.events$.subscribe(event => {
          events.value = [...events.value, event]
          if (event.type === 'result') result.value = event.result
        })
      },
    })
  }

  const buildDataBinding = (): PersistedDataBinding => {
    const capability = requireSelected('data-source')
    return {
      version: 1,
      source: {
        capabilityId: capability.id,
        version: Number(capability.definition.version || 1),
        config: parseJson(draftConfig.value),
      },
      query: parseJson(draftQuery.value) as PersistedDataBinding['query'],
    }
  }

  const buildOperationBinding = (): PersistedOperationBinding => {
    const capability = requireSelected('operation')
    return {
      version: 1,
      operation: {
        capabilityId: capability.id,
        version: Number(capability.definition.version || 1),
        config: parseJson(draftConfig.value),
      },
      input: parseJson(draftInput.value) as PersistedOperationBinding['input'],
    }
  }

  const requireSelected = (kind: CapabilityKind) => {
    if (!selectedCapability.value || selectedCapability.value.kind !== kind) {
      throw new Error(`请选择 ${kind} 能力`)
    }
    return selectedCapability.value
  }

  const getRuntime = () => {
    if (!runtime.value) {
      runtime.value = dataCapabilityRegistry.createRuntime({ ...context, runtimeId: 'data-capability-lab' })
    }
    return runtime.value
  }

  const stopConnection = () => {
    connection.value?.unsubscribe()
    connection.value = undefined
  }

  const parseJson = (value: string): unknown => {
    try {
      return value ? JSON.parse(value) : undefined
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'JSON 格式错误')
      throw error
    }
  }

  const safeParseJson = (value: string): unknown => {
    try {
      return value ? JSON.parse(value) : undefined
    } catch {
      return undefined
    }
  }

  const resolvePreviewComponent = (
    capability?: LabCapabilityItem,
  ): LazyComponentDefinition | undefined => {
    const definition = capability?.definition as any
    if (!definition) return undefined
    if (capability?.kind === 'value-editor') return definition.editor
    if (capability?.kind === 'data-source') {
      return definition.ui?.preview ?? definition.ui?.config?.editor ?? definition.ui?.query?.editor
    }
    if (capability?.kind === 'operation') {
      return definition.ui?.confirmation ?? definition.ui?.input?.editor ?? definition.ui?.config?.editor
    }
    return undefined
  }

  onBeforeUnmount(() => {
    stopConnection()
    void runtime.value?.dispose()
  })

  return {
    context,
    query,
    selectedKind,
    selectedCapability,
    connection,
    preparedOperation,
    loading,
    activeTab,
    draftConfig,
    draftQuery,
    draftInput,
    events,
    result,
    componentPreview,
    componentPreviewProps,
    componentLoading,
    componentError,
    capabilityItems,
    currentFixture,
    loadCatalog,
    selectCapability,
    refreshComponentPreview,
    runPreview,
    runQuery,
    runConnect,
    runOptionSource,
    prepareOperation,
    executeOperation,
    stopConnection,
  }
}

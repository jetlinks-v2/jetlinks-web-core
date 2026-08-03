import { computed, markRaw, reactive, ref, shallowRef, type Component } from 'vue'
import {
  dataCapabilityRegistry,
  type CapabilityChoiceResult,
  type CapabilityKind,
  type CapabilityQuery,
  type LazyComponentDefinition,
  type ResolvedCapabilityCatalog,
} from '@jetlinks-web-core/data-capability'
import { useLabEventBuffer } from './useLabEventBuffer'
import { useLabRuntimeActions } from './useLabRuntimeActions'
import type { LabCapabilityItem } from './types'

export function useDataCapabilityLab() {
  const context = reactive({ parameters: {}, attributes: {} })
  const query = reactive<CapabilityQuery>({ includeUnavailable: true })
  const selectedKind = ref<CapabilityKind>()
  const catalog = ref<ResolvedCapabilityCatalog>()
  const capabilityChoiceResult = ref<CapabilityChoiceResult>({ items: [], partial: false, diagnostics: [] })
  const selectedCapability = ref<LabCapabilityItem>()
  const loading = ref(false)
  const activeTab = ref('definition')
  const draftConfig = ref('{}')
  const draftQuery = ref('{}')
  const draftInput = ref('{}')
  const { events, eventStats, appendLabEvent, resetEvents } = useLabEventBuffer()
  const result = ref<unknown>()
  const componentPreview = shallowRef<Component>()
  const componentExtraProps = ref<Record<string, unknown>>({})
  const componentLoading = ref(false)
  const componentError = ref<string>()

  const runtimeActions = useLabRuntimeActions({
    context,
    selectedCapability,
    draftConfig,
    draftQuery,
    draftInput,
    result,
    appendEvent: appendLabEvent,
  })

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

  const selectedChoice = computed(() => capabilityChoiceResult.value.items.find(item => (
    item.value === selectedCapability.value?.id && item.kind === selectedCapability.value?.kind
  )))
  const selectedChoiceValue = computed(() => selectedChoice.value?.value)

  const currentFixture = computed(() => ({
    context,
    query: buildQuery(),
    selected: selectedCapability.value && {
      id: selectedCapability.value.id,
      kind: selectedCapability.value.kind,
    },
    capabilityReference: selectedChoice.value && {
      capabilityId: selectedChoice.value.value,
      version: selectedChoice.value.version,
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
      const currentQuery = buildQuery()
      const [resolvedCatalog, resolvedChoices] = await Promise.all([
        dataCapabilityRegistry.resolveCatalog(context, currentQuery),
        dataCapabilityRegistry.resolveCapabilityChoices(context, currentQuery),
      ])
      catalog.value = resolvedCatalog
      capabilityChoiceResult.value = resolvedChoices
    } finally {
      loading.value = false
    }
  }
  const buildQuery = (): CapabilityQuery => ({
    ...query,
    kinds: selectedKind.value ? [selectedKind.value] : undefined,
  })
  const selectCapability = (item?: LabCapabilityItem) => {
    runtimeActions.stopConnection()
    selectedCapability.value = item
    runtimeActions.preparedOperation.value = undefined
    result.value = undefined
    resetEvents()
    void refreshComponentPreview()
  }

  const selectCapabilityChoice = (value?: string) => {
    if (!value) {
      selectCapability()
      return
    }
    const choice = capabilityChoiceResult.value.items.find(item => item.value === value)
    if (!choice || choice.disabled) return
    const capability = capabilityItems.value.find(item => item.id === choice.value && item.kind === choice.kind)
    if (capability) selectCapability(capability)
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
  return {
    context,
    query,
    selectedKind,
    selectedCapability,
    connection: runtimeActions.connection,
    preparedOperation: runtimeActions.preparedOperation,
    canExecutePreparedOperation: runtimeActions.canExecutePreparedOperation,
    loading,
    activeTab,
    draftConfig,
    draftQuery,
    draftInput,
    events,
    eventStats,
    result,
    componentPreview,
    componentPreviewProps,
    componentLoading,
    componentError,
    capabilityChoiceResult,
    capabilityItems,
    selectedChoiceValue,
    currentFixture,
    loadCatalog,
    selectCapability,
    selectCapabilityChoice,
    refreshComponentPreview,
    runPreview: runtimeActions.runPreview,
    runQuery: runtimeActions.runQuery,
    runConnect: runtimeActions.runConnect,
    runOptionSource: runtimeActions.runOptionSource,
    prepareOperation: runtimeActions.prepareOperation,
    executeOperation: runtimeActions.executeOperation,
    stopConnection: runtimeActions.stopConnection,
  }
}

import { computed, onBeforeUnmount, ref, type Ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import {
  dataCapabilityRegistry,
  type CapabilityContext,
  type CapabilityKind,
  type DataCapabilityRuntime,
  type DataConnection,
  type OptionSourceRef,
  type PersistedDataBinding,
  type PersistedOperationBinding,
  type PreparedOperation,
} from '@jetlinks-web-core/data-capability'

import type { LabCapabilityItem } from './types'

interface UseLabRuntimeActionsOptions {
  context: CapabilityContext
  selectedCapability: Ref<LabCapabilityItem | undefined>
  draftConfig: Ref<string>
  draftQuery: Ref<string>
  draftInput: Ref<string>
  result: Ref<unknown>
  appendEvent(event: unknown): void
}

/** Owns the Lab Runtime and keeps Provider execution out of the page orchestration hook. */
export function useLabRuntimeActions(options: UseLabRuntimeActionsOptions) {
  const runtime = ref<DataCapabilityRuntime>()
  const connection = ref<DataConnection>()
  const preparedOperation = ref<PreparedOperation>()

  const canExecutePreparedOperation = computed(() => {
    const risk = preparedOperation.value?.policy.risk
    return !!preparedOperation.value && risk !== 'high' && risk !== 'critical'
  })

  const runPreview = async () => {
    options.result.value = await getRuntime().preview({ binding: buildDataBinding(), timeout: 5000, limit: 20 })
  }

  const runQuery = async () => {
    options.result.value = await getRuntime().query(buildDataBinding(), { timeout: 5000, limit: 20 })
  }

  const runConnect = () => {
    stopConnection()
    connection.value = getRuntime().connect({
      consumerId: 'data-capability-lab',
      binding: buildDataBinding(),
      options: { timeout: 5000, limit: 20 },
    })
    connection.value.events$.subscribe((event) => {
      options.appendEvent(event)
      if (event.type === 'data') options.result.value = event.result
    })
  }

  const runOptionSource = async () => {
    const capability = requireSelected('option-source')
    const ref: OptionSourceRef = {
      type: 'provider',
      capability: {
        capabilityId: capability.id,
        version: Number(capability.definition.version || 1),
      },
      query: parseJson(options.draftQuery.value) as Extract<OptionSourceRef, { type: 'provider' }>['query'],
    }
    options.result.value = await getRuntime().resolveOptions(ref)
  }

  const prepareOperation = async () => {
    preparedOperation.value = await getRuntime().prepareOperation(buildOperationBinding())
    options.result.value = preparedOperation.value
  }

  const executeOperation = () => {
    if (!preparedOperation.value) return
    if (!canExecutePreparedOperation.value) {
      message.warning('测试页不允许执行高风险或关键风险操作')
      return
    }
    Modal.confirm({
      title: '确认执行操作？',
      content: `将执行 ${preparedOperation.value.capabilityId}，请确认该操作允许在测试环境执行。`,
      onOk() {
        const operation = preparedOperation.value!.policy.confirmation === 'none'
          ? preparedOperation.value!
          : getRuntime().confirmOperation(preparedOperation.value!.id, { method: 'ui', reason: 'data-capability-lab' })
        const execution = getRuntime().executeOperation(operation)
        execution.events$.subscribe({
          next(event) {
            options.appendEvent(event)
            if (event.type === 'result') options.result.value = event.result
          },
          error(error) {
            message.error(error instanceof Error ? error.message : String(error))
          },
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
        config: parseJson(options.draftConfig.value),
      },
      query: parseJson(options.draftQuery.value) as PersistedDataBinding['query'],
    }
  }

  const buildOperationBinding = (): PersistedOperationBinding => {
    const capability = requireSelected('operation')
    return {
      version: 1,
      operation: {
        capabilityId: capability.id,
        version: Number(capability.definition.version || 1),
        config: parseJson(options.draftConfig.value),
      },
      input: parseJson(options.draftInput.value) as PersistedOperationBinding['input'],
    }
  }

  const requireSelected = (kind: CapabilityKind) => {
    if (!options.selectedCapability.value || options.selectedCapability.value.kind !== kind) {
      throw new Error(`请选择 ${kind} 能力`)
    }
    return options.selectedCapability.value
  }

  const getRuntime = () => {
    if (!runtime.value) {
      runtime.value = dataCapabilityRegistry.createRuntime({ ...options.context, runtimeId: 'data-capability-lab' })
    }
    return runtime.value
  }

  const stopConnection = () => {
    connection.value?.unsubscribe()
    connection.value = undefined
  }

  onBeforeUnmount(() => {
    stopConnection()
    void runtime.value?.dispose()
  })

  return {
    connection,
    preparedOperation,
    canExecutePreparedOperation,
    runPreview,
    runQuery,
    runConnect,
    runOptionSource,
    prepareOperation,
    executeOperation,
    stopConnection,
  }
}

function parseJson(value: string): unknown {
  try {
    return value ? JSON.parse(value) : undefined
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'JSON 格式错误')
    throw error
  }
}

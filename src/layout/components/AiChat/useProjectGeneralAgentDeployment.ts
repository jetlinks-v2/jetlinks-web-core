import { computed, reactive, ref, watch, type Ref } from 'vue'
import { queryAgentList } from '@jetlinks-web-core/api/comm'
import { PROJECT_GENERAL_AGENT_CLIENT_ID } from './generalAgentRuntime'

export const PROJECT_GENERAL_AGENT_CLIENT_TYPE = 'pagePoint'

export interface ProjectGeneralAgentDeployment {
  agentId?: string
  clientType?: string
  clientId?: string
}

const normalizeText = (value: unknown) => String(value || '').trim()

export const createProjectGeneralAgentSessionClientId = (projectId: string) => {
  const normalizedProjectId = normalizeText(projectId)
  return normalizedProjectId ? `${PROJECT_GENERAL_AGENT_CLIENT_ID}:${normalizedProjectId}` : ''
}

export const queryProjectGeneralAgentDeployment = async () => {
  const response = await queryAgentList(
    PROJECT_GENERAL_AGENT_CLIENT_TYPE,
    PROJECT_GENERAL_AGENT_CLIENT_ID,
  )
  if (!response?.success || !Array.isArray(response.result)) return undefined
  return response.result.find(
    (item: ProjectGeneralAgentDeployment) => normalizeText(item?.agentId),
  ) as ProjectGeneralAgentDeployment | undefined
}

export function useProjectGeneralAgentDeployment(projectId: Ref<string | undefined>) {
  const deployment = ref<ProjectGeneralAgentDeployment>()
  const loading = ref(false)
  const error = ref<'unavailable' | 'loadFailed' | ''>('')
  let loadGeneration = 0

  const reload = async () => {
    const token = ++loadGeneration
    deployment.value = undefined
    error.value = ''
    if (!normalizeText(projectId.value)) return false

    loading.value = true
    try {
      const nextDeployment = await queryProjectGeneralAgentDeployment()
      if (token !== loadGeneration) return false
      deployment.value = nextDeployment
      if (!normalizeText(nextDeployment?.agentId)) {
        error.value = 'unavailable'
        return false
      }
      return true
    } catch {
      if (token === loadGeneration) error.value = 'loadFailed'
      return false
    } finally {
      if (token === loadGeneration) loading.value = false
    }
  }

  watch(projectId, reload, { immediate: true })

  const agentId = computed(() => normalizeText(deployment.value?.agentId))
  const clientType = computed(() => (
    normalizeText(deployment.value?.clientType) || PROJECT_GENERAL_AGENT_CLIENT_TYPE
  ))
  const clientId = computed(() => createProjectGeneralAgentSessionClientId(projectId.value || ''))
  // Keep one reactive config object so consumers that capture the prop during setup
  // still observe the asynchronously resolved deployment.
  const agentConfig = reactive({
    get agentId() {
      return agentId.value
    },
    get agentClientType() {
      return clientType.value
    },
    get agentClientId() {
      return clientId.value
    },
  })

  return {
    agentConfig,
    agentId,
    clientId,
    clientType,
    deployment,
    error,
    loading,
    reload,
  }
}

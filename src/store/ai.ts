import {defineStore} from "pinia";
import {existsAiAgentSupport, queryAgentList} from "@jetlinks-web-core/api/comm";
import {useAuthStore} from "@jetlinks-web-core/store/auth";
import {ACCESS_AI_AGENT_CODE, USER_CENTER_MENU_CODE} from "@jetlinks-web-core/utils/consts";

export const useAIStore = defineStore('ai', () => {
  const showAiButton = ref(false)
  const showAiDrawer = ref(false)
  const agentList = ref<any[]>([])
  const parameters = ref<any>({})
  const aiAgentSupported = ref<boolean | undefined>(undefined)
  let supportPromise: Promise<boolean> | undefined
  let queryVersion = 0

  const isPermission = useAuthStore().hasPermission(
      `${USER_CENTER_MENU_CODE}:${ACCESS_AI_AGENT_CODE}`,
  );

  // 隐藏按钮
  const hideAiButton = () => {
    queryVersion += 1
    showAiButton.value = false
    showAiDrawer.value = false
  }

  const resetAgentState = () => {
    showAiButton.value = false
    showAiDrawer.value = false
    agentList.value = []
    parameters.value = {}
  }

  // 关闭窗口/显示窗口
  const setDrawer = (bool: boolean) => {
    showAiDrawer.value = bool
  }

  const openAgentConversation = (
    list: any[] = [],
    _parameters: Record<string, any> = {},
    open = true,
  ) => {
    queryVersion += 1
    agentList.value = Array.isArray(list) ? list : []
    parameters.value = _parameters || {}
    showAiButton.value = agentList.value.length > 0
    showAiDrawer.value = Boolean(open && agentList.value.length)
  }

  const isSupportedResponse = (resp: any) => {
    if (typeof resp === 'boolean') {
      return resp
    }
    return resp?.result === true || resp?.data === true
  }

  const ensureAiAgentSupport = async () => {
    if (aiAgentSupported.value !== undefined) {
      return aiAgentSupported.value
    }
    if (!supportPromise) {
      supportPromise = existsAiAgentSupport()
        .then((resp) => {
          const supported = isSupportedResponse(resp)
          aiAgentSupported.value = supported
          return supported
        })
        .catch(() => {
          aiAgentSupported.value = false
          return false
        })
        .finally(() => {
          supportPromise = undefined
        })
    }
    return supportPromise
  }

  // 查询智能体列表
  const queryAgent = async (clientId: string, _parameters: Record<string, any> = {}) => {
    const currentVersion = queryVersion + 1
    queryVersion = currentVersion
    resetAgentState()
    if (!isPermission) {
      return
    }

    const supported = await ensureAiAgentSupport()
    if (!supported || currentVersion !== queryVersion) {
      return
    }

    try {
      const resp = await queryAgentList('pagePoint', clientId)
      if (currentVersion !== queryVersion) {
        return
      }
      if (resp.success && Array.isArray(resp.result) && resp.result.length) {
        agentList.value = resp.result
        showAiButton.value = true
        parameters.value = _parameters
      }
    } catch {
      if (currentVersion === queryVersion) {
        resetAgentState()
      }
    }
  }

  return {
    showAiButton,
    showAiDrawer,
    agentList,
    parameters,
    aiAgentSupported,
    hideAiButton,
    queryAgent,
    setDrawer,
    openAgentConversation,
  }
})

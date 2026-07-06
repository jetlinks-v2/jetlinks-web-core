import {defineStore} from "pinia";
import {existsAiAgentSupport, queryAgentList} from "@jetlinks-web-core/api/comm";

export const useAIStore = defineStore('ai', () => {
  const showAiButton = ref(false)
  const showAiDrawer = ref(false)
  const agentList = ref<any[]>([])
  const parameters = ref<any>({})
  const bubbleConfig = ref<Record<string, any>>({})
  const bubbleUnreadCount = ref(0)
  const activeClientId = ref('')
  const pendingClientId = ref('')
  const aiAgentSupported = ref<boolean | undefined>(undefined)
  let supportPromise: Promise<boolean> | undefined
  let queryVersion = 0

  const setBubbleConfig = (_parameters: Record<string, any> = {}) => {
    bubbleConfig.value = {
      icon: _parameters.bubbleIcon,
      iconBadge: _parameters.bubbleIconBadge,
      className: _parameters.bubbleClassName,
      tooltip: _parameters.bubbleTooltip,
    }
  }

  const clearBubbleUnread = () => {
    bubbleUnreadCount.value = 0
  }

  const incrementBubbleUnread = (step = 1) => {
    if (showAiDrawer.value) {
      clearBubbleUnread()
      return
    }
    bubbleUnreadCount.value = Math.min(99, bubbleUnreadCount.value + Math.max(1, step))
  }

  // 隐藏按钮
  const hideAiButton = () => {
    queryVersion += 1
    activeClientId.value = ''
    pendingClientId.value = ''
    showAiButton.value = false
    showAiDrawer.value = false
    bubbleConfig.value = {}
    clearBubbleUnread()
  }

  const resetAgentState = (clearClient = true) => {
    if (clearClient) {
      activeClientId.value = ''
      pendingClientId.value = ''
    }
    showAiButton.value = false
    showAiDrawer.value = false
    agentList.value = []
    parameters.value = {}
    bubbleConfig.value = {}
    clearBubbleUnread()
  }

  // 关闭窗口/显示窗口
  const setDrawer = (bool: boolean) => {
    showAiDrawer.value = bool
    if (bool) {
      clearBubbleUnread()
    }
  }

  const openAgentConversation = (
    list: any[] = [],
    _parameters: Record<string, any> = {},
    open = true,
  ) => {
    queryVersion += 1
    activeClientId.value = String(_parameters?.clientId || _parameters?.subjectId || '')
    pendingClientId.value = ''
    agentList.value = Array.isArray(list) ? list : []
    parameters.value = _parameters || {}
    setBubbleConfig(parameters.value)
    showAiButton.value = agentList.value.length > 0
    showAiDrawer.value = Boolean(open && agentList.value.length)
    if (showAiDrawer.value) {
      clearBubbleUnread()
    }
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
    pendingClientId.value = clientId
    resetAgentState(false)

    const supported = await ensureAiAgentSupport()
    if (!supported || currentVersion !== queryVersion) {
      if (currentVersion === queryVersion) {
        pendingClientId.value = ''
        activeClientId.value = ''
      }
      return
    }

    try {
      const resp = await queryAgentList('pagePoint', clientId)
      if (currentVersion !== queryVersion) {
        return
      }
      pendingClientId.value = ''
      if (resp.success && Array.isArray(resp.result) && resp.result.length) {
        agentList.value = resp.result
        showAiButton.value = true
        parameters.value = _parameters
        setBubbleConfig(_parameters)
        activeClientId.value = clientId
      } else {
        activeClientId.value = ''
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
    bubbleConfig,
    bubbleUnreadCount,
    activeClientId,
    pendingClientId,
    aiAgentSupported,
    hideAiButton,
    queryAgent,
    setDrawer,
    openAgentConversation,
    clearBubbleUnread,
    incrementBubbleUnread,
  }
})

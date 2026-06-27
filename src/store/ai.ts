import {defineStore} from "pinia";
import {queryAgentList} from "@jetlinks-web-core/api/comm";
import {useAuthStore} from "@jetlinks-web-core/store/auth";
import {ACCESS_AI_AGENT_CODE, USER_CENTER_MENU_CODE} from "@jetlinks-web-core/utils/consts";

export const useAIStore = defineStore('ai', () => {
  const showAiButton = ref(false)
  const showAiDrawer = ref(false)
  const agentList = ref<any[]>([])
  const parameters = ref<any>({})

  const isPermission = useAuthStore().hasPermission(
      `${USER_CENTER_MENU_CODE}:${ACCESS_AI_AGENT_CODE}`,
  );

  // 隐藏按钮
  const hideAiButton = () => {
    showAiButton.value = false
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
  // 查询智能体列表
  const queryAgent = async (clientId: string, _parameters: Record<string, any> = {}) => {
    resetAgentState()
    if (isPermission) {
      const resp = await queryAgentList('pagePoint', clientId)
      if (resp.success && Array.isArray(resp.result) && resp.result.length) {
        agentList.value = resp.result
        showAiButton.value = true
        parameters.value = _parameters
      }
    }
  }

  return {
    showAiButton,
    showAiDrawer,
    agentList,
    parameters,
    hideAiButton,
    queryAgent,
    setDrawer
  }
})

import { computed, onBeforeUnmount, watch } from 'vue'
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import i18n from '@jetlinks-web-core/locales'
import { useAIStore } from '@jetlinks-web-core/store/ai'
import {
  createGeneralAgentRuntime,
  PROJECT_GENERAL_AGENT_CLIENT_ID,
  PROJECT_GENERAL_AGENT_SUBJECT_TYPE,
  type GeneralAgentContextAdapter,
  type GeneralAgentRuntime,
} from '@jetlinks-web-core/layout/components/AiChat/generalAgentRuntime'
import { createProjectGeneralAgentSessionClientId } from '@jetlinks-web-core/layout/components/AiChat/useProjectGeneralAgentDeployment'
import {
  createGeneralAgentExtensionLoaderTool,
  loadGeneralAgentExtensions,
} from '@jetlinks-web-core/layout/components/AiChat/generalAgentExtensionLoader'
import { HOME_AGENT_CAPABILITY_CHANGE_EVENT } from '@jetlinks-web-core/layout/components/AiChat/homeAgentCapabilities'
import { getProjectIdFromLocation, normalizeProjectRuntimePath } from '@jetlinks-web-core/utils/project-runtime'
import { getProjectStorage } from '@jetlinks-web-core/utils/project-storage'
import { useMenuStore } from '@/store/menu'
import { createProjectBubbleParameters } from '../utils/projectGeneralAgent'

type ProjectMenu = Record<string, any> & { children?: ProjectMenu[] }

export interface ProjectGeneralAgentRuntimeOptions {
  route: RouteLocationNormalizedLoaded
  router: Router
  projectId: string
  projectName?: string
  menus: ProjectMenu[]
  getLatestUserMessage?: () => Record<string, any> | undefined
  onConversationMessage?: (message: Record<string, any>) => void
  onCapabilitiesLoaded?: () => void
}

const normalizeText = (value: unknown) => String(value || '').trim()

const findProjectMenu = (menus: ProjectMenu[], value: string): ProjectMenu | undefined => {
  const target = normalizeText(value).toLowerCase()
  if (!target) return undefined

  for (const menu of menus) {
    const values = [menu.code, menu.name, menu.routeName, menu.path, menu.url]
      .map(item => normalizeText(item).toLowerCase())
    if (values.includes(target)) return menu
    const child = findProjectMenu(menu.children || [], value)
    if (child) return child
  }
  return undefined
}

const createProjectContextAdapter = (
  menus: ProjectMenu[],
  router: Router,
): GeneralAgentContextAdapter => ({
  getMenus: () => menus,
  navigateToMenu: (value, options) => {
    const menu = findProjectMenu(menus, value)
    const path = normalizeText(menu?.path || menu?.url)
    if (!path) return false
    void router.push({
      path: normalizeProjectRuntimePath(path),
      query: options?.query || {},
    })
    return true
  },
  navigateToRoute: (routeName, options) => {
    if (!router.hasRoute(routeName)) return false
    void router.push({
      name: routeName,
      params: options?.params || {},
      query: options?.query || {},
    })
    return true
  },
})

export const createProjectGeneralAgentRuntime = (
  options: ProjectGeneralAgentRuntimeOptions,
): GeneralAgentRuntime => {
  const projectName = normalizeText(options.projectName)
    || normalizeText(getProjectStorage(options.projectId)?.name)
    || options.projectId

  const runtime = createGeneralAgentRuntime({
    currentView: () => String(options.route.name || options.route.path || ''),
    contextAdapter: createProjectContextAdapter(options.menus, options.router),
    subjectType: PROJECT_GENERAL_AGENT_SUBJECT_TYPE,
    subjectId: options.projectId,
    subjectName: i18n.global.t('ProjectGeneralAgent.subjectName', [projectName]),
    conversationTitle: i18n.global.t('data.aiData.projectAiSearchHub.name'),
    extraTools: () => [createGeneralAgentExtensionLoaderTool(options.onCapabilitiesLoaded)],
    getLatestUserMessage: options.getLatestUserMessage,
    onConversationMessage: options.onConversationMessage,
    systemPromptLines: [i18n.global.t('ProjectGeneralAgent.scopePrompt', [projectName])],
  })
  return {
    ...runtime,
    parameters: {
      ...runtime.parameters,
      sessionClientId: createProjectGeneralAgentSessionClientId(options.projectId),
    },
  }
}

export function useProjectGeneralAgent(route: RouteLocationNormalizedLoaded, router: Router) {
  const aiStore = useAIStore()
  const projectMenuStore = useMenuStore()
  const projectId = computed(() => normalizeText(getProjectIdFromLocation()) || projectMenuStore.projectId)
  let syncing = false
  let syncTimer: number | undefined
  let latestUserMessage: Record<string, any> | undefined
  let managedClientId = ''
  let preparedPageClientId = ''

  const isHubRoute = () => normalizeProjectRuntimePath(route.path) === '/ai-search-hub'

  const getPageClientId = () => normalizeText(
    route.meta?.pageAgentClientId
    || route.meta?.aiAgentClientId
    || (route.meta?.pageAgent as Record<string, any> | undefined)?.clientId,
  )

  const releasePreparedPageAgent = () => {
    if (!preparedPageClientId) return
    aiStore.releaseAgentConversation(preparedPageClientId)
    preparedPageClientId = ''
  }

  const preparePageAgent = () => {
    const clientId = getPageClientId()
    if (!clientId || clientId === PROJECT_GENERAL_AGENT_CLIENT_ID) {
      releasePreparedPageAgent()
      return false
    }
    if (preparedPageClientId && preparedPageClientId !== clientId) {
      releasePreparedPageAgent()
    }
    if (aiStore.pendingClientId === clientId || aiStore.activeClientId === clientId) {
      preparedPageClientId = clientId
      return true
    }
    aiStore.prepareAgentConversation(clientId)
    preparedPageClientId = clientId
    return true
  }

  const recordConversationMessage = (message: Record<string, any>) => {
    if (message?.type !== 'user') return
    const content = normalizeText(message.content || message.text || message.payload?.content)
    if (!content) return
    latestUserMessage = {
      id: normalizeText(message.id) || undefined,
      type: 'user',
      content,
      createdAt: Number(message.createdAt) || Date.now(),
    }
  }

  const buildRuntime = () => {
    const projectName = normalizeText(getProjectStorage(projectId.value)?.name) || projectId.value
    const runtime = createProjectGeneralAgentRuntime({
      route,
      router,
      projectId: projectId.value,
      projectName,
      menus: projectMenuStore.siderMenus as ProjectMenu[],
      getLatestUserMessage: () => latestUserMessage,
      onConversationMessage: recordConversationMessage,
      onCapabilitiesLoaded: refreshParameters,
    })
    return {
      ...runtime,
      parameters: createProjectBubbleParameters(runtime),
    }
  }

  const refreshParameters = () => {
    if (getPageClientId() || aiStore.activeClientId !== PROJECT_GENERAL_AGENT_CLIENT_ID) return
    if (!aiStore.agentList.length) return
    aiStore.parameters = {
      ...aiStore.parameters,
      ...buildRuntime().parameters,
      projectId: projectId.value,
    }
  }

  const sync = async () => {
    if (!projectId.value || !projectMenuStore.initialized || syncing) return
    if (isHubRoute()) {
      releasePreparedPageAgent()
      if (managedClientId) aiStore.releaseAgentConversation(managedClientId)
      managedClientId = ''
      return
    }
    // 页面专用助手由页面自身组装参数并查询；项目壳层只预留会话，避免覆盖专用上下文。
    if (preparePageAgent()) {
      if (managedClientId) aiStore.releaseAgentConversation(managedClientId)
      managedClientId = ''
      return
    }

    const clientId = PROJECT_GENERAL_AGENT_CLIENT_ID
    if (managedClientId && managedClientId !== clientId) {
      aiStore.releaseAgentConversation(managedClientId)
      managedClientId = ''
    }
    if (aiStore.activeClientId === clientId && aiStore.agentList.length) {
      managedClientId = clientId
      refreshParameters()
      return
    }
    if (aiStore.pendingClientId && aiStore.pendingClientId !== clientId) return
    if (aiStore.showAiButton && aiStore.activeClientId !== clientId) return

    syncing = true
    try {
      await loadGeneralAgentExtensions({ loadAll: true })
      const runtime = buildRuntime()
      await aiStore.queryAgent(clientId, {
        ...runtime.parameters,
        projectId: projectId.value,
        scopeType: PROJECT_GENERAL_AGENT_SUBJECT_TYPE,
        scopeKey: projectId.value,
      })
      managedClientId = clientId
      if (aiStore.activeClientId === clientId) refreshParameters()
      else managedClientId = ''
    } finally {
      syncing = false
    }
  }

  const scheduleSync = () => {
    if (syncTimer) window.clearTimeout(syncTimer)
    syncTimer = window.setTimeout(() => {
      syncTimer = undefined
      void sync()
    }, 160)
  }

  watch(
    () => [route.fullPath, projectId.value, projectMenuStore.initialized, projectMenuStore.siderMenus.length],
    scheduleSync,
    { immediate: true, flush: 'post' },
  )

  window.addEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, scheduleSync)
  onBeforeUnmount(() => {
    if (syncTimer) window.clearTimeout(syncTimer)
    releasePreparedPageAgent()
    if (managedClientId) aiStore.releaseAgentConversation(managedClientId)
    window.removeEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, scheduleSync)
  })
}

import type { RouteLocationNormalizedLoaded, Router } from 'vue-router'
import i18n from '@jetlinks-web-core/locales'
import {
  createGeneralAgentRuntime,
  PROJECT_GENERAL_AGENT_SUBJECT_TYPE,
  type GeneralAgentCapability,
  type GeneralAgentContext,
  type GeneralAgentContextAdapter,
  type GeneralAgentRuntime,
} from './generalAgentRuntime'
import { createGeneralAgentExtensionLoaderTool } from './generalAgentExtensionLoader'
import { createProjectGeneralAgentSessionClientId } from './useProjectGeneralAgentDeployment'
import { normalizeProjectRuntimePath } from '@jetlinks-web-core/utils/project-runtime'
import { getProjectStorage } from '@jetlinks-web-core/utils/project-storage'

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

const PROJECT_PROMPT_EXAMPLE_LIMIT = 3
const DEVICE_MENU_ANCHORS = ['iot-user/device/overview', 'iot-user/device/list']
const ALARM_MENU_ANCHORS = ['iot-user/device/alarm', 'alarm', 'alarm/alarmEvents']

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeRouteKey = (value: unknown) => normalizeText(value)
  .replace(/^\/+|\/+$/g, '')
  .toLowerCase()

const uniquePromptExamples = (items: unknown[]) => {
  const seen = new Set<string>()
  return items.reduce<string[]>((result, item) => {
    const text = normalizeText(item)
    if (!text || seen.has(text)) return result
    seen.add(text)
    result.push(text)
    return result
  }, [])
}

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

const hasProjectMenu = (context: GeneralAgentContext, anchors: string[]) => (
  anchors.some(anchor => !!context.findMenu(anchor))
)

const isCurrentRouteCapability = (
  capability: GeneralAgentCapability,
  context: GeneralAgentContext,
) => {
  if (capability.metadata?.currentRoute) return true
  const currentRouteKeys = new Set([
    context.currentRoute.name,
    context.currentRoute.path,
  ].map(normalizeRouteKey).filter(Boolean))
  return [capability.menuCode, capability.routeName, capability.path]
    .map(normalizeRouteKey)
    .some(key => !!key && currentRouteKeys.has(key))
}

const resolveScenePromptExamples = (context: GeneralAgentContext) => uniquePromptExamples(
  context.capabilities
    .filter(capability => isCurrentRouteCapability(capability, context))
    .flatMap(capability => capability.metadata?.promptExamples || []),
)

export const createProjectBubbleParameters = (
  runtime: GeneralAgentRuntime,
) => {
  const context = runtime.getContext()
  const hasDeviceMenu = hasProjectMenu(context, DEVICE_MENU_ANCHORS)
  const hasAlarmMenu = hasProjectMenu(context, ALARM_MENU_ANCHORS)
  // Provider scene prompts win over generic navigation prompts, so page-specific work stays visible.
  const promptExamples = uniquePromptExamples([
    ...resolveScenePromptExamples(context),
    i18n.global.t('ProjectGeneralAgent.prompt.currentPage'),
    ...(hasDeviceMenu ? [i18n.global.t('ProjectGeneralAgent.prompt.deviceEntry')] : []),
    ...(hasAlarmMenu ? [i18n.global.t('ProjectGeneralAgent.prompt.alarmEntry')] : []),
    ...(!hasDeviceMenu && !hasAlarmMenu
      ? [i18n.global.t('ProjectGeneralAgent.prompt.availableFeatures')]
      : []),
  ]).slice(0, PROJECT_PROMPT_EXAMPLE_LIMIT)

  return {
    ...runtime.parameters,
    promptExamples,
    bubbleIcon: 'MessageOutlined',
    bubbleIconBadge: 'ThunderboltOutlined',
    bubbleTooltip: i18n.global.t('ProjectGeneralAgent.bubbleTooltip'),
  }
}

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

import i18n from '@jetlinks-web-core/locales'
import type {
  GeneralAgentCapability,
  GeneralAgentContext,
  GeneralAgentRuntime,
} from '@jetlinks-web-core/layout/components/AiChat/generalAgentRuntime'

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
  // Provider 场景词条优先于权限感知的通用词条，避免固定导航文案覆盖页面专属任务。
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

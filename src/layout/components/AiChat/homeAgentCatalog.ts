import i18n from '@jetlinks-web-core/locales'
import type {
  HomeAgentCapability,
  HomeAgentCapabilityContext,
  HomeAgentMenuEntry,
} from './homeAgentContracts'
import {
  isPlainRecord,
  normalizeKeyword,
  normalizeText,
  toArray,
  uniqueStrings,
} from './homeAgentShared'
import { searchHomeAgentCapabilities } from './homeAgentCapabilitySearch'

export const filterHomeAgentCapabilities = (
  capabilities: HomeAgentCapability[],
  args: Record<string, any>,
) => {
  return searchHomeAgentCapabilities(capabilities, args)
}

const compactContinuation = (value: unknown) => {
  if (!isPlainRecord(value)) return undefined
  const blockingFacts = Array.isArray(value.blockingFacts)
    ? value.blockingFacts.map(normalizeText).filter(Boolean)
    : []
  const continuation = {
    targetName: normalizeText(value.targetName) || undefined,
    promptPolicy: normalizeText(value.promptPolicy) || undefined,
    blockingFacts: blockingFacts.length ? blockingFacts : undefined,
  }
  return Object.values(continuation).some(Boolean) ? continuation : undefined
}

export const compactHomeAgentCapability = (item: HomeAgentCapability) => {
  const menuAnchor = item.menuCode || item.routeName
  const link = menuAnchor
    ? `#menu=${encodeURIComponent(String(menuAnchor))}`
    : undefined
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    description: item.description,
    category: item.category,
    menuCode: item.menuCode,
    routeName: item.routeName,
    path: item.path,
    link,
    markdownLink: link ? `[${item.name}](${link})` : undefined,
    clientId: item.clientId,
    clientType: item.clientType,
    continuation: compactContinuation(item.metadata?.continuation),
  }
}

export const hasHomeAgentContinuationCapabilities = (context: HomeAgentCapabilityContext) => (
  context.capabilities.some(item => isPlainRecord(item.metadata?.continuation))
)

const isCurrentMenu = (menu: HomeAgentMenuEntry, context: HomeAgentCapabilityContext) => {
  const routeName = normalizeKeyword(context.currentRoute.name)
  const routePath = normalizeKeyword(context.currentRoute.path)
  return (
    (!!routeName && (
      normalizeKeyword(menu.routeName) === routeName
      || normalizeKeyword(menu.code) === routeName
    ))
    || (!!routePath && normalizeKeyword(menu.path) === routePath)
  )
}

const isLikelyContainerMenu = (menu: HomeAgentMenuEntry) => (
  !menu.path && menu.breadcrumb.length <= 1
)

const getCurrentMenu = (context: HomeAgentCapabilityContext) => (
  context.menus.find(menu => isCurrentMenu(menu, context))
)

const isHomeRoute = (context: HomeAgentCapabilityContext) => {
  const currentMenu = getCurrentMenu(context)
  const path = normalizeKeyword(context.currentRoute.path)
  const name = normalizeKeyword(context.currentRoute.name)
  return currentMenu?.code === 'home'
    || currentMenu?.path === '/iot/home'
    || path === '/iot/home'
    || name === 'home'
}

const scorePromptMenu = (menu: HomeAgentMenuEntry, currentMenu?: HomeAgentMenuEntry) => {
  let score = 0
  const title = normalizeKeyword(menu.title)
  if (currentMenu?.breadcrumb?.[0] && menu.breadcrumb[0] === currentMenu.breadcrumb[0]) score += 30
  if (currentMenu?.breadcrumb?.[1] && menu.breadcrumb[1] === currentMenu.breadcrumb[1]) score += 10
  if (menu.path) score += 10
  if (menu.breadcrumb.length > 1) score += 8
  if (/首页|仪表盘|dashboard|home/i.test(title)) score -= 20
  return score
}

const selectPromptMenu = (context: HomeAgentCapabilityContext) => {
  const currentMenu = getCurrentMenu(context)
  const candidates = context.menus.filter(menu => (
    !isCurrentMenu(menu, context) && !isLikelyContainerMenu(menu)
  ))
  return candidates.slice().sort((a, b) => scorePromptMenu(b, currentMenu) - scorePromptMenu(a, currentMenu))[0]
}

const isCapabilityForCurrentRoute = (
  capability: HomeAgentCapability,
  context: HomeAgentCapabilityContext,
) => {
  if (capability.kind === 'menu') return false
  if (capability.metadata?.currentRoute) return true
  const currentMenu = getCurrentMenu(context)
  const routeName = normalizeKeyword(context.currentRoute.name)
  const routePath = normalizeKeyword(context.currentRoute.path)
  return (
    (!!capability.menuCode && currentMenu?.code === capability.menuCode)
    || (!!capability.routeName && (
      normalizeKeyword(capability.routeName) === routeName
      || currentMenu?.routeName === capability.routeName
    ))
    || (!!capability.path && normalizeKeyword(capability.path) === routePath)
  )
}

const getCapabilityPromptExamples = (capability: HomeAgentCapability) => {
  const prompts = toArray(capability.metadata?.promptExamples)
  return prompts.length
    ? prompts
    : [i18n.global.t('components.AiChat.homeAgent.promptExamples.capability', [capability.name])]
}

export const interleavePromptGroups = (groups: string[][]) => {
  const normalizedGroups = groups.map(uniqueStrings).filter(group => group.length)
  if (!normalizedGroups.length) return []
  const result: string[] = []
  const maxLength = Math.max(...normalizedGroups.map(group => group.length))
  for (let index = 0; index < maxLength; index += 1) {
    normalizedGroups.forEach((group) => {
      if (group[index]) result.push(group[index])
    })
  }
  return uniqueStrings(result)
}

const buildCurrentRouteExamples = (context: HomeAgentCapabilityContext) => (
  interleavePromptGroups(
    context.capabilities
      .filter(item => isCapabilityForCurrentRoute(item, context))
      .map(getCapabilityPromptExamples),
  )
)

const buildHomeRouteExamples = (context: HomeAgentCapabilityContext) => {
  const currentMenu = getCurrentMenu(context)
  const capabilityExamples = interleavePromptGroups(
    context.capabilities
      .filter(capability => !!capability.kind && capability.kind !== 'menu')
      .filter(capability => toArray(capability.metadata?.promptExamples).length)
      .map(getCapabilityPromptExamples),
  )
  const menuExamples = context.menus
    .filter(menu => !isLikelyContainerMenu(menu))
    .sort((a, b) => scorePromptMenu(b, currentMenu) - scorePromptMenu(a, currentMenu))
    .slice(0, 3)
    .map(menu => i18n.global.t('components.AiChat.homeAgent.promptExamples.openMenu', [menu.title]))
  const agentCount = context.capabilities.filter(item => item.kind === 'agent').length
  return uniqueStrings([
    ...capabilityExamples,
    ...(context.findMenu('device/Instance')
      ? [i18n.global.t('components.AiChat.homeAgent.promptExamples.openDevice')]
      : []),
    ...(agentCount > 0 && !capabilityExamples.length
      ? [i18n.global.t('components.AiChat.homeAgent.promptExamples.listAgents')]
      : []),
    ...(!capabilityExamples.length ? menuExamples : []),
    i18n.global.t('components.AiChat.homeAgent.promptExamples.findMenu'),
  ])
}

export const buildHomeAgentCapabilityPromptExamples = (context: HomeAgentCapabilityContext) => {
  const currentExamples = buildCurrentRouteExamples(context)
  if (currentExamples.length) return currentExamples
  if (isHomeRoute(context)) return buildHomeRouteExamples(context)

  const examples: string[] = []
  const menu = selectPromptMenu(context)
  const agentCount = context.capabilities.filter(item => item.kind === 'agent').length
  if (menu) {
    examples.push(i18n.global.t('components.AiChat.homeAgent.promptExamples.openMenu', [menu.title]))
  }
  if (agentCount > 0) {
    examples.push(i18n.global.t('components.AiChat.homeAgent.promptExamples.listAgents'))
  }
  examples.push(i18n.global.t('components.AiChat.homeAgent.promptExamples.findMenu'))
  return examples
}

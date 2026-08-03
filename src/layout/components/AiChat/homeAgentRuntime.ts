import i18n from '@jetlinks-web-core/locales'
import { resolveClientCapabilityLoaderToolId } from './clientCapabilityLoader'
import { createAiClientToolRuntime } from './clientTools'
import { createHomeAgentBaseTools } from './homeAgentBaseTools'
import {
  buildHomeAgentCapabilityPromptExamples,
  hasHomeAgentContinuationCapabilities,
  interleavePromptGroups,
} from './homeAgentCatalog'
import type {
  HomeAgentCapabilityContext,
  HomeAgentRuntime,
  HomeAgentRuntimeOptions,
} from './homeAgentContracts'
import {
  HOME_AGENT_CLIENT_ID,
  HOME_AGENT_SUBJECT_TYPE,
  HOME_AGENT_TOOL_SCOPE,
} from './homeAgentContracts'
import { createHomeAgentContext } from './homeAgentContext'
import { createHomeAgentMarkdownLinkHandler } from './homeAgentHandoff'
import { homeAgentCapabilityRegistry } from './homeAgentRegistry'
import {
  HOME_AGENT_PROMPT_EXAMPLE_LIMIT,
  resolveMaybeArray,
  resolveOptionText,
  toArray,
  uniqueStrings,
} from './homeAgentShared'

const getProviders = (options: HomeAgentRuntimeOptions) => (
  homeAgentCapabilityRegistry.getProviders(options.providerScopes || 'home')
)

const buildProviderTools = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => getProviders(options).flatMap(provider => toArray(provider.getClientTools?.(context)))

const buildProviderWorkflowGuides = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => getProviders(options).flatMap(provider => toArray(provider.getWorkflowGuides?.(context)))

const buildProviderPromptExamples = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => interleavePromptGroups(
  getProviders(options).map(provider => toArray(provider.getPromptExamples?.(context))),
)

const buildProviderSystemPromptLines = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => getProviders(options).flatMap(provider => toArray(provider.getSystemPromptLines?.(context)))

const buildHomeAgentSystemPrompt = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
  capabilityLoaderToolId?: string,
) => {
  const topMenus = context.menus.slice(0, 8).map(menu => `${menu.title}(${menu.code})`).join('、')
  return [
    i18n.global.t('components.AiChat.homeAgent.prompt.role'),
    i18n.global.t('components.AiChat.homeAgent.prompt.discovery'),
    capabilityLoaderToolId
      ? i18n.global.t('components.AiChat.homeAgent.prompt.dynamicLoading', [capabilityLoaderToolId])
      : '',
    i18n.global.t('components.AiChat.homeAgent.prompt.execution'),
    i18n.global.t('components.AiChat.homeAgent.prompt.navigation'),
    i18n.global.t('components.AiChat.homeAgent.prompt.menuLinks'),
    i18n.global.t('components.AiChat.homeAgent.prompt.boundary'),
    hasHomeAgentContinuationCapabilities(context)
      ? i18n.global.t('components.AiChat.homeAgent.prompt.continuation')
      : '',
    topMenus
      ? i18n.global.t('components.AiChat.homeAgent.prompt.visibleMenus', [topMenus])
      : i18n.global.t('components.AiChat.homeAgent.prompt.noMenus'),
    ...toArray(options.systemPromptLines),
    ...buildProviderSystemPromptLines(context, options),
  ].filter(Boolean).join('\n')
}

const buildHomeAgentToolsDescription = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => options.toolsDescription || [
  i18n.global.t('components.AiChat.homeAgent.toolsDescription'),
  i18n.global.t('components.AiChat.homeAgent.toolsDescriptionStats', [
    context.menus.length,
    context.capabilities.length,
  ]),
].join('\n')

const buildHomeAgentPromptExampleCandidates = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => uniqueStrings([
  ...(options.promptExamples || []),
  ...buildProviderPromptExamples(context, options),
  ...buildHomeAgentCapabilityPromptExamples(context),
])

export const createHomeAgentRuntime = (
  options: HomeAgentRuntimeOptions = {},
): HomeAgentRuntime => {
  const getContext = () => createHomeAgentContext(options)
  const context = getContext()
  const runtime = createAiClientToolRuntime<HomeAgentCapabilityContext>(
    () => {
      const currentContext = getContext()
      return [
        ...createHomeAgentBaseTools(),
        ...buildProviderTools(currentContext, options),
        ...resolveMaybeArray(options.extraTools),
      ]
    },
    {
      toolsName: options.toolsName || i18n.global.t('components.AiChat.homeAgent.toolsName'),
      toolsDescription: buildHomeAgentToolsDescription(context, options),
      registeredToolScopes: uniqueStrings([
        HOME_AGENT_TOOL_SCOPE,
        ...toArray(options.registeredToolScopes),
      ]),
      getContext,
      resultGuard: {
        maxJsonLength: 64 * 1024,
        maxArrayLength: 30,
        maxObjectKeys: 64,
      },
      riskDefaults: {
        readOnly: true,
        parallelSafe: true,
        needsApproval: false,
      },
    },
  )
  const capabilityLoaderToolId = resolveClientCapabilityLoaderToolId(runtime.clientTools)
  const subjectType = resolveOptionText(options.subjectType) || HOME_AGENT_SUBJECT_TYPE
  const subjectId = resolveOptionText(options.subjectId) || HOME_AGENT_CLIENT_ID
  const subjectName = resolveOptionText(options.subjectName)
    || i18n.global.t('components.AiChat.homeAgent.subjectName')
  const conversationTitle = resolveOptionText(options.conversationTitle)
    || i18n.global.t('components.AiChat.homeAgent.conversationTitle')
  const promptExamples = buildHomeAgentPromptExampleCandidates(context, options)

  return {
    ...runtime,
    getContext,
    promptExamples,
    parameters: {
      subjectType,
      subjectId,
      subjectName,
      conversationTitle,
      currentView: context.currentView,
      currentRoute: context.currentRoute,
      clientTools: runtime.clientTools,
      clientToolsVersion: runtime.clientToolsVersion,
      clientToolHandler: runtime.handleClientToolCall,
      clientToolsName: runtime.clientToolsName,
      clientToolsDescription: runtime.clientToolsDescription,
      workflowGuides: buildProviderWorkflowGuides(context, options),
      markdownLinkHandler: createHomeAgentMarkdownLinkHandler(options),
      ...(options.onConversationMessage ? { onConversationMessage: options.onConversationMessage } : {}),
      systemPrompt: buildHomeAgentSystemPrompt(context, options, capabilityLoaderToolId),
      openingStatement: options.openingStatement || i18n.global.t('components.AiChat.homeAgent.opening'),
      promptExamples: promptExamples.slice(0, HOME_AGENT_PROMPT_EXAMPLE_LIMIT),
    },
  }
}

import {
  buildHomeAgentCapabilityPromptExamples,
  hasHomeAgentContinuationCapabilities,
  interleavePromptGroups,
} from './homeAgentCatalog'
import {
  AI_CLIENT_TOOL_EVIDENCE_NARRATIVE_CONTRACT,
  type AiClientToolRuntime,
} from './clientTools'
import { normalizeClientSkillBindingContribution } from './clientSkillBindings'
import {
  HOME_AGENT_CLIENT_ID,
  HOME_AGENT_SUBJECT_TYPE,
  type HomeAgentCapabilityContext,
  type HomeAgentCapabilityProvider,
  type HomeAgentRuntimeOptions,
} from './homeAgentContracts'
import { HOME_AGENT_PROMPT_EXAMPLE_LIMIT } from './homeAgentShared'
import {
  readHomeAgentProviderContribution,
  resolveOptionText,
  toArray,
  uniqueStrings,
} from './homeAgentShared'

export interface HomeAgentParameterComposerInput {
  context: HomeAgentCapabilityContext
  options: HomeAgentRuntimeOptions
  providers: () => HomeAgentCapabilityProvider[]
  runtime: AiClientToolRuntime
  capabilityLoaderToolId?: string
  markdownLinkHandler: unknown
  translate: (key: string, values?: unknown[]) => any
}

const getProviderWorkflowGuides = (context: HomeAgentCapabilityContext, providers: () => HomeAgentCapabilityProvider[]) => (
  providers().flatMap(provider => readHomeAgentProviderContribution(
    provider.id,
    'workflowGuides',
    () => provider.getWorkflowGuides?.(context),
  ))
)

const getProviderPromptExamples = (context: HomeAgentCapabilityContext, providers: () => HomeAgentCapabilityProvider[]) => (
  interleavePromptGroups(providers().map(provider => readHomeAgentProviderContribution(
    provider.id,
    'promptExamples',
    () => provider.getPromptExamples?.(context),
  )))
)

const getProviderSystemPromptLines = (context: HomeAgentCapabilityContext, providers: () => HomeAgentCapabilityProvider[]) => (
  providers().flatMap(provider => readHomeAgentProviderContribution(
    provider.id,
    'systemPromptLines',
    () => provider.getSystemPromptLines?.(context),
  ))
)

const getProviderSkillBindings = (context: HomeAgentCapabilityContext, providers: () => HomeAgentCapabilityProvider[]) => (
  normalizeClientSkillBindingContribution(providers().flatMap(provider => (
    readHomeAgentProviderContribution(
      provider.id,
      'skillBindings',
      () => provider.getSkillBindings?.(context),
    )
  )))
)

export const composeHomeAgentParameters = ({
  context,
  options,
  providers,
  runtime,
  capabilityLoaderToolId,
  markdownLinkHandler,
  translate,
}: HomeAgentParameterComposerInput) => {
  const topMenus = context.menus.slice(0, 8).map(menu => `${menu.title}(${menu.code})`).join('、')
  const systemPrompt = [
    translate('components.AiChat.homeAgent.prompt.role'),
    translate('components.AiChat.homeAgent.prompt.discovery'),
    capabilityLoaderToolId ? translate('components.AiChat.homeAgent.prompt.dynamicLoading', [capabilityLoaderToolId]) : '',
    translate('components.AiChat.homeAgent.prompt.execution'),
    AI_CLIENT_TOOL_EVIDENCE_NARRATIVE_CONTRACT,
    translate('components.AiChat.homeAgent.prompt.navigation'),
    translate('components.AiChat.homeAgent.prompt.menuLinks'),
    translate('components.AiChat.homeAgent.prompt.boundary'),
    hasHomeAgentContinuationCapabilities(context) ? translate('components.AiChat.homeAgent.prompt.continuation') : '',
    topMenus
      ? translate('components.AiChat.homeAgent.prompt.visibleMenus', [topMenus])
      : translate('components.AiChat.homeAgent.prompt.noMenus'),
    ...toArray(options.systemPromptLines),
    ...getProviderSystemPromptLines(context, providers),
  ].filter(Boolean).join('\n')
  const promptExamples = uniqueStrings([
    ...(options.promptExamples || []),
    ...getProviderPromptExamples(context, providers),
    ...buildHomeAgentCapabilityPromptExamples(context),
  ])
  const subjectType = resolveOptionText(options.subjectType) || HOME_AGENT_SUBJECT_TYPE
  const subjectId = resolveOptionText(options.subjectId) || HOME_AGENT_CLIENT_ID
  const subjectName = resolveOptionText(options.subjectName) || translate('components.AiChat.homeAgent.subjectName')
  const conversationTitle = resolveOptionText(options.conversationTitle) || translate('components.AiChat.homeAgent.conversationTitle')

  return {
    promptExamples,
    skillBindings: getProviderSkillBindings(context, providers),
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
      workflowGuides: getProviderWorkflowGuides(context, providers),
      markdownLinkHandler,
      ...(options.onConversationMessage ? { onConversationMessage: options.onConversationMessage } : {}),
      systemPrompt,
      openingStatement: options.openingStatement || translate('components.AiChat.homeAgent.opening'),
      promptExamples: promptExamples.slice(0, HOME_AGENT_PROMPT_EXAMPLE_LIMIT),
    },
  }
}

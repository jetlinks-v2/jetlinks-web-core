import i18n from '@jetlinks-web-core/locales'
import { resolveClientCapabilityLoaderToolId } from './clientCapabilityLoader'
import { createAiClientToolRuntime } from './clientTools'
import { createHomeAgentBaseTools } from './homeAgentBaseTools'
import { composeHomeAgentParameters } from './homeAgentParameterComposition'
import type {
  HomeAgentCapabilityContext,
  HomeAgentRuntime,
  HomeAgentRuntimeOptions,
} from './homeAgentContracts'
import { HOME_AGENT_TOOL_SCOPE } from './homeAgentContracts'
import { createHomeAgentContext } from './homeAgentContext'
import { createHomeAgentMarkdownLinkHandler } from './homeAgentHandoff'
import { homeAgentCapabilityRegistry } from './homeAgentRegistry'
import { readHomeAgentProviderContribution, resolveMaybeArray, toArray, uniqueStrings } from './homeAgentShared'

const getProviders = (options: HomeAgentRuntimeOptions) => (
  homeAgentCapabilityRegistry.getProviders(options.providerScopes || 'home')
)

const buildProviderTools = (
  context: HomeAgentCapabilityContext,
  options: HomeAgentRuntimeOptions,
) => getProviders(options).flatMap(provider => readHomeAgentProviderContribution(
  provider.id,
  'clientTools',
  () => provider.getClientTools?.(context),
))

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
  const composition = composeHomeAgentParameters({
    context,
    options,
    providers: () => getProviders(options),
    runtime,
    capabilityLoaderToolId,
    markdownLinkHandler: createHomeAgentMarkdownLinkHandler(options),
    translate: i18n.global.t,
  })

  return {
    ...runtime,
    getContext,
    ...composition,
  }
}

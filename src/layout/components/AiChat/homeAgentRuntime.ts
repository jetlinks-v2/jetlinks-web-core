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
import { HOME_AGENT_CAPABILITY_CHANGE_EVENT, HOME_AGENT_TOOL_SCOPE } from './homeAgentContracts'
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
).map(tool => ({ ...tool, executionBinding: tool.executionBinding || provider })))

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
  // Rebuild localized declarations while retaining the runtime-owned execution lifetime.
  const baseOwner = {}
  const runtime = createAiClientToolRuntime<HomeAgentCapabilityContext>(
    () => {
      const currentContext = getContext()
      return [
        ...createHomeAgentBaseTools().map(tool => ({ ...tool, executionBinding: baseOwner })),
        ...buildProviderTools(currentContext, options),
        ...resolveMaybeArray(options.extraTools).map(tool => ({
          ...tool,
          ...(typeof options.extraTools === 'function'
            ? { executionBinding: tool.executionBinding || options.extraTools } : {}),
        })),
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
  let disposed = false
  const capabilityChangeTarget = window
  // Revoke changed provider bindings synchronously, before debounced host parameter updates.
  const refreshProviderTools = () => {
    if (disposed) return
    runtime.refreshClientTools()
  }
  const composeParameters = () => composeHomeAgentParameters({
    context: getContext(),
    options,
    providers: () => getProviders(options),
    runtime,
    capabilityLoaderToolId,
    markdownLinkHandler: createHomeAgentMarkdownLinkHandler(options),
    translate: i18n.global.t,
  })
  const agentRuntime: HomeAgentRuntime = {
    ...runtime,
    getContext,
    ...composeParameters(),
    // Preserve the live tool snapshot; object spread alone freezes runtime getters.
    get clientTools() { return runtime.clientTools },
    get clientToolsVersion() { return runtime.clientToolsVersion },
    refreshContext: () => {
      if (disposed) return
      runtime.refreshClientTools()
      Object.assign(agentRuntime, composeParameters())
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      capabilityChangeTarget.removeEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, refreshProviderTools)
      runtime.dispose()
    },
  }
  capabilityChangeTarget.addEventListener(HOME_AGENT_CAPABILITY_CHANGE_EVENT, refreshProviderTools)
  return agentRuntime
}

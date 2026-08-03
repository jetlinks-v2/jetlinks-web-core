import type { AiClientToolDefinition, AiClientToolRuntime } from './clientTools'

export const HOME_AGENT_CLIENT_ID = 'iotHome'
export const HOME_AGENT_SUBJECT_TYPE = 'runtimeHome'
export const HOME_AGENT_TOOL_SCOPE = 'homeAgent'
export const HOME_AGENT_CAPABILITY_CHANGE_EVENT = 'jetlinks-home-agent-capability-change'

export type MaybeArray<T> = T | T[] | undefined | null
export type HomeAgentCapabilityKind = 'menu' | 'feature' | 'agent' | 'tool' | 'guide'

export interface HomeAgentContinuationMetadata {
  targetName?: string
  targetClientId?: string
  targetMenuCode?: string
  toolId?: string
  promptPolicy?: string
  blockingFacts?: string[]
}

export interface HomeAgentContinuationReceiptOptions {
  targetName?: unknown
  targetClientId?: unknown
  targetMenuCode?: unknown
  routeName?: unknown
  path?: unknown
  subjectType?: unknown
  subjectId?: unknown
  subjectName?: unknown
  businessObject?: unknown
  navigation?: unknown
  contextPrepared?: boolean
}

export interface HomeAgentMenuEntry {
  code: string
  name: string
  title: string
  path?: string
  routeName?: string
  breadcrumb: string[]
  keywords: string[]
}

export interface HomeAgentCapability {
  id: string
  name: string
  description?: string
  kind?: HomeAgentCapabilityKind
  category?: string
  keywords?: string[]
  order?: number
  menuCode?: string
  routeName?: string
  path?: string
  clientId?: string
  clientType?: string
  metadata?: Record<string, any> & {
    currentRoute?: boolean
    promptExamples?: string[]
    continuation?: HomeAgentContinuationMetadata
  }
}

export interface HomeAgentRuntimeOptions {
  currentView?: string | (() => string | undefined)
  contextAdapter?: HomeAgentContextAdapter
  subjectType?: string | (() => string | undefined)
  subjectId?: string | (() => string | undefined)
  subjectName?: string | (() => string | undefined)
  conversationTitle?: string | (() => string | undefined)
  extraCapabilities?: MaybeArray<HomeAgentCapability> | (() => MaybeArray<HomeAgentCapability>)
  extraTools?: MaybeArray<AiClientToolDefinition<HomeAgentCapabilityContext>>
    | (() => MaybeArray<AiClientToolDefinition<HomeAgentCapabilityContext>>)
  registeredToolScopes?: string | string[]
  toolsName?: string
  toolsDescription?: string
  openingStatement?: string
  promptExamples?: string[]
  systemPromptLines?: string[]
  getLatestUserMessage?: () => HomeAgentConversationMessageContext | undefined
  onConversationMessage?: (message: HomeAgentConversationMessageContext & Record<string, any>) => void
  providerScopes?: string | string[]
}

export interface HomeAgentNavigationOptions {
  query?: Record<string, any>
  params?: Record<string, any>
}

/** Supplies the visible menu and navigation boundary for a general-agent host. */
export interface HomeAgentContextAdapter {
  getMenus?: () => Record<string, any>[]
  navigateToMenu?: (value: string, options?: HomeAgentNavigationOptions) => boolean
  navigateToRoute?: (routeName: string, options?: HomeAgentNavigationOptions) => boolean
}

/** Frontend workflow guide passed through to AgentConversation. */
export interface HomeAgentWorkflowGuide {
  id: string
  name?: string
  title?: string
  description?: string
  when?: string | string[]
  scenarios?: string[]
  keywords?: string[]
  steps?: Array<string | {
    title?: string
    description?: string
    /** Stable routing capability, never a concrete tool id. */
    capability?: string
    /** Binding types expected from this evidence step. */
    evidence?: string | string[]
    /** @deprecated Workflow guidance must not prescribe concrete tool ids. */
    tools?: string[]
    inputs?: Record<string, any>
    tips?: string[]
    required?: boolean
    [key: string]: any
  }>
  output?: string | string[]
  notes?: string | string[]
  priority?: number
  [key: string]: any
}

export interface HomeAgentCapabilityContext {
  currentRoute: {
    name?: string
    path?: string
    fullPath?: string
    title?: string
  }
  currentView?: string
  latestUserMessage?: HomeAgentConversationMessageContext
  menus: HomeAgentMenuEntry[]
  capabilities: HomeAgentCapability[]
  findMenu: (value: string) => HomeAgentMenuEntry | undefined
  navigateToMenu: (
    value: string,
    options?: { query?: Record<string, any>; params?: Record<string, any> },
  ) => boolean
  navigateToRoute: (
    routeName: string,
    options?: { query?: Record<string, any>; params?: Record<string, any> },
  ) => boolean
}

export interface HomeAgentConversationMessageContext {
  id?: string
  type?: string
  content?: string
  createdAt?: number
}

export interface HomeAgentRouteLink {
  routeName: string
  menuCode?: string
  path?: string
  params?: Record<string, any>
  query?: Record<string, any>
}

export interface HomeAgentCapabilityProvider {
  id: string
  order?: number
  getCapabilities?: (context: HomeAgentCapabilityContext) => MaybeArray<HomeAgentCapability>
  getClientTools?: (
    context: HomeAgentCapabilityContext,
  ) => MaybeArray<AiClientToolDefinition<HomeAgentCapabilityContext>>
  getWorkflowGuides?: (context: HomeAgentCapabilityContext) => MaybeArray<HomeAgentWorkflowGuide>
  getPromptExamples?: (context: HomeAgentCapabilityContext) => MaybeArray<string>
  getSystemPromptLines?: (context: HomeAgentCapabilityContext) => MaybeArray<string>
}

export interface HomeAgentRuntime extends AiClientToolRuntime {
  parameters: Record<string, any>
  getContext: () => HomeAgentCapabilityContext
  /** Complete authorized pool for hosts that need stable recommendation rotation. */
  promptExamples: string[]
}

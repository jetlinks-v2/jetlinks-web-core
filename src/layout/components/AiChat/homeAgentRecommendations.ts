import type { HomeAgentCapabilityContext } from './homeAgentContracts'
import { HOME_AGENT_CAPABILITY_CHANGE_EVENT } from './homeAgentContracts'
import { uniqueStrings } from './homeAgentShared'

export interface DynamicPromptExamplesOptions {
  id: string
  load: (
    context: HomeAgentCapabilityContext,
    signal: AbortSignal,
  ) => Promise<readonly string[]>
  fallback?: (context: HomeAgentCapabilityContext) => readonly string[]
  scopeKey?: (context: HomeAgentCapabilityContext) => string
}

interface PromptExampleState {
  loaded: boolean
  prompts: string[]
  loading?: Promise<void>
  controller?: AbortController
  lastAccess: number
  retryAfter: number
}

const states = new Map<string, PromptExampleState>()
const activeStates = new Map<string, PromptExampleState>()
const RETRY_DELAY = 30_000
const MAX_STATE_COUNT = 32

const defaultScopeKey = (context: HomeAgentCapabilityContext) => {
  if (context.scopeKey) return context.scopeKey
  const fullPath = String(context.currentRoute.fullPath || '')
  const query = fullPath.split('?')[1] || ''
  try {
    return new URLSearchParams(query).get('projectId') || 'default'
  } catch {
    return 'default'
  }
}

const notifyRuntime = () => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(HOME_AGENT_CAPABILITY_CHANGE_EVENT))
}

/**
 * Keeps provider prompt APIs synchronous while allowing recommendations to come from
 * authorized project data. The first render uses a neutral fallback; a capability
 * change event rebuilds the runtime after the data has loaded.
 */
export const createDynamicPromptExamples = (
  options: DynamicPromptExamplesOptions,
) => (context: HomeAgentCapabilityContext): string[] => {
  const scope = options.scopeKey?.(context) || defaultScopeKey(context)
  const stateKey = `${options.id}:${scope}`
  const state = states.get(stateKey) || {
    loaded: false,
    prompts: [],
    lastAccess: 0,
    retryAfter: 0,
  }
  state.lastAccess = Date.now()
  states.set(stateKey, state)
  if (states.size > MAX_STATE_COUNT) {
    const [evictedKey, evictedState] = [...states.entries()]
      .sort((left, right) => left[1].lastAccess - right[1].lastAccess)[0]
    evictedState.controller?.abort()
    states.delete(evictedKey)
  }

  const previousState = activeStates.get(options.id)
  if (previousState && previousState !== state) previousState.controller?.abort()
  activeStates.set(options.id, state)

  const now = Date.now()
  if (!state.loading && (!state.loaded || now >= state.retryAfter)) {
    const controller = new AbortController()
    state.controller = controller
    state.loading = options.load(context, controller.signal)
      .then((prompts) => {
        state.prompts = uniqueStrings([...prompts])
        state.loaded = true
        state.retryAfter = Number.POSITIVE_INFINITY
      })
      .catch(() => {
        state.loaded = true
        state.prompts = []
        state.retryAfter = Date.now() + RETRY_DELAY
      })
      .finally(() => {
        state.loading = undefined
        state.controller = undefined
        notifyRuntime()
      })
  }

  return state.prompts.length
    ? [...state.prompts]
    : [...(options.fallback?.(context) || [])]
}

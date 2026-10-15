import { nextTick } from 'vue'
import { isNavigationFailure, NavigationFailureType, type Router } from 'vue-router'
import type { HomeAgentCapabilityContext } from './homeAgentContracts'

type EntryHandler = { path: string; open: () => boolean }
type PendingEntry = {
  id: string
  getContext: () => HomeAgentCapabilityContext
  path?: string
  ready: boolean
  dispose: () => void
}

/** One click, one in-memory intent. Router completion and page mounting may arrive in either order. */
export const createFeatureEntryNavigation = (
  router: Router,
  options: { onOpened: () => void; onUnavailable: () => void; onBlocked: () => void },
) => {
  const handlers = new Map<string, Set<EntryHandler>>()
  let pending: PendingEntry | undefined

  const clear = () => {
    pending?.dispose()
    pending = undefined
  }

  const resolveEntry = (id: string, getContext: PendingEntry['getContext']) => {
    const context = getContext()
    const capability = context.capabilities.find(item => item.id === id)
    const menu = capability && context.findMenu(capability.menuCode || capability.routeName || '')
    return capability?.entry && menu ? { context, capability, menu } : undefined
  }

  const isDestination = (entry: NonNullable<ReturnType<typeof resolveEntry>>, route: { name?: unknown; path: string }) => (
    route.name === (entry.capability.routeName || entry.menu.routeName)
    || (!entry.capability.routeName && route.path === entry.menu.path)
  )

  const consume = () => {
    const intent = pending
    if (!intent?.ready || intent.path !== router.currentRoute.value.path) return
    const entry = resolveEntry(intent.id, intent.getContext)
    if (!entry || !isDestination(entry, router.currentRoute.value)) {
      clear()
      options.onUnavailable()
      return
    }
    if (!entry.capability.entry?.activate) {
      clear()
      options.onOpened()
      return
    }
    const handler = [...(handlers.get(intent.id) || [])].find(item => item.path === intent.path)
    if (!handler) return
    // Consume before opening: repeated mounts, refreshes and route hooks must not replay the click.
    clear()
    try {
      if (handler.open()) options.onOpened()
      else options.onBlocked()
    } catch {
      options.onUnavailable()
    }
  }

  return {
    register(id: string, path: string, open: () => boolean) {
      const handler = { path, open }
      const entries = handlers.get(id) || new Set<EntryHandler>()
      entries.add(handler)
      handlers.set(id, entries)
      consume()
      return () => {
        entries.delete(handler)
        if (!entries.size) handlers.delete(id)
      }
    },
    open(id: string, getContext: PendingEntry['getContext']) {
      clear()
      const entry = resolveEntry(id, getContext)
      if (!entry) {
        options.onUnavailable()
        return
      }
      const navigation = entry.capability.entry!
      const current = router.currentRoute.value
      const samePage = isDestination(entry, current)
      const intent: PendingEntry = { id, getContext, ready: false, dispose: () => {} }
      pending = intent
      let timer: ReturnType<typeof setTimeout> | undefined
      const armFallback = () => {
        // Waiting for an unsaved-edit guard is not a missing page handler.
        timer = setTimeout(() => {
          if (pending !== intent) return
          clear()
          options.onUnavailable()
        }, 10000)
      }
      const stop = router.afterEach((to, _from, failure) => {
        if (pending !== intent) return
        if (intent.ready || (failure && !isNavigationFailure(failure, NavigationFailureType.duplicated))) {
          clear()
          return
        }
        if (!isDestination(entry, to)) {
          clear()
          return
        }
        intent.ready = true
        intent.path = to.path
        armFallback()
        void nextTick().then(consume)
      })
      const stopErrors = router.onError(() => {
        if (pending !== intent) return
        clear()
        options.onUnavailable()
      })
      intent.dispose = () => { stop(); stopErrors(); clearTimeout(timer) }

      if (samePage && !navigation.query && !navigation.params) {
        intent.ready = true
        intent.path = current.path
        armFallback()
        consume()
        return
      }
      const navigationOptions = {
        query: samePage ? { ...current.query, ...navigation.query } : navigation.query,
        params: navigation.params,
      }
      try {
        const accepted = entry.capability.routeName
          ? entry.context.navigateToRoute(entry.capability.routeName, navigationOptions)
          : entry.context.navigateToMenu(entry.capability.menuCode!, navigationOptions)
        if (!accepted) {
          clear()
          options.onUnavailable()
        }
      } catch {
        clear()
        options.onUnavailable()
      }
    },
    dispose: clear,
  }
}

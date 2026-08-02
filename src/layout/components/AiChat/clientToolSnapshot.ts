export interface ClientToolSnapshotController<TSnapshot> {
  readonly snapshot: TSnapshot
  readonly version: number
  beginExecution: () => {
    snapshot: TSnapshot
    complete: () => void
  }
  refresh: () => void
  subscribe: (listener: (version: number) => void) => () => void
  dispose: () => void
}

/**
 * Owns semantic snapshot publication independently from transport and tool execution.
 * Refreshes update handler closures immediately, but wire changes wait for active executions.
 */
export const createClientToolSnapshotController = <TSnapshot>(
  buildSnapshot: () => TSnapshot,
  getSemanticSignature: (snapshot: TSnapshot) => string,
): ClientToolSnapshotController<TSnapshot> => {
  const listeners = new Set<(version: number) => void>()
  let currentSnapshot = buildSnapshot()
  let currentSignature = getSemanticSignature(currentSnapshot)
  let currentVersion = 1
  let activeExecutions = 0
  let pendingRefresh = false
  let disposed = false

  const publish = () => {
    if (disposed) return
    const nextSnapshot = buildSnapshot()
    const nextSignature = getSemanticSignature(nextSnapshot)
    const changed = nextSignature !== currentSignature
    // Same-schema rebuilds still replace handlers and their captured page context.
    currentSnapshot = nextSnapshot
    currentSignature = nextSignature
    if (!changed) return
    currentVersion += 1
    listeners.forEach(listener => listener(currentVersion))
  }

  const refresh = () => {
    if (disposed) return
    if (activeExecutions > 0) {
      pendingRefresh = true
      return
    }
    publish()
  }

  const beginExecution = () => {
    const executionSnapshot = currentSnapshot
    activeExecutions += 1
    let completed = false
    return {
      snapshot: executionSnapshot,
      complete: () => {
        if (completed) return
        completed = true
        activeExecutions = Math.max(0, activeExecutions - 1)
        if (!activeExecutions && pendingRefresh) {
          pendingRefresh = false
          publish()
        }
      },
    }
  }

  return {
    get snapshot() {
      return currentSnapshot
    },
    get version() {
      return currentVersion
    },
    beginExecution,
    refresh,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      pendingRefresh = false
      listeners.clear()
    },
  }
}

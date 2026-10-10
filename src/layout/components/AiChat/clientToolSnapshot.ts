export interface ClientToolExecutionBinding {
  signature: string
  references: readonly unknown[]
}

export interface ClientToolSnapshotController<TSnapshot> {
  readonly snapshot: TSnapshot
  readonly version: number
  beginExecution: () => {
    snapshot: TSnapshot
    getSignal: (key: string) => AbortSignal | undefined
    complete: () => void
  }
  getExecutionSignal: (key: string) => AbortSignal | undefined
  refresh: () => void
  subscribe: (listener: (version: number) => void) => () => void
  dispose: () => void
}

/**
 * Owns semantic snapshot publication independently from transport and tool execution.
 * Publishes immediately and revokes only removed or changed execution bindings.
 */
export const createClientToolSnapshotController = <TSnapshot>(
  buildSnapshot: () => TSnapshot,
  getSemanticSignature: (snapshot: TSnapshot) => string,
  getExecutionBindings: (snapshot: TSnapshot) => ReadonlyMap<string, ClientToolExecutionBinding> = () => new Map(),
): ClientToolSnapshotController<TSnapshot> => {
  const listeners = new Set<(version: number) => void>()
  let currentSnapshot = buildSnapshot()
  let currentSignature = getSemanticSignature(currentSnapshot)
  let currentVersion = 1
  let bindings = getExecutionBindings(currentSnapshot)
  let lifetimes = new Map(Array.from(bindings.keys(), key => [key, new AbortController()]))
  let disposed = false

  const publish = () => {
    if (disposed) return
    const nextSnapshot = buildSnapshot()
    const nextSignature = getSemanticSignature(nextSnapshot)
    const nextBindings = getExecutionBindings(nextSnapshot)
    const nextLifetimes = new Map<string, AbortController>()
    nextBindings.forEach((binding, key) => {
      const previous = bindings.get(key)
      const unchanged = previous?.signature === binding.signature
        && previous.references.length === binding.references.length
        && previous.references.every((reference, index) => reference === binding.references[index])
      nextLifetimes.set(key, unchanged ? lifetimes.get(key)! : new AbortController())
    })
    const revoked = Array.from(lifetimes).filter(([key, lifetime]) => nextLifetimes.get(key) !== lifetime)
    const changed = nextSignature !== currentSignature || revoked.length > 0
    // Install the complete next catalog before synchronous abort listeners inspect it.
    currentSnapshot = nextSnapshot
    currentSignature = nextSignature
    bindings = nextBindings
    lifetimes = nextLifetimes
    revoked.forEach(([, lifetime]) => lifetime.abort())
    if (!changed) return
    currentVersion += 1
    listeners.forEach(listener => listener(currentVersion))
  }

  const refresh = () => {
    if (disposed) return
    publish()
  }

  const beginExecution = () => {
    const executionSnapshot = currentSnapshot
    const executionLifetimes = lifetimes
    return {
      snapshot: executionSnapshot,
      getSignal: (key: string) => executionLifetimes.get(key)?.signal,
      complete: () => undefined,
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
    getExecutionSignal: key => lifetimes.get(key)?.signal,
    refresh,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      lifetimes.forEach(lifetime => lifetime.abort())
      listeners.clear()
    },
  }
}

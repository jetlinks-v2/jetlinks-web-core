/** Owns cancellation precedence for Runtime tasks and their abort-aware Provider work. */
export class CancellationResource {
  readonly abortController = new AbortController()
  readonly cancelPromise: Promise<never>
  settled = false
  cancelled = false

  private rejectCancel: (error: unknown) => void = () => undefined
  private readonly cancelHandlers = new Set<(error: unknown) => void>()

  constructor(private readonly cleanup?: () => void) {
    this.cancelPromise = new Promise<never>((_, reject) => {
      this.rejectCancel = reject
    })
  }

  addCancelHandler(handler: (error: unknown) => void): () => void {
    this.cancelHandlers.add(handler)
    return () => this.cancelHandlers.delete(handler)
  }

  cancel(error: unknown): void {
    if (this.settled || this.cancelled) return
    this.cancelled = true
    // The public race must settle before abort-aware Provider code can surface its own error.
    this.rejectCancel(error)
    this.abortController.abort()
    this.cancelHandlers.forEach(handler => handler(error))
    this.cancelHandlers.clear()
    this.cleanup?.()
  }
}

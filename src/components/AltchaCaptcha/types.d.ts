export interface AltchaWidgetElement extends HTMLElement {
  configure(config: {
    auto: 'off'
    challenge: Record<string, unknown>
    credentials: RequestCredentials
    language: string
    retryOnOutOfMemoryError: boolean
    workers: number
  }): Promise<void>
  reset(): void
}

declare global {
  var $altcha: {
    algorithms: Map<string, () => Worker | Promise<Worker>>
  }
}

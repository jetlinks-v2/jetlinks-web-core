export interface AltchaWidgetElement extends HTMLElement {
  configure(config: {
    auto: 'off'
    challenge: Record<string, unknown>
    credentials: RequestCredentials
    hideFooter: boolean
    hideLogo: boolean
    language: string
    retryOnOutOfMemoryError: boolean
    workers: number
  }): Promise<void>
  reset(): void
}

declare global {
  var $altcha: {
    algorithms: Map<string, () => Worker | Promise<Worker>>
    i18n: {
      get(language: string): Record<string, string> | undefined
      set(language: string, strings: Record<string, string>): void
    }
  }
}

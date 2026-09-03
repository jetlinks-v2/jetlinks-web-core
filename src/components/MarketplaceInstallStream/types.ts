export type MarketplaceInstallStreamRowType = 'progress' | 'log' | 'success' | 'error'

export interface MarketplaceInstallStreamRow {
  type: MarketplaceInstallStreamRowType
  message: string
  extra?: unknown
}

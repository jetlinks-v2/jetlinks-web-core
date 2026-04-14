/** 资源类型 Tab 选项 */
export type ResourceTypeOption = { label: string; value: string }

export type CapabilityUseCondition = 'free' | 'registered' | 'needPurchase'

/** 列表查询参数（与能力市场资源 detail/_query 语义一致） */
export interface MarketplaceResourceQuery {
  type: string
  /** 从 0 开始的页码 */
  pageIndex: number
  pageSize: number
  keyword: string
  selectedTagIds: string[]
}

/** 仅返回当前页列表；是否还有下一页由调用方根据 list.length 与 pageSize 判断 */
export type MarketplaceResourceFetcher = (q: MarketplaceResourceQuery) => Promise<{ list: any[] }>

export type TagClassifiersFetcher = (type: string) => Promise<any>

export interface MarketplaceResourcePickerLabels {
  all?: string
  tags?: string
  selectedTags?: string
  clearSelected?: string
  searchPlaceholder?: string
  empty?: string
  /** 滚动加载到底时的提示 */
  noMore?: string
  noResourceTypes?: string
  /** 卡片下方版本选择（enableVersionSelect 时） */
  version?: string
  versionPlaceholder?: string
  /** 有 releaseNotes 时，查看发布说明按钮 */
  viewReleaseNotes?: string
  /** 发布说明抽屉标题前缀（会拼接当前版本号） */
  releaseNotesTitle?: string
  /** 资源文档入口文案 */
  viewDocument?: string
  /** 资源文档抽屉标题前缀（会拼接资源名称） */
  resourceDocumentTitle?: string
  /** 当前版本摘要标题 */
  versionSummary?: string
}

export type SelectionMode = 'none' | 'single' | 'multiple'

/**
 * 能力版本下拉选项（与 GET /marketplace/capabilities/{id}/versions → CapabilityVersion 一致）
 */
export type CapabilityVersionOption = {
  label: string
  value: string
  /** 当前用户是否可使用此版本 */
  available?: boolean
  /** CapabilityVersion.summary */
  summary?: string
  /** CapabilityVersion.releaseNotes，Markdown */
  releaseNotes?: string
}

/** 拉取某能力下的版本列表，返回下拉选项（默认见 defaultFetchCapabilityVersions） */
export type FetchCapabilityVersions = (capabilityId: string) => Promise<CapabilityVersionOption[]>

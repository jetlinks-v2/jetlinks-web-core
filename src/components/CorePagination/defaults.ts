export const DEFAULT_PAGE_SIZE = 12
export const PAGE_SIZE_OPTIONS = ['12', '24', '48', '96']

export const paginationAppearance = { size: 'default', showQuickJumper: false } as const

// Ant 的 simple 模式即使 size="default" 也读取 controlHeightSM。仅调整分页主题，不改变紧凑表格和其他控件。
export function paginationThemeComponents(controlHeight: number) {
  return { Pagination: { controlHeightSM: controlHeight } }
}

export const runtimeTableConfig = {
  pagination: { defaultPageSize: DEFAULT_PAGE_SIZE, pageSizeOptions: PAGE_SIZE_OPTIONS, isShowContent: false, ...paginationAppearance },
}

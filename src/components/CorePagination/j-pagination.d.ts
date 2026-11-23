// 当前基础包未发布这个内部组件的声明，只描述本适配器使用的接口。
declare module '@jetlinks-web/components/es/ProTable/Pagination.js' {
  import type { DefineComponent } from 'vue'
  const JPagination: DefineComponent<{
    pageIndex: number
    pageSize: number
    total: number
    size?: 'default' | 'small'
    disabled?: boolean
    pageSizeOptions?: string[]
    showSizeChanger?: boolean
    showQuickJumper?: boolean
    isShowContent?: boolean
    onChange?: (page: number, size: number) => void
  }>
  export default JPagination
}

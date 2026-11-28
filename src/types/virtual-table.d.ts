declare module '@jetlinks-web/components/es/VirtualTable' {
  import type { DefineComponent } from 'vue'
  import type { TableProps } from 'ant-design-vue'
  type VirtualTableProps = TableProps & {
    virtual?: boolean | { itemHeight?: number; overscan?: number; threshold?: number }
  }
  const VirtualTable: DefineComponent<VirtualTableProps, {
    scrollTo: (offset: number) => void
    scrollToIndex: (index: number) => void
  }>
  export default VirtualTable
}

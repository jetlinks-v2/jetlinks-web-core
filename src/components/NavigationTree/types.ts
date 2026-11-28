import type { TreeProps } from 'ant-design-vue'

export type NavigationTreeKey = NonNullable<TreeProps['expandedKeys']>[number]
export type NavigationTreeNode = NonNullable<TreeProps['treeData']>[number]
export type NavigationTreeExpandInfo = Parameters<NonNullable<TreeProps['onExpand']>>[1]

export interface NavigationTreeOptions {
  /** 初始展示的业务层数；搜索范围根不计层级。 */
  defaultExpandDepth?: number
  searchable?: boolean
  nodeDraggable?: (node: NavigationTreeNode) => boolean
  searchNodeKey?: NavigationTreeKey
  searchValue?: string
  searchLabel?: string
  searchPlaceholder?: string
  getSearchText?: (node: NavigationTreeNode) => string
}

export type NavigationTreeProps = Omit<TreeProps, 'virtual' | 'autoExpandParent' | 'prefixCls'> & NavigationTreeOptions

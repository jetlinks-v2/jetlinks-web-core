import type { PropType } from 'vue'
import { Tree } from 'ant-design-vue'
import type { treeProps } from 'ant-design-vue/es/tree/Tree'
import type { NavigationTreeKey, NavigationTreeNode } from './types'

// 滚动与搜索期间的父级展开由目录树统一持有，其他属性保留原 Tree 定义。
const { virtual, autoExpandParent, prefixCls, ...nativeProps } = Tree.props as ReturnType<typeof treeProps>
export const navigationTreeProps = {
  ...nativeProps,
  showLine: { type: [Boolean, Object] as PropType<NonNullable<import('ant-design-vue').TreeProps['showLine']>>, default: () => ({ showLeafIcon: false }) },
  defaultExpandDepth: { type: Number, default: 2 },
  searchable: Boolean,
  nodeDraggable: Function as PropType<(node: NavigationTreeNode) => boolean>,
  searchNodeKey: [String, Number] as PropType<NavigationTreeKey>,
  searchValue: String,
  searchLabel: String,
  searchPlaceholder: String,
  getSearchText: Function as PropType<(node: NavigationTreeNode) => string>,
}

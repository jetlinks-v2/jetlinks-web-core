import type { TreeProps } from 'ant-design-vue'
import type { NavigationTreeKey, NavigationTreeNode } from './types'

/** 读取原生 fieldNames，所有派生操作均保留业务扩展字段且不改输入节点。 */
export function navigationTreeModel(fieldNames?: TreeProps['fieldNames']) {
  const fields = { key: 'key', title: 'title', children: 'children', ...fieldNames }
  const key = (node: NavigationTreeNode): NavigationTreeKey => node[fields.key]
  const children = (node: NavigationTreeNode): NavigationTreeNode[] => Array.isArray(node[fields.children]) ? node[fields.children] : []
  const title = (node: NavigationTreeNode) => node[fields.title]
  const text = (node: NavigationTreeNode): string => {
    const value: unknown = title(node)
    return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
  }
  function branchKeys(nodes: NavigationTreeNode[]): NavigationTreeKey[] {
    return nodes.flatMap(node => children(node).length ? [key(node), ...branchKeys(children(node))] : [])
  }
  function initialKeys(nodes: NavigationTreeNode[], depth: number, rootKey?: NavigationTreeKey, level = 1): NavigationTreeKey[] {
    return nodes.flatMap(node => {
      const nodeLevel = key(node) === rootKey ? level - 1 : level
      if (!children(node).length || nodeLevel >= depth) return []
      return [key(node), ...initialKeys(children(node), depth, rootKey, nodeLevel + 1)]
    })
  }
  function ancestors(nodes: NavigationTreeNode[], target: NavigationTreeKey, path: NavigationTreeKey[] = []): NavigationTreeKey[] | undefined {
    for (const node of nodes) {
      if (key(node) === target) return path
      const found = ancestors(children(node), target, [...path, key(node)])
      if (found) return found
    }
  }
  function filter(nodes: NavigationTreeNode[], keyword: string, searchNodeKey?: NavigationTreeKey, searchText = text): { nodes: NavigationTreeNode[]; matched: boolean } {
    const query = keyword.trim().toLocaleLowerCase()
    if (!query) return { nodes, matched: nodes.length > 0 }
    let matched = false
    const result = nodes.flatMap(node => {
      const root = key(node) === searchNodeKey
      const ownMatch = !root && searchText(node).toLocaleLowerCase().includes(query)
      const descendants = filter(children(node), query, searchNodeKey, searchText)
      matched ||= ownMatch || descendants.matched
      if (!root && !ownMatch && !descendants.matched) return []
      return [{ ...node, [fields.children]: ownMatch ? children(node) : descendants.nodes }]
    })
    return { nodes: result, matched }
  }
  return { key, children, title, text, branchKeys, initialKeys, ancestors, filter }
}

import type { RouteRecordRaw } from 'vue-router'
import { normalizeProjectRuntimePath } from '@jetlinks-web-core/utils/project-runtime'

type SidebarMenu = Pick<RouteRecordRaw, 'path' | 'meta'> & { children?: SidebarMenu[] }

/** 从实际渲染的菜单树查找祖先分组，叶子页面和 mix 布局的顶部一级菜单不参与侧栏展开。 */
export const getProjectSidebarOpenKeys = (
  menus: SidebarMenu[],
  activeKey: string,
  layoutMode: string,
): string[] => {
  if (layoutMode === 'top' || !activeKey) return []

  const findAncestors = (items: SidebarMenu[], ancestors: string[]): string[] | undefined => {
    for (const item of items) {
      const key = normalizeProjectRuntimePath(item.path)
      if (key === activeKey) return ancestors
      if (!item.children?.length || item.meta?.hideChildrenInMenu) continue

      const result = findAncestors(item.children, [...ancestors, item.path])
      if (result) return result
    }
  }

  const ancestors = findAncestors(menus, []) || []
  return layoutMode === 'mix' ? ancestors.slice(1) : ancestors
}

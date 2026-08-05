import type { RouteRecordRaw } from 'vue-router'

const normalizeMenuSearchText = (value?: unknown) => String(value || '').toLowerCase()

export const isMenuMatched = (menu: RouteRecordRaw, keyword: string) => {
  return [
    menu.name,
    menu.path,
    menu.meta?.title,
    menu.meta?.desc,
  ].some(item => normalizeMenuSearchText(item).includes(keyword))
}

export const filterMenusByKeyword = (menus: RouteRecordRaw[], keyword: string): RouteRecordRaw[] => {
  if (!keyword) {
    return menus
  }

  return menus.reduce<RouteRecordRaw[]>((result, menu) => {
    const children = (menu.children || []) as RouteRecordRaw[]
    const matched = isMenuMatched(menu, keyword)
    const matchedChildren = filterMenusByKeyword(children, keyword)

    if (matched || matchedChildren.length) {
      result.push({
        ...menu,
        children: matched ? children : matchedChildren,
      })
    }

    return result
  }, [])
}

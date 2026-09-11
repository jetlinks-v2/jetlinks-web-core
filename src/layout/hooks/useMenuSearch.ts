import type { RouteRecordRaw } from 'vue-router'
import i18n from '@jetlinks-web-core/locales'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMenuStore } from '@/store'

type MenuSearchItem = {
  key: string
  name: string
  title: string
  icon?: string
  ancestors: { key: string; title: string }[]
}

type TitleSegment = {
  text: string
  match: boolean
}

/** 管理菜单搜索的层级结果、展开状态与页面跳转。 */
export const useMenuSearch = () => {
  const menuStore = useMenuStore()

  const keyword = ref('')
  const open = ref(false)
  const rootRef = ref<HTMLElement>()

  // 保留可见祖先，供分组标题和父级路径展示；隐藏节点不作为层级标签。
  const collectMenus = (
    menus: RouteRecordRaw[],
    result: MenuSearchItem[] = [],
    ancestors: MenuSearchItem['ancestors'] = [],
  ): MenuSearchItem[] => {
    menus.forEach((menu) => {
      const meta = menu.meta || {}
      const key = String(menu.name || menu.path)
      const title = meta.title ? String(i18n.global.t(String(meta.title))) : ''
      const visible = meta.hideInMenu !== true && !!title
      if (visible) {
        result.push({
          key,
          name: String(menu.name || ''),
          title,
          icon: typeof meta.icon === 'string' ? meta.icon : undefined,
          ancestors,
        })
      }

      if (menu.children?.length) {
        collectMenus(menu.children as RouteRecordRaw[], result,
          visible ? [...ancestors, { key, title }] : ancestors)
      }
    })

    return result
  }

  const menuItems = computed(() => collectMenus(menuStore.siderMenus as RouteRecordRaw[]))

  const results = computed(() => {
    const searchText = keyword.value.trim().toLowerCase()
    if (!searchText) return []

    return menuItems.value.filter(item => item.title.toLowerCase().includes(searchText))
  })

  // 按纯文本分段，避免将菜单名称或搜索词作为 HTML 注入。
  const highlightTitle = (title: string): TitleSegment[] => {
    const searchText = keyword.value.trim().toLowerCase()
    if (!searchText) return [{ text: title, match: false }]

    const segments: TitleSegment[] = []
    const lowerTitle = title.toLowerCase()
    let cursor = 0
    let index = lowerTitle.indexOf(searchText)

    while (index > -1) {
      if (index > cursor) {
        segments.push({ text: title.slice(cursor, index), match: false })
      }
      segments.push({ text: title.slice(index, index + searchText.length), match: true })
      cursor = index + searchText.length
      index = lowerTitle.indexOf(searchText, cursor)
    }

    if (cursor < title.length) {
      segments.push({ text: title.slice(cursor), match: false })
    }

    return segments
  }

  // 按最上层可见菜单分组，深层结果保留完整父级路径以区分同名菜单。
  const groups = computed(() => {
    const grouped = new Map<string, { key: string; title: string; items: (MenuSearchItem & { parentTitle: string })[] }>()
    results.value.forEach(item => {
      const root = item.ancestors[0] || item
      if (!grouped.has(root.key)) {
        grouped.set(root.key, { key: root.key, title: root.title, items: [] })
      }
      grouped.get(root.key)!.items.push({
        ...item,
        parentTitle: item.ancestors.map(parent => parent.title).join(' / ') || item.title,
      })
    })
    return [...grouped.values()]
  })

  const close = () => {
    open.value = false
  }

  // 复用菜单 store 的路由入口，并清空本次搜索。
  const handleSelect = (item: MenuSearchItem) => {
    keyword.value = ''
    close()
    menuStore.jumpPage(item.name)
  }

  // 点击搜索区域之外时收起结果。
  const handleDocumentMousedown = (event: MouseEvent) => {
    if (!rootRef.value?.contains(event.target as Node)) {
      close()
    }
  }

  // 本地菜单过滤无需异步防抖，避免延迟回调在关闭后重新打开面板。
  watch(keyword, value => {
    open.value = !!value.trim()
  })

  watch(open, (value) => {
    if (value) {
      document.addEventListener('mousedown', handleDocumentMousedown)
    } else {
      document.removeEventListener('mousedown', handleDocumentMousedown)
    }
  })

  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleDocumentMousedown)
  })

  return { keyword, open, rootRef, groups, highlightTitle, close, handleSelect }
}

import { h, type VNode } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { RouterLink } from 'vue-router'
import { Menu } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'
import {
  DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY,
  isComingSoonMenuMeta,
} from '@jetlinks-web-core/utils/menuBadge'

type ProjectMenuRouteRecord = RouteRecordRaw & {
  key?: string
}

type SubMenuRenderContext = {
  item: ProjectMenuRouteRecord
  children: VNode[]
}

type MenuItemRenderContext = {
  item: ProjectMenuRouteRecord
  title: VNode
  icon?: VNode
}

const getMenuTitle = (item: ProjectMenuRouteRecord) => String(
  i18n.global.t(String(item.meta?.title || item.name || item.path)),
)

export const renderPrimaryMenuGroup = ({ item, children }: SubMenuRenderContext) => h(
  Menu.ItemGroup,
  { key: item.key || item.path, class: 'project-primary-menu-group' },
  {
    title: () => getMenuTitle(item),
    default: () => children,
  },
)

/** 两种壳层共用菜单项：内部导航只分发一次，外链继续使用 ProLayout 原有渲染。 */
export const createLayoutMenuItemRenderer = (navigate: (path: string) => void) => (
  { item, icon }: MenuItemRenderContext,
): VNode | undefined => {
  const comingSoon = isComingSoonMenuMeta(item.meta)
  if (!comingSoon && (item.meta?.target || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(item.path))) {
    return undefined
  }

  const children: VNode[] = []
  if (icon) children.push(icon)
  children.push(h('span', {
    class: ['ant-pro-menu-item-title', { 'basic-layout-menu-placeholder__title': comingSoon }],
  }, getMenuTitle(item)))

  if (comingSoon) {
    const badge = item.meta?.menuBadge
    const text = badge?.i18nKey
      ? i18n.global.t(badge.i18nKey)
      : badge?.text || i18n.global.t(DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY)
    children.push(h('span', { class: 'layout-menu-badge' }, String(text)))
  }

  return h(Menu.Item, {
    key: item.key || item.path,
    disabled: comingSoon || item.meta?.disabled === true,
    danger: item.meta?.danger,
    class: { 'basic-layout-menu-placeholder': comingSoon },
    onClick: (event: MouseEvent) => {
      if (comingSoon || item.meta?.disabled || event.defaultPrevented
        || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
        || (event.button !== undefined && event.button !== 0)) return

      event.preventDefault()
      navigate(item.path)
    },
  }, {
    default: () => comingSoon
      ? h('span', { class: 'ant-pro-menu-item basic-layout-menu-placeholder__content' }, children)
      // custom 保留链接 href 和新标签页操作，普通点击统一交给导航 Hook，避免 RouterLink 再次重定向。
      : h(RouterLink, { to: { name: item.name, ...item.meta }, custom: true }, {
        default: ({ href }: { href: string }) => h('a', { href, class: 'ant-pro-menu-item' }, children),
      }),
  })
}

import { h, type VNode } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { Menu } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'

type ProjectMenuRouteRecord = RouteRecordRaw & {
  key?: string
}

type SubMenuRenderContext = {
  item: ProjectMenuRouteRecord
  children: VNode[]
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

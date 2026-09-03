<template>
  <BasicLayoutShell
    class="tenant-layout-page"
    variant="tenant"
    :subMenuItemRender="renderTenantSubMenu"
  />
</template>

<script setup name="TenantLayoutPage" lang="ts">
import { computed, h, type VNode } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { Menu } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'
import { useBasicLayoutControllerContext } from '../hooks/basicLayoutContext'
import BasicLayoutShell from './BasicLayoutShell.vue'

type TenantMenuRouteRecord = RouteRecordRaw & {
  key?: string
}

type SubMenuRenderContext = {
  item: TenantMenuRouteRecord
  children: VNode[]
}

const DIRECT_MENU_COLUMN_SIZE = 5
const MENU_COLUMN_KIND_ATTR = 'data-tenant-menu-column'

const { config } = useBasicLayoutControllerContext()

const getMenuKey = (item: TenantMenuRouteRecord) => String(item.key || item.path)
const getMenuTitle = (item: TenantMenuRouteRecord) => String(
  i18n.global.t(String(item.meta?.title || item.name || item.path)),
)
const topLevelMenuItems = computed(() => new Set(
  config.value.menuData as TenantMenuRouteRecord[],
))

const isGroupedMenuColumn = (child: VNode) => (
  child.props?.[MENU_COLUMN_KIND_ATTR] === 'group'
)

const createDirectMenuColumn = (
  parentKey: string,
  items: VNode[],
  columnIndex: number,
) => h(
  Menu.ItemGroup,
  {
    key: `${parentKey}-direct-${columnIndex}`,
    [MENU_COLUMN_KIND_ATTR]: 'direct',
  },
  { default: () => items },
)

const arrangeTopLevelMenuChildren = (parentKey: string, children: VNode[]) => {
  const hasGroupedMenu = children.some(isGroupedMenuColumn)

  if (!hasGroupedMenu && children.length <= DIRECT_MENU_COLUMN_SIZE) {
    return { children, isMegaMenu: false }
  }

  const columns: VNode[] = []
  let directItems: VNode[] = []
  let directColumnIndex = 0
  const flushDirectItems = () => {
    if (!directItems.length) return

    columns.push(createDirectMenuColumn(parentKey, directItems, directColumnIndex))
    directItems = []
    directColumnIndex += 1
  }

  // 二级叶子菜单每五个成列；遇到三级分组立即断列，避免权限变化打乱菜单顺序。
  children.forEach((child) => {
    if (isGroupedMenuColumn(child)) {
      flushDirectItems()
      columns.push(child)
      return
    }

    directItems.push(child)
    if (directItems.length === DIRECT_MENU_COLUMN_SIZE) {
      flushDirectItems()
    }
  })
  flushDirectItems()

  return { children: columns, isMegaMenu: true }
}

const renderTenantSubMenu = ({ item, children }: SubMenuRenderContext) => {
  const key = getMenuKey(item)

  // ProLayout 未提供菜单深度，一级节点保留弹层，其余子菜单转换为同屏分组。
  if (!topLevelMenuItems.value.has(item)) {
    return h(
      Menu.ItemGroup,
      {
        key,
        [MENU_COLUMN_KIND_ATTR]: 'group',
      },
      {
        title: () => getMenuTitle(item),
        default: () => children,
      },
    )
  }

  const menuLayout = arrangeTopLevelMenuChildren(key, children)

  return h(
    Menu.SubMenu,
    {
      key,
      popupClassName: [
        'ant-pro-menu-popup',
        'tenant-menu-popup',
        menuLayout.isMegaMenu ? 'tenant-menu-popup--mega' : 'tenant-menu-popup--compact',
      ].join(' '),
      title: h('span', { class: 'ant-pro-menu-item' }, [
        h('span', { class: 'ant-pro-menu-item-title' }, getMenuTitle(item)),
      ]),
    },
    { default: () => menuLayout.children },
  )
}
</script>

<style lang="less">
.tenant-menu-popup {
  padding-top: var(--space-2);

  > .ant-menu {
    max-height: calc(100vh - var(--chrome-header-height) - var(--space-8));
    overflow-y: auto;
    border: var(--jet-theme-stroke-width) solid var(--line);
    border-radius: var(--chrome-popover-radius);
    background: var(--bg);
    box-shadow: var(--shadow-pop);
  }

  .ant-menu-item-group[data-tenant-menu-column] {
    min-width: 0;
  }

  .ant-menu-item-group[data-tenant-menu-column='direct'] > .ant-menu-item-group-title {
    display: none;
  }

  .ant-menu-item-group-title {
    margin-bottom: var(--space-2);
    padding: var(--space-2) 0;
    border-bottom: var(--jet-theme-stroke-width) solid var(--line);
    color: var(--ink-2);
    font-size: var(--fs-body);
    line-height: var(--layout-menu-item-line-height);
  }

  .ant-menu-item-group-list {
    margin: 0;
  }

  .ant-menu-item {
    width: 100% !important;
    height: var(--layout-menu-item-height);
    margin: 0 0 var(--layout-menu-item-gap) !important;
    padding-inline: var(--layout-menu-item-padding-x) !important;
    border-radius: var(--layout-menu-item-radius);
    color: var(--layout-menu-item-color);
    font-size: var(--layout-menu-item-font-size);
    line-height: var(--layout-menu-item-height);
  }

  .ant-menu-item:last-child {
    margin-bottom: 0 !important;
  }

  .ant-menu-item::after {
    display: none;
  }

  .ant-menu-item:hover {
    background: var(--layout-menu-item-hover-bg) !important;
    color: var(--layout-menu-item-color);
  }

  .ant-menu-item-selected {
    background: transparent !important;
    color: var(--layout-menu-item-active-color);
  }

  .ant-pro-menu-item {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: var(--space-2);
  }

  .ant-pro-menu-item-title {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ant-menu-item .anticon {
    margin: 0;
    color: var(--layout-menu-item-muted-color);
    font-size: var(--layout-menu-item-icon-size);
  }

  .ant-menu-item-selected .anticon {
    color: var(--layout-menu-item-active-color);
  }
}

.tenant-menu-popup--compact > .ant-menu {
  min-width: min(12rem, calc(100vw - var(--space-4)));
  padding: var(--space-2);
}

.tenant-menu-popup--mega {
  /* 浮层宽度由列数自动汇总，后续只需调整单列宽度。 */
  --tenant-menu-item-width: 8.5rem;
  --tenant-menu-effective-item-width: min(
    var(--tenant-menu-item-width),
    calc(100vw - var(--space-12) - var(--space-12))
  );

  > .ant-menu {
    width: max-content;
    max-width: calc(100vw - var(--space-8));
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-5) var(--space-8);
    padding: var(--space-4) !important;
    justify-content: center;
  }

  > .ant-menu::before,
  > .ant-menu::after {
    display: none;
  }

  .ant-menu-item-group[data-tenant-menu-column] {
    width: var(--tenant-menu-effective-item-width);
    flex: 0 0 var(--tenant-menu-effective-item-width);
    align-self: start;
  }
}
</style>

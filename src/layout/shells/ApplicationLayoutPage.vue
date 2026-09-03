<template>
  <div
    :class="[
      'basic-layout-page',
      'basic-layout-page--application',
      routeLayoutClassName,
      { 'basic-layout-page--header-scrolled': headerScrolled },
    ]"
  >
    <j-pro-layout
      v-bind="applicationConfig"
      v-model:openKeys="state.openKeys"
      v-model:collapsed="state.collapsed"
      :selectedKeys="applicationPrimarySelectedKeys"
      :breadcrumb="{ routes: [] }"
      :pure="state.pure"
      :layoutType="layoutType"
      :collapsedButtonRender="false"
      :menuExtraRender="showMenuSearch ? undefined : false"
      :menuItemRender="renderMenuItem"
      @menuClick="handlePrimaryMenuClick"
      @backClick="goBack"
    >
      <template #menuHeaderRender>
        <div class="project-layout__brand" :style="logoWidth">
          <div v-if="!state.collapsed" class="project-layout__brand-main">
            <img class="project-layout__brand-logo" :src="layout.logo" alt="" />
            <span class="project-layout__brand-title">{{ layout.title }}</span>
          </div>
          <a-button
            class="project-layout__brand-collapse"
            type="text"
            :aria-label="$t(state.collapsed ? 'components.LayoutSidebarUser.expand' : 'components.LayoutSidebarUser.collapse')"
            @click.stop="state.collapsed = !state.collapsed"
          >
            <template #icon>
              <AIcon :type="state.collapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
            </template>
          </a-button>
        </div>
      </template>
      <template #leftContentRender>
        <RegistryComponent pageCode="layout" code="layout" @click="onClick" />
      </template>
      <template #rightContentRender>
        <div class="right-content">
          <RegistryComponent pageCode="layout" code="headerRight">
            <template v-if="!hideHeaderRight">
              <Resource v-if="systemInfo?.front?.resources" key="resource" />
              <Language key="Language" />
              <Notice key="notice" />
            </template>
            <LayoutSidebarUser key="user" :collapsed="state.collapsed" />
          </RegistryComponent>
        </div>
      </template>
      <div class="project-layout__content">
        <ProjectSecondaryMenu
          v-if="secondaryMenuItems.length"
          :items="secondaryMenuItems"
          :selectedKey="secondaryMenuSelectedKey"
          tabPosition="top"
          @select="handleSecondaryMenuSelect"
        />
        <div class="project-layout__route-content">
          <PageRouteView />
        </div>
      </div>
    </j-pro-layout>
    <AiChat />
  </div>
</template>

<script setup name="ApplicationLayoutPage" lang="ts">
import { computed, h, watchEffect, type VNode } from 'vue'
import { useRoute, useRouter, type RouteRecordRaw } from 'vue-router'
import { Menu } from 'ant-design-vue'
import i18n from '@jetlinks-web-core/locales'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import {
  DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY,
  isComingSoonMenuMeta,
} from '@jetlinks-web-core/utils/menuBadge'
import {
  AiChat,
  Language,
  LayoutSidebarUser,
  Notice,
  Resource,
} from '../components'
import ProjectSecondaryMenu from '../components/ProjectSecondaryMenu.vue'
import { useBasicLayoutControllerContext } from '../hooks/basicLayoutContext'
import {
  containsNavigationKey,
  findFirstLeafKey,
  getBreadcrumbPaths,
  normalizeMenuKey,
  toNavigationItem,
  type ProjectNavigationItem,
  type ProjectNavigationRoute,
} from '../hooks/useProjectNavigation'

type LayoutMenuRouteRecord = RouteRecordRaw & {
  key?: string
}

type MenuItemRender = (context: {
  item: LayoutMenuRouteRecord
  title: VNode
  icon?: VNode
}) => VNode | undefined

const controller = useBasicLayoutControllerContext('side')
const route = useRoute()
const router = useRouter()
const menuStore = useMenuStore()

watchEffect(() => {
  controller.expandSecondaryMenu.value = false
})

const getLayoutMenuKey = (menu: LayoutMenuRouteRecord | ProjectNavigationRoute) => (
  normalizeMenuKey(menu.path || ('key' in menu && menu.key ? String(menu.key) : ''))
)

const getMenuTitle = (item: LayoutMenuRouteRecord) => String(
  i18n.global.t(String(item.meta?.title || item.name || item.path)),
)

const getMenuBadgeText = (item: LayoutMenuRouteRecord) => {
  const badge = item.meta?.menuBadge
  const text = badge?.i18nKey
    ? i18n.global.t(badge.i18nKey)
    : badge?.text || i18n.global.t(DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY)

  return String(text)
}

const renderMenuItem: MenuItemRender = ({ item, icon }) => {
  if (!isComingSoonMenuMeta(item.meta)) return undefined

  const children: VNode[] = []
  if (icon) children.push(icon)
  children.push(
    h('span', { class: 'ant-pro-menu-item-title basic-layout-menu-placeholder__title' }, getMenuTitle(item)),
    h('span', { class: 'layout-menu-badge' }, getMenuBadgeText(item)),
  )

  return h(
    Menu.Item,
    {
      key: item.key || item.path,
      disabled: true,
      class: 'basic-layout-menu-placeholder',
    },
    {
      default: () => h('span', { class: 'ant-pro-menu-item basic-layout-menu-placeholder__content' }, children),
    },
  )
}

const stripMenuChildren = (menu: LayoutMenuRouteRecord): LayoutMenuRouteRecord => ({ ...menu, children: undefined })

const containsRouteContext = (
  menu: ProjectNavigationRoute,
  routeKeys: string[],
  currentPath: string,
): boolean => {
  const menuKey = getLayoutMenuKey(menu)
  const currentRouteMatched = !!menuKey && (
    routeKeys.includes(menuKey)
    || currentPath === menuKey
    || (menuKey !== '/' && currentPath.startsWith(`${menuKey}/`))
  )

  return currentRouteMatched || (menu.children || [])
    .some(child => containsRouteContext(child, routeKeys, currentPath))
}

const findMenuByKey = (
  menus: RouteRecordRaw[],
  targetKey: string,
): RouteRecordRaw | undefined => {
  for (const menu of menus) {
    if (getLayoutMenuKey(menu as ProjectNavigationRoute) === targetKey) {
      return menu
    }

    const child = findMenuByKey((menu.children || []) as RouteRecordRaw[], targetKey)
    if (child) return child
  }

  return undefined
}

const isNavigationItemActive = (
  item: ProjectNavigationItem,
  routeKeys: string[],
  currentPath: string,
) => (
  routeKeys.some(key => item.key === key || containsNavigationKey(item.children || [], key))
  || (item.key !== '/' && currentPath.startsWith(`${item.key}/`))
)

const {
  config,
  goBack,
  handlePrimaryMenuClick,
  headerScrolled,
  hideHeaderRight,
  layout,
  layoutType,
  logoWidth,
  onClick,
  routeLayoutClassName,
  selectVisibleSecondaryItem,
  showMenuSearch,
  state,
  systemInfo,
  visibleSecondaryItems,
  visibleSecondarySelectedKey,
} = controller

// 应用端默认收起一级菜单，项目/租户布局继续使用各自的 shell 状态。
// state.collapsed = true

// 应用端左侧只承载一级菜单，二级导航交给内容区 ProjectSecondaryMenu，避免改动项目/租户壳层契约。
const applicationPrimarySourceMenus = computed(() => (
  config.value.menuData as LayoutMenuRouteRecord[]
))
const applicationPrimaryMenuData = computed(() => (
  applicationPrimarySourceMenus.value.map(stripMenuChildren)
))
const applicationConfig = computed(() => ({
  ...config.value,
  menuData: applicationPrimaryMenuData.value,
}))
const routeContextKeys = computed(() => getBreadcrumbPaths(route))
const currentRoutePath = computed(() => normalizeMenuKey(route.path))
const activePrimaryMenu = computed(() => (
  menuStore.siderMenus.find(menu => containsRouteContext(
    menu as ProjectNavigationRoute,
    routeContextKeys.value,
    currentRoutePath.value,
  ))
))
const activePrimaryKey = computed(() => (
  activePrimaryMenu.value ? getLayoutMenuKey(activePrimaryMenu.value as ProjectNavigationRoute) : ''
))
const visibleActivePrimaryMenu = computed(() => (
  applicationPrimarySourceMenus.value.find(menu => getLayoutMenuKey(menu) === activePrimaryKey.value)
))
const applicationPrimarySelectedKeys = computed(() => {
  const selectedKey = activePrimaryKey.value
  const isVisible = applicationPrimaryMenuData.value.some(menu => getLayoutMenuKey(menu) === selectedKey)

  return selectedKey && isVisible ? [selectedKey] : []
})
const applicationSecondaryItems = computed<ProjectNavigationItem[]>(() => {
  const sourceMenu = visibleActivePrimaryMenu.value || activePrimaryMenu.value

  return ((sourceMenu?.children || []) as ProjectNavigationRoute[])
    .map(toNavigationItem)
    .filter((item): item is ProjectNavigationItem => !!item)
})
const applicationSecondarySelectedKey = computed(() => (
  applicationSecondaryItems.value.find(item => isNavigationItemActive(
    item,
    routeContextKeys.value,
    currentRoutePath.value,
  ))?.key || ''
))
const secondaryMenuItems = computed(() => (
  applicationSecondaryItems.value.length ? applicationSecondaryItems.value : visibleSecondaryItems.value
))
const secondaryMenuSelectedKey = computed(() => (
  applicationSecondaryItems.value.length ? applicationSecondarySelectedKey.value : visibleSecondarySelectedKey.value
))

const navigateApplicationSecondary = (key: string) => {
  const targetMenu = findMenuByKey(menuStore.siderMenus, key)
  const targetPath = targetMenu ? findFirstLeafKey(targetMenu as ProjectNavigationRoute) : key

  if (targetPath && targetPath !== currentRoutePath.value) {
    void router.push(targetPath)
  }
}

const handleSecondaryMenuSelect = (key: string) => {
  if (applicationSecondaryItems.value.length) {
    navigateApplicationSecondary(key)
    return
  }

  selectVisibleSecondaryItem(key)
}
</script>

<style scoped lang="less" src="./BasicLayoutShell.less"></style>

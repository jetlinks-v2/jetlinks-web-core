<template>
  <div :class="['basic-layout-page', routeLayoutClassName, { 'basic-layout-page--header-scrolled': headerScrolled }]">
  <j-pro-layout
    v-bind="config"
    v-model:openKeys="state.openKeys"
    v-model:collapsed="state.collapsed"
    :selectedKeys="layoutSelectedKeys"
    :breadcrumb="{ routes: [] }"
    :pure="state.pure"
    :layoutType="layoutType"
    :collapsedButtonRender="false"
    :menuExtraRender="showMenuSearch ? undefined : false"
    :subMenuItemRender="layout.layout === 'side' && !state.collapsed ? renderPrimaryMenuGroup : undefined"
    @menuClick="handlePrimaryMenuClick"
    @backClick='goBack'
  >
    <template #menuHeaderRender>
      <div class="project-layout__brand" :style="layout.layout === 'top' ? undefined : logoWidth">
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
      <RegistryComponent pageCode="layout" code="layout" @click="onClick">

      </RegistryComponent>
    </template>

    <template #rightContentRender>
      <div class="right-content">
        <RegistryComponent pageCode="layout" code="headerRight">
          <template v-if="!hideHeaderRight">
            <Resource key="resource" v-if="systemInfo?.['front']?.resources"/>
            <Language key="Language" />
            <Notice key="notice" />
          </template>
            <LayoutSidebarUser
                key="user"
                :collapsed="state.collapsed"
            />
        </RegistryComponent>
      </div>
    </template>
      <div class="project-layout__content">
          <ProjectSecondaryMenu
              v-if="visibleSecondaryItems.length"
              :items="visibleSecondaryItems"
              :selectedKey="visibleSecondarySelectedKey"
              @select="selectVisibleSecondaryItem"
          />
          <div class="project-layout__route-content">
              <PageRouteView />
          </div>
      </div>
  </j-pro-layout>
  <AiChat />
  </div>
</template>

<script setup name="BasicLayoutPage" lang="ts">
import { reactive, computed, watchEffect } from 'vue'
import { useWindowScroll } from '@vueuse/core'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import {
  Notice,
  Language,
  Resource,
  AiChat,
  LayoutSidebarUser
} from './components'
import { storeToRefs } from 'pinia'
import { getHideHeaderRightConfig, routerFallback } from '@jetlinks-web-core/utils'
import { isSubApp } from '@/utils/consts'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import { useResponsiveLayoutDimensions } from '@jetlinks-web-core/hooks'
import { useGlobalHomeAgent } from '@jetlinks-web-core/layout/components/AiChat/useGlobalHomeAgent'
import ProjectSecondaryMenu from './components/ProjectSecondaryMenu.vue'
import { filterMenusByKeyword } from './utils/menuSearch'
import { useProjectGeneralAgent } from './hooks/useProjectGeneralAgent'
import { useProjectNavigation } from './hooks/useProjectNavigation'
import { provideProjectSecondaryMenu } from './hooks/useProjectSecondaryMenu'
import { useProjectSecondaryMenuExtensions } from './hooks/useProjectSecondaryMenuExtensions'
import { PROJECT_SETTINGS_MENU_CODE } from './navigation.constants'
import { renderPrimaryMenuGroup } from './utils/projectMenuRender'

const router = useRouter();
const route = useRoute();
const systemStore = useSystemStore()
const menuStore = useMenuStore()
const layoutType = ref('list')
const hideHeaderRight = getHideHeaderRightConfig()
const menuSearchKeyword = ref('')

const { theme, layout, language, systemInfo, themeStyleToken } = storeToRefs(systemStore)
const { y: scrollY } = useWindowScroll()
const headerScrolled = computed(() => layout.value.layout === 'top' && scrollY.value > 0)

type ProjectBreadcrumbRoute = {
    path?: string
}

type ProjectMenuClickEvent = {
    key: string | number
    item?: {
        path?: string
        key?: string | number
    }
}

const state = reactive<{
  pure: boolean
  collapsed: boolean
  openKeys: string[]
  selectedKeys: string[]
}>({
  pure: false,
  collapsed: false, // default value
  openKeys: [],
  selectedKeys: [],
});

const themeLayout = computed(() => themeStyleToken.value.layout)
const menuVariant = computed(() => themeLayout.value?.menuVariant || 'classic')
const routeLayoutClassName = computed(() => (
    [...route.matched]
        .reverse()
        .find(record => record.meta.layoutClassName)
        ?.meta.layoutClassName || ''
))
const showMenuSearch = computed(() => !!themeLayout.value?.showMenuSearch && !state.collapsed)
const { layoutConfig } = useResponsiveLayoutDimensions(layout, themeLayout)

useProjectGeneralAgent(route, router)

const filteredSiderMenus = computed(() => {
    return filterMenusByKeyword(menuStore.siderMenus, menuSearchKeyword.value.toLowerCase())
})

const projectMenus = computed(() => menuStore.siderMenus)
const {
    primaryMenus,
    primarySelectedKeys,
    mixSelectedKeys,
    topSelectedKeys,
    secondaryItems,
    secondarySelectedKey,
    navigatePrimary,
    navigateSecondary,
} = useProjectNavigation({
    menus: projectMenus,
    filteredMenus: filteredSiderMenus,
    searchKeyword: menuSearchKeyword,
    route,
    router,
})

const layoutSelectedKeys = computed(() => {
    if (layout.value.layout === 'mix') return mixSelectedKeys.value
    return layout.value.layout === 'top' ? topSelectedKeys.value : primarySelectedKeys.value
})
// top 保留完整树用于级联子菜单；side/mix 仍只把一级、二级交给 ProLayout。
const layoutMenuData = computed(() => (
    layout.value.layout === 'top' ? filteredSiderMenus.value : primaryMenus.value
))

const logoWidth = computed(() => {
    const _width = `${!state.collapsed ? config.value.siderWidth + 'px' : '100%'}`
    return {
        width: _width,
        minWidth: _width,
        maxWidth: _width,
    }
})

const {
    active: settingsActive,
    enterTarget: enterSettings,
    items: settingsSecondaryItems,
    selectedKey: settingsSecondarySelectedKey,
} = useProjectSecondaryMenuExtensions(PROJECT_SETTINGS_MENU_CODE)
const pageSecondaryMenu = provideProjectSecondaryMenu()

const pageSecondaryMenuActive = computed(() => (
    !settingsActive.value
    && !secondaryItems.value.length
    && !!pageSecondaryMenu.items.value.length
))

const visibleSecondaryItems = computed(() => {
    if (settingsActive.value) return settingsSecondaryItems.value
    if (pageSecondaryMenuActive.value) return pageSecondaryMenu.items.value
    // top 的路由三级菜单由 header 级联承载，不再重复渲染为内容区 Tab。
    return layout.value.layout === 'top' ? [] : secondaryItems.value
})
const visibleSecondarySelectedKey = computed(() => {
    if (settingsActive.value) return settingsSecondarySelectedKey.value
    return pageSecondaryMenuActive.value ? pageSecondaryMenu.selectedKey.value : secondarySelectedKey.value
})

useGlobalHomeAgent(route)

const config = computed(() => ({
  ...layoutConfig.value,
  headerHeight: 52,
  siderWidth: 240,
  collapsedWidth: 56,
  theme: theme.value,
  menuData: layoutMenuData.value,
  splitMenus: layout.value.layout === 'mix',
  classNames: {
    'cloud-project': true,
    'cloud-project--collapsed': state.collapsed,
    [`jet-layout-menu-${menuVariant.value}`]: true,
    [`cloud-layout-${layout.value.layout}`]: true
  }
}))

const goBack = () => {
  if (isSubApp) {
    const globalData = (window as any).microApp.getGlobalData() as { api: Record<string, any>}
    globalData.api.routerFallback?.()
  } else {
    routerFallback()
  }
}

const init = () => {
  (window as any).microApp?.addDataListener((data: any) => {
    if (data.layoutType) {
      layoutType.value = data.layoutType
    }
  }, true)
}

init()

const onClick = () => undefined

const handlePrimaryMenuClick = ({ item, key }: ProjectMenuClickEvent) => {
    navigatePrimary(String(item?.path || item?.key || key))
}


const selectVisibleSecondaryItem = (key: string) => {
    if (pageSecondaryMenuActive.value) {
        pageSecondaryMenu.select(key)
        return
    }

    navigateSecondary(key)
}

/**
 * 处理菜单选中，展开状态
 */
watchEffect(() => {
  if (router.currentRoute) {
    const paths = (
      route.meta.breadcrumb || route.meta.breadcrumbCache || []
    ) as ProjectBreadcrumbRoute[]
    state.selectedKeys = paths.map(item => item.path).filter((path): path is string => !!path)
    // 顶部菜单的 openKeys 会直接打开浮层，刷新时只恢复侧栏菜单的展开状态。
    state.openKeys = layout.value.layout === 'top' ? [] : paths.map(item => item.path).filter((path): path is string => !!path)
  }
  if (route.query?.layout === 'false') {
    state.pure = true
  }
})

</script>

<style scoped>
.right-content {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  height: var(--chrome-header-height);
  line-height: var(--chrome-header-height);
}</style>

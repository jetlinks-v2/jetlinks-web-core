<template>
  <div :class="['basic-layout-page', routeLayoutClassName]">
  <j-pro-layout
    v-bind="config"
    v-model:openKeys="state.openKeys"
    v-model:collapsed="state.collapsed"
    :selectedKeys="primarySelectedKeys"
    :breadcrumb="{ routes: [] }"
    :pure="state.pure"
    :layoutType="layoutType"
    :menuExtraRender="showMenuSearch ? undefined : false"
    class="cloud-project"
    @menuClick="handlePrimaryMenuClick"
    @backClick='goBack'
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
    <template #menuExtraRender>
      <LayoutMenuSearch @search="menuSearchKeyword = $event" />
    </template>
    <template #linksRender>
      <LayoutSidebarUser
        :collapsed="state.collapsed"
      />
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
            <Notice key="notice" />
            <Language key="Language" />
          </template>
<!--          <HeaderThemeSwitch key="theme" />-->
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
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import {
  Notice,
  Language,
  Resource,
  AiChat,
  LayoutMenuSearch,
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

const router = useRouter();
const route = useRoute();
const systemStore = useSystemStore()
const menuStore = useMenuStore()
const layoutType = ref('list')
const hideHeaderRight = getHideHeaderRightConfig()
const menuSearchKeyword = ref('')

const { theme, layout, language, systemInfo, themeStyleToken } = storeToRefs(systemStore)

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
    return pageSecondaryMenuActive.value ? pageSecondaryMenu.items.value : secondaryItems.value
})
const visibleSecondarySelectedKey = computed(() => {
    if (settingsActive.value) return settingsSecondarySelectedKey.value
    return pageSecondaryMenuActive.value ? pageSecondaryMenu.selectedKey.value : secondarySelectedKey.value
})

useGlobalHomeAgent(route)

const config = computed(() => ({
  ...layoutConfig.value,
  headerHeight: 56,
  siderWidth: 240,
  collapsedWidth: 56,
  theme: theme.value,
  menuData: primaryMenus.value,
  splitMenus: false,
  classNames: {
    'cloud-project': true,
    'cloud-project--collapsed': state.collapsed,
    [`jet-layout-menu-${menuVariant.value}`]: true
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
    state.openKeys = paths.map(item => item.path).filter((path): path is string => !!path)
  }
  if (route.query?.layout === 'false') {
    state.pure = true
  }
})

</script>

<style scoped>
.right-content {
  margin-left: auto;
  margin-right: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-6);
  height: var(--chrome-header-height);
  line-height: var(--chrome-header-height);
}</style>

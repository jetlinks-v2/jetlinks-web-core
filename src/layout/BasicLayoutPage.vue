<template>
  <j-pro-layout
    v-bind="config"
    v-model:openKeys="state.openKeys"
    v-model:collapsed="state.collapsed"
    :selectedKeys="state.selectedKeys"
    :breadcrumb="{ routes: route.meta.breadcrumb }"
    :pure="state.pure"
    :layoutType="layoutType"
    :menuExtraRender="showMenuSearch ? undefined : false"
    @backClick='goBack'
  >
    <template #breadcrumbRender="slotProps">
      <a v-if="slotProps.route.index !== 0 && !slotProps.route.isLast" @click="() => jumpPage(slotProps)" >
        {{ slotProps.route.breadcrumbName }}
      </a>
      <span v-else style='cursor: default' >{{ slotProps.route.breadcrumbName }}</span>
    </template>
    <template #menuExtraRender>
      <LayoutMenuSearch />
    </template>
    <template #linksRender>
      <LayoutSidebarUser
        :collapsed="state.collapsed"
        @toggleCollapse="state.collapsed = !state.collapsed"
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
            <Language key="Language" />
            <Resource key="resource" v-if="systemInfo?.['front']?.resources"/>
            <Notice key="notice" />
          </template>
          <HeaderThemeSwitch key="theme" />
        </RegistryComponent>
      </div>
    </template>
    <PageRouteView />
  </j-pro-layout>
  <AiChat />
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
  LayoutSidebarUser,
  HeaderThemeSwitch
} from './components'
import { storeToRefs } from 'pinia'
import { getHideHeaderRightConfig, routerFallback } from '@jetlinks-web-core/utils'
import { isSubApp } from '../utils/consts'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import { useResponsiveLayoutDimensions } from '@jetlinks-web-core/hooks'

const router = useRouter();
const route = useRoute();
const systemStore = useSystemStore()
const menuStore = useMenuStore()
const layoutType = ref('list')
const hideHeaderRight = getHideHeaderRightConfig()

const { theme, layout, language, systemInfo, themeStyleToken } = storeToRefs(systemStore)

const state = reactive({
  pure: false,
  collapsed: false, // default value
  openKeys: [],
  selectedKeys: [],
});

const themeLayout = computed(() => themeStyleToken.value.layout)
const menuVariant = computed(() => themeLayout.value?.menuVariant || 'classic')
const showMenuSearch = computed(() => !!themeLayout.value?.showMenuSearch && !state.collapsed)
const { layoutConfig } = useResponsiveLayoutDimensions(layout, themeLayout)

const config = computed(() => ({
  ...layoutConfig.value,
  theme: theme.value,
  menuData: menuStore.siderMenus,
  splitMenus: layout.value.layout === 'mix',
  classNames: {
    [`jet-layout-menu-${menuVariant.value}`]: true
  }
}))

/**
 * 路由跳转
 */
const jumpPage = (record: any) => {
  menuStore.jumpPage(record.route.name, {})
}

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

const onClick = () => {
  console.log('点击了')
}

const resolveMenuKeys = (paths: Array<Record<string, any>>) => {
  const menuPaths = paths.map(item => item.path).filter(Boolean)
  const leafPath = menuPaths.at(-1)
  const openKeys = leafPath ? menuPaths.slice(0, -1) : menuPaths

  if (!leafPath) {
    return {
      selectedKeys: [],
      openKeys
    }
  }

  if (layout.value.layout === 'mix') {
    const rootPath = menuPaths[0]
    return {
      selectedKeys: rootPath && rootPath !== leafPath ? [rootPath, leafPath] : [leafPath],
      openKeys
    }
  }

  return {
    selectedKeys: [leafPath],
    openKeys
  }
}

/**
 * 处理菜单选中，展开状态
 */
watchEffect(() => {
  if (router.currentRoute) {
    const paths = route.meta.breadcrumb || route.meta.breadcrumbCache || []
    const { selectedKeys, openKeys } = resolveMenuKeys(paths)
    state.selectedKeys = selectedKeys
    state.openKeys = openKeys
  }
  if (route.query?.layout === 'false') {
    state.pure = true
  }
})

</script>

<style scoped>
.right-content {
  margin-right: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-6);
  height: 3rem;
}</style>

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
<!--    <template #linksRender>-->
<!--      <LayoutSidebarUser-->
<!--        :collapsed="state.collapsed"-->
<!--        @toggleCollapse="state.collapsed = !state.collapsed"-->
<!--      />-->
<!--    </template>-->
    <template #leftContentRender>
      <RegistryComponent pageCode="layout" code="layout" @click="onClick">

      </RegistryComponent>
    </template>

    <template #rightContentRender>
      <div class="right-content">
        <RegistryComponent pageCode="layout" code="headerRight">
          <template v-if="!hideHeaderRight">
<!--            <Language key="Language" />-->
<!--            <Resource key="resource" v-if="systemInfo?.['front']?.resources"/>-->
            <a-tooltip title="应用中心">
              <a-button
                class="application-center-button"
                type="text"
                shape="circle"
                @click="openApplicationCenter"
              >
                <template #icon>
                  <AIcon type="AppstoreOutlined" />
                </template>
              </a-button>
            </a-tooltip>
            <Notice key="notice" />
          </template>
<!--          <HeaderThemeSwitch key="theme" />-->
          <User key="user" :hideHeaderRight="hideHeaderRight" />
        </RegistryComponent>
      </div>
    </template>
    <div class="layout-bg-blur" aria-hidden="true">
      <span class="layout-bg-blur__left" />
      <span class="layout-bg-blur__right" />
    </div>
    <div class="layout-header-mask" aria-hidden="true">
      <span class="layout-header-mask__left" />
      <span class="layout-header-mask__right" />
    </div>
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
  User
} from './components'
import { storeToRefs } from 'pinia'
import { getHideHeaderRightConfig, routerFallback } from '@jetlinks-web-core/utils'
import { isSubApp } from '@/utils/consts'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import { useResponsiveLayoutDimensions } from '@jetlinks-web-core/hooks'
import { useGlobalHomeAgent } from '@jetlinks-web-core/layout/components/AiChat/useGlobalHomeAgent'

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
const headerMaskHeight = computed(() => `${layoutConfig.value.headerHeight}px`)
useGlobalHomeAgent(route)

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

const openApplicationCenter = () => {
  router.push({
    name: 'smart-park-services/application'
  })
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
    // const { selectedKeys, openKeys } = resolveMenuKeys(paths)
    state.selectedKeys = paths.map(item => item.path)
    state.openKeys = paths.map(item => item.path)
  }
  if (route.query?.layout === 'false') {
    state.pure = true
  }
})

</script>

<style scoped>
.right-content {
  position: relative;
  z-index: 2;
  margin-right: var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-6);
  height: 3rem;
}

.application-center-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #1d2129;

  :deep(.anticon) {
    font-size: 1rem;
  }
}

.layout-bg-blur {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.layout-bg-blur__left,
.layout-bg-blur__right {
  position: absolute;
  border-radius: 250.065px;
  opacity: 0.4;
  filter: blur(80.0208px);
}

.layout-bg-blur__left {
  top: -80px;
  left: -80px;
  width: 235px;
  height: 235px;
  background: #60d1fa;
}

.layout-bg-blur__right {
  top: -120px;
  right: -120px;
  width: 356px;
  height: 356px;
  background: #60a5fa;
}

.layout-header-mask {
  position: fixed;
  top: 0;
  right: 0;
  left: 0;
  height: v-bind(headerMaskHeight);
  pointer-events: none;
  background: rgba(241, 245, 255, 0.96);
  overflow: hidden;
  z-index: 2;
}

.layout-header-mask__left,
.layout-header-mask__right {
  position: absolute;
  border-radius: 250.065px;
  opacity: 0.4;
  filter: blur(80.0208px);
}

.layout-header-mask__left {
  top: -80px;
  left: -80px;
  width: 235px;
  height: 235px;
  background: #60d1fa;
}

.layout-header-mask__right {
  top: -120px;
  right: -120px;
  width: 356px;
  height: 356px;
  background: #60a5fa;
}

:deep(.ant-layout) {
  position: relative;
  z-index: 1;
}

:deep(.ant-pro-top-nav-header),
:deep(.ant-layout-header),
:deep(.ant-layout-sider),
:deep(.ant-pro-page-container) {
  position: relative;
  z-index: 1;
}

:deep(.ant-pro-fixed-header),
:deep(.ant-layout-header) {
  z-index: 3;
}
</style>

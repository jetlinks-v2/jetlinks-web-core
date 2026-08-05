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
        <a-tree-select
          v-if="!userStore.isAdmin"
          v-model:value="selectedPark"
          class="basic-layout-park-select"
          :tree-data="parkOptions"
          :loading="loadingParks"
          :allow-clear="false"
          tree-default-expand-all
          show-search
          :tree-node-filter-prop="'title'"
        />
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
import { reactive, computed, watch, watchEffect, onMounted } from 'vue'
import { LocalStore } from '@jetlinks-web/utils'
import { request } from '@jetlinks-web/core'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useUserStore } from '@jetlinks-web-core/store'
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
import { PARK_STORAGE_KEY } from '@jetlinks-web-core/utils/consts'

type BasicConfigTreeNode = {
  id?: string
  key?: string
  name?: string
  type?: string
  orgId?: string
  parkId?: string
  children?: BasicConfigTreeNode[]
}

type ParkTreeSelectNode = {
  title: string
  value: string
  key: string
  disabled?: boolean
  selectable?: boolean
  children?: ParkTreeSelectNode[]
}

const router = useRouter();
const route = useRoute();
const systemStore = useSystemStore()
const menuStore = useMenuStore()
const userStore = useUserStore()
const layoutType = ref('list')
const hideHeaderRight = getHideHeaderRightConfig()

const { theme, layout, language, systemInfo, themeStyleToken } = storeToRefs(systemStore)
const selectedPark = ref(String(LocalStore.get(PARK_STORAGE_KEY) || ''))
const loadingParks = ref(false)
const currentUserParkTree = ref<BasicConfigTreeNode[]>([])

const state = reactive({
  pure: false,
  collapsed: false, // default value
  openKeys: [] as string[],
  selectedKeys: [] as string[],
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
  router.push('/application/center')
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

const unwrapResult = <T,>(response: { result?: T } | T): T => {
  if (response && typeof response === 'object' && 'result' in response) {
    return (response as { result?: T }).result as T
  }
  return response as T
}

const toParkTreeSelectNode = (node: BasicConfigTreeNode): ParkTreeSelectNode | undefined => {
  if (node.type === 'park') {
    const value = String(node.parkId || node.id || node.key || '')
    if (!value) return undefined
    return {
      title: String(node.name || value),
      value,
      key: value,
    }
  }

  if (node.type !== 'org') {
    return undefined
  }

  const children = (node.children || [])
    .map(toParkTreeSelectNode)
    .filter(Boolean) as ParkTreeSelectNode[]
  if (!children.length) {
    return undefined
  }
  const value = String(node.id || node.orgId || node.key || node.name || '')
  return {
    title: String(node.name || value),
    value: `org:${value}`,
    key: `org:${value}`,
    disabled: true,
    selectable: false,
    children,
  }
}

const currentUserParkOptions = computed<ParkTreeSelectNode[]>(() => (
  currentUserParkTree.value
    .map(toParkTreeSelectNode)
    .filter(Boolean) as ParkTreeSelectNode[]
))

const parkOptions = computed<ParkTreeSelectNode[]>(() => [
  ...(userStore.isAdmin ? [{ title: '全部园区', value: 'all', key: 'all' }] : []),
  ...currentUserParkOptions.value,
])

const loadCurrentUserParkTree = async () => {
  loadingParks.value = true
  try {
    const response = await request.get('/user/park/tree/current')
    currentUserParkTree.value = unwrapResult<BasicConfigTreeNode[]>(response) || []
  } catch {
    currentUserParkTree.value = []
  } finally {
    loadingParks.value = false
  }
}

const isSelectableParkOption = (node: ParkTreeSelectNode): boolean => node.selectable !== false

const includesParkOptionValue = (options: ParkTreeSelectNode[], value: string): boolean => (
  options.some(item => (
    (isSelectableParkOption(item) && item.value === value)
      || includesParkOptionValue(item.children || [], value)
  ))
)

const findFirstSelectableParkValue = (options: ParkTreeSelectNode[]): string | undefined => {
  for (const item of options) {
    if (isSelectableParkOption(item)) {
      return item.value
    }

    const childValue = findFirstSelectableParkValue(item.children || [])
    if (childValue) {
      return childValue
    }
  }

  return undefined
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
    const paths = (route.meta.breadcrumb || route.meta.breadcrumbCache || []) as Array<{ path?: string }>
    const menuPaths = paths.map(item => item.path).filter((path): path is string => Boolean(path))
    state.selectedKeys = menuPaths
    state.openKeys = menuPaths.slice(0, -1)
  }
  if (route.query?.layout === 'false') {
    state.pure = true
  }
  // 平台管理员不展示园区切换，统一按全部园区访问，避免沿用历史缓存的单园区范围。
  if (userStore.isAdmin && selectedPark.value !== 'all') {
    selectedPark.value = 'all'
  }
  if (!includesParkOptionValue(parkOptions.value, selectedPark.value)) {
    selectedPark.value = findFirstSelectableParkValue(parkOptions.value) || ''
  }
})

watchEffect(() => {
  if (selectedPark.value) {
    LocalStore.set(PARK_STORAGE_KEY, selectedPark.value)
  }
})

watch(selectedPark, (value, oldValue) => {
  if (value !== oldValue && route.name !== 'ParkSwitchRedirect') {
    router.replace({
      name: 'ParkSwitchRedirect',
      query: {
        redirect: route.fullPath,
        _parkSwitch: String(Date.now()),
      },
    })
  }
}, { flush: 'post' })

onMounted(loadCurrentUserParkTree)

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

.basic-layout-park-select {
  width: 10rem;
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

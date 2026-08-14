<template>
  <PageRouteView v-if="state.pure" />
  <div v-else class="smart-park-layout-shell ant-pro-basicLayout">
    <header class="smart-park-globalbar">
      <div class="smart-park-sidebar__brand">
        <img v-if="layout.logo" class="smart-park-sidebar__logo" :src="layout.logo" :alt="layout.title" />
        <span v-else class="smart-park-sidebar__brand-mark">{{ brandInitial }}</span>
        <span class="smart-park-sidebar__brand-text">
          <strong>{{ layout.title }}</strong>
        </span>
      </div>

      <div v-if="showProductTabs" class="smart-park-product-tabs">
        <a-button
          v-for="item in menuNodes"
          :key="item.key"
          type="text"
          class="smart-park-product-tab"
          :class="{ 'smart-park-product-tab--active': isMenuNodeActive(item) }"
          :title="item.title"
          @click="handleRootClick(item)"
        >
          <MenuIcon :item="item" class="smart-park-product-tab__icon" />
          <span class="smart-park-product-tab__title">{{ item.title }}</span>
        </a-button>
      </div>

      <div class="smart-park-global-actions">
        <a-tree-select
          v-if="!userStore.isAdmin"
          v-model:value="selectedPark"
          class="smart-park-park-select"
          :tree-data="parkOptions"
          :loading="loadingParks"
          :allow-clear="false"
          tree-default-expand-all
          show-search
          :tree-node-filter-prop="'title'"
        />
        <RegistryComponent pageCode="layout" code="headerRight">
          <template v-if="!hideHeaderRight">
            <Notice key="notice" />
          </template>
          <User key="user" :hideHeaderRight="hideHeaderRight" />
        </RegistryComponent>
      </div>
    </header>

    <aside class="smart-park-sidebar">
      <nav class="smart-park-sidebar__nav" aria-label="layout navigation">
        <div
          class="smart-park-sidebar__domain"
          :class="{ 'smart-park-sidebar__domain--simple': !showPrimaryRail }"
        >
          <div v-if="showPrimaryRail" class="smart-park-sidebar__primary-rail">
            <div
              v-for="section in primarySections"
              :key="section.key"
              class="smart-park-sidebar__primary"
              :class="{ 'smart-park-sidebar__primary--active': section.key === activeSection?.key }"
              :title="section.title"
              role="button"
              tabindex="0"
              @click="handlePrimaryClick(section)"
              @keydown.enter.prevent="handlePrimaryClick(section)"
              @keydown.space.prevent="handlePrimaryClick(section)"
            >
              <MenuIcon :item="section" class="smart-park-sidebar__primary-icon" />
              <b>{{ section.title }}</b>
            </div>
          </div>

          <a-menu
            class="smart-park-sidebar__secondary"
            mode="inline"
            :selectedKeys="state.selectedKeys"
            :openKeys="state.openKeys"
            :style="{ borderInlineEnd: '0', background: 'transparent', color: 'var(--jet-theme-text)' }"
            @click="handleSecondaryMenuClick"
            @openChange="handleSecondaryOpenChange"
          >
            <SmartParkSidebarMenu
              :nodes="secondaryMenuItems"
              :is-active="isOwnMenuNodeActive"
            />
          </a-menu>
        </div>
      </nav>
    </aside>

    <main class="smart-park-main">
      <section class="smart-park-content">
        <PageRouteView />
      </section>
    </main>
  </div>
</template>

<script setup name="SmartParkLayoutPage" lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, resolveComponent, type PropType, watch, watchEffect } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import type { MenuProps } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { LocalStore } from '@jetlinks-web/utils'
import { request } from '@jetlinks-web/core'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useUserStore } from '@jetlinks-web-core/store'
import { Notice, User } from './components'
import { getHideHeaderRightConfig } from '@jetlinks-web-core/utils'
import { PARK_STORAGE_KEY } from '@jetlinks-web-core/utils/consts'
import { dispatchParkChanged, isWorkflowEmbedRoute } from '@jetlinks-web-core/utils/park-events'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import { LayoutType } from '@jetlinks-web/components/es/ProLayout/defaultSettings'
import { defaultRouteContext, provideRouteContext } from '@jetlinks-web/components/es/ProLayout/RouteContext'

type MenuNode = {
  key: string
  title: string
  path?: string
  name?: string
  icon?: string
  children: MenuNode[]
  raw: RouteRecordRaw
}

type BreadcrumbRoute = {
  key: string
  breadcrumbName: string
  name?: string
  path?: string
  index: number
  isLast: boolean
}

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

const EMPTY_MENU_NODES: MenuNode[] = []

const MenuIcon = defineComponent({
  name: 'SmartParkMenuIcon',
  props: {
    item: {
      type: Object as PropType<MenuNode>,
      required: true,
    },
    class: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const AIcon = resolveComponent('AIcon')

    return () => {
      if (props.item.icon) {
        return h('span', { class: ['smart-park-sidebar__icon', props.class] }, [
          h(AIcon, { type: props.item.icon }),
        ])
      }

      return h('span', { class: ['smart-park-sidebar__icon', props.class] }, props.item.title.slice(0, 1))
    }
  },
})

// 侧栏菜单显式渲染 title slot，避免不同 Ant Design Vue 版本对 items.label 的渲染差异导致菜单名丢失。
const SmartParkSidebarMenu = defineComponent({
  name: 'SmartParkSidebarMenu',
  props: {
    nodes: {
      type: Array as PropType<MenuNode[]>,
      required: true,
    },
    isActive: {
      type: Function as PropType<(node: MenuNode) => boolean>,
      required: true,
    },
  },
  setup(props) {
    const AMenuItem = resolveComponent('AMenuItem')
    const ASubMenu = resolveComponent('ASubMenu')

    const renderLabel = (node: MenuNode) => h('span', {
      class: ['smart-park-sidebar__menu-label', {
        'smart-park-sidebar__menu-label--active': props.isActive(node),
      }],
    }, [
      h(MenuIcon, { item: node, class: 'smart-park-sidebar__item-icon', style: { marginRight: '6px' } },),
      h('span', { class: 'smart-park-sidebar__item-title' }, node.title),
    ])

    const renderNodes = (nodes: MenuNode[]): ReturnType<typeof h>[] => nodes.map((node) => {
      if (node.children.length) {
        return h(ASubMenu, {
          key: node.key,
        }, {
          title: () => renderLabel(node),
          default: () => renderNodes(node.children),
        })
      }

      return h(AMenuItem, { key: node.key }, {
        default: () => renderLabel(node),
      })
    })

    return () => renderNodes(props.nodes)
  },
})

const router = useRouter()
const route = useRoute()
const systemStore = useSystemStore()
const menuStore = useMenuStore()
const userStore = useUserStore()
const hideHeaderRight = getHideHeaderRightConfig()

const { layout } = storeToRefs(systemStore)
const selectedPark = ref(String(LocalStore.get(PARK_STORAGE_KEY) || ''))
const loadingParks = ref(false)
const currentUserParkTree = ref<BasicConfigTreeNode[]>([])

const state = reactive({
  pure: false,
  openKeys: [] as string[],
  selectedKeys: [] as string[],
})

const routeSelectedKeys = computed(() => {
  const paths = (route.meta.breadcrumb || route.meta.breadcrumbCache || []) as Array<{ name?: string; path?: string }>
  return paths.map(item => item.path).filter(Boolean).map(String)
})

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

const normalizeMenuNode = (item: RouteRecordRaw): MenuNode | undefined => {
  const meta = (item.meta || {}) as Record<string, any>
  if (meta.hideInMenu === true || meta?.options?.show === false) return undefined

  const title = String(meta.title || item.name || item.path || '')
  if (!title) return undefined

  const children = ((item.children || []) as RouteRecordRaw[])
    .map(child => normalizeMenuNode(child))
    .filter(Boolean) as MenuNode[]
  // Only a component that resolves to an actual page, iframe, or micro app marks
  // this node as navigable. Generated layout components do not count as pages.
  const hasPage = meta.hasPage === true

  // Application disablement can remove all child pages while leaving its route group.
  // Do not render that empty group in either the product navigation or the sidebar.
  if (!hasPage && !children.length) return undefined

  return {
    key: String(item.path || item.name || title),
    title,
    path: item.path,
    name: item.name ? String(item.name) : undefined,
    icon: meta.icon as string | undefined,
    children,
    raw: item,
  }
}

const menuNodes = computed(() => (
  (menuStore.siderMenus || [])
    .map(item => normalizeMenuNode(item))
    .filter((item): item is MenuNode => Boolean(item && item.children.length))
))
const showProductTabs = computed(() => menuNodes.value.length > 1)

const isOwnMenuNodeActive = (node: MenuNode) => {
  const keys = routeSelectedKeys.value
  return [node.key, node.path, node.name].filter(Boolean).some(key => keys.includes(String(key)))
    || (!!node.path && (route.path === node.path || route.path.startsWith(`${node.path}/`)))
}

const isMenuNodeActive = (node: MenuNode): boolean => {
  return isOwnMenuNodeActive(node) || node.children.some(child => isMenuNodeActive(child))
}

const findActiveNode = (nodes: MenuNode[]) => {
  if (route.path.startsWith('/config/')) {
    const configNode = nodes.find(item => item.path === '/config')
    if (configNode) {
      return configNode
    }
  }
  return nodes.find(item => isMenuNodeActive(item))
}

const activeRoot = computed(() => findActiveNode(menuNodes.value) || menuNodes.value[0])
const activeRootTitle = computed(() => activeRoot.value?.title || '')
const brandInitial = computed(() => (layout.value.title || activeRootTitle.value || 'J').slice(0, 1))
const proLayoutBreadcrumbRoutes = computed<BreadcrumbRoute[]>(() => {
  const items = (route.meta.breadcrumb || route.meta.breadcrumbCache || []) as Array<{
    breadcrumbName?: string
    title?: string
    name?: string
    path?: string
  }>

  return items
    .map((item, index) => ({
      key: String(item.path || item.name || index),
      breadcrumbName: String(item.breadcrumbName || item.title || ''),
      name: item.name,
      path: item.path,
      index,
      isLast: index === items.length - 1,
    }))
    .filter(item => item.breadcrumbName)
})

const jumpProLayoutBreadcrumb = (item: BreadcrumbRoute) => {
  if (item.name) {
    menuStore.jumpPage(item.name, {})
    return
  }

  if (item.path) {
    router.push(item.path)
  }
}

const breadcrumbItemRender = ({ route: item, routes }: { route: BreadcrumbRoute; routes: BreadcrumbRoute[] }) => {
  const index = item.index ?? routes.indexOf(item)
  const isLast = item.isLast ?? index === routes.length - 1

  if (index === 0 || isLast) {
    return h('span', { style: { cursor: 'default' } }, item.breadcrumbName)
  }

  return h('a', {
    onClick: (event: MouseEvent) => {
      event.preventDefault()
      jumpProLayoutBreadcrumb(item)
    },
  }, item.breadcrumbName)
}

const proLayoutRouteContext = reactive({
  ...defaultRouteContext,
  breadcrumb: computed(() => ({
    routes: proLayoutBreadcrumbRoutes.value,
    itemRender: breadcrumbItemRender,
  })),
  hasHeader: true,
  fixedHeader: false,
  headerHeight: 48,
  hasFooterToolbar: false,
  layoutType: LayoutType.LIST,
})

provideRouteContext(proLayoutRouteContext)

const rootChildren = computed<MenuNode[]>(() => activeRoot.value?.children || EMPTY_MENU_NODES)
const showPrimaryRail = computed(() => (
  rootChildren.value.length > 1 && rootChildren.value.some(item => item.children.length)
))
const primarySections = computed(() => showPrimaryRail.value ? rootChildren.value : [])
const activeSection = computed(() => (
  showPrimaryRail.value
    ? findActiveNode(primarySections.value) || primarySections.value[0]
    : undefined
))
const secondaryMenuItems = computed(() => {
  if (!activeRoot.value) return []
  if (!showPrimaryRail.value) {
    return activeRoot.value.children.length ? activeRoot.value.children : [activeRoot.value]
  }

  const section = activeSection.value
  return section?.children.length ? section.children : (section ? [section] : [])
})
const secondaryMenuNodeMap = computed(() => {
  const map = new Map<string, MenuNode>()
  const collect = (nodes: MenuNode[]) => {
    nodes.forEach((item) => {
      map.set(item.key, item)
      collect(item.children)
    })
  }

  collect(secondaryMenuItems.value)
  return map
})

const findFirstNavigableNode = (node: MenuNode): MenuNode => {
  if (!node.children.length) return node
  return findFirstNavigableNode(node.children[0])
}

const handleMenuClick = (node: MenuNode) => {
  const target = node.children.length && !isOwnMenuNodeActive(node) ? findFirstNavigableNode(node) : node

  if (target.name) {
    menuStore.jumpPage(target.name, {})
    return
  }

  if (target.path) {
    router.push(target.path)
  }
}

const handlePrimaryClick = (node: MenuNode) => {
  handleMenuClick(findFirstNavigableNode(node))
}

const handleRootClick = (node: MenuNode) => {
  handleMenuClick(findFirstNavigableNode(node))
}

const handleSecondaryMenuClick: MenuProps['onClick'] = ({ key }) => {
  const node = secondaryMenuNodeMap.value.get(String(key))
  if (node) {
    handleMenuClick(node)
  }
}

const handleSecondaryOpenChange: MenuProps['onOpenChange'] = (openKeys) => {
  state.openKeys = openKeys.map(String)
}

const resolveMenuKeys = (paths: Array<Record<string, any>>, activeMenu?: unknown) => {
  // a-menu 的 key 与 normalizeMenuNode 一致，优先取 path，再回退 name，避免 selectedKeys 命中不到菜单节点。
  const menuKeys = paths.map(item => item.path || item.name).filter(Boolean).map(String)
  const leafKey = typeof activeMenu === 'string' && activeMenu ? activeMenu : menuKeys.at(-1)
  const openKeys = leafKey ? menuKeys.slice(0, -1) : menuKeys

  if (!leafKey) {
    return {
      selectedKeys: [] as string[],
      openKeys,
    }
  }

  return {
    selectedKeys: [leafKey],
    openKeys,
  }
}

watchEffect(() => {
  state.pure = route.query?.layout === 'false'
  // 平台管理员不展示园区切换，统一按全部园区访问，避免沿用历史缓存的单园区范围。
  if (userStore.isAdmin && selectedPark.value !== 'all') {
    selectedPark.value = 'all'
  }
  if (!includesParkOptionValue(parkOptions.value, selectedPark.value)) {
    selectedPark.value = findFirstSelectableParkValue(parkOptions.value) || ''
  }
})

watch(() => route.fullPath, () => {
  const paths = (route.meta.breadcrumb || route.meta.breadcrumbCache || []) as Array<{ path?: string; name?: string }>
  const resolved = resolveMenuKeys(paths, route.meta.activeMenu)
  state.selectedKeys = resolved.selectedKeys
  state.openKeys = resolved.openKeys
}, { immediate: true })

watchEffect(() => {
  if (selectedPark.value) {
    LocalStore.set(PARK_STORAGE_KEY, selectedPark.value)
  }
})

watch(selectedPark, (value, oldValue) => {
  if (value === oldValue) return
  dispatchParkChanged(String(value || ''))
  if (isWorkflowEmbedRoute(route.path) || route.fullPath.includes('workflow-admin')) {
    return
  }
  if (route.name !== 'ParkSwitchRedirect') {
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
.smart-park-layout-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 3rem minmax(0, 1fr);
  grid-template-columns: max-content minmax(0, 1fr);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--jet-theme-primary) 7%, transparent), transparent 22%),
    linear-gradient(180deg, var(--jet-theme-bg-base) 0%, var(--jet-theme-bg-layout) 32%, var(--jet-theme-bg-layout) 100%);
}

.smart-park-sidebar {
  position: sticky;
  top: 3rem;
  grid-row: 2;
  grid-column: 1;
  width: max-content;
  height: calc(100vh - 3rem);
  //padding: 0.5rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow: hidden;
  border-right: 1px solid var(--jet-theme-border-secondary);
  background: color-mix(in srgb, var(--jet-theme-bg-container) 92%, transparent);
  backdrop-filter: blur(1.25rem);
}

.smart-park-main {
  grid-row: 2;
  grid-column: 2;
  min-width: 0;
  padding: 0 1rem 1rem;
  position: relative;
}

.smart-park-globalbar {
  grid-row: 1;
  grid-column: 1 / -1;
  height: 3rem;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2rem;
  position: sticky;
  top: 0;
  z-index: 20;
  background: linear-gradient(90deg, #2C72DA 0%, #00CDEC 100%);
  background-image: url('/layout/top.png'), linear-gradient(90deg, #2C72DA 0%, #00CDEC 100%);
  background-repeat: no-repeat, no-repeat;
  background-position: right 4rem center, center;
  background-size: 19rem auto, cover;
}

.smart-park-product-tabs,
.smart-park-global-actions {
  min-width: 0;
  display: flex;
}

.smart-park-product-tabs {
  flex: 0 1 auto;
  align-items: stretch;
  justify-content: flex-start;
  gap: 1.25rem;
  overflow: auto hidden;
}

.smart-park-global-actions {
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
  gap: 1rem;
}

.smart-park-global-actions :deep(.notice-container .ant-badge .notice-icon),
.smart-park-global-actions :deep(.user-info) {
  color: #fff;
}

.smart-park-park-select {
  width: 10rem;
}

.smart-park-product-tab {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  justify-content: flex-start;
  height: 3rem;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: #fff;
  background: transparent;
  position: relative;
  box-shadow: none;
  color: #fff;
}

.smart-park-product-tab__icon {
  width: 1rem;
  height: 1rem;
  flex: 0 0 1rem;
  font-size: var(--fs-body);
}

.smart-park-product-tab__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-park-product-tab:hover,
.smart-park-product-tab:focus,
.smart-park-product-tab:active {
  color: rgba(255, 255, 255, 0.82);
  background: transparent;
}

.smart-park-product-tab::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0.5rem;
  height: 0.125rem;
  border-radius: 999px;
  background: #fff;
  opacity: 0;
  transform: scaleX(0.6);
  transform-origin: center;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.smart-park-product-tab--active {
  color: #fff;
}

.smart-park-product-tab--active::after {
  opacity: 1;
  transform: scaleX(1);
}

.smart-park-sidebar__brand {
  display: flex;
  align-items: center;
  gap: 1rem;
  height: 3rem;
  padding: 0 1rem;
}

.smart-park-sidebar__logo,
.smart-park-sidebar__brand-mark {
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 1.5rem;
  border-radius: var(--jet-theme-button-r);
}

.smart-park-sidebar__logo {
  object-fit: contain;
}

.smart-park-sidebar__brand-mark {
  display: grid;
  place-items: center;
  background: var(--jet-theme-primary);
  color: #fff;
  font-size: var(--fs-h4);
  font-weight: 700;
}

.smart-park-sidebar__brand-text {
  min-width: 0;
  display: grid;
  gap: 1rem;
}

.smart-park-sidebar__brand-text strong,
.smart-park-sidebar__brand-text span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-park-sidebar__brand-text strong {
  color: #fff;
  font-size: var(--fs-h4);
  font-weight: 500;
}

.smart-park-sidebar__brand-text span {
  color: #fff;
  font-size: var(--fs-meta);
}

.smart-park-sidebar__nav {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #FFF 0%, #DCEFFF 100%);
  background-image: url('/layout/sider.png'), linear-gradient(180deg, #FFF 0%, #DCEFFF 100%);
  background-repeat: no-repeat, no-repeat;
  background-position: center bottom 0.5rem, center;
  background-size: calc(100% - 1rem) auto, cover;
  overflow: hidden;
}

.smart-park-sidebar__domain {
  min-height: 0;
  flex: 1;
  width: fit-content;
  max-width: 100%;
  display: grid;
  grid-template-columns: auto auto;
  //gap: 1rem;
}

.smart-park-sidebar__domain--simple {
  grid-template-columns: auto;
}

.smart-park-sidebar__primary-rail {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 8px;
  //padding-right: 0.75rem;
  overflow-y: auto;
  border-right: 1px solid var(--jet-theme-border-secondary);
}

.smart-park-sidebar__primary,
.smart-park-sidebar__secondary :deep(.ant-menu-item),
.smart-park-sidebar__secondary :deep(.ant-menu-submenu-title) {
  box-sizing: border-box;
  width: 100%;
  border: 0;
  cursor: pointer;
  font: inherit;
  color: var(--jet-theme-text-secondary);
  background: transparent;
  transition: background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.smart-park-sidebar__primary {
  /* min-height: 3.625rem; */
  padding: 8px;
  display: grid;
  place-items: center;
  gap: 8px;
  width: 50px;
  border-radius: var(--jet-theme-button-r);
}

.smart-park-sidebar__primary b {
  max-width: 100%;
  overflow: hidden;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  font-size: var(--fs-meta);
  font-weight: 600;
}

.smart-park-sidebar__primary:hover,
.smart-park-sidebar__primary--active {
  color: var(--jet-theme-primary);
  background: transparent;
}

.smart-park-sidebar__secondary {
  width: 11.25rem;
  min-width: 11.25rem;
  padding-right: 0.75rem;
  overflow-x: hidden;
  overflow-y: auto;
}

.smart-park-sidebar__icon {
  width: 1.125rem;
  height: 1.125rem;
  flex: 0 0 1.125rem;
  display: inline-grid;
  place-items: center;
  color: currentColor;
  font-size: var(--fs-body);
  line-height: 1;
}

.smart-park-sidebar__menu-label {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
}

.smart-park-sidebar__item-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-park-sidebar__menu-label--active {
  color: var(--jet-theme-primary);
  //font-weight: 600;
}

.smart-park-sidebar__primary-icon {
  width: 1.25rem;
  height: 1.25rem;
  font-size: var(--fs-h4);
}

.smart-park-sidebar__secondary :deep(.ant-menu-item-selected),
.smart-park-sidebar__secondary :deep(.ant-menu-submenu-selected > .ant-menu-submenu-title) {
  background: transparent !important;
  color: var(--jet-theme-primary) !important;
  //font-weight: 600;
}

.smart-park-sidebar__secondary :deep(.ant-menu-item:hover),
.smart-park-sidebar__secondary :deep(.ant-menu-submenu-title:hover) {
  background: transparent !important;
  color: var(--jet-theme-primary) !important;
}

.smart-park-sidebar__secondary :deep(.ant-menu-item-selected::after),
.smart-park-sidebar__secondary :deep(.ant-menu-submenu-selected > .ant-menu-submenu-title::after) {
  display: none !important;
}

.smart-park-sidebar__secondary :deep(.ant-menu-title-content) {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.smart-park-sidebar__menu-label :deep(.smart-park-sidebar__icon) {
  margin-inline-end: 0.125rem;
}

.smart-park-sidebar__secondary :deep(.smart-park-sidebar__icon),
.smart-park-sidebar__secondary :deep(.smart-park-sidebar__icon .anticon) {
  color: currentColor !important;
}

.smart-park-sidebar__secondary :deep(.ant-menu-item-selected .smart-park-sidebar__icon),
.smart-park-sidebar__secondary :deep(.ant-menu-submenu-selected > .ant-menu-submenu-title .smart-park-sidebar__icon) {
  color: currentColor !important;
}

.smart-park-sidebar__primary:focus-visible,
.smart-park-sidebar__secondary :deep(.ant-menu-item:focus-visible),
.smart-park-sidebar__secondary :deep(.ant-menu-submenu-title:focus-visible),
.smart-park-product-tab:focus-visible {
  outline: 0;
  box-shadow: 0 0 0 0.1875rem color-mix(in srgb, var(--jet-theme-primary) 18%, transparent);
}
</style>

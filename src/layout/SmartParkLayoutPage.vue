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

      <div class="smart-park-product-tabs">
        <a-button
          v-for="item in menuNodes"
          :key="item.key"
          type="text"
          class="smart-park-product-tab"
          :class="{ 'smart-park-product-tab--active': isMenuNodeActive(item) }"
          :title="item.title"
          @click="handleRootClick(item)"
        >
          {{ item.title }}
        </a-button>
      </div>

      <div class="smart-park-global-actions">
        <a-tree-select
          v-model:value="selectedPark"
          class="smart-park-park-select"
          :tree-data="parkOptions"
          :loading="loadingParks"
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

          <div class="smart-park-sidebar__secondary">
            <template v-for="item in secondaryMenuItems" :key="item.key">
              <a-button
                v-if="!item.children.length"
                type="text"
                class="smart-park-sidebar__item"
                :class="{ 'smart-park-sidebar__item--active': isMenuNodeActive(item) }"
                :title="item.title"
                @click="handleMenuClick(item)"
              >
                <MenuIcon :item="item" class="smart-park-sidebar__item-icon" />
                <span>{{ item.title }}</span>
              </a-button>

              <div v-else class="smart-park-sidebar__group">
                <a-button
                  type="text"
                  class="smart-park-sidebar__item smart-park-sidebar__item--group"
                  :class="{ 'smart-park-sidebar__item--active': isOwnMenuNodeActive(item) }"
                  :title="item.title"
                  @click="handleMenuClick(item)"
                >
                  <MenuIcon :item="item" class="smart-park-sidebar__item-icon" />
                  <span>{{ item.title }}</span>
                </a-button>
                <a-button
                  v-for="child in item.children"
                  :key="child.key"
                  type="text"
                  class="smart-park-sidebar__item smart-park-sidebar__item--sub"
                  :class="{ 'smart-park-sidebar__item--active': isMenuNodeActive(child) }"
                  :title="child.title"
                  @click="handleMenuClick(child)"
                >
                  <span class="smart-park-sidebar__sub-dot" />
                  <span>{{ child.title }}</span>
                </a-button>
              </div>
            </template>
          </div>
        </div>
      </nav>
    </aside>

    <main class="smart-park-main">
      <section class="smart-park-content">
        <PageRouteView />
      </section>
    </main>
  </div>
  <AiChat />
</template>

<script setup name="SmartParkLayoutPage" lang="ts">
import { computed, defineComponent, h, onMounted, reactive, ref, resolveComponent, type PropType, watchEffect } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { storeToRefs } from 'pinia'
import { request } from '@jetlinks-web/core'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { Notice, AiChat, User } from './components'
import { getHideHeaderRightConfig } from '@jetlinks-web-core/utils'
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

const router = useRouter()
const route = useRoute()
const systemStore = useSystemStore()
const menuStore = useMenuStore()
const hideHeaderRight = getHideHeaderRightConfig()

const { layout } = storeToRefs(systemStore)
const selectedPark = ref('all')
const loadingParks = ref(false)
const currentUserParkTree = ref<BasicConfigTreeNode[]>([])

const state = reactive({
  pure: false,
})

const routeSelectedKeys = computed(() => {
  const paths = (route.meta.breadcrumb || route.meta.breadcrumbCache || []) as Array<{ name?: string; path?: string }>
  return paths.flatMap(item => [item.path, item.name]).filter(Boolean).map(String)
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
      key: String(node.key || `park:${value}`),
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
    key: String(node.key || `org:${value}`),
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
  { title: '全部园区', value: 'all', key: 'all' },
  ...currentUserParkOptions.value,
])

const loadCurrentUserParkTree = async () => {
  loadingParks.value = true
  try {
    const response = await request.get('/park/basic/config/tree/current')
    currentUserParkTree.value = unwrapResult<BasicConfigTreeNode[]>(response) || []
  } catch {
    currentUserParkTree.value = []
  } finally {
    loadingParks.value = false
  }
}

const includesParkOptionValue = (options: ParkTreeSelectNode[], value: string): boolean => (
  options.some(item => item.value === value || includesParkOptionValue(item.children || [], value))
)

const normalizeMenuNode = (item: RouteRecordRaw): MenuNode | undefined => {
  const meta = (item.meta || {}) as Record<string, any>
  if (meta.hideInMenu === true || meta?.options?.show === false) return undefined

  const title = String(meta.title || item.name || item.path || '')
  if (!title) return undefined

  return {
    key: String(item.path || item.name || title),
    title,
    path: item.path,
    name: item.name ? String(item.name) : undefined,
    icon: meta.icon as string | undefined,
    children: ((item.children || []) as RouteRecordRaw[])
      .map(child => normalizeMenuNode(child))
      .filter(Boolean) as MenuNode[],
    raw: item,
  }
}

const menuNodes = computed(() => (
  (menuStore.siderMenus || [])
    .map(item => normalizeMenuNode(item))
    .filter(Boolean) as MenuNode[]
))

const isOwnMenuNodeActive = (node: MenuNode) => {
  const keys = routeSelectedKeys.value
  return [node.key, node.path, node.name].filter(Boolean).some(key => keys.includes(String(key)))
    || (!!node.path && (route.path === node.path || route.path.startsWith(`${node.path}/`)))
}

const isMenuNodeActive = (node: MenuNode): boolean => {
  return isOwnMenuNodeActive(node) || node.children.some(child => isMenuNodeActive(child))
}

const findActiveNode = (nodes: MenuNode[]) => {
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

watchEffect(() => {
  state.pure = route.query?.layout === 'false'
  if (!includesParkOptionValue(parkOptions.value, selectedPark.value)) {
    selectedPark.value = parkOptions.value[0]?.value || 'all'
  }
})

onMounted(loadCurrentUserParkTree)
</script>

<style scoped>
.smart-park-layout-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 3rem minmax(0, 1fr);
  grid-template-columns: 18.25rem minmax(0, 1fr);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--jet-theme-primary) 7%, transparent), transparent 22%),
    linear-gradient(180deg, var(--jet-theme-bg-base) 0%, var(--jet-theme-bg-layout) 32%, var(--jet-theme-bg-layout) 100%);
}

.smart-park-sidebar {
  position: sticky;
  top: 3rem;
  grid-row: 2;
  grid-column: 1;
  height: calc(100vh - 3rem);
  padding: 0.75rem;
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
  gap: 1rem;
  position: sticky;
  top: 0;
  z-index: 20;
  background: linear-gradient(90deg, var(--primary-color) 0%, var(--primary-color-3) 100%);
  background-image: url('/layout/top.png'), linear-gradient(90deg, var(--primary-color) 0%, var(--primary-color-3) 100%);
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
  gap: 1rem;
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
  justify-content: flex-start;
  height: 3rem;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: rgba(255, 255, 255, 0.82);
  background: transparent;
  position: relative;
  box-shadow: none;
}

.smart-park-product-tab:hover,
.smart-park-product-tab--active {
  color: #fff;
  background: transparent;
}

.smart-park-product-tab--active {
  font-weight: 700;
}

.smart-park-product-tab--active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0.1875rem;
  border-radius: 999px 999px 0 0;
  background: #fff;
  animation: smartParkTabSlide 0.22s ease-out;
}

@keyframes smartParkTabSlide {
  from {
    transform: scaleX(0.35);
    opacity: 0.35;
  }

  to {
    transform: scaleX(1);
    opacity: 1;
  }
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
  font-weight: 700;
}

.smart-park-sidebar__brand-text span {
  color: var(--jet-theme-text-secondary);
  font-size: var(--fs-meta);
}

.smart-park-sidebar__nav {
  min-height: 0;
  flex: 1;
}

.smart-park-sidebar__domain {
  height: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 1rem;
}

.smart-park-sidebar__domain--simple {
  grid-template-columns: minmax(0, 1fr);
}

.smart-park-sidebar__primary-rail {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 12px;
  padding-right: 0.75rem;
  overflow-y: auto;
  border-right: 1px solid var(--jet-theme-border-secondary);
}

.smart-park-sidebar__primary,
.smart-park-sidebar__item {
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
  //min-height: 3.625rem;
  padding: 12px;
  display: grid;
  place-items: center;
  gap: 8px;
  width: 58px;
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
  background: var(--jet-theme-primary-soft);
}

.smart-park-sidebar__secondary {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: 1rem;
  padding-right: 1rem;
  overflow-x: hidden;
  overflow-y: auto;
}

.smart-park-sidebar__group {
  min-width: 0;
  display: grid;
  gap: 1rem;
}

.smart-park-sidebar__item {
  position: relative;
  min-width: 0;
  min-height: 2.5rem;
  padding: 0 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid transparent;
  border-radius: var(--jet-theme-button-r-sm);
  text-align: left;
}

.smart-park-sidebar__item span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.smart-park-sidebar__item:hover {
  color: var(--jet-theme-text);
  background: var(--jet-theme-border-secondary);
}

.smart-park-sidebar__item--active {
  color: var(--jet-theme-primary);
  background: var(--jet-theme-primary-soft);
  border-color: color-mix(in srgb, var(--jet-theme-primary) 18%, transparent);
  font-weight: 600;
}

.smart-park-sidebar__item--group {
  margin-top: 1rem;
  color: var(--jet-theme-text);
  font-weight: 700;
}

.smart-park-sidebar__group:first-child .smart-park-sidebar__item--group {
  margin-top: 0;
}

.smart-park-sidebar__item--sub {
  min-height: 2.25rem;
  padding-left: calc(1rem + 1.375rem);
  color: var(--jet-theme-text-secondary);
}

.smart-park-sidebar__icon {
  width: 1.125rem;
  height: 1.125rem;
  flex: 0 0 1.125rem;
  display: inline-grid;
  place-items: center;
  font-size: var(--fs-body);
  line-height: 1;
}

.smart-park-sidebar__primary-icon {
  width: 1.25rem;
  height: 1.25rem;
  font-size: var(--fs-h4);
}

.smart-park-sidebar__sub-dot {
  width: 0.375rem;
  height: 0.375rem;
  flex: 0 0 0.375rem;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.4;
}

.smart-park-sidebar__primary:focus-visible,
.smart-park-sidebar__item:focus-visible,
.smart-park-product-tab:focus-visible {
  outline: 0;
  box-shadow: 0 0 0 0.1875rem color-mix(in srgb, var(--jet-theme-primary) 18%, transparent);
}
</style>

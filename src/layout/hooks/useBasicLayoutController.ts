import { computed, reactive, ref, watchEffect, type ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWindowScroll } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useResponsiveLayoutDimensions } from '@jetlinks-web-core/hooks'
import { useMenuStore } from '@jetlinks-web-core/store/menu'
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { getHideHeaderRightConfig, routerFallback } from '@jetlinks-web-core/utils'
import { isBusinessApplicationRuntime } from '@jetlinks-web-core/utils/business-application-runtime'
import { isSubApp } from '@jetlinks-web-core/utils/consts'
import { useGlobalHomeAgent } from '@jetlinks-web-core/layout/components/AiChat/useGlobalHomeAgent'
import {
  PROJECT_SETTINGS_MENU_CODE,
  PROJECT_SETTINGS_ROUTE_NAME,
} from '../navigation.constants'
import type { BasicLayoutVariant } from '../runtime/layoutVariant'
import { filterMenusByKeyword } from '../utils/menuSearch'
import { renderPrimaryMenuGroup } from '../utils/projectMenuRender'
import { useProjectGeneralAgent } from './useProjectGeneralAgent'
import { useProjectNavigation } from './useProjectNavigation'
import { provideProjectSecondaryMenu } from './useProjectSecondaryMenu'
import { useProjectSecondaryMenuExtensions } from './useProjectSecondaryMenuExtensions'

type ProjectBreadcrumbRoute = {
  path?: string
}

type PrimaryMenuClickEvent = {
  key: string | number
  item?: {
    path?: string
    key?: string | number
  }
}

type LayoutMicroAppData = {
  layoutType?: unknown
}

type LayoutMicroApp = {
  addDataListener?: (
    listener: (data: LayoutMicroAppData) => void,
    autoTrigger?: boolean,
  ) => void
  getGlobalData?: () => {
    api?: {
      routerFallback?: () => void
    }
  }
}

const getLayoutMicroApp = () => (
  (window as Window & { microApp?: LayoutMicroApp }).microApp
)

export const useBasicLayoutController = (
  layoutVariant: ComputedRef<BasicLayoutVariant>,
) => {
  const router = useRouter()
  const route = useRoute()
  const systemStore = useSystemStore()
  const menuStore = useMenuStore()
  const layoutType = ref('list')
  const hideHeaderRight = getHideHeaderRightConfig()
  const menuSearchKeyword = ref('')
  const businessApplicationRuntime = isBusinessApplicationRuntime()
  const { theme, layout, systemInfo, themeStyleToken } = storeToRefs(systemStore)
  const { y: scrollY } = useWindowScroll()
  const state = reactive({
    pure: false,
    collapsed: false,
    openKeys: [] as string[],
    selectedKeys: [] as string[],
  })

  const themeLayout = computed(() => themeStyleToken.value.layout)
  const menuVariant = computed(() => themeLayout.value?.menuVariant || 'classic')
  const routeLayoutClassName = computed(() => {
    const className = [...route.matched]
      .reverse()
      .find(record => record.meta.layoutClassName)
      ?.meta.layoutClassName

    return typeof className === 'string' ? className : ''
  })
  const headerScrolled = computed(() => layout.value.layout === 'top' && scrollY.value > 0)
  const showMenuSearch = computed(() => !!themeLayout.value?.showMenuSearch && !state.collapsed)
  const { layoutConfig } = useResponsiveLayoutDimensions(layout, themeLayout)

  useProjectGeneralAgent(route, router)
  useGlobalHomeAgent(route)

  const filteredSiderMenus = computed(() => filterMenusByKeyword(
    menuStore.siderMenus,
    menuSearchKeyword.value.toLowerCase(),
  ))
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
  // top 保留完整树用于级联子菜单；side/mix 只把一级、二级交给 ProLayout。
  const layoutMenuData = computed(() => (
    layout.value.layout === 'top' ? filteredSiderMenus.value : primaryMenus.value
  ))
  const logoWidth = computed(() => {
    const width = !state.collapsed ? `${config.value.siderWidth}px` : '100%'

    return {
      width,
      minWidth: width,
      maxWidth: width,
    }
  })

  const {
    active: settingsDomainActive,
    enterTarget: enterSettings,
    items: settingsSecondaryItems,
    selectedKey: settingsSecondarySelectedKey,
    visible: settingsDomainVisible,
  } = useProjectSecondaryMenuExtensions(
    PROJECT_SETTINGS_ROUTE_NAME,
    PROJECT_SETTINGS_MENU_CODE,
  )
  const settingsActive = computed(() => (
    layoutVariant.value === 'project' && settingsDomainActive.value
  ))
  const settingsVisible = computed(() => (
    layoutVariant.value === 'project' && settingsDomainVisible.value
  ))
  const pageSecondaryMenu = provideProjectSecondaryMenu()
  const pageSecondaryMenuActive = computed(() => (
    !settingsActive.value
    && !secondaryItems.value.length
    && !!pageSecondaryMenu.items.value.length
  ))
  const visibleSecondaryItems = computed(() => {
    if (settingsActive.value) return settingsSecondaryItems.value
    if (pageSecondaryMenuActive.value) return pageSecondaryMenu.items.value
    return layout.value.layout === 'top' ? [] : secondaryItems.value
  })
  const visibleSecondarySelectedKey = computed(() => {
    if (settingsActive.value) return settingsSecondarySelectedKey.value
    return pageSecondaryMenuActive.value
      ? pageSecondaryMenu.selectedKey.value
      : secondarySelectedKey.value
  })
  const secondaryTabPosition = computed(() => (
    settingsActive.value || layoutVariant.value !== 'project' ? 'top' : 'left'
  ))

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
      [`cloud-layout-${layout.value.layout}`]: true,
      [`cloud-layout-variant-${layoutVariant.value}`]: true,
    },
  }))

  const goBack = () => {
    if (isSubApp) {
      getLayoutMicroApp()?.getGlobalData?.()?.api?.routerFallback?.()
      return
    }

    routerFallback()
  }
  const handlePrimaryMenuClick = ({ item, key }: PrimaryMenuClickEvent) => {
    navigatePrimary(String(item?.path || item?.key || key))
  }
  const selectVisibleSecondaryItem = (key: string) => {
    if (pageSecondaryMenuActive.value) {
      pageSecondaryMenu.select(key)
      return
    }

    navigateSecondary(key)
  }

  getLayoutMicroApp()?.addDataListener?.((data) => {
    if (data.layoutType) layoutType.value = String(data.layoutType)
  }, true)

  watchEffect(() => {
    // 项目工作区保持固定导航宽度，不响应 ProLayout 的侧栏折叠状态。
    if (layoutVariant.value === 'project' && state.collapsed) state.collapsed = false

    const paths = (
      route.meta.breadcrumb || route.meta.breadcrumbCache || []
    ) as ProjectBreadcrumbRoute[]
    const selectedPaths = paths
      .map(item => item.path)
      .filter((path): path is string => !!path)

    state.selectedKeys = selectedPaths
    state.openKeys = layout.value.layout === 'top' ? [] : selectedPaths
    if (route.query?.layout === 'false') state.pure = true
  })

  return {
    businessApplicationRuntime,
    config,
    enterSettings,
    handlePrimaryMenuClick,
    headerScrolled,
    hideHeaderRight,
    layout,
    layoutSelectedKeys,
    layoutType,
    layoutVariant,
    logoWidth,
    onClick: () => undefined,
    renderPrimaryMenuGroup,
    routeLayoutClassName,
    secondaryTabPosition,
    selectVisibleSecondaryItem,
    showMenuSearch,
    state,
    settingsActive,
    settingsVisible,
    systemInfo,
    visibleSecondaryItems,
    visibleSecondarySelectedKey,
    goBack,
  }
}

export type BasicLayoutController = ReturnType<typeof useBasicLayoutController>

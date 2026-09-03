import {
  computed,
  inject,
  onActivated,
  onDeactivated,
  onUnmounted,
  provide,
  shallowRef,
  toValue,
  watch,
  type ComputedRef,
  type InjectionKey,
  type MaybeRefOrGetter,
  type ShallowRef,
  type WritableComputedRef,
} from 'vue'
import type { LocationQueryValue, RouteLocationNormalizedLoaded, Router } from 'vue-router'
import {
  containsNavigationKey,
  findFirstNavigationLeafKey,
  type ProjectNavigationItem,
} from './useProjectNavigation'

const DEFAULT_ACTIVE_QUERY_KEY = 'active'

type ProjectSecondaryMenuRegistration = {
  id: symbol
  active: ComputedRef<boolean>
  items: ComputedRef<ProjectNavigationItem[]>
  selectedKey: ComputedRef<string>
  select: (key: string) => void
}

type ProjectSecondaryMenuContext = {
  current: ShallowRef<ProjectSecondaryMenuRegistration | undefined>
  register: (registration: ProjectSecondaryMenuRegistration) => void
  unregister: (id: symbol) => void
}

export type UseProjectSecondaryMenuOptions = {
  items: MaybeRefOrGetter<ProjectNavigationItem[]>
  defaultActiveKey?: MaybeRefOrGetter<string | undefined>
  queryKey?: string
}

export type UseProjectSecondaryMenuResult = {
  activeKey: WritableComputedRef<string>
  setActiveKey: (key: string) => void
}

const PROJECT_SECONDARY_MENU_KEY: InjectionKey<ProjectSecondaryMenuContext> = Symbol(
  'project-secondary-menu',
)

const getQueryText = (value: LocationQueryValue | LocationQueryValue[]) => {
  const current = Array.isArray(value) ? value[0] : value
  return typeof current === 'string' ? current : ''
}

const resolveDefaultKey = (
  items: ProjectNavigationItem[],
  defaultActiveKey?: string,
) => {
  if (defaultActiveKey && containsNavigationKey(items, defaultActiveKey)) {
    return defaultActiveKey
  }

  const firstItem = items[0]
  return firstItem ? findFirstNavigationLeafKey(firstItem) : ''
}

const createRouteOwner = (route: RouteLocationNormalizedLoaded) => {
  const name = route.name
  const path = route.path

  return computed(() => name ? route.name === name : route.path === path)
}

/**
 * 为项目布局提供页面级二级导航注册点。
 * 路由页面通过 useProjectSecondaryMenu 注册后，布局会在当前一级菜单没有子路由时展示这些项目。
 */
export const provideProjectSecondaryMenu = () => {
  const current = shallowRef<ProjectSecondaryMenuRegistration>()
  const context: ProjectSecondaryMenuContext = {
    current,
    register: (registration) => {
      current.value = registration
    },
    unregister: (id) => {
      if (current.value?.id === id) current.value = undefined
    },
  }

  provide(PROJECT_SECONDARY_MENU_KEY, context)

  const registration = computed(() => current.value?.active.value ? current.value : undefined)

  return {
    items: computed(() => registration.value?.items.value || []),
    selectedKey: computed(() => registration.value?.selectedKey.value || ''),
    select: (key: string) => registration.value?.select(key),
  }
}

const createProjectSecondaryMenu = (
  context: ProjectSecondaryMenuContext,
  options: UseProjectSecondaryMenuOptions,
): UseProjectSecondaryMenuResult => {
  const route = useRoute()
  const router = useRouter() as Router
  const queryKey = options.queryKey || DEFAULT_ACTIVE_QUERY_KEY
  const ownerActive = createRouteOwner(route)
  const items = computed(() => toValue(options.items))
  const defaultKey = computed(() => resolveDefaultKey(
    items.value,
    toValue(options.defaultActiveKey),
  ))
  const selectedKey = computed(() => {
    const queryValue = getQueryText(route.query[queryKey])
    return containsNavigationKey(items.value, queryValue) ? queryValue : defaultKey.value
  })

  const setActiveKey = (key: string) => {
    if (!containsNavigationKey(items.value, key) || getQueryText(route.query[queryKey]) === key) {
      return
    }

    void router.replace({
      hash: route.hash,
      path: route.path,
      query: {
        ...route.query,
        [queryKey]: key,
      },
    })
  }

  const activeKey = computed({
    get: () => selectedKey.value,
    set: setActiveKey,
  })
  const registration: ProjectSecondaryMenuRegistration = {
    id: Symbol('project-secondary-menu-registration'),
    active: ownerActive,
    items,
    selectedKey,
    select: setActiveKey,
  }

  context.register(registration)
  onActivated(() => context.register(registration))
  onDeactivated(() => context.unregister(registration.id))
  onUnmounted(() => context.unregister(registration.id))

  watch(
    [ownerActive, items, () => route.query[queryKey]],
    () => {
      if (ownerActive.value && selectedKey.value) setActiveKey(selectedKey.value)
    },
    { immediate: true },
  )

  return {
    activeKey,
    setActiveKey,
  }
}

/**
 * 在存在项目布局 provider 时注册页面级二级导航。
 * 同时支持普通布局或多应用挂载的页面使用此入口，并在缺少 provider 时保留自身导航。
 */
export const useOptionalProjectSecondaryMenu = (
  options: UseProjectSecondaryMenuOptions,
): UseProjectSecondaryMenuResult | undefined => {
  const context = inject(PROJECT_SECONDARY_MENU_KEY)
  return context ? createProjectSecondaryMenu(context, options) : undefined
}

/**
 * 将一级菜单页面内的 Tab 注册到项目二级导航，并以 URL query 保存选中状态。
 * 只用于确定处于项目布局内的页面；跨布局页面应使用 useOptionalProjectSecondaryMenu。
 */
export const useProjectSecondaryMenu = (
  options: UseProjectSecondaryMenuOptions,
): UseProjectSecondaryMenuResult => {
  const result = useOptionalProjectSecondaryMenu(options)

  if (!result) {
    throw new Error('useProjectSecondaryMenu must be used inside ProjectLayoutPage')
  }

  return result
}

<template>
  <ConfigProvider
    :locale="language[systemStore.language]"
    :componentsLocale="componentsLocale[systemStore.language]"
    :IconConfig="iconConfig"
    :theme="themeConfig"
  >
    <PageRouteView :skeleton-variant="routeSkeletonVariant" />
  </ConfigProvider>
</template>
<script setup lang="ts">
import { ConfigProvider } from '@jetlinks-web/components'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUs from 'ant-design-vue/es/locale/en_US'
import { theme as antdTheme } from 'ant-design-vue'
import componentsZhCN from '@jetlinks-web/components/es/locale/zh-CN'
import componentsEnUS from '@jetlinks-web/components/es/locale/en-US'
import theme from '@theme-config'
import { useAuthStore, useSystemStore } from '@jetlinks-web-core/store';
import { ComponentsEnum, LOCAL_BASE_API } from '@jetlinks-web/constants'
import {initPackages} from "@jetlinks-web-core/package";
import { setToken} from "@jetlinks-web/utils";
import { getBaseApi, getPackageConfig, initPersonal } from '@jetlinks-web-core/utils'
import { componentsRegistry } from './utils/components-registry'
import {
  applyThemeStyle,
  getThemeStylePrimaryStateColors,
  pickAntdToken
} from '@jetlinks-web-core/utils/theme-style'
import { useResponsiveAntdToken } from '@jetlinks-web-core/hooks'

const route = useRoute()
const router = useRouter()

const systemStore = useSystemStore()

type RouteSkeletonVariant = 'content' | 'layout'
type AppPackageConfig = {
  iconConfig?: {
    scriptUrl?: string
  }
}

const DEFAULT_ICON_SCRIPT_URL = '/icons/iconfont.js'
const packageConfig = getPackageConfig() as AppPackageConfig | undefined

const routeSkeletonVariant = computed<RouteSkeletonVariant>(() => (
  route.query?.layout === 'false' ? 'content' : 'layout'
))

const language = {
    en: enUs,
    zh: zhCN
}

const componentsLocale = {
  en: componentsEnUS,
  zh: componentsZhCN
}
// 为公共hooks提供权限校验方法
const { hasPermission } = useAuthStore();
const responsiveAntdToken = useResponsiveAntdToken()

const themeConfig = computed(() => ({
  algorithm: systemStore.themeStyle === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: {
    ...theme,
    ...pickAntdToken(systemStore.themeStyleToken),
    ...responsiveAntdToken.token.value,
    ...getThemeStylePrimaryStateColors(systemStore.themeStyle, systemStore.themeColor)
  }
}))

const iconConfig = computed(() => ({
  scriptUrl: packageConfig?.iconConfig?.scriptUrl || DEFAULT_ICON_SCRIPT_URL
}))

watch(
  themeConfig,
  (config) => {
    applyThemeStyle(systemStore.themeStyle, systemStore.themeColor)
    ConfigProvider.config?.({ theme: config })
  },
  { immediate: true, deep: true }
)

provide(ComponentsEnum.Permission, { hasPermission })

initPersonal()
initPackages()

componentsRegistry.batchRegister()

if (import.meta.env.DEV) {
  localStorage.setItem(LOCAL_BASE_API, getBaseApi())
}

window.addEventListener('vite:preloadError', (event: Event) => {
  const error = (event as Event & { payload?: unknown }).payload
  const message = error instanceof Error ? error.message : String(error || '')
  const isResourceLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading CSS chunk/i.test(message)

  if (isResourceLoadError) {
    console.error('资源版本不对，请清除浏览器缓存')
  }
})

const parseHashQuery = (): Record<string, string> => {
  const [, hashQuery = ''] = window.location.hash.split('?')
  if (!hashQuery) return {}

  const params = new URLSearchParams(hashQuery)
  const result: Record<string, string> = {}
  params.forEach((value, key) => {
    result[key] = value
  })

  return result
}

const clearUrlAuthQuery = () => {
  const routeQuery = route.query || {}
  const shouldClearRouteQuery =
    Object.prototype.hasOwnProperty.call(routeQuery, 'token') ||
    Object.prototype.hasOwnProperty.call(routeQuery, 'from')

  if (shouldClearRouteQuery) {
    const nextQuery = { ...routeQuery }
    delete nextQuery.token
    delete nextQuery.from
    router.replace({
      query: nextQuery,
      hash: route.hash
    })
    return
  }

  if (window.location.hash.includes('?')) {
    const [hashPath, hashQuery = ''] = window.location.hash.split('?')
    const params = new URLSearchParams(hashQuery)
    if (!params.has('token') && !params.has('from')) return

    params.delete('token')
    params.delete('from')
    const nextHash = params.toString() ? `${hashPath}?${params.toString()}` : hashPath
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}${nextHash}`
    )
  }
}

watch(() => JSON.stringify(route.query || {}), () => {
  const routeQuery = route.query || {}
  const query = Object.keys(routeQuery).length ? routeQuery : parseHashQuery()

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return

    const storageValue = Array.isArray(value)
      ? value.filter((item) => item !== null).join(',')
      : (value ?? '')

    localStorage.setItem(key, String(storageValue))
  })
  if (query.token) {
    setToken(query.token as string)
  }

  if (query.token || query.from) {
    clearUrlAuthQuery()
  }
}, { immediate: true })

</script>
<style scoped></style>

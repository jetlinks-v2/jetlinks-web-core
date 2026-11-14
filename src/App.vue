<template>
  <ConfigProvider
    :locale="language[systemStore.language]"
    :componentsLocale="componentsLocale[systemStore.language]"
    :IconConfig="iconConfig"
    :theme="themeConfig"
    :renderEmpty="renderEmpty"
  >
    <PageRouteView :skeleton-variant="routeSkeletonVariant" />
  </ConfigProvider>
</template>
<script setup lang="ts">
import { ConfigProvider } from '@jetlinks-web/components'
import PageRouteView from '@jetlinks-web-core/components/PageRouteView/index.vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUs from 'ant-design-vue/es/locale/en_US'
import jaJP from 'ant-design-vue/es/locale/ja_JP'
import { Modal, theme as antdTheme } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import componentsZhCN from '@jetlinks-web/components/es/locale/zh-CN'
import componentsEnUS from '@jetlinks-web/components/es/locale/en-US'
import componentsJa from './locales/componentsJa'
import theme from '@theme-config'
import { useAuthStore, useSystemStore } from '@jetlinks-web-core/store';
import { ComponentsEnum, LOCAL_BASE_API } from '@jetlinks-web/constants'
import {initPackages, clearVerifyCache} from "@jetlinks-web-core/package";
import { setToken } from "@jetlinks-web/utils";
import { consumeLogoutLoginEntry, LOGOUT_AUTH_QUERY_KEYS } from '@jetlinks-web-core/router/login-session'
import { installEdgeImageProxy } from '@jetlinks-web-core/utils/edge-image-proxy'
import {
  getBaseApi,
  getPackageConfig,
  initPersonal,
  resolvePublicAssetUrl,
  setProjectStorage
} from '@jetlinks-web-core/utils'
import { componentsRegistry } from './utils/components-registry'
import {
  applyThemeStyle,
  getThemeStylePrimaryStateColors,
  pickAntdToken
} from '@jetlinks-web-core/utils/theme-style'
import { useResponsiveAntdToken } from '@jetlinks-web-core/hooks'
import CloudEmpty from '@jetlinks-web-core/components/CloudEmpty/index.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const systemStore = useSystemStore()

type RouteSkeletonVariant = 'content' | 'layout'
type AppPackageConfig = {
  iconConfig?: {
    scriptUrl?: string
  }
}

const DEFAULT_ICON_SCRIPT_URL = resolvePublicAssetUrl('icons/iconfont.js?t=202609291344')
const packageConfig = getPackageConfig() as AppPackageConfig | undefined

const routeSkeletonVariant = computed<RouteSkeletonVariant>(() => (
  route.query?.layout === 'false' ? 'content' : 'layout'
))

const language = {
    en: enUs,
    zh: zhCN,
    ja: jaJP
}

const componentsLocale = {
  en: componentsEnUS,
  zh: componentsZhCN,
  ja: componentsJa
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

let resourceLoadDialog: ReturnType<typeof Modal.warning> | undefined

// 只提示资源加载失败，保留原异常传播，让路由错误处理正常结束加载状态。
const handleResourceLoadError = (event: Event) => {
  const error = (event as Event & { payload?: unknown }).payload
  const message = error instanceof Error ? error.message : String(error || '')
  const isResourceLoadError = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading CSS chunk/i.test(message)

  // 一次导航可能同时加载多个资源，避免失败提示叠加。
  if (!isResourceLoadError || resourceLoadDialog) return

  resourceLoadDialog = Modal.warning({
    title: t('app.resourceLoadError.title'),
    content: h('div', { style: { whiteSpace: 'pre-line' } }, t('app.resourceLoadError.content')),
    okText: t('app.resourceLoadError.refresh'),
    centered: true,
    closable: false,
    maskClosable: false,
    keyboard: false,
    onOk: () => window.location.reload(),
    afterClose: () => { resourceLoadDialog = undefined }
  })
}

window.addEventListener('vite:preloadError', handleResourceLoadError)

onUnmounted(() => {
  window.removeEventListener('vite:preloadError', handleResourceLoadError)
  resourceLoadDialog?.destroy()
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

const renderEmpty = () => {
    return h(CloudEmpty)
}

watch(() => JSON.stringify(route.query || {}), () => {
  const routeQuery = route.query || {}
  const query = Object.keys(routeQuery).length ? routeQuery : parseHashQuery()

  // 兼容文档内进入清理地址；启动阶段已消费的退出原因不会再次清掉新 token。
  if (consumeLogoutLoginEntry(clearVerifyCache)) {
    const nextQuery = { ...query }
    for (const key of LOGOUT_AUTH_QUERY_KEYS) delete nextQuery[key]
    router.replace({ query: nextQuery, hash: route.hash })
    return
  }

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

  if (query.token && query.pName && query.pRuntime && query.pCode) {
    setProjectStorage(query.pCode as string, {
      domain: query.pCode as string,
      token: query.token as string,
      name: query.pNmae as string,
      runtime: query.pRuntime as string,
      id: query.pId as string,
    })
  }

}, { immediate: true })

// 首次进入远程页面时，先由上方的 immediate watch 写入网关上下文，再读取 getBaseApi()。
installEdgeImageProxy()

</script>
<style scoped></style>

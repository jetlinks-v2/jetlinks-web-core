import { defineStore } from 'pinia'
import { getDetails_api, preprocessorExists, settingDetail, systemVersion } from '@jetlinks-web-core/api/system/basis'
import { getTagsColor } from '@jetlinks-web-core/api/system/calendar'
import { getToken, LocalStore } from '@jetlinks-web/utils'
import { langKey, isSubApp } from '@jetlinks-web-core/utils/consts'
import { withModuleStoreOverride } from './module-override'
import { getThemeStyle_api } from '@jetlinks-web-core/api/account/center'
import { applyThemeColor, getInitialThemeColor, persistThemeColor } from '@jetlinks-web-core/utils/theme-color'
import {
  applyThemeStyle,
  getInitialThemeStyleConfig,
  getThemeStyleInitialColor,
  getThemeStylePrimaryColor,
  normalizeThemeStyle,
  persistThemeStyle,
  type ThemeStyleKey
} from '@jetlinks-web-core/utils/theme-style'
import { resolvePublicAssetUrl } from '@jetlinks-web-core/utils/public-asset'

export type LayoutMode = 'mix' | 'side' | 'top'

const layoutModes: readonly LayoutMode[] = ['mix', 'side', 'top']

// 历史 front 配置没有 layout，统一回退侧边导航，保持升级前的菜单行为。
export const normalizeLayoutMode = (value: unknown): LayoutMode => (
  layoutModes.includes(value as LayoutMode) ? value as LayoutMode : 'side'
)

interface LayoutType {
  siderWidth: number
  headerHeight: number
  collapsedWidth: number
  title: string
  logo: string
  layout: LayoutMode
}

const useSystemStoreBase = defineStore('system', () => {
  const initialThemeStyle = getInitialThemeStyleConfig()
  const theme = ref<string>('ai') // 主题色
  const themeStyle = ref<ThemeStyleKey>(initialThemeStyle.style)
  const themeStyleToken = ref(initialThemeStyle.token)
  const themeColor = ref<string>(applyThemeColor(getThemeStyleInitialColor(themeStyle.value, getInitialThemeColor())))
  applyThemeStyle(themeStyle.value, themeColor.value)
  const ico = ref<string>(resolvePublicAssetUrl('favicon.ico')) // 浏览器标签页logo
  const systemInfo = ref<Record<string, any>>({})
  const microApp = ref<Record<string, any>>({})
  const calendarTagColor = new Map([
    ['holiday', 'rgb(161, 180, 204)'],
    ['weekend', 'rgb(149, 222, 100)'],
    ['workday', 'rgba(105,177,255)']
  ])
  const showThreshold = ref(true)
  const language = ref(LocalStore.get(langKey) || 'zh')
  const sessionInitializedUserKey = ref('')

  const layout = reactive<LayoutType>({
    siderWidth: 208,
    headerHeight: 48,
    collapsedWidth: 48,
    title: '物联网平台', // 浏览器标签页title和系统名称
    logo: resolvePublicAssetUrl('images/login/logo.png'),
    layout: 'side'
  })

  /**
   * 切换主题色
   * @param type
   */
  const changeTheme = (type: string) => {
    theme.value = type
  }

  const changeThemeColor = (color: string) => {
    themeColor.value = persistThemeColor(color)
    const result = applyThemeStyle(themeStyle.value, themeColor.value)
    themeStyleToken.value = result.token
  }

  const changeThemeStyle = (style: string, color?: string) => {
    const themeStyleValue = normalizeThemeStyle(style)
    const result = persistThemeStyle(themeStyleValue, color || getThemeStylePrimaryColor(themeStyleValue) || themeColor.value)
    theme.value = themeStyleValue === 'dark' ? 'dark' : 'light'
    themeStyle.value = result.style
    themeStyleToken.value = result.token
    themeColor.value = result.color
  }

  const getUserThemeStyle = async () => {
    if (!getToken()) return undefined

    try {
      const resp = await getThemeStyle_api()
      return resp?.success === false
        ? undefined
        : normalizeThemeStyle(resp?.result?.content)
    } catch {
      return undefined
    }
  }

  /**
   * 修改其它配置项
   * @param code
   * @param value
   */
  const changeLayout = <K extends keyof LayoutType>(code: K, value: LayoutType[K]) => {
    layout[code] = value
  }

  /**
   * 修改浏览器标签ico
   * @param url
   */
  const changeIco = (url: string) => {
    const resolvedUrl = resolvePublicAssetUrl(url)
    ico.value = resolvedUrl
    const icoDom: any = document.querySelector('link[rel="icon"]')!
    if (!icoDom) return
    icoDom.href = resolvedUrl
  }

  const changeTitle = (value: string) => {
    document.title = value
  }

  const setDocumentTitle = () => {
    const _data = systemInfo.value['front']
    if (_data) {
      const ico: any = document.querySelector('link[rel="icon"]')
      if (!ico) return
      ico.href = resolvePublicAssetUrl(_data.ico)
      document.title = _data.title || ''
    }
  }

  const handleFront = (_value: any, userThemeStyle?: ThemeStyleKey) => {
    if (!_value) return
    layout.title = _value.title
    layout.logo = resolvePublicAssetUrl(_value.logo)
    layout.layout = normalizeLayoutMode(_value.layout)
    const frontThemeStyle = userThemeStyle || normalizeThemeStyle(_value.headerTheme)
    // localStorage 只负责接口返回前的首屏主题；登录后用户设置优先，系统设置兜底。
    changeThemeStyle(frontThemeStyle, getThemeStylePrimaryColor(frontThemeStyle))
    changeIco(_value.ico)
    setDocumentTitle()
    changeTitle(_value.title)
  }

  const queryInfo = async () => {
    const _keys = ['front', 'amap', 'paths']
    const userThemeStyle = await getUserThemeStyle()
    const resp = await getDetails_api(_keys)
    if (resp.success) {
      _keys.forEach((key: string) => {
        const _value = resp.result.find((item: any) => item.scope === key)?.properties
        systemInfo.value[key] = _value ?? {}
        if (key === 'front') {
          handleFront(_value, userThemeStyle)
        }
      })
    }
  }

  const querySingleInfo = async (__keys: string) => {
    if (!__keys) return
    const userThemeStyle = __keys === 'front' ? await getUserThemeStyle() : undefined
    const resp = await settingDetail(__keys)
    if (resp.success) {
      const _value = resp.result
      systemInfo.value[__keys] = _value ?? {}
      if (__keys === 'front') {
        handleFront(_value, userThemeStyle)
      }
    }
  }

  const setMircoData = () => {
    if (isSubApp) {
      microApp.value = (window as any).microApp.getData() // 获取主应用下发的数据
    }
  }

  const queryTagsColor = async () => {
    const answer: any = await getTagsColor()
    if (answer.success) {
      Object.keys(answer.result).forEach((i) => {
        calendarTagColor.set(i, answer.result[i])
      })
    }
  }

  const queryVersion = async () => {
    const resp = await systemVersion()
    if (resp.success && resp.result) {
      // const isCommunity = resp.result.edition === 'community'
      LocalStore.set('system_edition', resp.result.edition)
      LocalStore.set('system_version', resp.result.version)
    }
  }

  const getShowThreshold = async () => {
    const resp = await preprocessorExists()
    if (resp.success) {
      showThreshold.value = resp.result
    }
  }

  const isSessionInitializedFor = (userKey?: string) => {
    return !!userKey && sessionInitializedUserKey.value === userKey
  }

  const markSessionInitialized = (userKey?: string) => {
    sessionInitializedUserKey.value = userKey || ''
  }

  const resetSessionInitialization = () => {
    sessionInitializedUserKey.value = ''
  }

  return {
    systemInfo,
    theme,
    themeStyle,
    themeStyleToken,
    themeColor,
    ico,
    layout,
    calendarTagColor,
    showThreshold,
    language,
    microApp,
    changeTheme,
    changeThemeStyle,
    changeThemeColor,
    changeLayout,
    changeIco,
    changeTitle,
    queryInfo,
    querySingleInfo,
    setMircoData,
    queryTagsColor,
    queryVersion,
    getShowThreshold,
    isSessionInitializedFor,
    markSessionInitialized,
    resetSessionInitialization
  }
})

export const useSystemStore = withModuleStoreOverride(useSystemStoreBase)

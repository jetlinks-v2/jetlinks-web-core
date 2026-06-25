import { defineStore } from 'pinia'
import { getDetails_api, preprocessorExists, settingDetail, systemVersion } from '@jetlinks-web-core/api/system/basis'
import { getTagsColor } from '@jetlinks-web-core/api/system/calendar'
import { getTreeData_api } from '@jetlinks-web-core/api/system/department'
import { getThemeStyle_api } from '@jetlinks-web-core/api/account/center'
import { request } from '@jetlinks-web/core'
import { getToken, LocalStore } from '@jetlinks-web/utils'
import { langKey, isSubApp } from '@jetlinks-web-core/utils/consts'
import { withModuleStoreOverride } from './module-override'
import { applyThemeColor, getInitialThemeColor, persistThemeColor } from '@jetlinks-web-core/utils/theme-color'
import {
  applyThemeStyle,
  getInitialThemeStyleConfig,
  getThemeStyleInitialColor,
  getThemeStylePrimaryColor,
  normalizeThemeStyle,
  persistThemeStyle,
  type ThemeStyleKey,
} from '@jetlinks-web-core/utils/theme-style'

export interface OrganizationTreeNode {
  id?: string
  name?: string
  fullName?: string
  parentId?: string
  sortIndex?: number
  children?: OrganizationTreeNode[]
  [key: string]: any
}

export interface OrganizationPlatformSetting {
  id?: string
  orgId?: string
  orgName?: string
  title?: string
  companyName?: string
  recordNumber?: string
  showRecordNumber?: boolean
  enableDate?: string
  themeStyle?: string
  themeColor?: string
  defaultParkId?: string
  defaultParkName?: string
  logo?: string
  ico?: string
  background?: string
  footerLogo?: string
  [key: string]: any
}

export interface ParkViewItem {
  id?: string
  name?: string
  orgId?: string
  orgName?: string
  sortIndex?: number
  [key: string]: any
}

const PARK_CONTEXT_STORAGE_KEY = 'smart_park_current_park'
const TOP_ORG_STORAGE_KEY = 'smart_park_current_top_org'
const TOP_ORG_SETTING_STORAGE_KEY = 'smart_park_current_top_org_setting'

interface LayoutType {
  siderWidth: number
  headerHeight: number
  collapsedWidth: number
  title: string
  logo: string
  layout: 'mix' | 'side' | 'top'
}

const useSystemStoreBase = defineStore('system', () => {
  const initialThemeStyle = getInitialThemeStyleConfig()
  const theme = ref<string>('ai')
  const themeStyle = ref<ThemeStyleKey>(initialThemeStyle.style)
  const themeStyleToken = ref(initialThemeStyle.token)
  const themeColor = ref<string>(
    applyThemeColor(getThemeStyleInitialColor(themeStyle.value, getInitialThemeColor())),
  )
  applyThemeStyle(themeStyle.value, themeColor.value)

  const ico = ref<string>('/favicon.ico')
  const systemInfo = ref<Record<string, any>>({})
  const microApp = ref<Record<string, any>>({})
  const calendarTagColor = new Map([
    ['holiday', 'rgb(161, 180, 204)'],
    ['weekend', 'rgb(149, 222, 100)'],
    ['workday', 'rgba(105,177,255)'],
  ])
  const showThreshold = ref(true)
  const language = ref(LocalStore.get(langKey) || 'zh')
  const sessionInitializedUserKey = ref('')
  const organizationPlatformState = reactive<{
    organizationTree: OrganizationTreeNode[]
    currentParks: ParkViewItem[]
  }>({
    organizationTree: [],
    currentParks: [],
  })
  const currentTopOrgId = ref<string>(LocalStore.get(TOP_ORG_STORAGE_KEY) || '')
  const currentTopOrgSetting = ref<OrganizationPlatformSetting>(
    LocalStore.get(TOP_ORG_SETTING_STORAGE_KEY) || {},
  )
  const currentParkId = ref<string>(LocalStore.get(PARK_CONTEXT_STORAGE_KEY) || '')
  const currentParkInfo = ref<ParkViewItem | undefined>(undefined)

  const layout = reactive<LayoutType>({
    siderWidth: 208,
    headerHeight: 48,
    collapsedWidth: 48,
    title: 'JetLinks',
    logo: '/images/login/logo.png',
    layout: 'mix',
  })

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
    const result = persistThemeStyle(
      themeStyleValue,
      color || getThemeStylePrimaryColor(themeStyleValue) || themeColor.value,
    )
    theme.value = themeStyleValue === 'dark' ? 'dark' : 'light'
    themeStyle.value = result.style
    themeStyleToken.value = result.token
    themeColor.value = result.color
  }

  const getUserThemeStyle = async () => {
    if (!getToken()) return undefined

    try {
      const resp = await getThemeStyle_api()
      return resp?.success === false ? undefined : normalizeThemeStyle(resp?.result?.content)
    } catch {
      return undefined
    }
  }

  const changeLayout = <K extends keyof LayoutType>(code: K, value: LayoutType[K]) => {
    layout[code] = value
  }

  const changeIco = (url: string) => {
    ico.value = url
    const icoDom: HTMLLinkElement | null = document.querySelector('link[rel="icon"]')
    if (!icoDom) return
    icoDom.href = url
  }

  const changeTitle = (value: string) => {
    document.title = value
  }

  const setDocumentTitle = () => {
    const front = systemInfo.value.front
    if (!front) return

    const icoDom: HTMLLinkElement | null = document.querySelector('link[rel="icon"]')
    if (icoDom && front.ico) {
      icoDom.href = front.ico
    }
    document.title = front.title || ''
  }

  const handleFront = (front: any, userThemeStyle?: ThemeStyleKey) => {
    if (!front) return

    layout.title = front.title || layout.title
    layout.logo = front.logo || layout.logo
    const frontThemeStyle = userThemeStyle || normalizeThemeStyle(front.headerTheme)
    changeThemeStyle(frontThemeStyle, getThemeStylePrimaryColor(frontThemeStyle))
    if (front.ico) {
      changeIco(front.ico)
    }
    setDocumentTitle()
    changeTitle(front.title || '')
  }

  const queryInfo = async () => {
    const keys = ['front', 'amap', 'paths']
    const userThemeStyle = await getUserThemeStyle()
    const resp = await getDetails_api(keys)
    if (!resp.success) return

    keys.forEach((key) => {
      const value = resp.result.find((item: any) => item.scope === key)?.properties
      systemInfo.value[key] = value ?? {}
      if (key === 'front') {
        handleFront(value, userThemeStyle)
      }
    })
  }

  const querySingleInfo = async (key: string) => {
    if (!key) return

    const userThemeStyle = key === 'front' ? await getUserThemeStyle() : undefined
    const resp = await settingDetail(key)
    if (!resp.success) return

    const value = resp.result
    systemInfo.value[key] = value ?? {}
    if (key === 'front') {
      handleFront(value, userThemeStyle)
    }
  }

  const setMircoData = () => {
    if (isSubApp) {
      microApp.value = (window as any).microApp.getData()
    }
  }

  const queryTagsColor = async () => {
    const answer: any = await getTagsColor()
    if (!answer.success) return

    Object.keys(answer.result).forEach((key) => {
      calendarTagColor.set(key, answer.result[key])
    })
  }

  const queryVersion = async () => {
    const resp = await systemVersion()
    if (resp.success && resp.result) {
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

  const normalizeOrganizationList = (list: OrganizationTreeNode[] = []) =>
    [...list].sort((left, right) => {
      const sortDiff = Number(left?.sortIndex || 0) - Number(right?.sortIndex || 0)
      if (sortDiff !== 0) {
        return sortDiff
      }
      return String(left?.name || '').localeCompare(String(right?.name || ''))
    })

  const buildOrganizationNodeMap = (list: OrganizationTreeNode[] = []) => {
    const nodeMap = new Map<string, OrganizationTreeNode>()

    const visit = (nodes: OrganizationTreeNode[] = []) => {
      nodes.forEach((node) => {
        const id = String(node?.id || '')
        if (id) {
          nodeMap.set(id, node)
        }
        if (node?.children?.length) {
          visit(node.children)
        }
      })
    }

    visit(list)
    return nodeMap
  }

  const resolveOwnedTopOrganizations = (orgList: OrganizationTreeNode[] = []) => {
    const topOrganizations = getTopLevelOrganizations()
    const topOrgIdSet = new Set(topOrganizations.map((item) => String(item.id || '')))
    const organizationNodeMap = buildOrganizationNodeMap(organizationPlatformState.organizationTree)
    const resolvedTopOrgIds = new Set<string>()

    ;(orgList || []).forEach((item) => {
      let currentId = String(item?.id || '')
      const visited = new Set<string>()

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId)

        if (topOrgIdSet.has(currentId)) {
          resolvedTopOrgIds.add(currentId)
          break
        }

        const currentNode = organizationNodeMap.get(currentId)
        currentId = String(currentNode?.parentId || '')
      }
    })

    return normalizeOrganizationList(
      topOrganizations.filter((item) => resolvedTopOrgIds.has(String(item.id || ''))),
    )
  }

  const getTopLevelOrganizations = () => {
    const roots = (organizationPlatformState.organizationTree || []).filter((item) => !item?.parentId)
    return normalizeOrganizationList(roots)
  }

  const setCurrentTopOrgId = (orgId?: string, persist = true) => {
    const value = String(orgId || '')
    currentTopOrgId.value = value
    if (persist) {
      LocalStore.set(TOP_ORG_STORAGE_KEY, value)
    }
  }

  const setCurrentPark = (park?: ParkViewItem, persist = true) => {
    const id = String(park?.id || '')
    currentParkId.value = id
    currentParkInfo.value = id ? { ...park, id } : undefined
    if (persist) {
      LocalStore.set(PARK_CONTEXT_STORAGE_KEY, id)
    }
  }

  const clearCurrentPark = (persist = true) => {
    currentParkId.value = ''
    currentParkInfo.value = undefined
    if (persist) {
      LocalStore.remove(PARK_CONTEXT_STORAGE_KEY)
    }
  }

  const applyOrganizationPlatformSetting = (
    setting?: Partial<OrganizationPlatformSetting>,
    options: { persist?: boolean } = {},
  ) => {
    const nextSetting = {
      ...(currentTopOrgSetting.value || {}),
      ...(setting || {}),
    } as OrganizationPlatformSetting

    currentTopOrgSetting.value = nextSetting

    if (options.persist !== false) {
      LocalStore.set(TOP_ORG_SETTING_STORAGE_KEY, nextSetting)
    }

    handleFront(
      {
        ...(systemInfo.value.front || {}),
        title: nextSetting.title || systemInfo.value.front?.title || layout.title,
        logo: nextSetting.logo || systemInfo.value.front?.logo || layout.logo,
        ico: nextSetting.ico || systemInfo.value.front?.ico || ico.value,
        background: nextSetting.background || systemInfo.value.front?.background,
        recordNumber: nextSetting.recordNumber,
        showRecordNumber: nextSetting.showRecordNumber,
        footerLogo: nextSetting.footerLogo,
        headerTheme: nextSetting.themeStyle || systemInfo.value.front?.headerTheme || themeStyle.value,
      },
      normalizeThemeStyle(nextSetting.themeStyle || themeStyle.value),
    )

    if (nextSetting.themeColor) {
      changeThemeColor(nextSetting.themeColor)
    }
  }

  const queryOrganizationTree = async () => {
    const response: any = await getTreeData_api({ paging: false })
    const tree = Array.isArray(response?.result) ? response.result : Array.isArray(response) ? response : []
    organizationPlatformState.organizationTree = tree
    return tree
  }

  const loadTopOrgSetting = async (orgId?: string) => {
    const targetOrgId = String(orgId || '')
    if (!targetOrgId) return {}

    const response: any = await request.get(`/park/platform-setting/${targetOrgId}`)
    const setting = response?.result || response || {}
    const targetOrg = getTopLevelOrganizations().find((item) => String(item.id) === targetOrgId)

    setCurrentTopOrgId(targetOrgId)
    applyOrganizationPlatformSetting(
      {
        ...setting,
        orgId: targetOrgId,
        orgName: targetOrg?.name || setting?.orgName || '',
      },
      { persist: true },
    )

    return setting
  }

  const queryCurrentOrgParks = async (userId?: string) => {
    const targetUserId = String(userId || LocalStore.get('userId') || '')
    if (!targetUserId) {
      organizationPlatformState.currentParks = []
      clearCurrentPark()
      return []
    }

    const parkIdResponse: any = await request.get(`/user/park/${targetUserId}`)
    const parkIds = Array.isArray(parkIdResponse?.result)
      ? parkIdResponse.result
      : Array.isArray(parkIdResponse)
        ? parkIdResponse
        : []

    if (!parkIds.length) {
      organizationPlatformState.currentParks = []
      clearCurrentPark()
      return []
    }

    const response: any = await request.post('/park/basic/park/_query/no-paging', {
      paging: false,
      sorts: [{ name: 'name', order: 'asc' }],
      terms: [{ column: 'id', termType: 'in', value: parkIds }],
    }, {
      headers: {
        'X-Park-Id': '',
      },
    })

    const orgSortMap = new Map(
      getTopLevelOrganizations().map((item, index) => [String(item.id || ''), Number(item.sortIndex ?? index)]),
    )
    const parks = (Array.isArray(response?.result) ? response.result : Array.isArray(response) ? response : []).sort(
      (left: ParkViewItem, right: ParkViewItem) => {
        const leftSort = Number(orgSortMap.get(String(left?.orgId || '')) ?? Number.MAX_SAFE_INTEGER)
        const rightSort = Number(orgSortMap.get(String(right?.orgId || '')) ?? Number.MAX_SAFE_INTEGER)
        if (leftSort !== rightSort) {
          return leftSort - rightSort
        }
        return String(left?.name || '').localeCompare(String(right?.name || ''))
      },
    )

    organizationPlatformState.currentParks = parks

    const syncOrgTheme = async (park?: ParkViewItem) => {
      const parkOrgId = String(park?.orgId || '')
      if (parkOrgId && parkOrgId !== currentTopOrgId.value) {
        await loadTopOrgSetting(parkOrgId)
      }
    }

    const matched = parks.find((item: ParkViewItem) => String(item.id) === currentParkId.value)
    if (matched) {
      await syncOrgTheme(matched)
      setCurrentPark(matched)
      return parks
    }

    const defaultParkId = String(currentTopOrgSetting.value?.defaultParkId || '')
    const defaultPark = parks.find((item: ParkViewItem) => String(item.id) === defaultParkId)
    if (defaultPark) {
      await syncOrgTheme(defaultPark)
      setCurrentPark(defaultPark)
      return parks
    }

    const currentOrgPark = parks.find((item: ParkViewItem) => String(item.orgId || '') === currentTopOrgId.value)
    if (currentOrgPark) {
      setCurrentPark(currentOrgPark)
      return parks
    }

    if (parks.length) {
      await syncOrgTheme(parks[0])
      setCurrentPark(parks[0])
      return parks
    }

    clearCurrentPark()
    return []
  }

  const initOrganizationPlatformSetting = async (orgList: OrganizationTreeNode[] = []) => {
    const topOrganizations = getTopLevelOrganizations()
    const sortedOwnedTopOrganizations = resolveOwnedTopOrganizations(orgList)

    const fallbackOrg = sortedOwnedTopOrganizations[0] || topOrganizations[0]
    const nextTopOrgId =
      sortedOwnedTopOrganizations.some((item) => String(item.id) === currentTopOrgId.value)
        ? currentTopOrgId.value
        : String(fallbackOrg?.id || '')

    setCurrentTopOrgId(nextTopOrgId)

    if (!nextTopOrgId) {
      // 有些用户拿不到完整组织树，但仍然绑定了园区。
      // 这里继续按用户园区做一次兜底，避免左下角“当前视角”显示为空。
      await queryCurrentOrgParks()
      return
    }

    await loadTopOrgSetting(nextTopOrgId)
    await queryCurrentOrgParks()
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
    organizationPlatformState,
    currentTopOrgId,
    currentTopOrgSetting,
    currentParkId,
    currentParkInfo,
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
    resetSessionInitialization,
    queryOrganizationTree,
    initOrganizationPlatformSetting,
    applyOrganizationPlatformSetting,
    setCurrentTopOrgId,
    queryCurrentOrgParks,
    loadTopOrgSetting,
    setCurrentPark,
    clearCurrentPark,
  }
})

export const useSystemStore = withModuleStoreOverride(useSystemStoreBase)

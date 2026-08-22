import { defineStore } from 'pinia'
import { ref } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import i18n from '@jetlinks-web-core/locales'
import {
  getMyBusinessApplications,
  type BusinessApplicationEntity,
} from '@jetlinks-web-core/api/application'
import {
  getApplicationScopeFromLocation,
  isBusinessApplicationEndpointMissing,
  isProjectApplicationScope,
  normalizeBusinessApplications,
  PROJECT_APPLICATION_SCOPE,
  setApplicationScope,
} from '@jetlinks-web-core/utils/application-scope'
import { prepareApplicationAccess } from '@jetlinks-web-core/utils/application-access'
import { createProjectRuntimeHref, getProjectCodeFromLocation } from '@jetlinks-web-core/utils/project-runtime'
import { getProjectStorage } from '@jetlinks-web-core/utils/project-storage'
import { useMenuStore } from './menu'

const $t = i18n.global.t

type BusinessApplicationRuntimeType = 'application' | 'project'

type BusinessApplicationEntry = BusinessApplicationEntity & {
  runtimeType?: BusinessApplicationRuntimeType
  projectCode?: string
}

type EnterApplicationOptions = {
  currentProjectCode?: string
  fallbackPath?: string
  force?: boolean
  silent?: boolean
}

const normalizeText = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const isProjectEntry = (application?: BusinessApplicationEntry) => (
  application?.runtimeType === 'project' || isProjectApplicationScope(application?.id)
)

const getCurrentProjectContext = (projectCodeHint?: string) => {
  const locationCode = normalizeText(projectCodeHint) || getProjectCodeFromLocation()
  const locationStorage = getProjectStorage(locationCode)
  const projectCode = normalizeText(locationStorage?.domain) || locationCode
  const projectStorage = getProjectStorage(projectCode) || locationStorage
  const projectName = normalizeText(projectStorage?.projectName)
    || normalizeText(projectStorage?.name)
    || normalizeText(locationStorage?.projectName)
    || projectCode
    || $t('components.BusinessApplicationSwitcher.projectEntry')

  return {
    projectCode,
    projectName,
  }
}

const createProjectApplicationEntry = (
  sourceApplications: BusinessApplicationEntity[],
  projectCodeHint?: string,
): BusinessApplicationEntry | undefined => {
  if (!sourceApplications.length) return undefined

  const { projectCode, projectName } = getCurrentProjectContext(projectCodeHint)
  if (!projectCode) return undefined

  return {
    id: PROJECT_APPLICATION_SCOPE,
    projectId: projectCode,
    templateId: '',
    name: projectName,
    icon: 'ProjectOutlined',
    runtimeType: 'project',
    projectCode,
  }
}

const withProjectEntry = (
  sourceApplications: BusinessApplicationEntity[],
  projectCodeHint?: string,
): BusinessApplicationEntry[] => {
  const businessEntries = sourceApplications.map(item => ({
    ...item,
    runtimeType: 'application' as const,
  }))
  const projectEntry = createProjectApplicationEntry(sourceApplications, projectCodeHint)

  return projectEntry ? [...businessEntries, projectEntry] : businessEntries
}

const selectInitialApplication = (
  entries: BusinessApplicationEntry[],
  applicationScope?: string,
) => {
  const normalizedScope = normalizeText(applicationScope)
  if (normalizedScope) {
    const matchedApplication = entries.find(item => item.id === normalizedScope)
    if (matchedApplication) return matchedApplication
  }

  return entries.find(isProjectEntry) || entries[0]
}

export const useBusinessApplicationStore = defineStore('business-application', () => {
  const applications = ref<BusinessApplicationEntry[]>([])
  const currentApplication = ref<BusinessApplicationEntry>()
  const loading = ref(false)
  const switching = ref(false)
  const initialized = ref(false)
  const scopeSupported = ref(true)
  let initializePromise: Promise<BusinessApplicationEntry | undefined> | undefined
  let refreshPromise: Promise<BusinessApplicationEntry | undefined> | undefined

  const loadApplications = async (
    projectCodeHint?: string,
    preferredApplicationId?: string,
  ) => {
    const response = await getMyBusinessApplications().catch((err: unknown) => {
      if (isBusinessApplicationEndpointMissing(err)) return err
      throw err
    })

    if (isBusinessApplicationEndpointMissing(response)) {
      // 兼容未部署业务应用能力的 SaaS 后端，继续走普通菜单加载。
      applications.value = []
      currentApplication.value = undefined
      scopeSupported.value = false
      setApplicationScope()
      initialized.value = true
      return undefined
    }

    const result = normalizeBusinessApplications<BusinessApplicationEntity>(response)
    const entries = withProjectEntry(result, projectCodeHint)
    // 普通项目入口默认保留项目菜单；子账号登录会显式调用 enterFirstApplication 进入首个业务应用。
    const selected = selectInitialApplication(entries, preferredApplicationId)

    applications.value = entries
    currentApplication.value = selected
    scopeSupported.value = true
    setApplicationScope(selected?.id)
    initialized.value = true
    return selected
  }

  const initialize = (projectCodeHint?: string) => {
    if (initialized.value) return Promise.resolve(currentApplication.value)
    if (initializePromise) return initializePromise

    loading.value = true
    initializePromise = loadApplications(projectCodeHint, getApplicationScopeFromLocation())

    return initializePromise.finally(() => {
      loading.value = false
      initializePromise = undefined
    })
  }

  const refreshApplications = (projectCodeHint?: string) => {
    if (refreshPromise) return refreshPromise

    // Header 快捷入口与项目应用管理共享此状态；重拉时保留当前作用域，避免刷新列表改变菜单上下文。
    refreshPromise = (async () => {
      if (initializePromise) await initializePromise
      loading.value = true
      const preferredApplicationId = currentApplication.value?.id || getApplicationScopeFromLocation()
      return loadApplications(projectCodeHint, preferredApplicationId)
    })()

    return refreshPromise.finally(() => {
      loading.value = false
      refreshPromise = undefined
    })
  }

  const enterProject = async (
    projectEntry: BusinessApplicationEntry,
    options: EnterApplicationOptions = {},
  ) => {
    const result = await useMenuStore().queryMenus(PROJECT_APPLICATION_SCOPE)
    if (!result?.applied) return false

    const projectCode = normalizeText(projectEntry.projectCode)
      || getCurrentProjectContext(options.currentProjectCode).projectCode
    const path = result.firstMenuPath || options.fallbackPath || '/403'

    currentApplication.value = projectEntry
    setApplicationScope(PROJECT_APPLICATION_SCOPE)
    window.location.assign(createProjectRuntimeHref(projectCode, path))
    return true
  }

  const enterBusinessApplication = async (
    nextApplication: BusinessApplicationEntry,
    options: EnterApplicationOptions = {},
  ) => {
    const result = await useMenuStore().queryMenus(nextApplication.id)
    if (!result?.applied) return false

    const customDomain = typeof nextApplication.configuration?.customDomain === 'string'
      ? nextApplication.configuration.customDomain
      : ''
    const access = prepareApplicationAccess({
      applicationId: nextApplication.id,
      applicationName: nextApplication.name,
      currentProjectCode: options.currentProjectCode,
      domain: customDomain,
      path: result.firstMenuPath || options.fallbackPath || '/403',
    })
    if (!access.success) {
      throw new Error(`Application access context is unavailable: ${access.reason}`)
    }

    currentApplication.value = nextApplication
    setApplicationScope(nextApplication.id)
    window.location.assign(access.url)
    return true
  }

  const enterApplication = async (
    nextApplication: BusinessApplicationEntry,
    options: EnterApplicationOptions = {},
  ) => {
    if (!options.force && nextApplication.id === currentApplication.value?.id) {
      return false
    }

    return isProjectEntry(nextApplication)
      ? enterProject(nextApplication, options)
      : enterBusinessApplication(nextApplication, options)
  }

  const switchApplication = async (applicationId: string) => {
    const nextApplication = applications.value.find(item => item.id === applicationId)
    if (!nextApplication || switching.value) {
      return false
    }

    switching.value = true
    try {
      return await enterApplication(nextApplication)
    } catch (error) {
      onlyMessage($t('components.BusinessApplicationSwitcher.switchFailed', { name: nextApplication.name }), 'error')
      console.error('[Business Application] Failed to switch application:', error)
      return false
    } finally {
      switching.value = false
    }
  }

  const enterFirstApplication = async (options: EnterApplicationOptions = {}) => {
    if (switching.value) return false

    switching.value = true
    try {
      await initialize(options.currentProjectCode)
      const firstApplication = applications.value.find(item => !isProjectEntry(item))
      if (!firstApplication) return false

      return await enterApplication(firstApplication, {
        ...options,
        force: true,
      })
    } catch (error) {
      if (!options.silent) {
        onlyMessage($t('components.BusinessApplicationSwitcher.switchFailed', {
          name: applications.value.find(item => !isProjectEntry(item))?.name || '',
        }), 'error')
      }
      console.error('[Business Application] Failed to enter first application:', error)
      return false
    } finally {
      switching.value = false
    }
  }

  const init = () => {
    applications.value = []
    currentApplication.value = undefined
    loading.value = false
    switching.value = false
    initialized.value = false
    scopeSupported.value = true
    initializePromise = undefined
    refreshPromise = undefined
  }

  return {
    applications,
    currentApplication,
    loading,
    switching,
    initialized,
    scopeSupported,
    initialize,
    refreshApplications,
    switchApplication,
    enterFirstApplication,
    init,
  }
})

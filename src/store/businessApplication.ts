import { defineStore } from 'pinia'
import { ref } from 'vue'
import { onlyMessage } from '@jetlinks-web/utils'
import router from '@jetlinks-web-core/router'
import i18n from '@jetlinks-web-core/locales'
import {
  getMyBusinessApplications,
  type BusinessApplicationEntity,
} from '@jetlinks-web-core/api/application'
import {
  getApplicationScopeFromLocation,
  isBusinessApplicationEndpointMissing,
  normalizeBusinessApplications,
  selectApplicationScope,
  setApplicationScope,
} from '@jetlinks-web-core/utils/application-scope'
import { useMenuStore } from './menu'

const $t = i18n.global.t

export const useBusinessApplicationStore = defineStore('business-application', () => {
  const applications = ref<BusinessApplicationEntity[]>([])
  const currentApplication = ref<BusinessApplicationEntity>()
  const loading = ref(false)
  const switching = ref(false)
  const initialized = ref(false)
  const scopeSupported = ref(true)
  let initializePromise: Promise<BusinessApplicationEntity | undefined> | undefined

  const initialize = () => {
    if (initialized.value) return Promise.resolve(currentApplication.value)
    if (initializePromise) return initializePromise

    loading.value = true
    initializePromise = (async () => {
      const response = await getMyBusinessApplications().catch((err) => {
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
      const selected = selectApplicationScope(result, getApplicationScopeFromLocation())

      applications.value = result
      currentApplication.value = selected
      scopeSupported.value = true
      setApplicationScope(selected?.id)
      initialized.value = true
      return selected
    })()

    return initializePromise.finally(() => {
      loading.value = false
      initializePromise = undefined
    })
  }

  const switchApplication = async (applicationId: string) => {
    const nextApplication = applications.value.find(item => item.id === applicationId)
    if (!nextApplication || nextApplication.id === currentApplication.value?.id || switching.value) {
      return false
    }

    switching.value = true
    try {
      const result = await useMenuStore().queryMenus(nextApplication.id)
      if (!result?.applied) return false

      currentApplication.value = nextApplication
      setApplicationScope(nextApplication.id)
      await router.replace(result.firstMenuPath || '/403')
      return true
    } catch (error) {
      onlyMessage($t(
        'components.BusinessApplicationSwitcher.switchFailed',
        { name: nextApplication.name },
      ), 'error')
      console.error('[Business Application] Failed to switch application:', error)
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
  }

  return {
    applications,
    currentApplication,
    loading,
    switching,
    initialized,
    scopeSupported,
    initialize,
    switchApplication,
    init,
  }
})

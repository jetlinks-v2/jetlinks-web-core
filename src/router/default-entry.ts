import { onlyMessage } from '@jetlinks-web/utils'
import i18n from '@jetlinks-web-core/locales'
import { useAuthStore, useBusinessApplicationStore, useUserStore } from '@jetlinks-web-core/store'
import { isBusinessApplicationRuntime } from '@jetlinks-web-core/utils/business-application-runtime'
import { getApplicationRuntimeEntry } from '@jetlinks-web-core/utils/project-runtime'
import {
  APPLICATION_SCOPE_QUERY_KEY,
  getRouteQueryParam,
  isProjectApplicationScope,
} from '@jetlinks-web-core/utils/application-scope'

/** 默认应用选择失败后必须停止项目菜单加载，避免掩盖真实的应用准入失败。 */
export class DefaultApplicationEntryError extends Error {
  constructor(cause?: unknown) {
    super('Default application entry unavailable', { cause })
    this.name = 'DefaultApplicationEntryError'
  }
}

/** 入口名单读取失败时，尚未确认身份的项目路径也不能继续加载项目菜单。 */
export const initializeBusinessApplicationEntry = async () => {
  try {
    return await useBusinessApplicationStore().initialize()
  } catch (error) {
    if (getApplicationRuntimeEntry().type === 'application') throw error
    onlyMessage(i18n.global.t('components.BusinessApplicationSwitcher.loadFailed'), 'error')
    throw new DefaultApplicationEntryError(error)
  }
}

/** 返回 true 表示已发起整页应用跳转，调用方必须停止后续初始化与导航。 */
export const enterDefaultApplication = async () => {
  if (!isBusinessApplicationRuntime()
    || getApplicationRuntimeEntry().type === 'application'
    || useUserStore().isAdmin) return false

  const requestedScope = getRouteQueryParam(window.location, APPLICATION_SCOPE_QUERY_KEY)
  // 显式项目链接和主动切换具有更高优先级，不由默认入口策略覆盖。
  if (requestedScope === '' || isProjectApplicationScope(requestedScope)) return false

  try {
    if (!await useAuthStore().hasOnlyApplicationRoles()) return false

    const applications = useBusinessApplicationStore()
    await applications.initialize()
    if (!applications.applications.some(item => item.runtimeType !== 'project')) {
      onlyMessage(i18n.global.t('components.BusinessApplicationSwitcher.noAccessibleApplication'), 'warning')
      throw new DefaultApplicationEntryError()
    }

    // enterFirstApplication 保留接口顺序，并在目标 Scope 下预检菜单和复制访问上下文。
    const entered = await applications.enterFirstApplication()
    if (!entered) throw new DefaultApplicationEntryError()
    return true
  } catch (error) {
    if (error instanceof DefaultApplicationEntryError) throw error
    onlyMessage(i18n.global.t('components.BusinessApplicationSwitcher.loadFailed'), 'error')
    throw new DefaultApplicationEntryError(error)
  }
}

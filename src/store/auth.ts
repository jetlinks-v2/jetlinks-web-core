import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isArray } from 'lodash-es'
import { getMe_api } from '@jetlinks-web-core/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const permissions = ref<Record<string, string[]>>({})
  let applicationOnlyRoles: boolean | undefined
  let roleQuery: Promise<boolean> | undefined
  let sessionVersion = 0

  /** 只识别角色归属，tenant、成员关系等维度不能代替项目角色。 */
  const hasOnlyApplicationRoles = () => {
    if (applicationOnlyRoles !== undefined) return Promise.resolve(applicationOnlyRoles)
    if (roleQuery) return roleQuery

    const version = sessionVersion
    const pending = getMe_api({ applicationScope: false }).then(response => {
      if (version !== sessionVersion) throw new Error('Authorization session changed')
      if (!response.success || !Array.isArray(response.result?.dimensions)) {
        throw new Error('Current authorization is unavailable')
      }

      const roles = response.result.dimensions.filter(dimension => (
        (typeof dimension.type === 'string' ? dimension.type : dimension.type?.id) === 'role'
        && dimension.options?.ignore !== true
      ))
      applicationOnlyRoles = roles.length > 0 && roles.every(dimension => (
        typeof dimension.options?.applicationId === 'string'
        && !!dimension.options.applicationId.trim()
      ))
      return applicationOnlyRoles
    }).finally(() => {
      // 换账号后旧请求不能清掉新会话的查询，也不能回填旧身份。
      if (roleQuery === pending) roleQuery = undefined
    })
    roleQuery = pending
    return pending
  }

  const setPermissionsAll = (record: Record<string, string[]>) => {
    cleanPermission()
    permissions.value = record
  }

  const setPermission = (code: string, buttons: string[]) => {
    permissions.value[code] = buttons
  }

  const cleanPermission = () => {
    permissions.value = {}
  }

  const getPermission = (code: string): string[] => {
    if (code) {
      return permissions.value[code]
    }

    return []
  }

  const hasPermission = (code: string | string[]): boolean => {
    const codes = isArray(code) ? code : [code]
    return codes.some((key) => {
      const [menuCode, button] = key.split(':')
      return !!getPermission(menuCode)?.includes(button)
    })
  }

  const handlePermission = (data: any) => {
    cleanPermission()
  }

  const init = () => {
    sessionVersion += 1
    applicationOnlyRoles = undefined
    roleQuery = undefined
    permissions.value = {}
  }

  return {
    permissions,
    hasOnlyApplicationRoles,
    getPermission,
    setPermission,
    cleanPermission,
    handlePermission,
    hasPermission,
    setPermissionsAll,
    init
  }
})

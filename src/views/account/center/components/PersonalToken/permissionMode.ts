import type { PermissionDefinition, PermissionScope } from './components/data'
import type { StoredTokenScope, TokenGrantScope, TokenPermissionMode } from './types'

export const TOKEN_PERMISSION_MODE_ATTRIBUTE = 'personalTokenPermissionMode'
export const TOKEN_PERMISSION_MODES: TokenPermissionMode[] = ['follow', 'readonly', 'custom']

export const clonePermissions = (permissions: PermissionScope[]): PermissionScope[] =>
  permissions.map(item => ({ id: item.id, actions: [...item.actions] }))

/** 与后端 extractPermissions 一致：缺省范围或单个全局 * 都表示继承账号权限。 */
export function followsAccount(scope?: StoredTokenScope | null): boolean {
  const permissions = scope?.permissions
  return permissions == null || (permissions.length === 1 && permissions[0].id === '*')
}

export function resolvePermissionMode(scope?: StoredTokenScope | null): TokenPermissionMode {
  if (followsAccount(scope)) return 'follow'
  const marker = scope?.attributes?.[TOKEN_PERMISSION_MODE_ATTRIBUTE]
  if (marker === 'readonly' && scope?.permissions?.every(item => item.actions.every(action => action === 'query'))) {
    return 'readonly'
  }
  // 未记录模式的历史权限一律保留具体清单，不猜测它当时是否选择了“只读”。
  return 'custom'
}

export function permissionModeLabel(scope?: StoredTokenScope | null): string {
  const mode = resolvePermissionMode(scope)
  if (mode === 'follow' || mode === 'readonly' || scope?.attributes?.[TOKEN_PERMISSION_MODE_ATTRIBUTE] === 'custom') {
    return 'PersonalToken.permissionMode.' + mode
  }
  return 'PersonalToken.permissionMode.specified'
}

/** 只复制要编辑的权限和属性；维度及其他既有 Scope 字段原样回传。 */
export function copyTokenScope(scope?: StoredTokenScope | null): TokenGrantScope {
  return {
    ...scope,
    permissions: followsAccount(scope) ? [{ id: '*', actions: ['*'] }] : clonePermissions(scope?.permissions || []),
    ...(scope?.attributes ? { attributes: { ...scope.attributes } } : {}),
  }
}

export function withPermissionMode(
  scope: TokenGrantScope,
  mode: TokenPermissionMode,
  permissions = scope.permissions,
): TokenGrantScope {
  return {
    ...scope,
    permissions: mode === 'follow' ? [{ id: '*', actions: ['*'] }] : clonePermissions(permissions),
    attributes: { ...scope.attributes, [TOKEN_PERMISSION_MODE_ATTRIBUTE]: mode },
  }
}

export function allPermissionOperations(definitions: PermissionDefinition[]): PermissionScope[] {
  return definitions.flatMap(item => {
    const actions = (item.actions || []).map(action => action.action)
    return item.id !== '*' && actions.length ? [{ id: item.id, actions }] : []
  })
}

/** 单资源 actions=* 同样继承该资源的动作；只在展示或显式收窄时展开。 */
export function expandPermissionOperations(
  permissions: PermissionScope[],
  definitions: PermissionDefinition[],
): PermissionScope[] {
  return permissions.map(item => {
    const definition = definitions.find(value => value.id === item.id)
    return {
      id: item.id,
      actions: item.actions.includes('*') && definition
        ? (definition.actions || []).map(action => action.action) : [...item.actions],
    }
  })
}

/** “只读”保守限定为平台 query 操作；不能把导出、指令或未知动作视为查询。 */
export function readonlyPermissions(definitions: PermissionDefinition[]): PermissionScope[] {
  return definitions
    .filter(item => item.id !== '*')
    .map(item => ({ id: item.id, actions: (item.actions || []).filter(action => action.action === 'query').map(action => action.action) }))
    .filter(item => item.actions.length > 0)
}

import type {
  MenuOwnerGroup,
  MenuPermissionGroupDefinition,
  MenuPermissionNode,
  MenuPermissionScope,
} from './menuAssetPermissionEditor.types'

export interface MenuPermissionProjection {
  scope?: MenuPermissionScope
}

/** 派生分组视图，按钮仅展示允许集合；WeakMap 元数据不会进入授权快照。 */
export function projectMenuPermissionGroups(
  menus: MenuPermissionNode[],
  definitions: MenuPermissionGroupDefinition[],
  projections: WeakMap<MenuPermissionNode, MenuPermissionProjection>,
): MenuOwnerGroup[] {
  return definitions.map(group => {
    const scopes = new Map(group.menus.map(scope => [scope.id, scope]))
    const visit = (items: MenuPermissionNode[]): MenuPermissionNode[] => items.flatMap(menu => {
      const children = visit(menu.children || [])
      if (group.visibleOwner !== undefined && menu.owner !== group.visibleOwner) return children
      const scope = scopes.get(menu.id)
      if (!scope && !children.length) return []
      const allowedButtons = new Set(scope?.buttonIds || [])
      const buttons = (menu.buttons || []).filter(button => allowedButtons.has(button.id))
      const states = [
        ...buttons.map(button => ({ full: !!button.granted, some: !!button.granted })),
        ...children.map(child => ({ full: !!child._granted, some: !!child._granted || !!child.indeterminate })),
      ]
      const full = states.length ? states.every(state => state.full) : !!scope && !!menu.granted
      const some = states.length ? states.some(state => state.some) : full
      const projected: MenuPermissionNode = {
        ...menu, buttons, children: children.length ? children : null,
        granted: !!scope && !!menu.granted, _granted: full, indeterminate: !full && some,
      }
      projections.set(projected, { scope })
      return [projected]
    })
    return { key: group.key, label: group.label, menus: visit(menus) }
  }).filter(group => group.menus.length)
}

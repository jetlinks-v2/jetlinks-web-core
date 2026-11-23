import { cloneDeep } from 'lodash-es'
import { computed, reactive, ref, toRaw } from 'vue'
import { isPrivateDeployment } from '../utils/deployment'
import { projectMenuPermissionGroups } from './menuPermissionGroups'
import type { MenuPermissionProjection } from './menuPermissionGroups'
import type {
  AssetAccessPolicy,
  GrantableAssetSupport,
  GrantableAssetType,
  MenuAssetPermissionEditorContext,
  MenuAssetPermissionSnapshot,
  MenuAssetPermissionResetOptions,
  MenuPermissionButton,
  MenuPermissionNode,
  MenuPermissionGroupDefinition,
  MenuPermissionScope,
  SelectionState,
  VisibleAssetPermission,
} from './menuAssetPermissionEditor.types'

interface EditorOptions {
  notificationScopeMode?: 'grantable' | 'deployment'
  defaultSupportIds?: string[]
  protectedMenuCode?: string
  protectedButtonId?: string
}

interface AssetDefinition {
  assetType: string
  name?: string
  menuName?: string
  accesses: Map<string, GrantableAssetSupport>
}

const valueOf = (value: unknown) => {
  if (value && typeof value === 'object') {
    const item = value as Record<string, unknown>
    return String(item.id ?? item.value ?? item.assetType ?? '')
  }
  return String(value ?? '')
}

const supportIdOf = (access: unknown) => {
  if (access == null) return ''
  if (typeof access !== 'object') return String(access)
  const item = access as Record<string, any>
  return String(item.supportId ?? item.id ?? item.type ?? item.value ?? '')
}
const supportNameOf = (access: unknown) => {
  if (!access || typeof access !== 'object') return supportIdOf(access)
  const item = access as Record<string, any>
  return String(item.i18nName ?? item.name ?? supportIdOf(item))
}

export const getMenuPermissionAssetTypes = (menu: MenuPermissionNode): string[] => {
  const multiple = Array.isArray(menu.assetTypes)
    ? menu.assetTypes.map(valueOf).filter(Boolean)
    : (menu.assetTypes ? [valueOf(menu.assetTypes)].filter(Boolean) : [])
  if (multiple.length) return Array.from(new Set(multiple))

  const single = valueOf(menu.assetType)
  if (single) return [single]

  return Array.from(new Set((menu.assetAccesses || []).map(access => valueOf(access.assetType)).filter(Boolean)))
}

export const isFixedNotificationAsset = (assetType: string) =>
  assetType === 'notifyConfig' || assetType === 'notifyTemplate'

const flatten = (menus: MenuPermissionNode[] = []) => {
  const result: MenuPermissionNode[] = []
  const visit = (items: MenuPermissionNode[]) => items.forEach(item => {
    result.push(item)
    visit(item.children || [])
  })
  visit(menus)
  return result
}

export const getFixedNotificationMenus = (menus: MenuPermissionNode[]) => flatten(menus)
  .filter(menu => getMenuPermissionAssetTypes(menu).some(isFixedNotificationAsset))
  .map(menu => ({ ...menu, children: null }))

/** 模板保留完整菜单树承载撤销，仅为固定范围补上与独立策略一致的兼容字段。 */
export const getFixedNotificationMenuAccesses = (snapshot: MenuAssetPermissionSnapshot) =>
  new Map(snapshot.menus.map(menu => [menu.id, (menu.assetAccesses || [])
    .filter(access => isFixedNotificationAsset(valueOf(access.assetType)))]))

export const useMenuAssetPermissionEditor = (options: EditorOptions = {}): MenuAssetPermissionEditorContext => {
  const defaultSupportIds = options.defaultSupportIds || ['creator']
  const fixedScope = isPrivateDeployment() ? 'all' : 'tenant'
  const useDeploymentScope = options.notificationScopeMode === 'deployment'
  const protectedButtonId = options.protectedButtonId || 'view'
  const menuTree = ref<MenuPermissionNode[]>([])
  const buttonBatchValues = ref<string[]>([])
  const loading = ref(false)
  const menuMap = new Map<string, MenuPermissionNode>()
  const menuGroups = ref<MenuPermissionGroupDefinition[]>()
  const projections = new WeakMap<MenuPermissionNode, MenuPermissionProjection>()
  const editableMenus = new Map<string, MenuPermissionScope>()
  const explicitMenuGrants = new Set<string>()
  const assetDefinitions = reactive(new Map<string, AssetDefinition>())
  const assetNames = reactive(new Map<string, string>())
  const assetDrafts = reactive(new Map<string, string>())
  const assetOrder = ref<string[]>([])
  const fixedSupports = ref(new Map<string, GrantableAssetSupport>())
  const fixedHistory = ref(new Map<string, Map<string, string>>())

  const flatMenus = computed(() => flatten(menuTree.value))

  const isProtectedMenu = (menu: MenuPermissionNode) => {
    return !!options.protectedMenuCode && menu.code === options.protectedMenuCode
  }

  const isProtectedButton = (menu: MenuPermissionNode, button: MenuPermissionButton) => {
    return isProtectedMenu(menu) && button.id === protectedButtonId
  }

  const buttonsOf = (menu: MenuPermissionNode) => menu.buttons || []

  const recomputeNode = (menu: MenuPermissionNode) => {
    const childStates = (menu.children || []).map(child => ({
      selected: !!child._granted || !!child.indeterminate,
      full: !!child._granted && !child.indeterminate,
    }))
    const buttonStates = buttonsOf(menu).map(button => ({
      selected: !!button.granted,
      full: !!button.granted,
    }))
    const states = [...childStates, ...buttonStates]

    if (states.length) {
      const all = states.every(state => state.full)
      const some = states.some(state => state.selected)
      menu._granted = all
      menu.indeterminate = !all && some
      // 分组外节点只参与层级回显，不能因子菜单勾选而获得新的菜单权限。
      if (!menuGroups.value || editableMenus.has(menu.id)) {
        menu.granted = all || some || explicitMenuGrants.has(menu.id)
      }
    } else {
      menu._granted = !!menu.granted
      menu.indeterminate = false
    }

    if (isProtectedMenu(menu)) {
      menu.granted = true
      const view = buttonsOf(menu).find(button => button.id === protectedButtonId)
      if (view) view.granted = true
      if (!menu._granted) menu.indeterminate = true
    }
  }

  const recomputeTree = (menus: MenuPermissionNode[]) => {
    menus.forEach(menu => {
      recomputeTree(menu.children || [])
      recomputeNode(menu)
    })
  }

  const recomputeAncestors = (parentId?: string) => {
    if (!parentId) return
    const parent = menuMap.get(parentId)
    if (!parent) return
    recomputeNode(parent)
    recomputeAncestors(parent.parentId)
  }

  const setNodeState = (menu: MenuPermissionNode, checked: boolean) => {
    menu.granted = checked
    menu._granted = checked
    menu.indeterminate = false
    buttonsOf(menu).forEach(button => {
      button.granted = isProtectedButton(menu, button) ? true : checked
    })
    ;(menu.children || []).forEach(child => setNodeState(child, checked))
    recomputeNode(menu)
  }

  const scopeOf = (menu: MenuPermissionNode) => {
    const projection = projections.get(toRaw(menu))
    return projection ? projection.scope : editableMenus.get(menu.id)
  }

  /** 仅把当前视图允许的动作写回真实节点，不递归操作被其他模板隐藏的兄弟或按钮。 */
  const setScopedNodeState = (view: MenuPermissionNode, checked: boolean) => {
    const menu = menuMap.get(view.id)
    const scope = scopeOf(view)
    if (menu && scope && !(isProtectedMenu(menu) && !checked)) {
      menu.granted = checked
      explicitMenuGrants.delete(menu.id)
      if (checked && !scope.buttonIds.length && !view.children?.length) explicitMenuGrants.add(menu.id)
      const allowed = new Set(scope.buttonIds)
      buttonsOf(menu).forEach(button => {
        if (allowed.has(button.id)) button.granted = isProtectedButton(menu, button) || checked
      })
    }
    ;(view.children || []).forEach(child => setScopedNodeState(child, checked))
  }

  const selectedMenus = () => flatMenus.value.filter(menu => !!menu.granted)

  const getAssetTypesFromMenus = (menus: MenuPermissionNode[], includeChildren = true) => {
    const visitedMenus = new Set<string>()
    const seenAssetTypes = new Set<string>()
    const result: string[] = []
    const visit = (items: MenuPermissionNode[]) => items.forEach(menu => {
      if (visitedMenus.has(menu.id)) return
      visitedMenus.add(menu.id)
      getMenuPermissionAssetTypes(menu).forEach(assetType => {
        if (!seenAssetTypes.has(assetType)) {
          seenAssetTypes.add(assetType)
          result.push(assetType)
        }
      })
      if (includeChildren) visit(menu.children || [])
    })
    visit(menus)
    return result
  }

  const getDefaultSupport = (assetType: string) => {
    const supports = Array.from(assetDefinitions.get(assetType)?.accesses.values() || [])
      .filter(item => !item.disabled)
    const preferred = new Set(defaultSupportIds.map(item => item.toLowerCase()))
    return supports.find(item => preferred.has(item.supportId.toLowerCase()))?.supportId || supports[0]?.supportId
  }

  const getVisibleAssetIdsInMenuOrder = () => getAssetTypesFromMenus(selectedMenus(), false)

  const visibleAssetIds = () => {
    const menuOrder = getVisibleAssetIdsInMenuOrder()
    const visible = new Set(menuOrder)
    const result = assetOrder.value.filter(assetType => visible.has(assetType))
    const ordered = new Set(result)
    menuOrder.forEach(assetType => {
      if (!ordered.has(assetType)) {
        ordered.add(assetType)
        result.push(assetType)
      }
    })
    return result
  }

  const prependNewlyVisibleAssets = (previousVisible: Set<string>, menus: MenuPermissionNode[]) => {
    const nowVisible = new Set(getVisibleAssetIdsInMenuOrder())
    const additions = getAssetTypesFromMenus(menus)
      .filter(assetType => nowVisible.has(assetType) && !previousVisible.has(assetType))
    if (!additions.length) return
    const additionSet = new Set(additions)
    assetOrder.value = [...additions, ...assetOrder.value.filter(assetType => !additionSet.has(assetType))]
  }

  const ensureVisibleDrafts = () => {
    visibleAssetIds().forEach(assetType => {
      if (!isFixedNotificationAsset(assetType) && !assetDrafts.has(assetType)) {
        const supportId = getDefaultSupport(assetType)
        if (supportId) assetDrafts.set(assetType, supportId)
      }
    })
  }

  const toggleMenu = (menu: MenuPermissionNode, checked: boolean) => {
    if (isProtectedMenu(menu) && !checked) return
    const previousVisible = new Set(visibleAssetIds())
    if (menuGroups.value) {
      setScopedNodeState(menu, checked)
      recomputeTree(menuTree.value)
    } else {
      setNodeState(menu, checked)
      recomputeAncestors(menu.parentId)
    }
    buttonBatchValues.value = []
    if (checked) prependNewlyVisibleAssets(previousVisible, [menu])
    ensureVisibleDrafts()
  }

  const toggleButton = (menu: MenuPermissionNode, button: MenuPermissionButton, checked: boolean) => {
    if (menuGroups.value) {
      if (!scopeOf(menu)?.buttonIds.includes(button.id)) return
      const source = menuMap.get(menu.id)
      const sourceButton = source?.buttons?.find(item => item.id === button.id)
      if (!source || !sourceButton) return
      menu = source
      button = sourceButton
    }
    if (isProtectedButton(menu, button) && !checked) return
    const previousVisible = new Set(visibleAssetIds())
    button.granted = checked
    recomputeNode(menu)
    recomputeAncestors(menu.parentId)
    buttonBatchValues.value = []
    if (checked) prependNewlyVisibleAssets(previousVisible, [menu])
    ensureVisibleDrafts()
  }

  const setMenusChecked = (menus: MenuPermissionNode[], checked: boolean) => {
    const previousVisible = new Set(visibleAssetIds())
    menus.forEach(menu => menuGroups.value ? setScopedNodeState(menu, checked) : setNodeState(menu, checked))
    recomputeTree(menuTree.value)
    buttonBatchValues.value = []
    if (checked) prependNewlyVisibleAssets(previousVisible, menus)
    ensureVisibleDrafts()
  }

  const getSelectionState = (menus: MenuPermissionNode[]): SelectionState => {
    const items = flatten(menus).filter(menu => !isProtectedMenu(menu))
    if (!items.length) return { checked: false, indeterminate: false }
    const selected = items.filter(menu => menu._granted && !menu.indeterminate).length
    const partial = items.some(menu => menu.indeterminate)
    return {
      checked: selected === items.length,
      indeterminate: partial || (selected > 0 && selected < items.length),
    }
  }

  const getActionOptions = (menus: MenuPermissionNode[] = menuTree.value) => {
    const counts = new Map<string, { count: number; order: number; label: string }>()
    flatten(menus).forEach(menu => buttonsOf(menu).forEach(button => {
      const current = counts.get(button.id)
      if (current) current.count += 1
      else counts.set(button.id, {
        count: 1,
        order: counts.size,
        label: `${button.i18nName || button.name || button.id}(${button.id})`,
      })
    }))
    return Array.from(counts.entries())
      .sort((left, right) => right[1].count - left[1].count || left[1].order - right[1].order)
      .map(([value, item]) => ({ label: item.label, value }))
  }

  const actionOptions = computed(() => getActionOptions())

  const applyButtonBatch = (buttonIds: string[], menus: MenuPermissionNode[] = menuTree.value) => {
    const previousVisible = new Set(visibleAssetIds())
    const selected = new Set(buttonIds || [])
    const targetMenus = flatten(menus)
    targetMenus.forEach(view => {
      const menu = menuGroups.value ? menuMap.get(view.id) : view
      if (!menu) return
      const allowed = menuGroups.value ? new Set(scopeOf(view)?.buttonIds || []) : undefined
      buttonsOf(menu).forEach(button => {
        if (!allowed || allowed.has(button.id)) button.granted = isProtectedButton(menu, button) || selected.has(button.id)
      })
    })
    recomputeTree(menuTree.value)
    buttonBatchValues.value = [...selected]
    prependNewlyVisibleAssets(previousVisible, targetMenus)
    ensureVisibleDrafts()
  }

  const ownerGroups = computed(() => {
    if (menuGroups.value) return projectMenuPermissionGroups(menuTree.value, menuGroups.value, projections)
    const groups = new Map<string, MenuPermissionNode[]>()
    menuTree.value.forEach(menu => {
      const owner = String(menu.owner || 'default')
      if (!groups.has(owner)) groups.set(owner, [])
      groups.get(owner)!.push(menu)
    })
    return Array.from(groups.entries()).map(([key, menus]) => ({ key, label: key, menus }))
  })

  const selectedSupportOf = (assetType: string) => isFixedNotificationAsset(assetType)
    ? fixedSupports.value.get(assetType)?.supportId
    : assetDrafts.get(assetType)

  const visibleAssets = computed<VisibleAssetPermission[]>(() => visibleAssetIds().map(assetType => {
    const definition = assetDefinitions.get(assetType)
    const name = assetNames.get(assetType) || definition?.name || definition?.menuName || assetType
    const selectedSupportId = selectedSupportOf(assetType)
    if (isFixedNotificationAsset(assetType)) {
      const support = fixedSupports.value.get(assetType)
      const history = fixedHistory.value.get(assetType)
      const previousScopeLabels = history?.size && (history.size !== 1 || !history.has(selectedSupportId || ''))
        ? Array.from(history.values()) : undefined
      return { assetType, name, accesses: support ? [{ ...support, disabled: true }] : [],
        selectedSupportId, fixedScope, previousScopeLabels }
    }
    const accesses = Array.from(definition?.accesses.values() || []).map(item => ({ ...item }))
    if (selectedSupportId && !accesses.some(item => item.supportId === selectedSupportId)) {
      accesses.push({ supportId: selectedSupportId, name: selectedSupportId, disabled: true })
    }
    return {
      assetType,
      name,
      accesses,
      selectedSupportId,
    }
  }))

  const editableAssets = computed(() => visibleAssets.value.filter(asset => !asset.fixedScope))

  const batchAssetOptions = computed(() => {
    if (!editableAssets.value.length) return []
    const supportSets = editableAssets.value.map(asset => new Set(
      asset.accesses.filter(item => !item.disabled).map(item => item.supportId)
    ))
    if (supportSets.some(set => !set.size)) return []
    return editableAssets.value[0].accesses
      .filter(item => !item.disabled && supportSets.every(set => set.has(item.supportId)))
      .map(item => ({ label: item.i18nName || item.name || item.supportId, value: item.supportId }))
  })

  const batchAssetValue = computed(() => {
    const values = Array.from(new Set(editableAssets.value.map(item => item.selectedSupportId).filter(Boolean)))
    if (values.length !== 1) return undefined
    return batchAssetOptions.value.some(item => item.value === values[0]) ? values[0] : undefined
  })

  const setAssetAccess = (assetType: string, supportId?: string) => {
    if (supportId && !isFixedNotificationAsset(assetType)) assetDrafts.set(assetType, supportId)
  }

  const applyAssetBatch = (supportId?: string) => {
    if (!supportId || !batchAssetOptions.value.some(item => item.value === supportId)) return
    editableAssets.value.forEach(asset => assetDrafts.set(asset.assetType, supportId))
  }

  const mergeGrantedMenus = (menus: MenuPermissionNode[], grantedMenus?: MenuPermissionNode[]) => {
    const grantMap = new Map(flatten(grantedMenus || []).map(menu => [menu.id, menu]))
    const hasSeparateGrant = grantedMenus !== undefined
    const visit = (items: MenuPermissionNode[], parentId?: string): MenuPermissionNode[] => items.map(source => {
      const menu = cloneDeep(source)
      const granted = grantMap.get(menu.id)
      if (!menu.parentId && parentId) menu.parentId = parentId
      menu.buttons = cloneDeep(menu.buttons || menu.actions || [])
      delete menu.actions

      if (hasSeparateGrant) {
        menu.granted = granted ? granted.granted !== false : false
        const grantedButtons = new Map((granted?.buttons || granted?.actions || []).map(button => [button.id, button]))
        menu.buttons.forEach(button => {
          const grantedButton = grantedButtons.get(button.id)
          button.granted = grantedButton ? grantedButton.granted !== false : false
        })
        if (granted?.assetAccesses?.length) {
          const grantedAccesses = new Map(granted.assetAccesses.map(access => [
            `${valueOf(access.assetType)}:${supportIdOf(access)}`,
            access,
          ]))
          const sourceAccesses = menu.assetAccesses || []
          sourceAccesses.forEach(access => {
            const key = `${valueOf(access.assetType)}:${supportIdOf(access)}`
            access.granted = grantedAccesses.get(key)?.granted === true
          })
          granted.assetAccesses.forEach(access => {
            const key = `${valueOf(access.assetType)}:${supportIdOf(access)}`
            if (!sourceAccesses.some(item => `${valueOf(item.assetType)}:${supportIdOf(item)}` === key)) {
              sourceAccesses.push(cloneDeep(access))
            }
          })
          menu.assetAccesses = sourceAccesses
        }
      } else {
        menu.granted = !!menu.granted
        menu.buttons.forEach(button => button.granted = !!button.granted)
      }

      const children = visit(menu.children || [], menu.id)
      menu.children = children.length ? children : null
      return menu
    })
    return visit(menus)
  }

  const rebuildAssetDefinitions = (input: MenuAssetPermissionResetOptions) => {
    assetDefinitions.clear()
    assetNames.clear()
    ;(input.assetTypes || []).forEach(type => assetNames.set(String(type.id), String(type.name || type.id)))
    const hasGrantableScope = input.grantableAssets !== undefined
    const grantableMap = new Map<string, GrantableAssetType>()
    ;(input.grantableAssets || []).forEach(asset => grantableMap.set(String(asset.assetType), asset))

    flatMenus.value.forEach(menu => {
      const types = getMenuPermissionAssetTypes(menu)
      types.forEach(assetType => {
        if (!assetDefinitions.has(assetType)) {
          const grantable = grantableMap.get(assetType)
          assetDefinitions.set(assetType, {
            assetType,
            name: grantable?.name,
            menuName: String(menu.i18nName || menu.name || ''),
            accesses: new Map(),
          })
        }
        const definition = assetDefinitions.get(assetType)!
        ;(menu.assetAccesses || []).forEach(access => {
          const accessType = valueOf(access.assetType)
          if (accessType && accessType !== assetType) return
          const supportId = supportIdOf(access)
          if (!supportId) return
          const existing = definition.accesses.get(supportId)
          const grantable = grantableMap
            .get(assetType)
            ?.accesses
            .find(item => String(item.supportId) === supportId)
          // detail 返回完整候选集；grantable 只决定当前赋权人能否选择，不能把候选及其名称从回显中删除。
          definition.accesses.set(supportId, {
            ...existing,
            ...access,
            ...grantable,
            supportId,
            name: grantable?.name || existing?.name || supportNameOf(access),
            disabled: hasGrantableScope
              ? !grantable || grantable.disabled === true
              : access.disabled === true,
          })
        })

        // 兼容尚未在 detail 中铺开候选项的旧后端，仅在该资产没有菜单候选时回退到 grantable。
        if (!definition.accesses.size) {
          ;(grantableMap.get(assetType)?.accesses || []).forEach(access => {
            const supportId = String(access.supportId)
            definition.accesses.set(supportId, { ...access, supportId })
          })
        }
      })
    })

    grantableMap.forEach((asset, assetType) => {
      if (!assetDefinitions.has(assetType)) {
        assetDefinitions.set(assetType, {
          assetType,
          name: asset.name,
          accesses: new Map((asset.accesses || []).map(access => [String(access.supportId), access])),
        })
      }
    })
  }

  const initializeFixedScopes = (input: MenuAssetPermissionResetOptions) => {
    const source = new Map<string, Map<string, GrantableAssetSupport>>()
    const history = new Map<string, Map<string, string>>()
    const sourceMenus = flatten(input.menus)
    // AssetsHolder 的现行「全部数据」标识是 ignore；兼容目录实际返回的 all。
    const matchingIds = fixedScope === 'all' ? ['ignore', 'all'] : ['tenant', 'tenant_member']
    const recordHistory = (assetType: string, access: unknown) => {
      const id = supportIdOf(access)
      if (!id || !isFixedNotificationAsset(assetType)) return
      const labels = history.get(assetType) || new Map<string, string>()
      // 仅回显旧值，不从旧策略反推新授权的候选。
      labels.set(id, supportNameOf(source.get(assetType)?.get(id) || access))
      history.set(assetType, labels)
    }

    sourceMenus.forEach(menu => {
      getMenuPermissionAssetTypes(menu).filter(isFixedNotificationAsset).forEach(assetType => {
        const supports = source.get(assetType) || new Map<string, GrantableAssetSupport>()
        ;(menu.assetAccesses || []).forEach(access => {
          const type = valueOf(access.assetType)
          const supportId = supportIdOf(access)
          if (!supportId || (type && type !== assetType)) return
          const existing = supports.get(supportId)
          if (!existing || existing.disabled) {
            supports.set(supportId, { ...access, supportId, name: supportNameOf(access), disabled: access.disabled === true })
          }
        })
        source.set(assetType, supports)
      })
    })
    input.assetAccesses?.forEach(policy => {
      const accesses = policy.accesses?.length ? policy.accesses : [policy]
      accesses.forEach(access => recordHistory(policy.assetType, access))
    })
    const sourceById = input.grantedMenus ? new Map(sourceMenus.map(menu => [menu.id, menu])) : undefined
    const grantedMenus = input.grantedMenus ? flatten(input.grantedMenus) : sourceMenus
    grantedMenus.forEach(menu => {
      if (menu.granted === false) return
      ;(menu.assetAccesses || []).filter(access => access.granted === true).forEach(access => {
        const type = valueOf(access.assetType)
        const linked = sourceById?.get(menu.id) ?? menu
        ;(type ? [type] : getMenuPermissionAssetTypes(linked)).forEach(assetType => recordHistory(assetType, access))
      })
    })

    // 候选只取合并回显前的菜单及服务端可授权目录；存量 all 不能让新授权获得 all。
    const allowed = useDeploymentScope ? undefined : (input.fixedAssetGrantable ?? input.grantableAssets)
    const fixed = new Map<string, GrantableAssetSupport>()
    source.forEach((menuSupports, assetType) => {
      const candidates = allowed === undefined ? [...menuSupports.values()] :
        (allowed.find(asset => asset.assetType === assetType)?.accesses || [])
          .filter(access => !menuSupports.size || menuSupports.get(access.supportId)?.disabled === false)
      const previous = history.get(assetType)
      const ordered = previous?.size === 1 ? [...previous.keys(), ...matchingIds] : matchingIds
      for (const id of ordered) {
        if (!matchingIds.includes(id)) continue
        const match = candidates.find(access => access.supportId === id && !access.disabled)
        if (match) { fixed.set(assetType, match); break }
      }
      // 全局角色允许升级旧菜单；没有匹配候选时按部署补齐，保存结果由服务端裁决。
      if (useDeploymentScope && !fixed.has(assetType)) {
        fixed.set(assetType, { supportId: matchingIds[0] })
      }
    })
    fixedHistory.value = history
    fixedSupports.value = fixed
  }

  const initializeDrafts = (input: MenuAssetPermissionResetOptions) => {
    assetDrafts.clear()
    ;(input.assetAccesses || []).forEach(policy => {
      const supportId = (policy.accesses || []).map(supportIdOf).find(Boolean)
        || String((policy as any).supportId || '')
      if (policy.assetType && supportId) assetDrafts.set(String(policy.assetType), String(supportId))
    })
    flatMenus.value.forEach(menu => {
      ;(menu.assetAccesses || []).forEach(access => {
        const supportId = supportIdOf(access)
        if (!access.granted || !supportId) return
        const accessType = valueOf(access.assetType)
        const assetTypes = accessType ? [accessType] : getMenuPermissionAssetTypes(menu)
        assetTypes.forEach(assetType => {
          if (assetType && !assetDrafts.has(assetType)) assetDrafts.set(assetType, supportId)
        })
      })
    })
    ensureVisibleDrafts()
  }

  const initializeAssetOrder = (input: MenuAssetPermissionResetOptions) => {
    const menuOrder = getVisibleAssetIdsInMenuOrder()
    const visible = new Set(menuOrder)
    const savedOrder = (input.assetAccesses || [])
      .map(policy => String(policy.assetType || ''))
      .filter((assetType, index, all) => assetType && visible.has(assetType) && all.indexOf(assetType) === index)
    assetOrder.value = [...savedOrder, ...menuOrder.filter(assetType => !savedOrder.includes(assetType))]
  }

  const reset = (input: MenuAssetPermissionResetOptions) => {
    menuMap.clear()
    editableMenus.clear()
    explicitMenuGrants.clear()
    menuGroups.value = input.menuGroups
    input.menuGroups?.forEach(group => group.menus.forEach(scope => {
      const previous = editableMenus.get(scope.id)
      editableMenus.set(scope.id, { id: scope.id, buttonIds: [...new Set([...(previous?.buttonIds || []), ...scope.buttonIds])] })
    }))
    buttonBatchValues.value = []
    menuTree.value = mergeGrantedMenus(input.menus || [], input.grantedMenus)
    flatMenus.value.forEach(menu => menuMap.set(menu.id, menu))
    if (input.menuGroups) flatMenus.value.forEach(menu => {
      if (menu.granted && !(menu.buttons || []).some(button => button.granted)
        && !(menu.children || []).some(child => child.granted)) explicitMenuGrants.add(menu.id)
    })
    recomputeTree(menuTree.value)
    initializeAssetOrder(input)
    rebuildAssetDefinitions(input)
    initializeFixedScopes(input)
    initializeDrafts(input)
  }

  const getSnapshot = () => {
    const menus = selectedMenus().map(source => {
      const menu = cloneDeep(source)
      menu.granted = !!source.granted
      // 部分授权接口按 buttons 数组存在即授权，快照只提交真实勾选的按钮。
      menu.buttons = buttonsOf(source)
        .filter(button => button.granted === true)
        .map(button => ({ ...cloneDeep(button), granted: true }))
      delete menu.children
      delete menu.actions
      // 后端仍会校验已授权菜单的菜单级资产权限，独立策略提交期间需同步最小兼容字段。
      menu.assetAccesses = getMenuPermissionAssetTypes(source).flatMap(assetType => {
        const supportId = selectedSupportOf(assetType)
        return supportId ? [{ assetType, supportId, granted: true }] : []
      })
      delete menu.dataAccesses
      delete menu._granted
      delete menu.indeterminate
      delete menu.selectAccesses
      delete menu.selectAccessesByAssetType
      return menu
    })
    const assetAccesses: AssetAccessPolicy[] = visibleAssetIds().flatMap(assetType => {
      const supportId = selectedSupportOf(assetType)
      return supportId ? [{ assetType, accesses: [{ supportId }] }] : []
    })
    return { menus, assetAccesses }
  }

  const getGrantSnapshot = (currentFixedGrantable?: GrantableAssetType[]) => {
    for (const { assetType, fixedScope, selectedSupportId } of visibleAssets.value) {
      if (!fixedScope) continue
      if (!selectedSupportId) return undefined
      if (!useDeploymentScope && currentFixedGrantable && !currentFixedGrantable.find(type => type.assetType === assetType)
        ?.accesses.some(access => access.supportId === selectedSupportId && !access.disabled)) return undefined
    }
    return getSnapshot()
  }

  return {
    menuTree,
    flatMenus,
    ownerGroups,
    fixedScopeAsRadio: useDeploymentScope,
    showMenuGroups: computed(() => menuGroups.value !== undefined),
    visibleAssets,
    batchAssetOptions,
    batchAssetValue,
    actionOptions,
    buttonBatchValues,
    loading,
    reset,
    toggleMenu,
    toggleButton,
    setMenusChecked,
    getActionOptions,
    applyButtonBatch,
    setAssetAccess,
    applyAssetBatch,
    getSelectionState,
    isProtectedMenu,
    isProtectedButton,
    getSnapshot,
    getGrantSnapshot,
  }
}

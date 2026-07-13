import { cloneDeep } from 'lodash-es'
import { computed, reactive, ref } from 'vue'
import type {
  AssetAccessPolicy,
  GrantableAssetSupport,
  GrantableAssetType,
  MenuAssetPermissionEditorContext,
  MenuAssetPermissionResetOptions,
  MenuPermissionButton,
  MenuPermissionNode,
  SelectionState,
} from './menuAssetPermissionEditor.types'

interface EditorOptions {
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

const flatten = (menus: MenuPermissionNode[] = []) => {
  const result: MenuPermissionNode[] = []
  const visit = (items: MenuPermissionNode[]) => items.forEach(item => {
    result.push(item)
    visit(item.children || [])
  })
  visit(menus)
  return result
}

export const useMenuAssetPermissionEditor = (options: EditorOptions = {}): MenuAssetPermissionEditorContext => {
  const defaultSupportIds = options.defaultSupportIds || ['creator']
  const protectedButtonId = options.protectedButtonId || 'view'
  const menuTree = ref<MenuPermissionNode[]>([])
  const buttonBatchValues = ref<string[]>([])
  const loading = ref(false)
  const menuMap = new Map<string, MenuPermissionNode>()
  const assetDefinitions = reactive(new Map<string, AssetDefinition>())
  const assetNames = reactive(new Map<string, string>())
  const assetDrafts = reactive(new Map<string, string>())
  const assetOrder = ref<string[]>([])

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
      menu.granted = all || some
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
      if (!assetDrafts.has(assetType)) {
        const supportId = getDefaultSupport(assetType)
        if (supportId) assetDrafts.set(assetType, supportId)
      }
    })
  }

  const toggleMenu = (menu: MenuPermissionNode, checked: boolean) => {
    if (isProtectedMenu(menu) && !checked) return
    const previousVisible = new Set(visibleAssetIds())
    setNodeState(menu, checked)
    recomputeAncestors(menu.parentId)
    buttonBatchValues.value = []
    if (checked) prependNewlyVisibleAssets(previousVisible, [menu])
    ensureVisibleDrafts()
  }

  const toggleButton = (menu: MenuPermissionNode, button: MenuPermissionButton, checked: boolean) => {
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
    menus.forEach(menu => setNodeState(menu, checked))
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
    const targetMenus = Array.from(new Map(flatten(menus).map(menu => [menu.id, menu])).values())
    targetMenus.forEach(menu => buttonsOf(menu).forEach(button => {
      button.granted = isProtectedButton(menu, button) || selected.has(button.id)
    }))
    recomputeTree(menuTree.value)
    buttonBatchValues.value = [...selected]
    prependNewlyVisibleAssets(previousVisible, targetMenus)
    ensureVisibleDrafts()
  }

  const ownerGroups = computed(() => {
    const groups = new Map<string, MenuPermissionNode[]>()
    menuTree.value.forEach(menu => {
      const owner = String(menu.owner || 'default')
      if (!groups.has(owner)) groups.set(owner, [])
      groups.get(owner)!.push(menu)
    })
    return Array.from(groups.entries()).map(([key, menus]) => ({ key, label: key, menus }))
  })

  const visibleAssets = computed(() => visibleAssetIds().map(assetType => {
    const definition = assetDefinitions.get(assetType)
    const accesses = Array.from(definition?.accesses.values() || []).map(item => ({ ...item }))
    const selectedSupportId = assetDrafts.get(assetType)
    if (selectedSupportId && !accesses.some(item => item.supportId === selectedSupportId)) {
      accesses.push({ supportId: selectedSupportId, name: selectedSupportId, disabled: true })
    }
    return {
      assetType,
      name: assetNames.get(assetType) || definition?.name || definition?.menuName || assetType,
      accesses,
      selectedSupportId,
    }
  }))

  const batchAssetOptions = computed(() => {
    if (!visibleAssets.value.length) return []
    const supportSets = visibleAssets.value.map(asset => new Set(
      asset.accesses.filter(item => !item.disabled).map(item => item.supportId)
    ))
    if (supportSets.some(set => !set.size)) return []
    return visibleAssets.value[0].accesses
      .filter(item => !item.disabled && supportSets.every(set => set.has(item.supportId)))
      .map(item => ({ label: item.i18nName || item.name || item.supportId, value: item.supportId }))
  })

  const batchAssetValue = computed(() => {
    const values = Array.from(new Set(visibleAssets.value.map(item => item.selectedSupportId).filter(Boolean)))
    if (values.length !== 1) return undefined
    return batchAssetOptions.value.some(item => item.value === values[0]) ? values[0] : undefined
  })

  const setAssetAccess = (assetType: string, supportId?: string) => {
    if (supportId) assetDrafts.set(assetType, supportId)
  }

  const applyAssetBatch = (supportId?: string) => {
    if (!supportId || !batchAssetOptions.value.some(item => item.value === supportId)) return
    visibleAssets.value.forEach(asset => assetDrafts.set(asset.assetType, supportId))
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
    const authoritative = input.grantableAssets !== undefined
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
            accesses: new Map((grantable?.accesses || []).map(access => [String(access.supportId), {
              ...access,
              supportId: String(access.supportId),
            }])),
          })
        }
        const definition = assetDefinitions.get(assetType)!
        ;(menu.assetAccesses || []).forEach(access => {
          const accessType = valueOf(access.assetType)
          if (accessType && accessType !== assetType) return
          const supportId = supportIdOf(access)
          if (!supportId) return
          const existing = definition.accesses.get(supportId)
          if (!authoritative || existing) {
            definition.accesses.set(supportId, {
              ...access,
              ...existing,
              supportId,
              name: existing?.name || supportNameOf(access),
            })
          }
        })
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
    buttonBatchValues.value = []
    menuTree.value = mergeGrantedMenus(input.menus || [], input.grantedMenus)
    flatMenus.value.forEach(menu => menuMap.set(menu.id, menu))
    recomputeTree(menuTree.value)
    initializeAssetOrder(input)
    rebuildAssetDefinitions(input)
    initializeDrafts(input)
  }

  const getSnapshot = () => {
    const menus = flatMenus.value.map(source => {
      const menu = cloneDeep(source)
      menu.granted = !!source.granted
      menu.buttons = buttonsOf(source).map(button => ({ ...cloneDeep(button), granted: !!button.granted }))
      delete menu.children
      delete menu.actions
      delete menu.assetAccesses
      delete menu.dataAccesses
      delete menu._granted
      delete menu.indeterminate
      delete menu.selectAccesses
      delete menu.selectAccessesByAssetType
      return menu
    })
    const assetAccesses: AssetAccessPolicy[] = visibleAssetIds().flatMap(assetType => {
      const supportId = assetDrafts.get(assetType)
      return supportId ? [{ assetType, accesses: [{ supportId }] }] : []
    })
    return { menus, assetAccesses }
  }

  return {
    menuTree,
    flatMenus,
    ownerGroups,
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
  }
}

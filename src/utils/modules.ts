import type { BaseMenuExport, MenuItem, ModuleExport, ResolvedModuleExport } from '@jetlinks-web-core/types/module'

type ModuleGlobMap = Record<string, ModuleExport>
type FilterableModuleExport = {
  default?: {
    filter?: boolean
  }
}
type BaseMenuModule = {
  default?: BaseMenuExport
}

const isFilterModule = (item?: FilterableModuleExport) => {
  return !item?.default || item.default.filter === true
}

const resolveBaseMenus = (baseMenuItem?: BaseMenuModule): MenuItem[] => {
  const menuExport = baseMenuItem?.default
  if (!menuExport) {
    return []
  }

  if (typeof menuExport === 'function') {
    const menus = menuExport()
    return Array.isArray(menus) ? menus : menus ? [menus] : []
  }

  if (Array.isArray(menuExport)) {
    return menuExport
  }

  return [menuExport]
}

const getSortModules = (): ResolvedModuleExport[] => {
  const modulesFiles = import.meta.glob('../../../modules/*/index.ts', {eager: true}) as ModuleGlobMap
  return Object.keys(modulesFiles).sort((a, b) => {
    const itemA = modulesFiles[a].default
    const itemB = modulesFiles[b].default
    const priorityA = itemA?.priority || 0
    const priorityB = itemB?.priority || 0
    return priorityA - priorityB
  }).map(key => ({
    key,
    name: key.replace('../../../modules/', '').replace('/index.ts', ''),
    ...modulesFiles[key]
  })).filter((item): item is ResolvedModuleExport => !!item.default)
}

export const modules = () => {
  const modulesMap: Record<string, ResolvedModuleExport> = {}
  const modulesFiles = getSortModules()
  modulesFiles.forEach((item) => {
    if (!isFilterModule(item)) {
      modulesMap[item.key] = item
    }
  })
  return modulesMap
}

export const getModulesMenu = () => {
  const modulesDefaultFiles = getSortModules()
  const modulesFiles = import.meta.glob('../../../modules/*/baseMenu.ts', {eager: true}) as Record<string, BaseMenuModule>
  const menus: MenuItem[] = []

  modulesDefaultFiles.forEach((item) => {
      const defaultName = item.name
      const key = `../../../modules/${defaultName}/baseMenu.ts`
      const baseMenuItem = modulesFiles[key]
      if (baseMenuItem?.default) {
        menus.push(...resolveBaseMenus(baseMenuItem))
      }
  })

  return menus
}

export const registerModule = () => {
  const modulesFiles = getSortModules()
  modulesFiles.forEach((item) => {
    if (!isFilterModule(item)) {
      item.default.register?.()
    }
  })
}

export const getModulesInitPage = () => {
  const modulesFiles = getSortModules()
  let initPage: unknown
  modulesFiles.forEach((item) => {
    if (!isFilterModule(item)) {
      const page = item.default.initPage?.()
      if (page) {
        initPage = page
      }
    }
  })

  return initPage
}

export const getHideHeaderRightConfig = () => {
  const modulesFiles = getSortModules()
  let hideHeaderRight = false;
  modulesFiles.forEach((item) => {
    if (!isFilterModule(item)) {
      hideHeaderRight = item.default.getConfig?.()?.hideHeaderRight ?? false
    }
  })
  return hideHeaderRight
}

export const getPackageConfig = () => {
  const modulesFiles = getSortModules()
  let packageConfig: unknown
  modulesFiles.forEach((item) => {
    if (!isFilterModule(item)) {
      const config = item.default.getConfig?.()
      if (config) {
        packageConfig = config
      }
    }
  })
  return packageConfig
}

const isFilterModule = (item) => {
  return item && item.default.filter === true
}

export const modules = () => {
  const modulesMap = {}
  const modulesFiles = import.meta.glob('../../../modules/*/index.ts', {eager: true})
  Object.keys(modulesFiles).forEach((key: any) => {
    const item = modulesFiles[key]
    if (!isFilterModule(item)) {
      modulesMap[key] = item
    }
  })
  return modulesMap
}

export const getModulesMenu = () => {
  const modulesFiles = import.meta.glob('../../../modules/*/baseMenu.ts', {eager: true})
  const menus: any[] = []

  Object.values(modulesFiles).forEach((item: any) => {
    if (!isFilterModule(item)) {
      menus.push(...item.default?.())
    }
  })

  return menus
}

export const registerModule = () => {
  const modulesFiles = import.meta.glob('../../../modules/*/index.ts', {eager: true})
  Object.values(modulesFiles).forEach((item: any ) => {
    if (!isFilterModule(item)) {
      item.default.register?.()
    }
  })
}

export const getModulesInitPage = () => {
  const modulesFiles = import.meta.glob('../../../modules/*/index.ts', {eager: true})
  let initPage
  Object.values(modulesFiles).forEach((item: any) => {
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
  const modulesFiles = import.meta.glob('../../../modules/*/index.ts', {eager: true})
  let hideHeaderRight;
  Object.values(modulesFiles).forEach((item: any) => {
    if (!isFilterModule(item)) {
      const config = item.default.getConfig?.()?.hideHeaderRight
      if (config) {
        hideHeaderRight = config
      }
    }
  })
  return hideHeaderRight
}

export const getPackageConfig = () => {
  const modulesFiles = import.meta.glob('../../../modules/*/index.ts', {eager: true})
  let packageConfig
  Object.values(modulesFiles).forEach((item: any) => {
    if (!isFilterModule(item)) {
      const config = item.default.getConfig?.()
      if (config) {
        packageConfig = config
      }
    }
  })
  return packageConfig
}

import { modules } from '@jetlinks-web-core/utils/modules'
import type {
  MenuFilterContext,
  MenuFilterDefinition,
  MenuItem,
} from '@jetlinks-web-core/types/module'

type ResolvedMenuFilterDefinition = MenuFilterDefinition & {
  moduleName: string
}

const normalizeMenuFilters = (
  moduleName: string,
  filters: MenuFilterDefinition[] = [],
): ResolvedMenuFilterDefinition[] => filters
  .filter((item): item is MenuFilterDefinition => (
    !!item
    && typeof item.code === 'string'
    && typeof item.filter === 'function'
  ))
  .map(item => ({
    ...item,
    moduleName,
  }))

export const getModuleMenuFilters = () => {
  const menuFilters: ResolvedMenuFilterDefinition[] = []

  Object.values(modules()).forEach((item) => {
    menuFilters.push(...normalizeMenuFilters(
      item.name,
      item.default.getMenuFilters?.() || [],
    ))
  })

  return menuFilters.sort((a, b) => (a.order || 0) - (b.order || 0))
}

/**
 * Client-side menu filters only prune the menu tree before route generation;
 * backend user-owned menus and permissions remain the authority.
 */
export const applyModuleMenuFilters = async (
  menus: MenuItem[],
  context: MenuFilterContext,
) => {
  let filteredMenus = menus

  for (const definition of getModuleMenuFilters()) {
    try {
      const result = await definition.filter(filteredMenus, context)
      if (Array.isArray(result)) {
        filteredMenus = result
      }
    } catch (error) {
      console.warn(
        `[Menu Filter] Skip "${definition.moduleName}:${definition.code}" because it failed.`,
        error,
      )
    }
  }

  return filteredMenus
}

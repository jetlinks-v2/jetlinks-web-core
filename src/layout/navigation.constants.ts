export const PROJECT_SETTINGS_MENU_CODE = 'system'
export const PROJECT_SETTINGS_ROUTE_NAME = 'midhub/settings'

export const PROJECT_SECONDARY_MENU_REGISTRY_PAGE = 'project-secondary-menu'

export const getProjectSecondaryMenuRegistryKey = (targetCode: string) => {
  return `${PROJECT_SECONDARY_MENU_REGISTRY_PAGE}:${targetCode}`
}

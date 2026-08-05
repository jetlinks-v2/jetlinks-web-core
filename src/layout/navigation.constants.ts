export const PROJECT_SETTINGS_MENU_CODE = 'project/Settings'
export const PROJECT_PERSON_CENTER_MENU_CODE = 'project/PersonCenter'

export const PROJECT_SECONDARY_MENU_REGISTRY_PAGE = 'project-secondary-menu'

export const getProjectSecondaryMenuRegistryKey = (targetCode: string) => {
  return `${PROJECT_SECONDARY_MENU_REGISTRY_PAGE}:${targetCode}`
}

export type LocaleMessages = Record<string, string>

export type MenuI18nMessages = Record<string, string | LocaleMessages | undefined> & {
  name?: LocaleMessages
}

export type MenuButton = {
  permissions?: Array<{
    permission: string
  }>
}

export type MenuItem = {
  id?: string
  code?: string
  name?: string
  i18nName?: string
  sortIndex?: number | string
  i18nMessages?: MenuI18nMessages
  showPage?: string[]
  buttons?: MenuButton[]
  children?: MenuItem[]
  options?: {
    hasProtocol?: boolean
    show?: boolean
  }
  owner?: string
}

export type MenuTreeNode = {
  key: string
  title: string
  children?: MenuTreeNode[]
}

export type MenuFilter = (menus: MenuItem[]) => MenuItem[] | Promise<MenuItem[]>

export const getLocaleKeys = (locale: string) => {
  const current = locale.replace('-', '_')

  return current.startsWith('en')
    ? [current, 'en_US', 'en', 'zh_CN', 'zh']
    : [current, 'zh_CN', 'zh', 'en_US', 'en']
}

export const resolveMenuTitle = (item: MenuItem, localeKeys: string[]) => {
  const messages = item.i18nMessages || {}
  const nameMessages = typeof messages.name === 'object' && messages.name ? messages.name : messages
  const localeTitle = localeKeys
    .map(key => nameMessages[key])
    .find((value): value is string => typeof value === 'string')

  return item.i18nName || localeTitle || item.name || item.code || ''
}

export const buildMenuTreeData = (
  menus: MenuItem[] = [],
  localeKeys: string[],
  parentKey = '',
): MenuTreeNode[] => {
  return menus.map((item, index) => {
    const rawKey = item.code || item.id || item.name || String(index)
    const key = parentKey ? `${parentKey}/${rawKey}` : rawKey
    const children = item.children?.length
      ? buildMenuTreeData(item.children, localeKeys, key)
      : undefined

    return {
      key,
      title: resolveMenuTitle(item, localeKeys),
      children,
    }
  })
}

export const collectExpandedKeys = (tree: MenuTreeNode[], level = 1): string[] => {
  return tree.reduce<string[]>((keys, item) => {
    if (item.children?.length && level < 3) {
      keys.push(item.key, ...collectExpandedKeys(item.children, level + 1))
    }

    return keys
  }, [])
}

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
  id: string
  title: string
  children?: MenuTreeNode[]
}

export type MenuFilter = (menus: MenuItem[]) => MenuItem[] | Promise<MenuItem[]>


export const collectExpandedKeys = (tree: MenuTreeNode[], level = 1): string[] => {
  return tree.reduce<string[]>((keys, item) => {
    if (item.children?.length && level < 3) {
      keys.push(item.id, ...collectExpandedKeys(item.children, level + 1))
    }

    return keys
  }, [])
}

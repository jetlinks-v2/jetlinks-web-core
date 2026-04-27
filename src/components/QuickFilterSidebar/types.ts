import type { ConditionFilterField, ConditionFilterTerm } from '../ConditionFilter'

export type QuickFilterSidebarValue = string | number | boolean | null | undefined

export type QuickFilterSidebarAction = {
  key?: string
  label?: string
  icon?: string
  tooltip?: string
  disabled?: boolean
  danger?: boolean
}

export type QuickFilterSidebarItem = {
  key?: string | number
  label: string
  value?: QuickFilterSidebarValue
  tooltip?: string
  icon?: string
  description?: string
  meta?: string
  payload?: unknown
  disabled?: boolean
  active?: boolean
  action?: QuickFilterSidebarAction
  actions?: QuickFilterSidebarAction[]
  shortcut?: QuickFilterSidebarShortcut
}

export type QuickFilterSidebarSection = {
  key: string
  title: string
  items?: QuickFilterSidebarItem[]
  activeValue?: QuickFilterSidebarValue
  activeValues?: QuickFilterSidebarValue[]
  emptyText?: string
  allOption?: QuickFilterSidebarItem
  collapsible?: boolean
  extraAction?: QuickFilterSidebarAction
  extraActions?: QuickFilterSidebarAction[]
}

export type QuickFilterSidebarTerm = ConditionFilterTerm

export type QuickFilterSidebarField = ConditionFilterField

export type QuickFilterSidebarShortcut = {
  terms?: ConditionFilterTerm[]
  removeColumns?: string[]
}

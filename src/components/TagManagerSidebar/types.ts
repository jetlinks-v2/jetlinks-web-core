export type TagManagerSidebarCategoryItem = {
  id: string
  name: string
  code?: string
  description?: string
  icon?: string
  parentId?: string
  sortIndex?: number
  children?: TagManagerSidebarCategoryItem[]
}

export type TagManagerSidebarTagItem = {
  id: string
  name: string
  categoryId: string
  description?: string
  icon?: string
  parentId?: string
  sortIndex?: number
  state?: any
  children?: TagManagerSidebarTagItem[]
}

export type TagManagerSidebarCategoryPayload = Partial<TagManagerSidebarCategoryItem> & {
  name: string
  code?: string
}

export type TagManagerSidebarTagPayload = Partial<TagManagerSidebarTagItem> & {
  name: string
  categoryId: string
}

export type TagManagerSidebarClient = {
  queryCategories: () => Promise<any>
  queryTags: (categoryId: string) => Promise<any>
  saveCategory: (payload: TagManagerSidebarCategoryPayload) => Promise<any>
  updateCategory: (payload: TagManagerSidebarCategoryPayload) => Promise<any>
  deleteCategory: (id: string) => Promise<any>
  saveTag: (payload: TagManagerSidebarTagPayload) => Promise<any>
  updateTag: (payload: TagManagerSidebarTagPayload) => Promise<any>
  deleteTag: (id: string) => Promise<any>
}

export type TagManagerSidebarTexts = {
  tags: string
  selectedTags: string
  clearSelectedTags: string
  edit: string
  finishEdit: string
  dragSort: string
  addCategory: string
  editCategory: string
  deleteCategory: string
  emptyTags: string
  emptyTagCategory: string
  categoryName: string
  categoryNamePlaceholder: string
  categoryNameRequired: string
  categoryCode: string
  categoryCodePlaceholder: string
  categoryCodeRequired: string
  categoryCodeMaxLength: string
  addTag: string
  editTag: string
  deleteTag: string
  tagName: string
  tagNamePlaceholder: string
  tagNameRequired: string
  tagCategory: string
  tagCategoryPlaceholder: string
  tagCategoryRequired: string
  state: string
  enabled: string
  disabled: string
  icon: string
  codeFormat: string
  success: string
  confirmDeleteCategory: string
  confirmDeleteTag: string
}

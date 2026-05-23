<template>
  <a-card class="tag-manager-sidebar" :bordered="false">
    <template #title>
      <div class="tag-manager-sidebar__title">
        <span>{{ mergedTexts.tags }}</span>
      </div>
    </template>
    <template #extra>
      <div class="tag-manager-sidebar__header-actions">
        <div
          v-if="selectedTagItems.length"
          class="tag-manager-sidebar__selected-summary"
        >
          <a-tooltip :title="selectedTagTooltip">
            <button type="button" class="tag-manager-sidebar__selected-trigger">
              <span>{{ mergedTexts.selectedTags }}</span>
              <span class="tag-manager-sidebar__selected-trigger-count">
                {{ selectedTagItems.length }}
              </span>
            </button>
          </a-tooltip>
          <a-button type="link" size="small" @click="clearSelectedTagIds">
            {{ mergedTexts.clearSelectedTags }}
          </a-button>
        </div>

        <template v-if="!editing">
          <j-permission-button
            v-if="permission"
            :hasPermission="updatePermission"
            size="small"
            @click="enterEditMode"
          >
            <AIcon type="EditOutlined" />
            {{ mergedTexts.edit }}
          </j-permission-button>
          <a-button v-else size="small" @click="enterEditMode">
            <AIcon type="EditOutlined" />
            {{ mergedTexts.edit }}
          </a-button>
        </template>
        <a-button v-else size="small" @click="exitEditMode">
          <AIcon type="CheckOutlined" />
          {{ mergedTexts.finishEdit }}
        </a-button>
      </div>
    </template>

    <a-spin :spinning="loading || sorting">
      <div v-if="categoryGroups.length" class="tag-manager-sidebar__group-list">
        <section
          v-for="group in categoryGroups"
          :key="group.id"
          class="tag-manager-sidebar__group"
          :class="{
            'tag-manager-sidebar__group--dragging': draggingCategoryId === group.id,
            'tag-manager-sidebar__group--drag-over': dragOverCategoryId === group.id,
          }"
          @dragover.prevent="handleCategoryDragOver(group.id)"
          @dragleave="handleCategoryDragLeave(group.id)"
          @drop.prevent="handleCategoryDrop(group.id)"
        >
          <div class="tag-manager-sidebar__group-header">
            <div class="tag-manager-sidebar__group-title">
              <IconValueView
                class="tag-manager-sidebar__group-icon"
                :value="group.icon"
                :size="20"
                :border-radius="6"
                :fallback-text="group.name"
              />
              <span
                v-if="editing"
                class="tag-manager-sidebar__drag-handle"
                :title="mergedTexts.dragSort"
                draggable="true"
                @dragstart.stop="handleCategoryDragStart($event, group.id)"
                @dragend.stop="handleCategoryDragEnd"
              >
                <AIcon type="HolderOutlined" />
              </span>
              <span class="tag-manager-sidebar__group-name">{{ group.name }}</span>
              <span class="tag-manager-sidebar__group-count">{{ group.tags.length }}</span>
            </div>
            <div class="tag-manager-sidebar__group-line" />
            <a-space v-if="editing" :size="4">
              <a-tooltip :title="mergedTexts.editCategory">
                <j-permission-button
                  v-if="permission"
                  :hasPermission="updatePermission"
                  type="text"
                  size="small"
                  @click="openCategoryDialog('edit', group)"
                >
                  <AIcon type="EditOutlined" />
                </j-permission-button>
                <a-button
                  v-else
                  type="text"
                  size="small"
                  @click="openCategoryDialog('edit', group)"
                >
                  <AIcon type="EditOutlined" />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="mergedTexts.deleteCategory">
                <j-permission-button
                  v-if="permission"
                  :hasPermission="deletePermission"
                  type="text"
                  size="small"
                  danger
                  @click="handleDeleteCategory(group)"
                >
                  <AIcon type="DeleteOutlined" />
                </j-permission-button>
                <a-button
                  v-else
                  type="text"
                  size="small"
                  danger
                  @click="handleDeleteCategory(group)"
                >
                  <AIcon type="DeleteOutlined" />
                </a-button>
              </a-tooltip>
            </a-space>
          </div>

          <div class="tag-manager-sidebar__group-content">
            <div v-if="group.tags.length || editing" class="tag-manager-sidebar__tag-list">
              <button
                v-for="tag in group.tags"
                :key="tag.id"
                type="button"
                class="tag-manager-sidebar__tag-chip"
                :class="getTagChipClass(group.id, tag)"
                @dragover.prevent="handleTagDragOver(group.id, tag.id)"
                @dragleave="handleTagDragLeave(group.id, tag.id)"
                @drop.prevent="handleTagDrop(group.id, tag.id)"
                @click="handleTagClick(tag)"
              >
                <span
                  v-if="editing"
                  class="tag-manager-sidebar__drag-handle tag-manager-sidebar__drag-handle--tag"
                  :title="mergedTexts.dragSort"
                  draggable="true"
                  @click.stop.prevent
                  @dragstart.stop="handleTagDragStart($event, group.id, tag.id)"
                  @dragend.stop="handleTagDragEnd"
                >
                  <AIcon type="HolderOutlined" />
                </span>
                <IconValueView
                  class="tag-manager-sidebar__tag-icon"
                  :value="tag.icon"
                  :size="18"
                  :border-radius="5"
                  :fallback-text="tag.name"
                />
                <span>{{ tag.name }}</span>
                <span
                  v-if="editing"
                  class="tag-manager-sidebar__tag-action"
                  @click.stop="handleDeleteTag(tag)"
                >
                  <AIcon type="DeleteOutlined" />
                </span>
              </button>

              <button
                v-if="editing"
                type="button"
                class="tag-manager-sidebar__tag-chip tag-manager-sidebar__tag-chip--add"
                @click="openTagDialog('add', undefined, group.id)"
              >
                <AIcon type="PlusOutlined" />
              </button>
            </div>
            <div v-else class="tag-manager-sidebar__group-empty">
              {{ mergedTexts.emptyTags }}
            </div>
          </div>
        </section>
      </div>
      <CloudEmpty
        v-else
        :description="mergedTexts.emptyTagCategory"
      />

      <button
        v-if="editing"
        type="button"
        class="tag-manager-sidebar__add-bar"
        :title="mergedTexts.addCategory"
        @click="openCategoryDialog('add')"
      >
        <AIcon type="PlusOutlined" />
        <span>{{ mergedTexts.addCategory }}</span>
      </button>
    </a-spin>
  </a-card>

  <a-modal
    v-model:open="categoryDialog.visible"
    :title="categoryDialogTitle"
    :confirm-loading="categorySubmitting"
    destroy-on-close
    @ok="submitCategory"
  >
    <a-form ref="categoryFormRef" layout="vertical" :model="categoryForm" :rules="categoryRules">
      <a-form-item :label="mergedTexts.categoryName" name="name">
        <a-input
          v-model:value="categoryForm.name"
          :placeholder="mergedTexts.categoryNamePlaceholder"
        />
      </a-form-item>
      <a-form-item :label="mergedTexts.categoryCode" name="code">
        <a-input
          v-model:value="categoryForm.code"
          :placeholder="mergedTexts.categoryCodePlaceholder"
        />
      </a-form-item>
      <a-form-item :label="mergedTexts.icon" name="icon">
        <IconValueEditor
          v-model="categoryForm.icon"
          :preview-size="48"
          :preview-fallback="categoryForm.name || categoryForm.code"
        />
      </a-form-item>
    </a-form>
  </a-modal>

  <a-modal
    v-model:open="tagDialog.visible"
    :title="tagDialogTitle"
    :confirm-loading="tagSubmitting"
    destroy-on-close
    @ok="submitTag"
  >
    <a-form ref="tagFormRef" layout="vertical" :model="tagForm" :rules="tagRules">
      <a-form-item :label="mergedTexts.tagName" name="name">
        <a-input
          v-model:value="tagForm.name"
          :placeholder="mergedTexts.tagNamePlaceholder"
        />
      </a-form-item>
      <a-form-item :label="mergedTexts.tagCategory" name="categoryId">
        <a-select
          v-model:value="tagForm.categoryId"
          show-search
          option-filter-prop="label"
          :options="categoryOptions"
          :placeholder="mergedTexts.tagCategoryPlaceholder"
        />
      </a-form-item>
      <a-form-item :label="mergedTexts.state" name="state">
        <a-select v-model:value="tagForm.state">
          <a-select-option value="enabled">{{ mergedTexts.enabled }}</a-select-option>
          <a-select-option value="disabled">{{ mergedTexts.disabled }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="mergedTexts.icon" name="icon">
        <IconValueEditor
          v-model="tagForm.icon"
          :preview-size="48"
          :preview-fallback="tagForm.name"
        />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { PropType } from 'vue'
import type { FormInstance } from 'ant-design-vue'
import { Modal } from 'ant-design-vue'
import { onlyMessage } from '@jetlinks-web/utils'
import { IconValueEditor, IconValueView } from '@jetlinks-web-core/components/IconValue'
import type {
  TagManagerSidebarCategoryItem,
  TagManagerSidebarClient,
  TagManagerSidebarTagItem,
  TagManagerSidebarTexts,
} from './types'

const DEFAULT_TEXTS: TagManagerSidebarTexts = {
  tags: '标签',
  selectedTags: '已选标签',
  clearSelectedTags: '清空',
  edit: '编辑',
  finishEdit: '完成',
  dragSort: '拖动排序',
  addCategory: '新增分类',
  editCategory: '编辑分类',
  deleteCategory: '删除分类',
  emptyTags: '暂无标签',
  emptyTagCategory: '暂无标签分类',
  categoryName: '分类名称',
  categoryNamePlaceholder: '请输入分类名称',
  categoryNameRequired: '请输入分类名称',
  categoryCode: '分类编码',
  categoryCodePlaceholder: '请输入分类编码',
  categoryCodeRequired: '请输入分类编码',
  categoryCodeMaxLength: '分类编码最多64个字符',
  addTag: '新增标签',
  editTag: '编辑标签',
  deleteTag: '删除标签',
  tagName: '标签名称',
  tagNamePlaceholder: '请输入标签名称',
  tagNameRequired: '请输入标签名称',
  tagCategory: '所属分类',
  tagCategoryPlaceholder: '请选择所属分类',
  tagCategoryRequired: '请选择所属分类',
  state: '状态',
  enabled: '启用',
  disabled: '禁用',
  icon: '图标',
  codeFormat: '编码只能包含字母、数字、下划线和中划线',
  success: '操作成功',
  confirmDeleteCategory: '确认删除分类“{0}”？',
  confirmDeleteTag: '确认删除标签“{0}”？',
}

const props = defineProps({
  selectedTagIds: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  permission: {
    type: String,
    default: '',
  },
  client: {
    type: Object as PropType<TagManagerSidebarClient>,
    required: true,
  },
  texts: {
    type: Object as PropType<Partial<TagManagerSidebarTexts>>,
    default: () => ({}),
  },
})

const emit = defineEmits(['update:selectedTagIds', 'change', 'refresh'])

const loading = ref(false)
const sorting = ref(false)
const editing = ref(false)
const categories = ref<TagManagerSidebarCategoryItem[]>([])
const tagMap = ref<Record<string, TagManagerSidebarTagItem[]>>({})
const draggingCategoryId = ref('')
const dragOverCategoryId = ref('')
const draggingTagCategoryId = ref('')
const draggingTagId = ref('')
const dragOverTagCategoryId = ref('')
const dragOverTagId = ref('')

const categoryFormRef = ref<FormInstance>()
const tagFormRef = ref<FormInstance>()
const categorySubmitting = ref(false)
const tagSubmitting = ref(false)

const mergedTexts = computed(() => ({
  ...DEFAULT_TEXTS,
  ...(props.texts || {}),
}))

const updatePermission = computed(() => (props.permission ? `${props.permission}:update` : ''))
const deletePermission = computed(() => (props.permission ? `${props.permission}:delete` : ''))
const permission = computed(() => props.permission)

const selectedTagIds = computed({
  get: () => props.selectedTagIds || [],
  set: (value: string[]) => emit('update:selectedTagIds', value),
})

const allTags = computed(() => {
  const result: TagManagerSidebarTagItem[] = []
  const existed = new Set<string>()

  categories.value.forEach((category) => {
    ;(tagMap.value[category.id] || []).forEach((tag) => {
      if (!existed.has(tag.id)) {
        existed.add(tag.id)
        result.push(tag)
      }
    })
  })

  return result
})

const categoryGroups = computed(() =>
  categories.value.map((category) => ({
    ...category,
    tags: tagMap.value[category.id] || [],
  })),
)

const selectedTagItems = computed(() => {
  const tagMapById = allTags.value.reduce<Record<string, TagManagerSidebarTagItem>>((acc, item) => {
    acc[item.id] = item
    return acc
  }, {})

  return selectedTagIds.value
    .map((id) => tagMapById[id])
    .filter(Boolean)
})

const selectedTagTooltip = computed(() =>
  selectedTagItems.value.map((item) => item.name).join('、'),
)

const categoryOptions = computed(() =>
  categories.value.map((item) => ({
    label: item.name,
    value: item.id,
  })),
)

const categoryDialog = reactive({
  visible: false,
  mode: 'add' as 'add' | 'edit',
})

const tagDialog = reactive({
  visible: false,
  mode: 'add' as 'add' | 'edit',
})

const categoryForm = reactive({
  id: '',
  name: '',
  code: '',
  parentId: undefined as string | undefined,
  icon: '',
  sortIndex: 0,
})

const tagForm = reactive({
  id: '',
  name: '',
  categoryId: '',
  parentId: undefined as string | undefined,
  icon: '',
  state: 'enabled',
  sortIndex: 0,
})

const categoryDialogTitle = computed(() =>
  categoryDialog.mode === 'add'
    ? mergedTexts.value.addCategory
    : mergedTexts.value.editCategory,
)

const tagDialogTitle = computed(() =>
  tagDialog.mode === 'add'
    ? mergedTexts.value.addTag
    : mergedTexts.value.editTag,
)

const categoryRules = computed(() => ({
  name: [{ required: true, message: mergedTexts.value.categoryNameRequired, trigger: 'blur' }],
  code: [
    { required: true, message: mergedTexts.value.categoryCodeRequired, trigger: 'blur' },
    { max: 64, message: mergedTexts.value.categoryCodeMaxLength, trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_-]+$/, message: mergedTexts.value.codeFormat, trigger: 'blur' },
  ],
}))

const tagRules = computed(() => ({
  name: [{ required: true, message: mergedTexts.value.tagNameRequired, trigger: 'blur' }],
  categoryId: [{ required: true, message: mergedTexts.value.tagCategoryRequired, trigger: 'change' }],
}))

const unwrapArray = <T = any>(response: any): T[] => {
  const result = response?.result ?? response
  if (Array.isArray(result)) {
    return result as T[]
  }
  if (Array.isArray(result?.data)) {
    return result.data as T[]
  }
  return []
}

const normalizeState = (value: any) => {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object') {
    return value.value || value.text || 'enabled'
  }
  return 'enabled'
}

const formatText = (template: string, values: string[]) =>
  values.reduce((text, value, index) => text.replace(`{${index}}`, value), template)

const flattenCategoryItems = (
  items: TagManagerSidebarCategoryItem[],
  result: TagManagerSidebarCategoryItem[] = [],
) => {
  items.forEach((item) => {
    result.push({
      id: item.id,
      name: item.name,
      code: item.code,
      description: item.description,
      icon: item.icon,
      parentId: item.parentId,
      sortIndex: item.sortIndex,
    })
    if (Array.isArray(item.children) && item.children.length) {
      flattenCategoryItems(item.children, result)
    }
  })
  return result
}

const flattenTagItems = (
  items: TagManagerSidebarTagItem[],
  result: TagManagerSidebarTagItem[] = [],
) => {
  items.forEach((item) => {
    result.push({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      description: item.description,
      icon: item.icon,
      parentId: item.parentId,
      sortIndex: item.sortIndex,
      state: item.state,
    })
    if (Array.isArray(item.children) && item.children.length) {
      flattenTagItems(item.children, result)
    }
  })
  return result
}

const setSelectedTagIds = (ids: string[], triggerChange = true) => {
  selectedTagIds.value = ids
  if (triggerChange) {
    emit('change')
  }
}

const isTagSelected = (id: string) => selectedTagIds.value.includes(id)

const sortBySortIndex = <T extends { sortIndex?: number }>(items: T[]) =>
  [...items].sort((left, right) => (left.sortIndex ?? 0) - (right.sortIndex ?? 0))

const getNextSortIndex = <T extends { sortIndex?: number }>(items: T[]) => {
  if (!items.length) {
    return 0
  }
  return Math.max(...items.map((item) => item.sortIndex ?? 0)) + 1
}

const normalizeOrder = <T extends { sortIndex?: number }>(items: T[]) =>
  items.map((item, index) => ({
    ...item,
    sortIndex: index,
  }))

const moveItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const nextItems = [...items]
  const [item] = nextItems.splice(fromIndex, 1)
  if (!item) {
    return items
  }
  nextItems.splice(Math.min(toIndex, nextItems.length), 0, item)
  return nextItems
}

const getTagChipClass = (categoryId: string, tag: TagManagerSidebarTagItem) => ({
  'tag-manager-sidebar__tag-chip--editable': editing.value,
  'tag-manager-sidebar__tag-chip--selected': !editing.value && isTagSelected(tag.id),
  'tag-manager-sidebar__tag-chip--dragging':
    draggingTagCategoryId.value === categoryId && draggingTagId.value === tag.id,
  'tag-manager-sidebar__tag-chip--drag-over':
    dragOverTagCategoryId.value === categoryId && dragOverTagId.value === tag.id,
})

const toggleTag = (id: string) => {
  const nextIds = [...selectedTagIds.value]
  const index = nextIds.indexOf(id)
  if (index >= 0) {
    nextIds.splice(index, 1)
  } else {
    nextIds.push(id)
  }
  setSelectedTagIds(nextIds)
}

const handleTagClick = (tag: TagManagerSidebarTagItem) => {
  if (editing.value) {
    openTagDialog('edit', tag)
    return
  }
  toggleTag(tag.id)
}

const clearSelectedTagIds = () => {
  if (!selectedTagIds.value.length) {
    return
  }
  setSelectedTagIds([])
}

const enterEditMode = () => {
  editing.value = true
}

const exitEditMode = () => {
  editing.value = false
}

const resetCategoryForm = () => {
  Object.assign(categoryForm, {
    id: '',
    name: '',
    code: '',
    parentId: undefined,
    icon: '',
    sortIndex: 0,
  })
}

const resetTagForm = () => {
  Object.assign(tagForm, {
    id: '',
    name: '',
    categoryId: '',
    parentId: undefined,
    icon: '',
    state: 'enabled',
    sortIndex: 0,
  })
}

const buildCategoryPayload = (
  category: TagManagerSidebarCategoryItem,
  sortIndex = category.sortIndex ?? 0,
) => ({
  id: category.id || undefined,
  name: category.name,
  code: category.code,
  parentId: category.parentId || undefined,
  icon: category.icon || undefined,
  description: category.description || undefined,
  sortIndex,
})

const buildTagPayload = (
  tag: TagManagerSidebarTagItem,
  sortIndex = tag.sortIndex ?? 0,
) => ({
  id: tag.id || undefined,
  name: tag.name,
  categoryId: tag.categoryId,
  parentId: tag.parentId || undefined,
  icon: tag.icon || undefined,
  description: tag.description || undefined,
  state: normalizeState(tag.state),
  sortIndex,
})

const persistCategorySort = async (nextCategories: TagManagerSidebarCategoryItem[]) => {
  const sortedCategories = normalizeOrder(nextCategories)
  categories.value = sortedCategories
  sorting.value = true
  try {
    await Promise.all(
      sortedCategories.map((category) =>
        props.client.updateCategory(buildCategoryPayload(category)),
      ),
    )
    onlyMessage(mergedTexts.value.success)
    emit('refresh')
  } catch (error) {
    await loadData()
  } finally {
    sorting.value = false
  }
}

const persistTagSort = async (categoryId: string, nextTags: TagManagerSidebarTagItem[]) => {
  const sortedTags = normalizeOrder(nextTags).map((tag) => ({
    ...tag,
    categoryId,
  }))
  tagMap.value = {
    ...tagMap.value,
    [categoryId]: sortedTags,
  }
  sorting.value = true
  try {
    await Promise.all(
      sortedTags.map((tag) => props.client.updateTag(buildTagPayload(tag))),
    )
    onlyMessage(mergedTexts.value.success)
    emit('refresh')
  } catch (error) {
    await loadData()
  } finally {
    sorting.value = false
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const categoryTree = unwrapArray<TagManagerSidebarCategoryItem>(
      await props.client.queryCategories(),
    )

    const nextCategories = sortBySortIndex(flattenCategoryItems(categoryTree))
    const nextTagMap: Record<string, TagManagerSidebarTagItem[]> = {}

    await Promise.all(
      nextCategories.map(async (category) => {
        nextTagMap[category.id] = sortBySortIndex(flattenTagItems(
          unwrapArray<TagManagerSidebarTagItem>(await props.client.queryTags(category.id)),
        ))
      }),
    )

    categories.value = nextCategories
    tagMap.value = nextTagMap

    const availableIds = new Set(
      Object.values(nextTagMap).flatMap((items) => items.map((item) => item.id)),
    )
    const filteredIds = selectedTagIds.value.filter((id) => availableIds.has(id))
    if (filteredIds.length !== selectedTagIds.value.length) {
      setSelectedTagIds(filteredIds)
    }
  } finally {
    loading.value = false
  }
}

const handleCategoryDragStart = (event: DragEvent, categoryId: string) => {
  if (!editing.value) {
    return
  }
  draggingCategoryId.value = categoryId
  event.dataTransfer?.setData('text/plain', categoryId)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleCategoryDragOver = (categoryId: string) => {
  if (!draggingCategoryId.value || draggingCategoryId.value === categoryId) {
    return
  }
  dragOverCategoryId.value = categoryId
}

const handleCategoryDragLeave = (categoryId: string) => {
  if (dragOverCategoryId.value === categoryId) {
    dragOverCategoryId.value = ''
  }
}

const handleCategoryDragEnd = () => {
  draggingCategoryId.value = ''
  dragOverCategoryId.value = ''
}

const handleCategoryDrop = async (categoryId: string) => {
  const fromId = draggingCategoryId.value
  handleCategoryDragEnd()
  if (!fromId || fromId === categoryId) {
    return
  }

  const fromIndex = categories.value.findIndex((item) => item.id === fromId)
  const toIndex = categories.value.findIndex((item) => item.id === categoryId)

  if (fromIndex < 0 || toIndex < 0) {
    return
  }

  await persistCategorySort(moveItem(categories.value, fromIndex, toIndex))
}

const handleTagDragStart = (event: DragEvent, categoryId: string, tagId: string) => {
  if (!editing.value) {
    return
  }
  draggingTagCategoryId.value = categoryId
  draggingTagId.value = tagId
  event.dataTransfer?.setData('text/plain', `${categoryId}:${tagId}`)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleTagDragOver = (categoryId: string, tagId: string) => {
  if (
    !draggingTagId.value
    || draggingTagCategoryId.value !== categoryId
    || draggingTagId.value === tagId
  ) {
    return
  }

  dragOverTagCategoryId.value = categoryId
  dragOverTagId.value = tagId
}

const handleTagDragLeave = (categoryId: string, tagId: string) => {
  if (dragOverTagCategoryId.value === categoryId && dragOverTagId.value === tagId) {
    dragOverTagCategoryId.value = ''
    dragOverTagId.value = ''
  }
}

const handleTagDragEnd = () => {
  draggingTagCategoryId.value = ''
  draggingTagId.value = ''
  dragOverTagCategoryId.value = ''
  dragOverTagId.value = ''
}

const handleTagDrop = async (categoryId: string, tagId: string) => {
  const fromCategoryId = draggingTagCategoryId.value
  const fromTagId = draggingTagId.value
  handleTagDragEnd()

  if (!fromTagId || !fromCategoryId || fromCategoryId !== categoryId || fromTagId === tagId) {
    return
  }

  const currentTags = tagMap.value[categoryId] || []
  const fromIndex = currentTags.findIndex((item) => item.id === fromTagId)
  const toIndex = currentTags.findIndex((item) => item.id === tagId)

  if (fromIndex < 0 || toIndex < 0) {
    return
  }

  await persistTagSort(categoryId, moveItem(currentTags, fromIndex, toIndex))
}

const openCategoryDialog = (
  mode: 'add' | 'edit',
  category?: TagManagerSidebarCategoryItem,
) => {
  categoryDialog.visible = true
  categoryDialog.mode = mode
  resetCategoryForm()

  if (mode === 'edit' && category) {
    Object.assign(categoryForm, {
      id: category.id,
      name: category.name || '',
      code: category.code || '',
      parentId: category.parentId || undefined,
      icon: category.icon || '',
      sortIndex: category.sortIndex ?? 0,
    })
  }

  categoryFormRef.value?.clearValidate?.()
}

const openTagDialog = (
  mode: 'add' | 'edit',
  tag?: TagManagerSidebarTagItem,
  categoryId?: string,
) => {
  tagDialog.visible = true
  tagDialog.mode = mode
  resetTagForm()

  if (mode === 'edit' && tag) {
    Object.assign(tagForm, {
      id: tag.id,
      name: tag.name || '',
      categoryId: tag.categoryId || '',
      parentId: tag.parentId || undefined,
      icon: tag.icon || '',
      state: normalizeState(tag.state),
      sortIndex: tag.sortIndex ?? 0,
    })
  } else {
    tagForm.categoryId = categoryId || categories.value[0]?.id || ''
  }

  tagFormRef.value?.clearValidate?.()
}

const submitCategory = async () => {
  await categoryFormRef.value?.validate?.()

  categorySubmitting.value = true
  try {
    const sortIndex = categoryDialog.mode === 'add'
      ? getNextSortIndex(categories.value)
      : (categoryForm.sortIndex ?? 0)
    const payload = {
      id: categoryForm.id || undefined,
      name: categoryForm.name.trim(),
      code: categoryForm.code.trim(),
      parentId: categoryForm.parentId || undefined,
      icon: categoryForm.icon || undefined,
      sortIndex,
    }

    if (categoryDialog.mode === 'add') {
      await props.client.saveCategory(payload)
    } else {
      await props.client.updateCategory(payload)
    }

    onlyMessage(mergedTexts.value.success)
    categoryDialog.visible = false
    await loadData()
    emit('refresh')
  } finally {
    categorySubmitting.value = false
  }
}

const submitTag = async () => {
  await tagFormRef.value?.validate?.()

  tagSubmitting.value = true
  try {
    const targetCategoryId = tagForm.categoryId
    const originalTag = allTags.value.find((item) => item.id === tagForm.id)
    const sortIndex = tagDialog.mode === 'add'
      || originalTag?.categoryId !== targetCategoryId
      ? getNextSortIndex(tagMap.value[targetCategoryId] || [])
      : (tagForm.sortIndex ?? 0)
    const payload = {
      id: tagForm.id || undefined,
      name: tagForm.name.trim(),
      categoryId: targetCategoryId,
      parentId: tagForm.parentId || undefined,
      icon: tagForm.icon || undefined,
      state: tagForm.state,
      sortIndex,
    }

    if (tagDialog.mode === 'add') {
      await props.client.saveTag(payload)
    } else {
      await props.client.updateTag(payload)
    }

    onlyMessage(mergedTexts.value.success)
    tagDialog.visible = false
    await loadData()
    emit('refresh')
  } finally {
    tagSubmitting.value = false
  }
}

const handleDeleteCategory = (category: TagManagerSidebarCategoryItem) => {
  Modal.confirm({
    title: formatText(mergedTexts.value.confirmDeleteCategory, [category.name]),
    onOk: async () => {
      await props.client.deleteCategory(category.id)
      onlyMessage(mergedTexts.value.success)
      await loadData()
      emit('refresh')
    },
  })
}

const handleDeleteTag = (tag: TagManagerSidebarTagItem) => {
  Modal.confirm({
    title: formatText(mergedTexts.value.confirmDeleteTag, [tag.name]),
    onOk: async () => {
      await props.client.deleteTag(tag.id)
      onlyMessage(mergedTexts.value.success)
      await loadData()
      emit('refresh')
    },
  })
}

onMounted(() => {
  void loadData()
})

defineExpose({
  refresh: loadData,
})
</script>

<style scoped>
.tag-manager-sidebar {
  height: 100%;
  border-radius: 1rem;
}
.tag-manager-sidebar :deep(.ant-card-head) {
  min-height: 3.5rem;
}
.tag-manager-sidebar :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  height: calc(100% - 3.5625rem);
  padding: var(--space-5);
  overflow: hidden;
}
.tag-manager-sidebar :deep(.ant-spin-nested-loading),
.tag-manager-sidebar :deep(.ant-spin-container) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.tag-manager-sidebar :deep(.ant-spin-container) {
  gap: var(--space-4);
  overflow-y: auto;
}
.tag-manager-sidebar__title {
  display: flex;
  align-items: center;
  font-weight: 600;
}
.tag-manager-sidebar__header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.tag-manager-sidebar__selected-summary {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}
.tag-manager-sidebar__selected-summary :deep(.ant-btn) {
  padding-inline: 0;
}
.tag-manager-sidebar__selected-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 1.75rem;
  padding: 0 0.625rem;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  border-radius: 62.4375rem;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--jet-theme-primary-active);
  font-size: var(--fs-12);
  cursor: pointer;
}
.tag-manager-sidebar__selected-trigger-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  border-radius: 62.4375rem;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: var(--fs-12);
}
.tag-manager-sidebar__group-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.tag-manager-sidebar__group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  transition: all 0.2s;
}
.tag-manager-sidebar__group--dragging {
  opacity: 0.6;
}
.tag-manager-sidebar__group--drag-over {
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--accent) 4%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
}
.tag-manager-sidebar__group-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.tag-manager-sidebar__group-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex-shrink: 0;
}
.tag-manager-sidebar__group-name {
  font-weight: 600;
  color: var(--ink-1);
}
.tag-manager-sidebar__group-icon,
.tag-manager-sidebar__tag-icon {
  flex-shrink: 0;
}
.tag-manager-sidebar__drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  color: var(--ink-4);
  cursor: grab;
}
.tag-manager-sidebar__drag-handle:active {
  cursor: grabbing;
}
.tag-manager-sidebar__drag-handle--tag {
  margin-right: -0.125rem;
}
.tag-manager-sidebar__group-count {
  color: var(--ink-4);
  font-size: var(--fs-12);
}
.tag-manager-sidebar__group-line {
  flex: 1;
  height: 0.0625rem;
  background: color-mix(in srgb, var(--ink-1) 8%, transparent);
}
.tag-manager-sidebar__group-content {
  padding-left: var(--space-3);
  margin-left: var(--space-1);
  border-left: 0.125rem solid color-mix(in srgb, var(--accent) 12%, transparent);
}
.tag-manager-sidebar__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.tag-manager-sidebar__tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3125rem 0.625rem;
  border: 1px solid color-mix(in srgb, var(--ink-1) 8%, transparent);
  border-radius: var(--r-3);
  background: var(--bg);
  cursor: pointer;
  transition: all 0.2s;
}
.tag-manager-sidebar__tag-chip--selected,
.tag-manager-sidebar__tag-chip--active {
  color: var(--jet-theme-primary-active);
  border-color: var(--accent);
  box-shadow: 0 0 0 0.125rem color-mix(in srgb, var(--accent) 8%, transparent);
}
.tag-manager-sidebar__tag-chip--dragging {
  opacity: 0.6;
}
.tag-manager-sidebar__tag-chip--drag-over {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
.tag-manager-sidebar__tag-chip--editable {
  padding-right: 0.375rem;
}
.tag-manager-sidebar__tag-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
  color: var(--ink-4);
  transition: all 0.2s;
}
.tag-manager-sidebar__tag-action:hover {
  color: var(--err);
  background: color-mix(in srgb, var(--err) 8%, transparent);
}
.tag-manager-sidebar__tag-chip--add {
  border-style: dashed;
  color: var(--ink-2);
}
.tag-manager-sidebar__tag-chip--add:disabled {
  cursor: not-allowed;
  color: color-mix(in srgb, var(--ink-1) 25%, transparent);
  background: color-mix(in srgb, var(--ink-1) 2%, transparent);
}
.tag-manager-sidebar__add-bar {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px dashed color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: 0.625rem;
  background: color-mix(in srgb, var(--accent) 3%, transparent);
  color: var(--accent);
  font-size: var(--fs-14);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.tag-manager-sidebar__add-bar:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.tag-manager-sidebar__group-empty,
.tag-manager-sidebar__empty-hint {
  padding: var(--space-4);
  border-radius: 0.75rem;
  text-align: center;
  color: var(--ink-4);
  background: color-mix(in srgb, var(--ink-1) 2%, transparent);
}</style>

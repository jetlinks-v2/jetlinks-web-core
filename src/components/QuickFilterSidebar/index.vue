<template>
  <aside class="quick-filter-sidebar">
    <div
      v-for="section in sections"
      :key="section.key"
      class="quick-filter-sidebar__section"
    >
      <div
        class="quick-filter-sidebar__section-header"
        :class="{ 'quick-filter-sidebar__section-header--static': getHeaderActions(section).length > 0 }"
      >
        <button
          type="button"
          class="quick-filter-sidebar__section-title"
          :disabled="section.collapsible === false"
          @click="toggleSection(section.key)"
        >
          <span>{{ section.title }}</span>
          <AIcon
            v-if="section.collapsible !== false"
            type="DownOutlined"
            class="quick-filter-sidebar__caret"
            :class="{ 'quick-filter-sidebar__caret--open': isSectionOpen(section.key) }"
          />
        </button>

        <div v-if="getHeaderActions(section).length" class="quick-filter-sidebar__header-actions">
          <template
            v-for="action in getHeaderActions(section)"
            :key="`${section.key}:${action.key || action.label || action.icon}`"
          >
            <a-tooltip
              v-if="action.tooltip"
              :title="action.tooltip"
            >
              <a-button
                type="link"
                size="small"
                class="quick-filter-sidebar__header-action"
                :danger="action.danger"
                :disabled="action.disabled"
                @click.stop="handleHeaderAction(section, action)"
              >
                <AIcon v-if="action.icon" :type="action.icon" />
                <span v-if="action.label">{{ action.label }}</span>
              </a-button>
            </a-tooltip>
            <a-button
              v-else
              type="link"
              size="small"
              class="quick-filter-sidebar__header-action"
              :danger="action.danger"
              :disabled="action.disabled"
              @click.stop="handleHeaderAction(section, action)"
            >
              <AIcon v-if="action.icon" :type="action.icon" />
              <span v-if="action.label">{{ action.label }}</span>
            </a-button>
          </template>
        </div>
      </div>

      <div v-if="isSectionOpen(section.key)" class="quick-filter-sidebar__items">
        <div
          v-for="item in getSectionItems(section)"
          :key="resolveItemKey(section.key, item)"
          class="quick-filter-sidebar__row"
          :class="{ 'quick-filter-sidebar__row--active': isItemActive(section, item) }"
        >
          <button
            type="button"
            class="quick-filter-sidebar__item"
            :class="{ 'quick-filter-sidebar__item--active': isItemActive(section, item) }"
            :disabled="item.disabled"
            @click="handleSelect(section, item)"
          >
            <slot
              name="item"
              :section="section"
              :item="item"
              :active="isItemActive(section, item)"
            >
              <div class="quick-filter-sidebar__item-content">
                <span v-if="item.icon" class="quick-filter-sidebar__item-icon">
                  <AIcon :type="item.icon" />
                </span>
                <a-tooltip :title="item.tooltip || item.label">
                  <span class="quick-filter-sidebar__item-main">
                    <span class="quick-filter-sidebar__item-text">{{ item.label }}</span>
                    <span v-if="item.description" class="quick-filter-sidebar__item-description">
                      {{ item.description }}
                    </span>
                  </span>
                </a-tooltip>
              </div>
              <span v-if="item.meta" class="quick-filter-sidebar__item-meta">{{ item.meta }}</span>
            </slot>
          </button>

          <div v-if="getItemActions(item).length" class="quick-filter-sidebar__item-actions">
            <template
              v-for="action in getItemActions(item)"
              :key="`${resolveItemKey(section.key, item)}:${action.key || action.label || action.icon}`"
            >
              <a-tooltip
                v-if="action.tooltip"
                :title="action.tooltip"
              >
                <button
                  type="button"
                  class="quick-filter-sidebar__item-action-btn"
                  :class="{ 'quick-filter-sidebar__item-action-btn--danger': action.danger }"
                  :disabled="action.disabled"
                  @click.stop="handleItemAction(section, item, action)"
                >
                  <AIcon :type="action.icon || 'DeleteOutlined'" />
                </button>
              </a-tooltip>
              <button
                v-else
                type="button"
                class="quick-filter-sidebar__item-action-btn"
                :class="{ 'quick-filter-sidebar__item-action-btn--danger': action.danger }"
                :disabled="action.disabled"
                @click.stop="handleItemAction(section, item, action)"
              >
                <AIcon :type="action.icon || 'DeleteOutlined'" />
              </button>
            </template>
          </div>
        </div>

        <div
          v-if="!section.items?.length && section.emptyText"
          class="quick-filter-sidebar__empty"
        >
          {{ section.emptyText }}
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import {
  isSameTerms,
  normalizeInputTerms,
  type ConditionFilterField,
  type ConditionFilterTerm,
} from '../ConditionFilter'
import type { QuickFilterSidebarItem, QuickFilterSidebarSection, QuickFilterSidebarShortcut } from './types'

const props = defineProps({
  sections: {
    type: Array as PropType<QuickFilterSidebarSection[]>,
    default: () => [],
  },
  fields: {
    type: Array as PropType<ConditionFilterField[]>,
    default: () => [],
  },
  modelValue: {
    type: Array as PropType<ConditionFilterTerm[]>,
    default: () => [],
  },
  openKeys: {
    type: Array as PropType<string[]>,
    default: undefined,
  },
  defaultOpenKeys: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
})

const emit = defineEmits<{
  (e: 'select', sectionKey: string, item: QuickFilterSidebarItem): void
  (e: 'update:modelValue', value: ConditionFilterTerm[]): void
  (e: 'change', value: { terms: ConditionFilterTerm[]; sectionKey: string; item: QuickFilterSidebarItem }): void
  (e: 'update:openKeys', value: string[]): void
  (e: 'toggleSection', sectionKey: string, opened: boolean): void
  (e: 'headerAction', sectionKey: string, actionKey: string): void
  (e: 'itemAction', sectionKey: string, actionKey: string, item: QuickFilterSidebarItem): void
}>()

const uncontrolledOpenSections = ref<string[]>([])
const isControlled = computed(() => Array.isArray(props.openKeys))
const openSections = computed<string[]>(() => {
  if (isControlled.value) {
    return props.openKeys || []
  }

  return uncontrolledOpenSections.value
})

watch(
  () => [props.defaultOpenKeys, props.sections] as const,
  ([keys, sections]) => {
    if (isControlled.value || uncontrolledOpenSections.value.length) {
      return
    }

    uncontrolledOpenSections.value = keys?.length ? [...keys] : (sections || []).map((item) => item.key)
  },
  { immediate: true },
)

const isSectionOpen = (key: string) => openSections.value.includes(key)

const toggleSection = (key: string) => {
  const section = props.sections.find((item) => item.key === key)
  if (section?.collapsible === false) {
    return
  }

  const nextOpenSections = isSectionOpen(key)
    ? openSections.value.filter((item) => item !== key)
    : [...openSections.value, key]

  if (isControlled.value) {
    emit('update:openKeys', nextOpenSections)
  } else {
    uncontrolledOpenSections.value = nextOpenSections
  }

  emit('toggleSection', key, nextOpenSections.includes(key))
}

const resolveItemKey = (sectionKey: string, item: QuickFilterSidebarItem) => {
  return `${sectionKey}:${String(item.key ?? item.value ?? item.label)}`
}

const getHeaderActions = (section: QuickFilterSidebarSection) => {
  return section.extraActions?.length ? section.extraActions : section.extraAction ? [section.extraAction] : []
}

const getItemActions = (item: QuickFilterSidebarItem) => {
  return item.actions?.length ? item.actions : item.action ? [item.action] : []
}

const handleSelect = (section: QuickFilterSidebarSection, item: QuickFilterSidebarItem) => {
  if (item.disabled) {
    return
  }

  emit('select', section.key, item)

  if (item.shortcut) {
    const nextTerms = applyShortcut(props.modelValue || [], item.shortcut)
    emit('update:modelValue', nextTerms)
    emit('change', {
      terms: nextTerms,
      sectionKey: section.key,
      item,
    })
  }
}

const isSameValue = (left: QuickFilterSidebarItem['value'], right: QuickFilterSidebarItem['value']) => {
  return Object.is(left, right)
}

const cloneTermValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneTermValue(item))
  }

  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) }
  }

  return value
}

const cloneTerms = (terms: ConditionFilterTerm[] = []) => {
  return terms.map((item) => ({
    ...item,
    value: cloneTermValue(item.value),
    terms: item.terms ? cloneTerms(item.terms as ConditionFilterTerm[]) : undefined,
  }))
}

const normalizeTerms = (terms: ConditionFilterTerm[] = []) => {
  return normalizeInputTerms(cloneTerms(terms), props.fields || [])
}

const collectShortcutColumns = (shortcut?: QuickFilterSidebarShortcut) => {
  const columns = new Set<string>()

  ;(shortcut?.removeColumns || []).forEach((item) => {
    if (item) {
      columns.add(item)
    }
  })

  ;(shortcut?.terms || []).forEach((item) => {
    if (item?.column) {
      columns.add(String(item.column))
    }
  })

  return Array.from(columns)
}

const extractTermsByColumns = (terms: ConditionFilterTerm[] = [], columns: string[] = []) => {
  if (!columns.length) {
    return []
  }

  return terms.reduce<ConditionFilterTerm[]>((acc, item) => {
    if (!item) {
      return acc
    }

    if (item.column && columns.includes(String(item.column))) {
      acc.push({
        ...item,
        value: cloneTermValue(item.value),
      })
      return acc
    }

    if (Array.isArray(item.terms) && item.terms.length) {
      const nextTerms = extractTermsByColumns(item.terms as ConditionFilterTerm[], columns)

      if (nextTerms.length) {
        acc.push({
          ...item,
          terms: nextTerms,
        })
      }
    }

    return acc
  }, [])
}

const removeTermsByColumns = (terms: ConditionFilterTerm[] = [], columns: string[] = []) => {
  if (!columns.length) {
    return cloneTerms(terms)
  }

  return terms.reduce<ConditionFilterTerm[]>((acc, item) => {
    if (!item || (item.column && columns.includes(String(item.column)))) {
      return acc
    }

    if (Array.isArray(item.terms) && item.terms.length) {
      const nextTerms = removeTermsByColumns(item.terms as ConditionFilterTerm[], columns)

      if (nextTerms.length) {
        acc.push({
          ...item,
          terms: nextTerms,
        })
      }

      return acc
    }

    acc.push({
      ...item,
      value: cloneTermValue(item.value),
    })
    return acc
  }, [])
}

const applyShortcut = (terms: ConditionFilterTerm[] = [], shortcut?: QuickFilterSidebarShortcut) => {
  if (!shortcut) {
    return normalizeTerms(terms)
  }

  const columns = collectShortcutColumns(shortcut)
  const baseTerms = removeTermsByColumns(terms, columns)
  const shortcutTerms = cloneTerms(shortcut.terms || [])

  shortcutTerms.forEach((item, index) => {
    if (!item.type) {
      item.type = baseTerms.length || index ? 'and' : undefined
    }
  })

  return normalizeTerms([...baseTerms, ...shortcutTerms])
}

const isShortcutActive = (shortcut?: QuickFilterSidebarShortcut) => {
  if (!shortcut) {
    return false
  }

  const columns = collectShortcutColumns(shortcut)
  const currentTerms = normalizeTerms(extractTermsByColumns(props.modelValue || [], columns))
  const expectedTerms = normalizeTerms(shortcut.terms || [])

  return isSameTerms(currentTerms, expectedTerms)
}

const isItemActive = (section: QuickFilterSidebarSection, item: QuickFilterSidebarItem) => {
  if (typeof item.active === 'boolean') {
    return item.active
  }

  if (item.shortcut) {
    return isShortcutActive(item.shortcut)
  }

  if (section.activeValues?.length) {
    return section.activeValues.some((value) => isSameValue(value, item.value))
  }

  return isSameValue(section.activeValue, item.value)
}

const handleHeaderAction = (section: QuickFilterSidebarSection, action?: QuickFilterSidebarSection['extraAction']) => {
  if (action?.disabled) {
    return
  }

  emit('headerAction', section.key, action?.key || 'action')
}

const handleItemAction = (
  section: QuickFilterSidebarSection,
  item: QuickFilterSidebarItem,
  action?: QuickFilterSidebarItem['action'],
) => {
  if (action?.disabled) {
    return
  }

  emit('itemAction', section.key, action?.key || 'action', item)
}

const getSectionItems = (section: QuickFilterSidebarSection) => {
  return section.allOption ? [section.allOption, ...(section.items || [])] : section.items || []
}

</script>

<style scoped>
.quick-filter-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 14.5rem;
  height: 100%;
  padding: var(--space-3);
  overflow: auto;
  background: var(--bg);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-3);
}
.quick-filter-sidebar__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.quick-filter-sidebar__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
}
.quick-filter-sidebar__section-header--static {
  align-items: flex-start;
}
.quick-filter-sidebar__section-title {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  min-width: 0;
  padding: 0;
  color: var(--ink-1);
  font-size: var(--fs-14);
  font-weight: 600;
  line-height: 1.375rem;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.quick-filter-sidebar__section-title:disabled {
  cursor: default;
}
.quick-filter-sidebar__caret {
  color: var(--ink-4);
  font-size: var(--fs-12);
  transform: rotate(-90deg);
  transition: transform 0.2s ease;
}
.quick-filter-sidebar__caret--open {
  transform: rotate(0);
}
.quick-filter-sidebar__header-action {
  padding: 0;
  font-size: var(--fs-12);
  line-height: 1.25rem;
}
.quick-filter-sidebar__header-actions {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
}
.quick-filter-sidebar__items {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.quick-filter-sidebar__row {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  border-radius: var(--r-2);
}
.quick-filter-sidebar__row--active {
  background: var(--accent-soft);
}
.quick-filter-sidebar__item {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
  min-height: 1.875rem;
  padding: 0 0.625rem;
  color: var(--ink-2);
  font-size: var(--fs-14);
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: var(--r-2);
  cursor: pointer;
  transition: all 0.2s ease;
}
.quick-filter-sidebar__item:hover {
  color: var(--ink-1);
  background: var(--bg-hover);
}
.quick-filter-sidebar__item:disabled {
  color: var(--ink-4);
  cursor: not-allowed;
}
.quick-filter-sidebar__item--active {
  color: var(--accent);
  font-weight: 600;
  background: var(--accent-soft);
}
.quick-filter-sidebar__item-content {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
}
.quick-filter-sidebar__item-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  color: var(--ink-4);
}
.quick-filter-sidebar__item-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}
.quick-filter-sidebar__item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-filter-sidebar__item-description {
  overflow: hidden;
  color: color-mix(in srgb, var(--ink-1) 40%, transparent);
  font-size: var(--fs-12);
  font-weight: 400;
  line-height: 1.125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quick-filter-sidebar__item-meta {
  flex-shrink: 0;
  color: color-mix(in srgb, var(--ink-1) 40%, transparent);
  font-size: var(--fs-12);
  line-height: 1.125rem;
}
.quick-filter-sidebar__item-actions {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
}
.quick-filter-sidebar__item-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  color: var(--ink-4);
  background: transparent;
  border: 0;
  border-radius: var(--r-2);
  cursor: pointer;
  transition: all 0.2s ease;
}
.quick-filter-sidebar__item-action-btn:hover {
  color: var(--err);
  background: color-mix(in srgb, var(--err) 8%, transparent);
}
.quick-filter-sidebar__item-action-btn:disabled {
  color: color-mix(in srgb, var(--ink-1) 20%, transparent);
  cursor: not-allowed;
  background: transparent;
}
.quick-filter-sidebar__item-action-btn--danger {
  color: var(--err);
}
.quick-filter-sidebar__empty {
  padding: 0.25rem 0.625rem;
  color: color-mix(in srgb, var(--ink-1) 40%, transparent);
  font-size: var(--fs-12);
  line-height: 1.25rem;
}</style>

<template>
  <div ref="rootRef" class="menu-search">
    <a-input
      v-model:value="keyword"
      allow-clear
      class="menu-search__input"
      :placeholder="$t('layout.menuSearch.placeholder')"
      @focus="open = true"
      @keydown.esc="close"
      @change="valueChange"
    >
      <template #prefix>
        <AIcon type="SearchOutlined" />
      </template>
    </a-input>

    <div v-if="open && keyword.trim()" class="menu-search__panel">
      <div v-if="results.length" class="menu-search__list">
        <button
          v-for="item in results"
          :key="item.key"
          type="button"
          class="menu-search__item"
          @mousedown.prevent="handleSelect(item)"
        >
          <AIcon v-if="item.icon" class="menu-search__icon" :type="item.icon" />
          <span v-else class="menu-search__icon menu-search__icon--empty" />
          <span class="menu-search__title">
            <template v-for="(segment, index) in highlightTitle(item.title)" :key="index">
              <em v-if="segment.match" class="menu-search__hit">{{ segment.text }}</em>
              <template v-else>{{ segment.text }}</template>
            </template>
          </span>
        </button>
      </div>
      <div v-else class="menu-search__empty">
        {{ $t('layout.menuSearch.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MenuSearch">
import type { RouteRecordRaw } from 'vue-router'
import i18n from '@jetlinks-web-core/locales'
import { debounce } from 'lodash-es'
import { useMenuStore } from '@/store'

type MenuSearchItem = {
  key: string
  name: string
  title: string
  icon?: string
}

type TitleSegment = {
  text: string
  match: boolean
}

const menuStore = useMenuStore()

const keyword = ref('')
const open = ref(false)
const rootRef = ref<HTMLElement>()

const collectMenus = (
  menus: RouteRecordRaw[],
  result: MenuSearchItem[] = [],
): MenuSearchItem[] => {
  menus.forEach((menu) => {
    const meta = (menu.meta || {}) as Record<string, any>
    if (meta.hideInMenu !== true && meta.title) {
      result.push({
        key: String(menu.name || menu.path),
        name: String(menu.name || ''),
        title: String(i18n.global.t(String(meta.title))),
        icon: meta.icon,
      })
    }

    if (menu.children?.length) {
      collectMenus(menu.children as RouteRecordRaw[], result)
    }
  })

  return result
}

const menuItems = computed(() => collectMenus(menuStore.siderMenus as RouteRecordRaw[]))

const results = computed(() => {
  const searchText = keyword.value.trim().toLowerCase()
  if (!searchText) return []

  return menuItems.value.filter(item => item.title.toLowerCase().includes(searchText))
})

const highlightTitle = (title: string): TitleSegment[] => {
  const searchText = keyword.value.trim().toLowerCase()
  if (!searchText) return [{ text: title, match: false }]

  const segments: TitleSegment[] = []
  const lowerTitle = title.toLowerCase()
  let cursor = 0
  let index = lowerTitle.indexOf(searchText)

  while (index > -1) {
    if (index > cursor) {
      segments.push({ text: title.slice(cursor, index), match: false })
    }
    segments.push({ text: title.slice(index, index + searchText.length), match: true })
    cursor = index + searchText.length
    index = lowerTitle.indexOf(searchText, cursor)
  }

  if (cursor < title.length) {
    segments.push({ text: title.slice(cursor), match: false })
  }

  return segments
}

const close = () => {
  open.value = false
}

const handleSelect = (item: MenuSearchItem) => {
  keyword.value = ''
  close()
  menuStore.jumpPage(item.name)
}

const handleDocumentMousedown = (event: MouseEvent) => {
  if (!rootRef.value?.contains(event.target as Node)) {
    close()
  }
}

const valueChange = debounce((e) => {
  open = !!e.target.value
},300)

watch(open, (value) => {
  if (value) {
    document.addEventListener('mousedown', handleDocumentMousedown)
  } else {
    document.removeEventListener('mousedown', handleDocumentMousedown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentMousedown)
})
</script>

<style scoped lang="less">
.menu-search {
  position: relative;
  display: flex;
  align-items: center;

  &__input.ant-input-affix-wrapper {
    width: 12.5rem;
    height: var(--space-8);
    padding: 0 var(--space-2);
    background: var(--layout-menu-search-bg, var(--jet-theme-bg-layout));
    border-color: var(--layout-menu-search-border, var(--jet-theme-border-secondary));
    border-radius: var(--r-2);
    box-shadow: none;

    &:hover {
      border-color: var(--jet-theme-primary);
    }

    &:focus-within,
    &.ant-input-affix-wrapper-focused {
      border-color: var(--jet-theme-primary);
      box-shadow: var(--chrome-focus-ring, var(--ring-focus));
    }

    .ant-input {
      background: transparent;
      color: var(--jet-theme-text);
      font-size: var(--fs-12);
    }

    .ant-input-prefix {
      margin-inline-end: var(--space-1);
      color: var(--jet-theme-text-secondary);
    }

    .ant-input-clear-icon {
      font-size: var(--fs-12);
    }
  }

  &__panel {
    position: absolute;
    top: calc(100% + var(--space-1));
    left: 0;
    z-index: var(--z-drawer);
    width: 19rem;
    padding: var(--space-1);
    border: 1px solid var(--jet-theme-border-secondary);
    border-radius: var(--r-3);
    background: var(--jet-theme-bg-container);
    box-shadow: var(--shadow-fab);
    line-height: 1.5;
  }

  &__list {
    max-height: 18rem;
    overflow-y: auto;
  }

  &__item {
    display: flex;
    width: 100%;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border: 0;
    border-radius: var(--r-2);
    background: transparent;
    color: var(--jet-theme-text);
    cursor: pointer;
    font-size: var(--fs-14);
    line-height: var(--layout-menu-item-line-height, 1.25rem);
    text-align: left;

    &:hover,
    &:focus-visible {
      background: var(--jet-theme-primary-soft);
      outline: none;
    }
  }

  &__icon {
    flex: 0 0 auto;
    color: var(--jet-theme-text-secondary);
    font-size: var(--layout-menu-item-icon-size, 1rem);
  }

  &__icon--empty {
    display: inline-block;
    width: var(--layout-menu-item-icon-size, 1rem);
  }

  &__title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__hit {
    color: var(--jet-theme-primary);
    font-style: normal;
  }

  &__empty {
    padding: var(--space-4) 0;
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-12);
    text-align: center;
  }
}
</style>

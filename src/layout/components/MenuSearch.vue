<template>
  <div ref="rootRef" class="menu-search">
    <a-input
      v-model:value="keyword"
      allow-clear
      class="menu-search__input"
      :placeholder="$t('layout.menuSearch.placeholder')"
      @focus="open = true"
      @keydown.esc="close"
    >
      <template #prefix>
        <AIcon type="SearchOutlined" />
      </template>
    </a-input>

    <div v-if="open && keyword.trim()" class="menu-search__panel">
      <div v-if="groups.length" class="menu-search__list">
        <section v-for="group in groups" :key="group.key" class="menu-search__group">
          <div class="menu-search__group-title">{{ group.title }}</div>
          <button
            v-for="item in group.items"
            :key="item.key"
            type="button"
            class="menu-search__item"
            @mousedown.prevent
            @click="handleSelect(item)"
          >
            <span class="menu-search__parent" :title="item.parentTitle">{{ item.parentTitle }}</span>
            <span class="menu-search__target" :title="item.title">
              <AIcon v-if="item.icon" class="menu-search__icon" :type="item.icon" />
              <span class="menu-search__title">
                <template v-for="(segment, index) in highlightTitle(item.title)" :key="index">
                  <em v-if="segment.match" class="menu-search__hit">{{ segment.text }}</em>
                  <template v-else>{{ segment.text }}</template>
                </template>
              </span>
            </span>
          </button>
        </section>
      </div>
      <div v-else class="menu-search__empty">
        {{ $t('layout.menuSearch.empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MenuSearch">
import { useMenuSearch } from '../hooks/useMenuSearch'

const { keyword, open, rootRef, groups, highlightTitle, close, handleSelect } = useMenuSearch()
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
    right: 0;
    z-index: var(--z-drawer);
    width: 28rem;
    max-width: calc(100vw - var(--space-8));
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

  &__group + &__group {
    margin-top: var(--space-3);
  }

  &__group-title {
    padding: var(--space-2);
    border-bottom: 1px solid var(--jet-theme-border-secondary);
    color: var(--jet-theme-text);
    font-size: var(--fs-14);
  }

  &__parent {
    width: 30%;
    flex-shrink: 0;
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-12);
    text-align: right;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__target {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    flex: 1;
    padding: var(--space-2);
    border-left: 1px solid var(--jet-theme-border-secondary);
  }

  &__item {
    display: flex;
    width: 100%;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-2);
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

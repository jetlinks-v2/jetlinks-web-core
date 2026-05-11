<template>
  <a-input
    v-model:value="keyword"
    allow-clear
    class="layout-menu-search"
    placeholder="搜索菜单 / ..."
  >
    <template #prefix>
      <AIcon type="SearchOutlined" />
    </template>
    <template #suffix>
      <kbd class="layout-menu-search__key">⌘K</kbd>
    </template>
  </a-input>
</template>

<script setup name="LayoutMenuSearch" lang="ts">
const keyword = ref('')
</script>

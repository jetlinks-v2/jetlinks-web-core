<template>
  <a-input
    v-model:value="keyword"
    ref="searchInputRef"
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
const searchInputRef = ref<{ focus: () => void }>()
const emit = defineEmits<{
  (e: 'search', value: string): void
}>()

watch(keyword, (value) => {
  emit('search', value.trim())
})

const handleShortcut = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchInputRef.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleShortcut)
})
</script>

<template>
  <a-modal
    open
    :title="$t('components.IconLibrary.title')"
    :width="900"
    centered
    @cancel="emits('close')"
    @ok="confirm"
  >
    <div
      class="icon-selector"
      @click.stop
      @mousedown.stop
      @mouseup.stop
    >
      <div class="toolbar">
        <a-input-search
          v-model:value="searchText"
          :placeholder="$t('components.IconLibrary.searchPlaceholder')"
          style="width: 18.75rem"
          allow-clear
        />
        <div v-if="selected">
          <span>{{ $t('components.IconLibrary.currentSelected') }}</span>
          <a-tag color="blue">
            <AIcon :type="selected" />
            {{ selected }}
          </a-tag>
        </div>
      </div>
      <a-tabs
        v-model:active-key="activeCategory"
        class="category-tabs"
      >
        <a-tab-pane
          v-for="category in categoryTabs"
          :key="category.key"
          :tab="category.label"
        >
          <div class="icon-grid">
            <div
              v-for="icon in getFilteredCategory(category.key)"
              :key="icon.value"
              :class="['icon-item', { active: selected === icon.value }]"
              @click="selectIcon(icon)"
            >
              <AIcon :type="icon.value" />
              <div class="icon-name">{{ icon.name }}</div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { categories } from './fields'
import { useIconfontSymbols } from './useIconfontSymbols'

type IconOption = { name: string; value: string }

const { t: $t } = useI18n()
const emits = defineEmits(['save', 'close'])
const activeCategory = ref('all')
const theme = ref<'Outlined' | 'Filled' | 'TwoTone'>('Outlined')
const searchText = ref('')
const selected = ref('')
const iconfontSymbols = useIconfontSymbols()

// 在生成选项时确定最终值，所有分类的预览、选中态、复制和保存都消费同一个值。
const iconCategories = computed<Record<string, IconOption[]>>(() => ({
  ...Object.fromEntries<IconOption[]>(Object.entries(categories).map(([category, names]) => [
    category,
    names.map(name => ({ name, value: `${name}${theme.value}` }))
  ])),
  iconfont: iconfontSymbols.value.map(name => ({ name, value: name }))
}))
const allIcons = computed(() => [...new Map(
  Object.values(iconCategories.value).flat().map(icon => [icon.value, icon] as const)
).values()])
const categoryTabs = computed(() => [
  { key: 'all', label: $t('components.IconLibrary.categoryAll') },
  { key: 'direction', label: $t('components.IconLibrary.categoryDirection') },
  { key: 'suggestion', label: $t('components.IconLibrary.categorySuggestion') },
  { key: 'editor', label: $t('components.IconLibrary.categoryEditor') },
  { key: 'data', label: $t('components.IconLibrary.categoryData') },
  { key: 'logo', label: $t('components.IconLibrary.categoryLogo') },
  { key: 'other', label: $t('components.IconLibrary.categoryOther') },
  { key: 'iconfont', label: 'iconfont' }
])

const getFilteredCategory = (category: string): IconOption[] => {
  const icons = category === 'all' ? allIcons.value : iconCategories.value[category] || []
  const keyword = searchText.value.toLowerCase()
  return icons.filter(icon => icon.name.toLowerCase().includes(keyword))
}

const selectIcon = (icon: IconOption) => {
  selected.value = icon.value
  copyToClipboard(icon.value)
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 非安全上下文保留传统复制方式。
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
    } catch (error) {
      console.error('复制失败:', error)
    }
    document.body.removeChild(textarea)
  }
}

const confirm = () => {
  if (selected.value) emits('save', selected.value)
}
</script>

<style scoped>
.icon-selector .toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--line-strong);
}
.icon-selector .category-tabs :deep(.ant-tabs-content) {
  height: 28.125rem;
  overflow-y: auto;
}
.icon-selector .icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.25rem, 1fr));
  gap: var(--space-3);
  padding: 0.5rem 0;
}
.icon-selector .icon-grid .icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.5rem;
  border: 0.125rem solid var(--line-strong);
  border-radius: var(--r-2);
  cursor: pointer;
  transition: all 0.3s;
}
.icon-selector .icon-grid .icon-item .anticon {
  font-size: var(--fs-32);
  margin-bottom: var(--space-2);
}
.icon-selector .icon-grid .icon-item .icon-name {
  font-size: var(--fs-12);
  color: var(--ink-3);
  text-align: center;
  word-break: break-word;
  line-height: 1.2;
}
.icon-selector .icon-grid .icon-item:hover {
  border-color: var(--accent);
  background-color: var(--accent-soft);
}
.icon-selector .icon-grid .icon-item.active {
  color: var(--accent);
  border-color: var(--accent);
  background-color: var(--accent-soft);
}
.icon-selector .icon-grid .icon-item.active .icon-name {
  color: var(--accent);
  font-weight: 500;
}
.icon-selector .selected-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line-strong);
}
.icon-selector .selected-info .ant-tag {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-14);
  padding: 0.25rem 0.75rem;
}</style>

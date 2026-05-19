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
      <!-- 搜索和主题选择 -->
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

      <!-- 分类标签 -->
      <a-tabs
        v-model:active-key="activeCategory"
        class="category-tabs"
      >
        <a-tab-pane
          key="all"
          :tab="$t('components.IconLibrary.categoryAll')"
        >
          <div class="icon-grid">
            <div
              v-for="icon in filteredIcons"
              :key="icon"
              :class="['icon-item', { active: selected === getIconName(icon) }]"
              @click="selectIcon(icon)"
            >
              <AIcon :type="getIconName(icon)" />
              <div class="icon-name">{{ icon }}</div>
            </div>
          </div>
        </a-tab-pane>
        <a-tab-pane
          key="direction"
          :tab="$t('components.IconLibrary.categoryDirection')"
        >
          <div class="icon-grid">
            <div
              v-for="icon in getFilteredCategory('direction')"
              :key="icon"
              :class="['icon-item', { active: selected === getIconName(icon) }]"
              @click="selectIcon(icon)"
            >
              <AIcon :type="getIconName(icon)" />
              <div class="icon-name">{{ icon }}</div>
            </div>
          </div>
        </a-tab-pane>
        <a-tab-pane
          key="suggestion"
          :tab="$t('components.IconLibrary.categorySuggestion')"
        >
          <div class="icon-grid">
            <div
              v-for="icon in getFilteredCategory('suggestion')"
              :key="icon"
              :class="['icon-item', { active: selected === getIconName(icon) }]"
              @click="selectIcon(icon)"
            >
              <AIcon :type="getIconName(icon)" />
              <div class="icon-name">{{ icon }}</div>
            </div>
          </div>
        </a-tab-pane>
        <a-tab-pane
          key="editor"
          :tab="$t('components.IconLibrary.categoryEditor')"
        >
          <div class="icon-grid">
            <div
              v-for="icon in getFilteredCategory('editor')"
              :key="icon"
              :class="['icon-item', { active: selected === getIconName(icon) }]"
              @click="selectIcon(icon)"
            >
              <AIcon :type="getIconName(icon)" />
              <div class="icon-name">{{ icon }}</div>
            </div>
          </div>
        </a-tab-pane>
        <a-tab-pane
          key="data"
          :tab="$t('components.IconLibrary.categoryData')"
        >
          <div class="icon-grid">
            <div
              v-for="icon in getFilteredCategory('data')"
              :key="icon"
              :class="['icon-item', { active: selected === getIconName(icon) }]"
              @click="selectIcon(icon)"
            >
              <AIcon :type="getIconName(icon)" />
              <div class="icon-name">{{ icon }}</div>
            </div>
          </div>
        </a-tab-pane>
        <a-tab-pane
          key="logo"
          :tab="$t('components.IconLibrary.categoryLogo')"
        >
          <div class="icon-grid">
            <div
              v-for="icon in getFilteredCategory('logo')"
              :key="icon"
              :class="['icon-item', { active: selected === getIconName(icon) }]"
              @click="selectIcon(icon)"
            >
              <AIcon :type="getIconName(icon)" />
              <div class="icon-name">{{ icon }}</div>
            </div>
          </div>
        </a-tab-pane>
        <a-tab-pane
          key="other"
          :tab="$t('components.IconLibrary.categoryOther')"
        >
          <div class="icon-grid">
            <div
              v-for="icon in getFilteredCategory('other')"
              :key="icon"
              :class="['icon-item', { active: selected === getIconName(icon) }]"
              @click="selectIcon(icon)"
            >
              <AIcon :type="getIconName(icon)" />
              <div class="icon-name">{{ icon }}</div>
            </div>
          </div>
        </a-tab-pane>
        <a-tab-pane
          key="iconfont"
          tab="iconfont"
        >
          <div class="icon-grid">
            <div
              v-for="icon in getFilteredCategory('iconfont')"
              :key="icon"
              :class="['icon-item', { active: selected === getIconName(icon) }]"
              @click="selectIcon(icon, 'iconfont')"
            >
              <AIcon :type="getIconName(icon, 'iconfont')" />
              <div class="icon-name">{{ icon }}</div>
            </div>
          </div>
        </a-tab-pane>
      </a-tabs>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { categories } from './fields'

const { t: $t } = useI18n()

const emits = defineEmits(['save', 'close'])

const activeCategory = ref<string>('all')
const theme = ref<'Outlined' | 'Filled' | 'TwoTone'>('Outlined')
const searchText = ref<string>('')
const selected = ref<string>('')

// 获取所有图标
const allIcons = computed(() => {
  const icons: string[] = []
  Object.values(categories).forEach((category) => {
    icons.push(...category)
  })
  return [...new Set(icons)]
})

// 根据搜索和主题过滤图标
const filteredIcons = computed(() => {
  let icons = allIcons.value
  if (searchText.value) {
    icons = icons.filter((icon) => icon.toLowerCase().includes(searchText.value.toLowerCase()))
  }
  return icons
})

// 获取带主题的图标名称
const getIconName = (icon: string, type?: string) => {
  if (type === 'iconfont') {
    return icon
  }
  return `${icon}${theme.value}`
}

// 选择图标
const selectIcon = (icon: string, type?: string) => {
  const iconName = getIconName(icon, type)
  selected.value = iconName

  // 复制图标名称到剪贴板
  copyToClipboard(iconName)
}

// 复制到剪贴板
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    // message.success(`已复制: ${text}`)
  } catch (err) {
    // 降级方案：使用传统方法
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
    } catch (e) {
      console.error('复制失败:', e)
    }
    document.body.removeChild(textarea)
  }
}

// 获取过滤后的分类图标
const getFilteredCategory = (category: keyof typeof categories) => {
  let icons = categories[category]
  if (searchText.value) {
    icons = icons.filter((icon) => icon.toLowerCase().includes(searchText.value.toLowerCase()))
  }
  return icons
}

// 确认选择
const confirm = () => {
  if (selected.value) {
    emits('save', selected.value)
  }
}
</script>

<style scoped>
.icon-selector {
  height: 80vh;
}
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

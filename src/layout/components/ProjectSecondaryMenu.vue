<template>
  <div v-if="items.length" class="project-secondary-menu" :class="{ 'project-secondary-menu--grouped': grouped }">
    <a-menu v-if="grouped" mode="inline" :inline-indent="16" :selected-keys="[selectedKey]" :open-keys="openGroupKeys" @update:openKeys="openGroupKeys = $event" @click="handleGroupedClick">
      <a-sub-menu v-for="group in items" :key="group.key" :disabled="group.disabled">
        <template v-if="group.icon" #icon><AIcon :type="group.icon" /></template>
        <template #title><span class="ant-pro-menu-item"><span class="ant-pro-menu-item-title">{{ group.label }}</span></span></template>
        <a-menu-item v-for="item in group.children || []" :key="item.key" :disabled="item.disabled">
          <a class="ant-pro-menu-item" @click.prevent>
            <AIcon v-if="item.icon" :type="item.icon" />
            <span class="ant-pro-menu-item-title">{{ item.label }}</span>
            <span v-if="getMenuBadgeText(item)" class="layout-menu-badge">{{ getMenuBadgeText(item) }}</span>
          </a>
        </a-menu-item>
      </a-sub-menu>
    </a-menu>
    <a-tabs v-else :active-key="selectedKey" :tab-position="tabPosition" @change="handleClick">
      <a-tab-pane v-for="item in items" :key="item.key" :disabled="item.disabled">
        <template #tab><span class="project-secondary-menu__tab"><AIcon v-if="item.icon" :type="item.icon" /><span class="project-secondary-menu__label">{{ item.label }}</span><span v-if="getMenuBadgeText(item)" class="layout-menu-badge">{{ getMenuBadgeText(item) }}</span></span></template>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts" name="ProjectSecondaryMenu">
import { ref, watch, type PropType } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import { COMING_SOON_MENU_BADGE_TYPE, DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY } from '@jetlinks-web-core/utils/menuBadge'
import type { ProjectNavigationItem } from '../hooks/useProjectNavigation'
const props = defineProps({
  items: { type: Array as PropType<ProjectNavigationItem[]>, default: () => [] },
  selectedKey: { type: String, default: '' },
  tabPosition: { type: String as PropType<'top' | 'left'>, default: 'top' },
  grouped: { type: Boolean, default: false },
})
const emit = defineEmits<{ (event: 'select', path: string): void }>()
const openGroupKeys = ref<string[]>([])
let knownGroupKeys = new Set<string>()

// Ant Design Vue 的 Menu 没有 defaultOpenKeys：首次出现的分组展开，已手动收起的分组保持收起。
watch(() => props.grouped ? props.items.map(item => item.key) : [], keys => {
  const nextKeys = new Set(keys)
  openGroupKeys.value = [
    ...openGroupKeys.value.filter(key => nextKeys.has(key)),
    ...keys.filter(key => !knownGroupKeys.has(key)),
  ]
  knownGroupKeys = nextKeys
}, { immediate: true })

const getMenuBadgeText = (item: ProjectNavigationItem) => {
  const badge = item.menuBadge
  if (!badge) return ''
  if (badge.i18nKey) return String(i18n.global.t(badge.i18nKey))
  if (badge.text) return badge.text
  if (badge.type === COMING_SOON_MENU_BADGE_TYPE) return String(i18n.global.t(DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY))
  return ''
}
const handleClick = (key: string | number) => {
  const entries = props.grouped ? props.items.flatMap(group => group.children || []) : props.items
  const item = entries.find(item => item.key === String(key))
  if (!item || item.disabled) return
  emit('select', String(key))
}
// 与 ProLayout BaseMenu 使用相同的 Ant Menu 层级及类名，直接继承系统多级菜单样式。
const handleGroupedClick = ({ key }: { key: string | number }) => handleClick(key)
</script>

<style scoped>
.project-secondary-menu__tab { display: inline-flex; min-width: 0; align-items: center; gap: var(--space-1); }
</style>

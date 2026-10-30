<template>
  <div v-if="items.length" class="project-secondary-menu" :class="{ 'project-secondary-menu--grouped': grouped }">
    <DefineTabs v-slot="{ entries }">
      <a-tabs :activeKey="props.selectedKey" :tabPosition="props.tabPosition" @change="handleClick">
        <a-tab-pane v-for="item in entries" :key="item.key" :disabled="item.disabled">
          <template #tab>
            <span class="project-secondary-menu__tab">
              <AIcon v-if="item.icon" :type="item.icon" />
              <span class="project-secondary-menu__label">{{ item.label }}</span>
              <span v-if="getMenuBadgeText(item)" class="layout-menu-badge">{{ getMenuBadgeText(item) }}</span>
            </span>
          </template>
        </a-tab-pane>
      </a-tabs>
    </DefineTabs>
    <template v-if="grouped">
      <div v-for="group in items" :key="group.key" class="project-secondary-menu__group">
        <div class="project-secondary-menu__group-title">{{ group.label }}</div>
        <RenderTabs :entries="group.children || []" />
      </div>
    </template>
    <RenderTabs v-else :entries="items" />
  </div>
</template>

<script setup lang="ts" name="ProjectSecondaryMenu">
import { type PropType } from 'vue'
import { createReusableTemplate } from '@vueuse/core'
import i18n from '@jetlinks-web-core/locales'
import { COMING_SOON_MENU_BADGE_TYPE, DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY } from '@jetlinks-web-core/utils/menuBadge'
import type { ProjectNavigationItem } from '../hooks/useProjectNavigation'

const props = defineProps({
  items: { type: Array as PropType<ProjectNavigationItem[]>, default: () => [] },
  selectedKey: { type: String, default: '' },
  tabPosition: { type: String as PropType<'top' | 'left'>, default: 'top' },
  // 仅页面显式注册 grouped 时使用分类标题；现有平铺导航默认保持原样。
  grouped: { type: Boolean, default: false },
})
const emit = defineEmits<{ (event: 'select', path: string): void }>()
const [DefineTabs, RenderTabs] = createReusableTemplate<{ entries: ProjectNavigationItem[] }>()
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
  if (item?.disabled) return
  emit('select', String(key))
}
</script>

<style scoped lang="less">
.project-secondary-menu__tab { display: inline-flex; min-width: 0; align-items: center; gap: var(--space-1); }
.project-secondary-menu--grouped {
  .project-secondary-menu__group :deep(.ant-tabs) { height: auto; }
}
.project-secondary-menu__group-title {
  padding: var(--space-2) var(--space-4);
  color: var(--layout-menu-item-muted-color, var(--text-color-secondary));
  font-size: var(--fs-12);
  line-height: 1.5;
}
</style>

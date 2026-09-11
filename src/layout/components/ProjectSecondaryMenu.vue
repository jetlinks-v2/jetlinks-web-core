<template>
  <div v-if="items.length" class="project-secondary-menu">
    <a-tabs
      :activeKey="props.selectedKey"
      :tabPosition="props.tabPosition"
      @change="handleClick"
    >
      <a-tab-pane v-for="item in items" :key="item.key" :disabled="item.disabled">
        <template #tab>
          <span class="project-secondary-menu__tab">
            <AIcon v-if="item.icon" :type="item.icon" />
            <span class="project-secondary-menu__label">{{ item.label }}</span>
            <span v-if="getMenuBadgeText(item)" class="layout-menu-badge">
              {{ getMenuBadgeText(item) }}
            </span>
          </span>
        </template>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts" name="ProjectSecondaryMenu">
import { type PropType } from 'vue'
import i18n from '@jetlinks-web-core/locales'
import {
  COMING_SOON_MENU_BADGE_TYPE,
  DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY,
} from '@jetlinks-web-core/utils/menuBadge'
import type { ProjectNavigationItem } from '../hooks/useProjectNavigation'

const props = defineProps({
  items: {
    type: Array as PropType<ProjectNavigationItem[]>,
    default: () => [],
  },
  selectedKey: {
    type: String,
    default: '',
  },
  tabPosition: {
    type: String as PropType<'top' | 'left'>,
    default: 'top',
  },
})

const emit = defineEmits<{
  (event: 'select', path: string): void
}>()

const getMenuBadgeText = (item: ProjectNavigationItem) => {
  const badge = item.menuBadge
  if (!badge) return ''
  if (badge.i18nKey) return String(i18n.global.t(badge.i18nKey))
  if (badge.text) return badge.text
  if (badge.type === COMING_SOON_MENU_BADGE_TYPE) {
    return String(i18n.global.t(DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY))
  }
  return ''
}

const handleClick = (key: string | number) => {
  const item = props.items.find(item => item.key === String(key))
  if (item?.disabled) return

  emit('select', String(key))
}
</script>

<style scoped lang="less">
.project-secondary-menu__tab {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: var(--space-1);
}
</style>

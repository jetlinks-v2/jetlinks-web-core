<template>
<!--  <nav-->
<!--    v-if="items.length"-->
<!--    class="project-secondary-menu"-->
<!--    :aria-label="$t('ProjectLayout.navigationLabel')"-->
<!--  >-->
<!--    <a-menu-->
<!--      class="project-secondary-menu__items"-->
<!--      mode="horizontal"-->
<!--      :selectedKeys="selectedKeys"-->
<!--      @click="handleClick"-->
<!--    >-->
<!--        <a-menu-item-->
<!--            v-for="item in items"-->
<!--            :key="item.key"-->
<!--            :class="item.code ? PROJECT_ONBOARDING_MENU_TARGET_CLASSES[item.code] : undefined"-->
<!--        >-->
<!--            <AIcon :type="String(item.icon)" />-->
<!--            <span>{{ item.label }}</span>-->
<!--        </a-menu-item>-->
<!--    </a-menu>-->
<!--  </nav>-->
    <div class="project-secondary-menu" v-if="items.length > 0">
        <a-tabs @change="handleClick">
            <a-tab-pane v-for="item in items" :key="item.key">
                <template #tab>
                    <AIcon v-if="item.icon" :type="item.icon"/>
                    {{ item.label }}
                </template>
            </a-tab-pane>
        </a-tabs>
    </div>
</template>

<script setup lang="ts" name="ProjectSecondaryMenu">
import { computed, type PropType } from 'vue'
import { regular } from '@jetlinks-web/utils'
import type { ProjectNavigationItem } from '../hooks/useProjectNavigation'
import { PROJECT_ONBOARDING_MENU_TARGET_CLASSES } from '../utils/projectOnboarding'

type MenuClickInfo = {
  key: string | number
}

const props = defineProps({
  items: {
    type: Array as PropType<ProjectNavigationItem[]>,
    default: () => [],
  },
  selectedKey: {
    type: String,
    default: '',
  },
})

const emit = defineEmits<{
  (event: 'select', path: string): void
}>()

const getMenuIconSource = (icon?: string) => {
  return typeof icon === 'string' && (regular.isUrl(icon) || regular.isImg(icon)) ? icon : ''
}

const selectedKeys = computed(() => props.selectedKey ? [props.selectedKey] : [])

const handleClick = (key) => {
  emit('select', String(key))
}
</script>

<style scoped lang="less">
.project-secondary-menu {
    padding: 0 var(--space-4);
}

.project-secondary-menu__items {
  display: flex;
  align-items: center;
  min-width: 0;
  padding-inline: 0;
  border-bottom: 0;
  background: transparent;
  font-size: var(--fs-14);
  line-height: 20px;

  :deep(.ant-menu-item),
  :deep(.ant-menu-submenu) {
    top: 0;
    display: inline-flex;
    align-items: center;
    height: 32px;
    margin: 0 var(--space-3) 0 0;
    padding: 0 9px;
    border: 1px solid var(--line);
    border-radius: var(--r-3);
    background: rgba(255, 255, 255, 0.7);
    color: var(--ink-2);
    font-size: var(--fs-14);
    font-weight: 400;
    line-height: 20px;
    vertical-align: middle;
    transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);

    &:hover {
      background: rgba(255, 255, 255, 0.85);
      color: var(--ink-1);
    }

    &::after {
      display: none;
    }
  }

  :deep(.ant-menu-submenu-title) {
    height: auto;
    padding: 0;
    line-height: 20px;
  }

  :deep(.ant-menu-item:focus-visible),
  :deep(.ant-menu-submenu-title:focus-visible) {
    outline: none;
    box-shadow: var(--ring-focus);
  }

  :deep(.ant-menu-item-selected),
  :deep(.ant-menu-submenu-selected) {
    background: var(--bg);
    color: var(--accent);
    font-weight: 400;

    &:hover {
      color: var(--accent);
    }

    &::after {
      display: none;
    }
  }

  :deep(.ant-menu-item-disabled),
  :deep(.ant-menu-submenu-disabled) {
    background: rgba(255, 255, 255, 0.5);
    color: var(--ink-3) !important;
    opacity: 0.6;
  }

  :deep(.ant-menu-title-content) {
    display: inline-flex;
    align-items: center;
  }

  :deep(.ant-menu-item .anticon),
  :deep(.ant-menu-submenu-title .anticon) {
    font-size: 16px;
    line-height: 1;
  }
}
</style>

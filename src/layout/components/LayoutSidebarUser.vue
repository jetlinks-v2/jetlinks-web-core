<template>
  <div class="layout-sidebar-user" :class="{ 'layout-sidebar-user--collapsed': collapsed }">
    <div v-if="!collapsed" class="layout-sidebar-user__scope">
      <div class="layout-sidebar-user__scope-label">{{ $t('components.LayoutSidebarUser.scopeLabel') }}</div>
      <a-dropdown
        v-if="hasParkOptions"
        v-model:open="scopeOpen"
        placement="topLeft"
        trigger="click"
        overlay-class-name="layout-sidebar-scope-overlay"
      >
        <button class="layout-sidebar-user__scope-card" type="button">
          <span class="layout-sidebar-user__scope-path">{{ scopePathText }}</span>
          <AIcon type="DownOutlined" class="layout-sidebar-user__scope-arrow" />
        </button>

        <template #overlay>
          <div class="layout-sidebar-user__scope-menu">
            <button
              v-for="item in parkOptions"
              :key="item.key"
              class="layout-sidebar-user__scope-option"
              :class="{ 'layout-sidebar-user__scope-option--active': item.active }"
              type="button"
              @click="handleParkChange(item.raw)"
            >
              <div class="layout-sidebar-user__scope-option-title">{{ item.label }}</div>
              <div class="layout-sidebar-user__scope-option-subtitle">{{ item.description }}</div>
            </button>
          </div>
        </template>
      </a-dropdown>

      <div v-else class="layout-sidebar-user__scope-empty">{{ scopePathText }}</div>

      <div v-if="scopeDescription" class="layout-sidebar-user__scope-desc">{{ scopeDescription }}</div>
    </div>

    <a-button
      class="layout-sidebar-user__collapse"
      type="text"
      :aria-label="$t(collapsed ? 'components.LayoutSidebarUser.expand' : 'components.LayoutSidebarUser.collapse')"
      @click="emit('toggleCollapse')"
    >
      <template #icon>
        <AIcon :type="collapsed ? 'MenuUnfoldOutlined' : 'MenuFoldOutlined'" />
      </template>
    </a-button>
  </div>
</template>

<script setup lang="ts" name="LayoutSidebarUser">
import { useSystemStore } from '@jetlinks-web-core/store/system'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'

defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  (e: 'toggleCollapse'): void
}>()

const { t: $t } = useI18n()
const systemStore = useSystemStore()
const { currentTopOrgSetting, currentParkId, currentParkInfo, organizationPlatformState } = storeToRefs(systemStore)
const scopeOpen = ref(false)

const currentOrgName = computed(() => String(currentTopOrgSetting.value?.orgName || ''))
const currentParkName = computed(() => String(currentParkInfo.value?.name || currentTopOrgSetting.value?.defaultParkName || ''))
const scopePathText = computed(() => {
  if (currentOrgName.value && currentParkName.value) {
    return `${currentOrgName.value} / ${currentParkName.value}`
  }
  return currentOrgName.value || currentParkName.value || '--'
})
const scopeDescription = computed(() => String(currentTopOrgSetting.value?.companyName || ''))
const parkOptions = computed(() =>
  (organizationPlatformState.value.currentParks || []).map((item) => ({
    key: String(item.id || ''),
    label: item.name || '--',
    description: currentOrgName.value || item.orgName || '',
    active: String(item.id || '') === String(currentParkId.value || ''),
    raw: item,
  })),
)
const hasParkOptions = computed(() => parkOptions.value.length > 0)

const handleParkChange = async (park: Record<string, any>) => {
  scopeOpen.value = false
  const parkOrgId = String(park?.orgId || '')
  if (parkOrgId && parkOrgId !== String(systemStore.currentTopOrgId || '')) {
    await systemStore.loadTopOrgSetting(parkOrgId)
  }
  systemStore.setCurrentPark(park)
}
</script>

<style scoped lang="less">
.layout-sidebar-user {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1.75rem;
  align-items: center;
  gap: var(--space-1);
  padding: 0.5rem 0.625rem;
  border-top: 1px solid var(--jet-theme-border-secondary);
  background: var(--layout-menu-bg, var(--jet-theme-bg-container));

  &__scope {
    grid-column: 1 / -1;
    padding: 0.25rem 0 0.375rem;
  }

  &__scope-label {
    margin-bottom: 0.5rem;
    color: var(--jet-theme-text-description);
    font-size: var(--fs-12);
    line-height: 1.125rem;
  }

  &__scope-card,
  &__scope-empty {
    width: 100%;
    min-height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border: 0;
    border-radius: 0.625rem;
    background: color-mix(in srgb, var(--jet-theme-primary) 10%, #f3f7ff);
    color: var(--jet-theme-primary);
    font-size: var(--fs-14);
    line-height: 1.25rem;
  }

  &__scope-card {
    cursor: pointer;
  }

  &__scope-path {
    max-width: calc(100% - 1rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  &__scope-arrow {
    color: currentColor;
    font-size: var(--fs-12);
  }

  &__scope-desc {
    margin-top: 0.5rem;
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-12);
    line-height: 1.125rem;
  }

  &__collapse {
    grid-column: 2;
    justify-self: end;
    width: 1.75rem;
    height: 1.75rem;
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-12);
  }

  &__scope-menu {
    padding: var(--space-1);
    background: var(--chrome-elev, var(--jet-theme-bg-container));
    border: 1px solid var(--chrome-line, var(--jet-theme-border));
    border-radius: var(--chrome-popover-radius, var(--r-3));
    box-shadow: var(--shadow-pop);
  }

  &__scope-menu {
    width: 14.5rem;
  }

  &__scope-option {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    padding: 0.625rem 0.75rem;
    border: 0;
    border-radius: var(--r-2);
    background: transparent;
    text-align: left;
    cursor: pointer;

    &:hover,
    &--active {
      background: color-mix(in srgb, var(--jet-theme-primary) 10%, #f3f7ff);
    }
  }

  &__scope-option-title {
    color: var(--jet-theme-text);
    font-size: var(--fs-13);
    line-height: 1.25rem;
    font-weight: 600;
  }

  &__scope-option-subtitle {
    color: var(--jet-theme-text-secondary);
    font-size: var(--fs-12);
    line-height: 1.125rem;
  }

  &--collapsed {
    grid-template-columns: 1fr;
    padding: 0.5rem 0.375rem;

    .layout-sidebar-user__collapse {
      margin-top: var(--space-1);
      justify-self: center;
    }
  }
}
</style>

<style lang="less">
.layout-sidebar-user-overlay,
.layout-sidebar-scope-overlay {
  .ant-dropdown-menu {
    padding: 0;
  }
}
</style>

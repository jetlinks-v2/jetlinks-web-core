<template>
  <a-dropdown
    v-if="currentApplication"
    placement="bottomLeft"
    :trigger="['click']"
    :disabled="loading || switching"
  >
    <button
      class="application-trigger"
      type="button"
      :aria-label="$t('components.BusinessApplicationSwitcher.switchApplication')"
    >
      <a-spin :spinning="loading || switching" size="small">
        <BusinessApplicationIcon :application="currentApplication" />
      </a-spin>
      <a-tooltip :title="currentApplication.name">
        <span class="application-trigger__name">{{ currentApplication.name }}</span>
      </a-tooltip>
      <AIcon class="application-trigger__arrow" type="DownOutlined" />
    </button>

    <template #overlay>
      <a-menu class="application-menu" :selectable="false" @click="handleSelect">
        <a-menu-item
          v-for="item in applications"
          :key="item.id"
          :disabled="switching"
          :class="{ 'application-menu__item--selected': item.id === currentApplication.id }"
        >
          <div class="application-menu__item">
            <BusinessApplicationIcon :application="item" />
            <a-tooltip :title="item.name">
              <span class="application-menu__name">{{ item.name }}</span>
            </a-tooltip>
            <AIcon
              v-if="item.id === currentApplication.id"
              class="application-menu__check"
              type="CheckOutlined"
            />
          </div>
        </a-menu-item>
      </a-menu>
    </template>
  </a-dropdown>

  <div v-else class="project-layout__brand-main">
    <img v-if="fallbackLogo" class="project-layout__brand-logo" :src="fallbackLogo" alt="">
    <span class="project-layout__brand-title">{{ fallbackTitle }}</span>
  </div>

  <Teleport to="body">
    <div
      v-if="switching"
      class="business-application-switch-mask"
      :aria-label="$t('components.BusinessApplicationSwitcher.switching')"
      role="status"
    >
      <a-spin size="large" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { AIcon } from '@jetlinks-web/components'
import { useBusinessApplicationStore } from '@jetlinks-web-core/store/businessApplication'
import BusinessApplicationIcon from './BusinessApplicationIcon.vue'

type MenuClickEvent = { key: string | number }

defineProps({
  fallbackLogo: {
    type: String,
    default: '',
  },
  fallbackTitle: {
    type: String,
    default: '',
  },
})

const { t: $t } = useI18n()
const store = useBusinessApplicationStore()
const { applications, currentApplication, loading, switching } = storeToRefs(store)

const handleSelect = ({ key }: MenuClickEvent) => {
  void store.switchApplication(String(key))
}
</script>

<style scoped lang="less">
.application-trigger {
  display: inline-flex;
  align-items: center;
  max-width: 12.5rem;
  height: 2.5rem;
  min-width: 0;
  gap: var(--space-2);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--r-2);
  background: transparent;
  color: var(--ink-1);
  cursor: pointer;
  font-size: var(--fs-14);
  font-weight: 500;
  transition: background 0.16s ease;

  &:hover,
  &:focus-visible {
    background: var(--bg-hover);
  }

  &:disabled {
    cursor: wait;
  }

  &__name {
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__arrow {
    color: var(--ink-3);
    font-size: var(--fs-12);
  }
}

.application-menu {
  width: 16rem;
  max-height: 22rem;
  overflow-y: auto;
  padding: var(--space-1);
  border-radius: var(--r-3);

  &__item {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: var(--space-2);
  }

  &__item--selected {
    background: var(--jet-theme-primary-soft);
    color: var(--jet-theme-primary);
  }

  &__name {
    flex: 1;
    overflow: hidden;
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__check {
    color: var(--jet-theme-primary);
  }
}

.business-application-switch-mask {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--jet-theme-bg-container) 72%, transparent);
}
</style>

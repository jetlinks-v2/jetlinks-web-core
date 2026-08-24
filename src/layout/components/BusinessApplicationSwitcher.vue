<template>
  <a-dropdown
    v-if="currentApplication"
    :placement="mode === 'header' ? 'bottomRight' : 'bottomLeft'"
    :trigger="['click']"
    :disabled="loading || switching"
  >
    <button
      class="application-trigger"
      :class="`application-trigger--${mode}`"
      type="button"
      :aria-label="$t('components.BusinessApplicationSwitcher.switchApplication')"
    >
      <template v-if="mode === 'header'">
        <AIcon class="application-trigger__header-icon" type="AppstoreOutlined" />
        <span class="application-trigger__header-label">
          {{ $t('components.BusinessApplicationSwitcher.headerLabel') }}
        </span>
      </template>
      <template v-else>
        <a-spin :spinning="loading || switching" size="small">
          <BusinessApplicationIcon :application="currentApplication" />
        </a-spin>
        <a-tooltip :title="currentApplication.name">
          <span class="application-trigger__name">{{ currentApplication.name }}</span>
        </a-tooltip>
      </template>
    </button>

    <template #overlay>
      <div class="application-menu-panel">
        <div v-if="mode === 'header'" class="application-menu-panel__title">
          {{ $t('components.BusinessApplicationSwitcher.quickEntry') }}
        </div>
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
      </div>
    </template>
  </a-dropdown>

  <div v-else-if="mode === 'brand'" class="project-layout__brand-main">
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
import type { PropType } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { AIcon } from '@jetlinks-web/components'
import { useBusinessApplicationStore } from '@jetlinks-web-core/store/businessApplication'
import BusinessApplicationIcon from './BusinessApplicationIcon.vue'

type MenuClickEvent = { key: string | number }

defineProps({
  mode: {
    type: String as PropType<'brand' | 'header'>,
    default: 'brand',
  },
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

<style scoped lang="less" src="./BusinessApplicationSwitcher.less"></style>

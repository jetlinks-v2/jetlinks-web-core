<template>
  <div class="notice-container">
    <a-dropdown v-model:open="visible" :trigger="['click']" :placement="props.placement" :getPopupContainer="resolvePopupContainer">
      <a-badge size="small" :count="total" :overflow-count="BADGE_OVERFLOW_COUNT" :offset="[-8, 8]">
        <button type="button" class="notice-trigger" :aria-label="$t('PersonalCenter.messagesGroup')" :aria-expanded="visible">
          <AIcon class="notice-icon" :type="props.icon" />
        </button>
      </a-badge>
      <template #overlay>
        <div class="notice-panel">
          <div class="notice-panel__header">
            <strong>{{ $t('PersonalCenter.messagesGroup') }}</strong>
            <span v-if="!loading && !error" class="notice-panel__unread">
              {{ total ? $t('components.Notice.unreadCount', { count: total > BADGE_OVERFLOW_COUNT ? '99+' : total }) : $t('components.Notice.allRead') }}
            </span>
          </div>
          <a-alert v-if="error" type="warning" show-icon :message="$t('components.Notice.loadFailed')">
            <template #action><a-button type="link" size="small" :loading="loading" @click="retry">{{ $t('components.Notice.retry') }}</a-button></template>
          </a-alert>
          <div v-if="loading && !tabs.length" class="notice-panel__loading"><a-spin /></div>
          <NoticeInfo v-else-if="!error || tabs.length" ref="noticeInfoRef" :tabs="tabs" :provider-names="providerNames" :unavailable="error" @action="handleRead" />
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts" name="Notice">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import NoticeInfo from './NoticeInfo.vue'
import { BADGE_OVERFLOW_COUNT } from './noticeUtils'
import { useHeaderNotice } from './useHeaderNotice'

type NoticePlacement = 'top' | 'bottom' | 'topLeft' | 'topRight' | 'topCenter' | 'bottomLeft' | 'bottomRight' | 'bottomCenter'
type NoticePopupContainer = (triggerNode: HTMLElement) => HTMLElement
const props = defineProps({
  icon: { type: String, default: 'BellOutlined' },
  placement: { type: String as PropType<NoticePlacement>, default: 'bottomRight' },
  getPopupContainer: { type: Function as PropType<NoticePopupContainer>, default: undefined },
})
const { t: $t } = useI18n()
const { visible, total, loading, error, tabs, providerNames, noticeInfoRef, handleRead, retry } = useHeaderNotice()
const resolvePopupContainer = (triggerNode: HTMLElement) => (
  props.getPopupContainer?.(triggerNode) || document.body
)
</script>

<style scoped lang="less">
.notice-container { display: flex; align-items: center; }
.notice-trigger {
  display: inline-flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem; padding: 0; border: 0; border-radius: var(--r-2);
  background: transparent; color: inherit; cursor: pointer;
  &:hover { color: var(--jet-theme-primary); background: var(--jet-theme-primary-soft); }
  &:focus-visible { outline: 2px solid var(--jet-theme-primary); outline-offset: 2px; }
}
.notice-icon { font-size: var(--fs-16); }
.notice-panel {
  width: min(23.75rem, calc(100vw - 2rem)); overflow: hidden;
  border: 1px solid var(--jet-theme-border-secondary); border-radius: var(--r-3);
  background: var(--jet-theme-bg-container); box-shadow: var(--shadow-pop);
  &__header {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);
    padding: var(--space-3) var(--space-4); color: var(--text-color); font-size: var(--fs-14);
    strong { font-weight: 600; }
  }
  &__unread { color: color-mix(in srgb, var(--jet-theme-text-secondary) 70%, var(--jet-theme-bg-container)); font-size: var(--fs-12); }
  &__loading { padding: var(--space-6); text-align: center; }
  :deep(.ant-alert) { margin: 0 var(--space-3) var(--space-2); }
}
</style>

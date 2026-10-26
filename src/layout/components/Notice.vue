<template>
  <div class="notice-container" ref="noticeRef">
    <a-dropdown
      v-model:open="visible"
      :trigger="['click']"
      :placement="props.placement"
      :getPopupContainer="resolvePopupContainer"
    >
      <a-badge :count="total" :overflow-count="BADGE_OVERFLOW_COUNT" :offset="[3, -3]">
	      <AIcon class="notice-icon" :type="props.icon" />
      </a-badge>
      <template #overlay>
        <div class="notice-panel">
          <a-alert v-if="error" type="warning" show-icon :message="$t('components.Notice.loadFailed')">
            <template #action><a-button type="link" size="small" :loading="loading" @click="retry">{{ $t('components.Notice.retry') }}</a-button></template>
          </a-alert>
          <a-spin v-if="loading && !tabs.length" />
          <NoticeInfo v-else-if="!error || tabs.length" ref="noticeInfoRef" :tabs="tabs" @action="handleRead" />
        </div>
      </template>
    </a-dropdown>
  </div>
</template>

<script setup lang="ts" name="Notice">
import { ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import NoticeInfo from './NoticeInfo.vue'
import { BADGE_OVERFLOW_COUNT } from './noticeUtils'
import { useHeaderNotice } from './useHeaderNotice'

type NoticePlacement = 'top' | 'bottom' | 'topLeft' | 'topRight' | 'topCenter' | 'bottomLeft' | 'bottomRight' | 'bottomCenter'
type NoticePopupContainer = (triggerNode: HTMLElement) => HTMLElement
const props = defineProps({
  icon: { type: String, default: 'BellOutlined' },
  placement: { type: String as PropType<NoticePlacement>, default: 'bottomLeft' },
  getPopupContainer: { type: Function as PropType<NoticePopupContainer>, default: undefined }
})
const { t: $t } = useI18n()
const noticeRef = ref<HTMLElement | null>(null)
const { visible, total, loading, error, tabs, noticeInfoRef, handleRead, retry } = useHeaderNotice()
const resolvePopupContainer = (triggerNode: HTMLElement) => (
  props.getPopupContainer?.(triggerNode) || noticeRef.value || document.body
)
</script>

<style scoped lang="less">
.notice-panel { min-width: 24rem; }
.notice-container {
		display: flex;
		align-items: center;
    .notice-icon {
        font-size: var(--fs-h4);
    }

    .icon-content {
        height: 3rem;
        display: flex;
        align-items: center;
        position: relative;

        .unread {
            position: absolute;
            top: 0;
            right: -0.75rem;
            min-width: 1.25rem;
            height: 1.25rem;
            padding: 0 0.375rem;
            color: var(--accent-ink);
            font-weight: normal;
            font-size: var(--fs-12);
            line-height: 1.25rem;
            white-space: nowrap;
            text-align: center;
            background: var(--jet-theme-error);
            border-radius: 0.625rem;
        }
    }
}</style>

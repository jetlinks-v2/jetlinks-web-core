<template>
  <div class="notice-info-container">
    <a-tabs v-if="tabs.length" v-model:active-key="activeKey" size="small" :animated="false">
      <a-tab-pane v-for="item in tabs" :key="item.key" :tab="$t(item.tab)" />
    </a-tabs>
    <div v-if="failed" class="notice-info__error" role="alert">
      <span>{{ $t('components.Notice.loadFailed') }}</span>
      <a-button type="link" size="small" :loading="loading" @click="refresh">{{ $t('components.Notice.retry') }}</a-button>
    </div>
    <a-spin :spinning="loading">
      <div class="notice-info__list">
        <NoticeItem v-for="item in list" :key="item.id" :data="item" :source-name="providerNames[item.topicProvider || '']" :disabled="!!openingId" @select="selectNotice" />
        <div v-if="!loading && !failed && !unavailable && !list.length" class="notice-info__empty">
          <CloudEmpty :image-style="{ height: '3rem' }" :description="$t(activeKey === 'announcement' ? 'components.Notice.emptyAnnouncements' : 'components.Notice.emptyNotifications')" />
        </div>
        <div v-else-if="loading && !list.length" class="notice-info__placeholder" />
      </div>
    </a-spin>
    <div class="notice-info__footer">
      <a-button type="link" class="notice-info__more" @click="openMessageCenter">
        <span>{{ $t('components.Notice.messageCenter') }}</span>
        <RightOutlined class="notice-info__more-arrow" aria-hidden="true" />
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { RightOutlined } from '@ant-design/icons-vue'
import NoticeItem from './NoticeItem.vue'
import type { NoticeTabItem } from './noticeUtils'
import { useNoticeInfo } from './useHeaderNotice'

const props = defineProps({
  tabs: { type: Array as PropType<NoticeTabItem[]>, default: () => [] },
  unavailable: { type: Boolean, default: false },
  providerNames: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
})
const emits = defineEmits<{ (event: 'action'): void }>()
const { t: $t } = useI18n()
const { activeKey, list, loading, failed, openingId, refresh, selectNotice, openMessageCenter } = useNoticeInfo(props, () => emits('action'))
defineExpose({ refresh })
</script>

<style lang="less" scoped>
.notice-info-container {
  :deep(.ant-tabs-nav) { margin: 0; padding: 0 var(--space-4); }
  :deep(.ant-tabs-tab) { padding: var(--space-2) 0; font-size: var(--fs-13); }
  :deep(.ant-tabs-content-holder) { display: none; }
}
.notice-info__list { max-height: min(22rem, calc(100dvh - 13rem)); overflow-y: auto; overscroll-behavior: contain; }
.notice-info__empty { padding: var(--space-5) var(--space-4); }
.notice-info__placeholder { height: 7rem; }
.notice-info__error { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: var(--space-3) var(--space-4); color: var(--jet-theme-text-secondary); font-size: var(--fs-12); }
.notice-info__footer {
  display: flex; align-items: center; justify-content: center; min-height: 2.5rem;
  border-top: 1px solid var(--jet-theme-border-secondary);
}
.notice-info__more { display: inline-flex; align-items: center; justify-content: center; gap: var(--space-1); font-size: var(--fs-12); }
.notice-info__more > .notice-info__more-arrow {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1em; height: 1em; margin: 0; margin-inline-start: 0;
  color: inherit; font-size: var(--fs-12); line-height: 0; vertical-align: 0; flex: none;
}
</style>

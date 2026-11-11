<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveSsoIcon } from '@jetlinks-web-core/utils/sso-icon'
import type { LoginMethodEntry } from './useLoginMethods'

const props = defineProps({ entry: { type: Object as PropType<LoginMethodEntry>, required: true } })
const { t } = useI18n()
const displayValue = computed(() => {
  const value = props.entry.value
  return value && value !== t('AccountInfo.unbound') && value !== props.entry.state?.text ? value : ''
})
</script>

<template>
  <a-list-item :id="entry.key" class="login-method-row">
    <a-list-item-meta>
      <template #avatar>
        <a-avatar v-if="entry.binding" :size="38" shape="square" :src="resolveSsoIcon(entry.binding)" />
        <a-avatar v-else :size="38" shape="square" class="login-method-row__icon">
          <template #icon><AIcon :type="entry.icon" /></template>
        </a-avatar>
      </template>
      <template #title>
        <div class="login-method-row__title">
          <span class="login-method-row__label">{{ entry.label }}</span>
          <span v-if="displayValue && entry.kind === 'password'" class="login-method-row__value" :title="displayValue">{{ displayValue }}</span>
          <span v-if="entry.detail" class="login-method-row__detail">{{ entry.detail }}</span>
        </div>
      </template>
      <template #description>
        <div class="login-method-row__desc"><slot name="description">{{ entry.description }}</slot></div>
      </template>
    </a-list-item-meta>
    <template #actions>
      <div class="login-method-row__actions">
        <div v-if="entry.state || (displayValue && entry.kind !== 'password')" class="login-method-row__status">
          <a-tooltip v-if="displayValue && entry.kind !== 'password'" :title="displayValue"><span class="login-method-row__receiver">{{ displayValue }}</span></a-tooltip>
          <a-tag v-if="entry.state" :bordered="false" :color="entry.state.status === 'warning' ? 'warning' : entry.state.bound ? 'success' : undefined" class="login-method-row__tag" :class="{ 'login-method-row__tag--neutral': !entry.state.bound && (!entry.state.status || entry.state.status === 'default') }">
            <a-badge :status="entry.state.status || (entry.state.bound ? 'success' : 'default')" />{{ entry.state.text }}
          </a-tag>
        </div>
        <slot />
      </div>
    </template>
  </a-list-item>
</template>

<style scoped>
.login-method-row { align-items: center; gap: var(--space-4); padding: var(--space-3) var(--space-6); transition: background 0.15s; }
.login-method-row:hover { background: color-mix(in srgb, var(--accent-soft) 20%, var(--bg-elev)); }
.login-method-row :deep(.ant-list-item-meta) { align-items: center; min-width: 0; }
.login-method-row :deep(.ant-list-item-meta-content) { min-width: 0; }
.login-method-row :deep(.ant-list-item-meta-title) { margin-bottom: var(--space-1); }
.login-method-row :deep(.ant-list-item-action) { margin: 0; flex: none; }
.login-method-row :deep(.ant-list-item-action > li) { padding: 0; }
.login-method-row__icon { background: var(--accent-soft); color: var(--accent); border-radius: var(--r-3); }
.login-method-row__title { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-1) var(--space-3); line-height: var(--lh-normal); }
.login-method-row__label { font-size: var(--fs-16); font-weight: 600; color: var(--text-color); overflow-wrap: anywhere; }
.login-method-row__value, .login-method-row__detail { min-width: 0; overflow-wrap: anywhere; font-size: var(--fs-13); font-weight: 400; }
.login-method-row__value, .login-method-row__detail { color: color-mix(in srgb, var(--text-color-secondary) 75%, var(--bg-elev)); }
.login-method-row__desc { color: var(--text-color-secondary); }
.login-method-row__desc { font-size: var(--fs-13); line-height: var(--lh-relaxed); }
.login-method-row__actions { display: flex; align-items: center; gap: var(--space-5); line-height: var(--lh-normal); }
.login-method-row__actions :deep(.ant-btn) { min-width: 4rem; }
.login-method-row__status { display: flex; align-items: center; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); max-width: 14rem; }
.login-method-row__receiver { display: block; max-width: 10rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-color-secondary); font-size: var(--fs-13); }
.login-method-row__tag.ant-tag { display: inline-flex; align-items: center; gap: var(--space-1); margin: 0; padding: var(--space-1) var(--space-2); border: 0; border-radius: var(--r-1); font-size: var(--fs-12); line-height: var(--fs-16); }
.login-method-row__tag :deep(.ant-badge-status) { display: inline-flex; align-items: center; line-height: 0; }
.login-method-row__tag :deep(.ant-badge-status-dot) { top: 0; }
.login-method-row__tag--neutral { color: color-mix(in srgb, var(--text-color-secondary) 85%, var(--bg-elev)); }
@container account-basic (max-width: 50rem) {
  .login-method-row { padding: var(--space-3) var(--space-4); }
  .login-method-row__actions { flex-direction: column; align-items: flex-end; gap: var(--space-2); }
}
@container account-basic (max-width: 38rem) {
  .login-method-row { flex-wrap: wrap; gap: var(--space-3); }
  .login-method-row :deep(.ant-list-item-meta) { flex-basis: 100%; }
  .login-method-row :deep(.ant-list-item-action) { margin: 0 0 0 auto; }
  .login-method-row__actions { flex-direction: row; align-items: center; }
  .login-method-row__status { max-width: 12rem; }
}
@media (prefers-reduced-motion: reduce) {
  .login-method-row { transition: none; }
}
</style>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveSsoIcon } from '@jetlinks-web-core/utils/sso-icon'
import { maskContactValue } from '../../contactPresentation'
import type { LoginMethodEntry } from './useLoginMethods'

const props = defineProps({ entry: { type: Object as PropType<LoginMethodEntry>, required: true } })
const { t } = useI18n()
const displayValue = computed(() => {
  const value = props.entry.value
  if (!value || value === t('AccountInfo.unbound') || value === props.entry.state?.text) return ''
  return props.entry.kind === 'mobile' || props.entry.kind === 'email'
    ? maskContactValue(value, props.entry.kind)
    : value
})
</script>

<template>
  <a-list-item :id="entry.key" class="login-method-row">
    <a-list-item-meta>
      <template #avatar>
        <a-avatar v-if="entry.binding" :size="32" shape="square" :src="resolveSsoIcon(entry.binding)" />
        <a-avatar v-else :size="32" shape="square" class="login-method-row__icon">
          <template #icon><AIcon :type="entry.icon" /></template>
        </a-avatar>
      </template>
      <template #title>
        <div class="login-method-row__title">
          <span class="login-method-row__label">{{ entry.label }}</span>
          <span v-if="displayValue && entry.kind !== 'sso'" class="login-method-row__value" :title="displayValue">{{ displayValue }}</span>
          <span v-if="entry.detail && entry.kind !== 'sso'" class="login-method-row__detail">{{ entry.detail }}</span>
          <a-badge v-if="entry.state" :status="entry.state.status || (entry.state.bound ? 'success' : 'default')" class="login-method-row__status">
            <template #text><a-typography-text :type="entry.state.status === 'warning' ? 'warning' : 'secondary'" class="login-method-row__state-text">{{ entry.state.text }}</a-typography-text></template>
          </a-badge>
          <span v-if="entry.kind === 'sso' && displayValue" class="login-method-row__detail" :title="displayValue"><span aria-hidden="true">· </span>{{ displayValue }}</span>
          <span v-if="entry.kind === 'sso' && entry.detail" class="login-method-row__detail"><span aria-hidden="true">· </span>{{ entry.detail }}</span>
        </div>
      </template>
      <template #description>
        <div class="login-method-row__desc"><slot name="description">{{ entry.description }}</slot></div>
      </template>
    </a-list-item-meta>
    <template #actions>
      <slot />
    </template>
  </a-list-item>
</template>

<style scoped>
.login-method-row { align-items: center; gap: var(--space-4); padding: var(--space-4); transition: background 0.15s; }
.login-method-row:hover { background: color-mix(in srgb, var(--accent-soft) 20%, var(--bg-elev)); }
.login-method-row :deep(.ant-list-item-meta) { align-items: center; min-width: 0; }
.login-method-row :deep(.ant-list-item-meta-content) { min-width: 0; }
.login-method-row :deep(.ant-list-item-meta-title) { margin-bottom: var(--space-1); }
.login-method-row :deep(.ant-list-item-action) { margin: 0; flex: none; }
.login-method-row :deep(.ant-list-item-action > li) { padding: 0; }
.login-method-row__icon { background: var(--accent-soft); color: var(--accent); border-radius: var(--r-3); }
.login-method-row__title { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-1) var(--space-3); line-height: var(--lh-normal); }
.login-method-row__label { font-size: var(--fs-14); font-weight: 600; color: var(--text-color); overflow-wrap: anywhere; }
.login-method-row__value, .login-method-row__detail { min-width: 0; max-width: 18rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-13); font-weight: 400; }
.login-method-row__value { color: var(--text-color); }
.login-method-row__detail { color: var(--text-color-secondary); }
.login-method-row__desc { color: var(--account-hint-color, var(--text-color-secondary)); }
.login-method-row__desc { font-size: var(--fs-13); line-height: var(--lh-relaxed); }
.login-method-row :deep(.ant-list-item-action .ant-btn) { min-width: 3.25rem; }
.login-method-row__status { display: inline-flex; align-items: center; white-space: nowrap; }
.login-method-row__state-text { font-size: var(--fs-12); font-weight: 400; }
@container account-basic (max-width: 38rem) {
  .login-method-row { flex-wrap: wrap; gap: var(--space-3); }
  .login-method-row :deep(.ant-list-item-meta) { flex-basis: 100%; }
  .login-method-row :deep(.ant-list-item-action) { margin: 0 0 0 auto; }
  .login-method-row__value, .login-method-row__detail { max-width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .login-method-row { transition: none; }
}
</style>

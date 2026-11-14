<script setup lang="ts">
import { computed, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { onlyMessage } from '@jetlinks-web/utils'
import { resolvePublicAssetUrl } from '@jetlinks-web-core/utils/public-asset'
import LoginMethods from './LoginMethods/index.vue'
import { useBasicProfile } from './useBasicProfile'
import type { AccountCardItem, AccountCardProfile, AccountEditTarget } from '../types'

const props = defineProps({ profile: { type: Object as PropType<AccountCardProfile>, required: true } })
const emit = defineEmits<{ (event: 'edit', target: AccountEditTarget): void; (event: 'password'): void; (event: 'notification-settings'): void }>()
const { t, locale } = useI18n()
const { saving, saveError, saveName, saveAvatar, fields } = useBasicProfile(() => props.profile)
const nameError = ref('')

async function saveDisplayName(value: string) {
  const name = value.trim()
  nameError.value = !name ? t('PersonalCenter.nameRequired') : [...name].length > 20 ? t('PersonalCenter.nameTooLong', { count: [...name].length }) : ''
  if (nameError.value) return false
  const saved = await saveName(name)
  if (!saved) nameError.value = t('PersonalCenter.saveFailed')
  return saved
}

const accountId = computed(() => props.profile.items.find(item => item.key === 'id')?.value || '')
const shortAccountId = computed(() => accountId.value.length > 10
  ? `${accountId.value.slice(0, 4)}…${accountId.value.slice(-6)}` : accountId.value)

async function copyAccountId() {
  if (!accountId.value) return
  try {
    await navigator.clipboard.writeText(accountId.value)
    onlyMessage(t('PersonalCenter.copySuccess'), 'success')
  } catch {
    onlyMessage(t('PersonalCenter.copyFailed'), 'error')
  }
}

const organizationFields = computed<AccountCardItem[]>(() => {
  const items = ['roles', 'orgs', 'createTime'].flatMap(key => {
    const item = props.profile.items.find(field => field.key === key)
    return item ? [item] : key === 'createTime' ? [{ key, label: t('PersonalCenter.createdAt'), value: '—' }] : []
  })
  // 最近登录来源于既有用户资料；缺失时不能用当前时间或活跃时间代替。
  return [...items, fields.value.find(item => item.key === 'loginTime') || { key: 'loginTime', label: t('PersonalCenter.latestLogin'), value: '—' }]
})
const organizationIcons: Record<string, string> = {
  roles: 'SafetyCertificateOutlined', orgs: 'ApartmentOutlined', createTime: 'CalendarOutlined', loginTime: 'ClockCircleOutlined',
}
const orgNote = computed(() => {
  const fields = organizationFields.value.filter(item => item.unassigned).map(item => item.label)
  if (!fields.length) return t('PersonalCenter.orgNote')
  return t('PersonalCenter.orgNoteEmpty', {
    fields: new Intl.ListFormat(locale.value, { style: 'long', type: 'conjunction' }).format(fields),
  })
})
</script>

<template>
  <div class="account-basic">
    <a-alert v-if="saveError" type="error" show-icon :message="$t('PersonalCenter.saveFailed')" />
    <ContentPanel :background="false" :padding="0" fill class="account-basic__profile">
      <div class="account-basic__profile-top">
        <a-descriptions layout="vertical" size="small" :colon="false" :column="1" class="account-basic__credentials">
          <a-descriptions-item :label="$t('PersonalCenter.nameLabel')">
            <div class="account-basic__item">
              <div class="account-basic__item-value account-basic__name">
                <InputEditable
                  v-if="profile.canEdit"
                  :value="profile.name" trigger="icon" :label="$t('AccountCenter.editField', { field: $t('PersonalCenter.nameLabel') })"
                  :max-length="20" :disabled="saving" :save="saveDisplayName" :error="nameError"
                  :text-style="{ fontSize: 'var(--fs-14)', fontWeight: 500 }"
                />
                <span v-else>{{ profile.name }}</span>
              </div>
              <div class="account-basic__item-hint">{{ $t('PersonalCenter.nameHint') }}</div>
            </div>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('PersonalCenter.account')">
            <div class="account-basic__item">
              <div class="account-basic__item-value"><span class="account-basic__mono">{{ profile.username }}</span></div>
              <div class="account-basic__item-hint">{{ $t('PersonalCenter.usernameHint') }}</div>
            </div>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('PersonalCenter.accountIdLabel')">
            <div class="account-basic__item">
              <div class="account-basic__item-value">
                <span class="account-basic__mono" :title="accountId">{{ shortAccountId }}</span>
                <a-tooltip :title="$t('PersonalCenter.copyId')">
                  <a-button type="text" size="small" class="account-basic__copy-btn" :aria-label="$t('PersonalCenter.copyId')" @click="copyAccountId">
                    <template #icon><AIcon type="CopyOutlined" /></template>
                  </a-button>
                </a-tooltip>
              </div>
              <div class="account-basic__item-hint">{{ $t('PersonalCenter.accountIdHint') }}</div>
            </div>
          </a-descriptions-item>
        </a-descriptions>

        <div class="account-basic__avatar-section">
          <div class="account-basic__avatar-label">{{ $t('AccountInfo.avatar') }}</div>
          <div class="account-basic__avatar-container">
            <div v-if="profile.canEdit && !saving" class="account-basic__avatar-uploader" :title="$t('PersonalCenter.changeAvatar')">
              <ImageUpload
                :value="profile.avatar || ''" :disabled="saving" :size="2" accept="image/jpeg,image/png"
                :border-style="{ width: '100%', height: '100%', border: 'none', borderRadius: '50%', overflow: 'visible' }"
                :style="{ padding: 0, background: 'transparent' }"
                :cropper-props="{ fixed: true, fixedNumber: [1, 1], autoCropWidth: 200, autoCropHeight: 200 }"
                @update:value="saveAvatar"
              >
                <template #content>
                  <a-avatar :src="resolvePublicAssetUrl(profile.avatar)" class="account-basic__avatar" aria-hidden="true">{{ profile.name.trim().slice(0, 1) }}</a-avatar>
                  <span class="account-basic__avatar-camera" aria-hidden="true"><AIcon type="CameraOutlined" /></span>
                  <span class="account-basic__visually-hidden">{{ $t('PersonalCenter.changeAvatar') }}</span>
                </template>
              </ImageUpload>
            </div>
            <a-avatar v-else :src="resolvePublicAssetUrl(profile.avatar)" class="account-basic__avatar">{{ profile.name.trim().slice(0, 1) }}</a-avatar>
          </div>
          <div class="account-basic__item-hint">{{ $t('PersonalCenter.avatarNote') }}</div>
        </div>
      </div>

      <a-divider class="account-basic__divider" />

      <div class="account-basic__organization">
        <a-descriptions layout="vertical" size="small" :colon="false" :column="{ xs: 1, sm: 2, md: 4 }">
          <a-descriptions-item v-for="item in organizationFields" :key="item.key" :class="{ 'account-basic__organization-item--login': item.key === 'loginTime' }">
            <template #label><span class="account-basic__organization-label"><AIcon :type="organizationIcons[item.key]" aria-hidden="true" />{{ item.label }}</span></template>
            <a-tooltip v-if="item.tags?.length" :trigger="['hover', 'click']" placement="top" destroy-tooltip-on-hide>
              <template #title>
                <div class="account-basic__tags-tooltip" tabindex="0">
                  <div v-for="(tag, index) in item.tags" :key="index" class="account-basic__tags-tooltip-item">{{ tag }}</div>
                </div>
              </template>
              <a-button type="text" class="account-basic__tags-trigger">
                <span class="account-basic__tags-summary">
                  <a-tag :bordered="false" class="account-basic__tag-first">{{ item.tags[0] }}</a-tag>
                  <a-tag v-if="item.tags.length > 1" :bordered="false" class="account-basic__tag-more">+{{ item.tags.length - 1 }}</a-tag>
                </span>
              </a-button>
            </a-tooltip>
            <span v-else :title="item.value">{{ item.key === 'createTime' ? item.value.slice(0, 10) : item.value }}</span>
          </a-descriptions-item>
        </a-descriptions>
        <div class="account-basic__item-hint account-basic__organization-note">{{ orgNote }}</div>
      </div>
    </ContentPanel>
    <LoginMethods :profile="profile" @edit="emit('edit', $event)" @password="emit('password')" @notification-settings="emit('notification-settings')" />
  </div>
</template>

<style scoped lang="less">
.account-basic {
  --account-avatar-size: 10rem;
  --account-hint-color: color-mix(in srgb, var(--text-color-secondary) 85%, var(--bg-elev));
  container: account-basic / inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-width: 0;
  &__profile { display: flex; flex-direction: column; flex: none; min-width: 0; overflow: visible; }
  &__profile-top { display: grid; grid-template-columns: minmax(0, 1fr) var(--account-avatar-size); gap: var(--space-8); align-items: start; min-width: 0; }
  &__item { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  &__item-value { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-1); min-height: 1.5rem; min-width: 0; font-size: var(--fs-14); color: var(--text-color); }
  &__name { max-width: 24rem; font-weight: 500; line-height: var(--lh-normal); }
  &__name > .input-editable { width: 100%; }
  &__name :deep(.input-editable > div > .ant-btn) { opacity: 0; transition: opacity 0.15s; }
  &__name:hover :deep(.input-editable > div > .ant-btn), &__name:focus-within :deep(.input-editable > div > .ant-btn) { opacity: 1; }
  &__mono { font-family: var(--font-mono); font-size: var(--fs-13); overflow-wrap: anywhere; }
  &__copy-btn { width: 1.5rem; height: 1.5rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--text-color-secondary); }
  &__item-hint { font-size: var(--fs-12); color: var(--account-hint-color); line-height: var(--lh-relaxed); }
  &__avatar-section { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); min-width: 0; }
  &__avatar-label { color: var(--text-color-secondary); font-size: var(--fs-13); line-height: var(--lh-normal); }
  &__avatar-container { display: flex; flex: none; align-items: center; min-width: 0; }
  &__avatar-uploader {
    position: relative; width: var(--account-avatar-size); height: var(--account-avatar-size); flex: none; border-radius: 50%;
    :deep(.ant-upload.ant-upload-select.ant-upload-select-picture-card) { width: 100%; height: 100%; margin: 0; border: 0; background: transparent; }
    :deep(.ant-upload[role='button']:focus-visible) { outline: 2px solid var(--jet-theme-primary); outline-offset: -2px; border-radius: 50%; }
    &:hover .account-basic__avatar-camera, &:focus-within .account-basic__avatar-camera { opacity: 1; }
  }
  &__avatar { width: var(--account-avatar-size); height: var(--account-avatar-size); line-height: var(--account-avatar-size); background: var(--accent); color: var(--accent-ink); font-size: var(--fs-48); font-weight: 500; flex: none; }
  &__avatar-camera { position: absolute; inset: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; background: color-mix(in srgb, var(--text-color) 45%, transparent); color: var(--bg-elev); font-size: var(--fs-24); opacity: 0; pointer-events: none; transition: opacity 0.15s; }
  &__visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  &__divider.ant-divider-horizontal { margin: var(--space-6) 0; }
  &__organization { min-width: 0; }
  &__organization-label { display: inline-flex; align-items: center; gap: var(--space-1); }
  &__organization-label :deep(.anticon) { color: var(--text-color-secondary); }
  &__tags-trigger.ant-btn { max-width: 100%; height: auto; padding: 0; text-align: left; vertical-align: top; }
  &__tags-trigger.ant-btn:hover, &__tags-trigger.ant-btn:active { background: transparent; }
  &__tags-trigger:focus-visible { outline: 2px solid var(--jet-theme-primary); outline-offset: 2px; }
  &__tags-summary { display: flex; align-items: center; gap: 4px; min-width: 0; }
  &__tag-first.ant-tag { min-width: 0; max-width: 100%; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  &__tag-more.ant-tag { flex: none; margin: 0; }
  &__tags-tooltip { max-width: min(20rem, 75vw); max-height: 15rem; overflow: auto; }
  &__tags-tooltip-item { overflow-wrap: anywhere; line-height: 1.6; }
  &__credentials :deep(.ant-descriptions-view table), &__organization :deep(.ant-descriptions-view table) { table-layout: fixed; }
  &__credentials :deep(.ant-descriptions-item-label), &__organization :deep(.ant-descriptions-item-label) { color: var(--text-color-secondary); font-size: var(--fs-13); }
  &__credentials :deep(.ant-descriptions-item-content), &__organization :deep(.ant-descriptions-item-content) { min-width: 0; color: var(--text-color); font-size: var(--fs-14); overflow-wrap: anywhere; }
  &__credentials :deep(.ant-descriptions-row > th) { padding-bottom: var(--space-1); }
  &__credentials :deep(.ant-descriptions-row > td) { padding-bottom: var(--space-5); }
  &__credentials :deep(.ant-descriptions-row:last-child > td) { padding-bottom: 0; }
  &__organization :deep(.ant-descriptions-row > th) { padding-bottom: var(--space-1); }
  &__organization :deep(.ant-descriptions-row:last-child > td) { padding-bottom: 0; }
  &__organization-note { margin-top: var(--space-3); }
}
@container account-basic (min-width: 48rem) {
  .account-basic__organization :deep(.account-basic__organization-item--login) { width: var(--account-avatar-size); }
}
@container account-basic (max-width: 38rem) {
  .account-basic__profile { --account-avatar-size: 7rem; }
  .account-basic__profile-top { gap: var(--space-5); }
  .account-basic__avatar { font-size: var(--fs-36); }
}
@container account-basic (max-width: 25rem) {
  .account-basic__profile-top { grid-template-columns: minmax(0, 1fr); }
}
@media (hover: none) {
  .account-basic__name :deep(.input-editable > div > .ant-btn) { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .account-basic__avatar-camera { transition: none; }
  .account-basic__name :deep(.input-editable > div > .ant-btn) { transition: none; }
}
</style>

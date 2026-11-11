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
const { saving, saveError, saveName, saveAvatar } = useBasicProfile(() => props.profile)
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

const organizationFields = computed<AccountCardItem[]>(() => ['roles', 'orgs', 'positions', 'createTime'].flatMap(key => {
  const item = props.profile.items.find(field => field.key === key)
  return item ? [item] : key === 'createTime' ? [{ key, label: t('PersonalCenter.createdAt'), value: '—' }] : []
}))
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
    <ContentPanel :background="false" :padding="0" fill class="account-basic__profile personal-center-summary">
      <div class="account-basic__profile-top">
        <a-tooltip :title="$t('PersonalCenter.avatarNote')">
        <div class="account-basic__avatar-container">
          <div class="account-basic__visually-hidden">{{ $t('AccountInfo.avatar') }}</div>
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
        </a-tooltip>

        <div class="account-basic__fields">
          <div class="account-basic__item">
            <div class="account-basic__visually-hidden">{{ $t('PersonalCenter.nameLabel') }}</div>
            <a-tooltip :title="$t('PersonalCenter.nameHint')">
            <div class="account-basic__item-value account-basic__name">
              <InputEditable
                v-if="profile.canEdit"
                :value="profile.name" trigger="text" :label="$t('PersonalCenter.nameLabel')"
                :max-length="20" :disabled="saving" :save="saveDisplayName" :error="nameError"
                :text-style="{ fontSize: 'var(--fs-20)', fontWeight: 600 }"
              />
              <span v-else>{{ profile.name }}</span>
            </div>
            </a-tooltip>
            <div class="account-basic__item-hint account-basic__name-hint">{{ $t('PersonalCenter.nameHint') }}</div>
          </div>
          <a-descriptions size="small" :colon="false" :column="1" class="account-basic__credentials">
            <a-descriptions-item :label="$t('PersonalCenter.account')">
              <div class="account-basic__item-value">
                <span class="account-basic__mono">{{ profile.username }}</span>
                <a-tooltip :title="$t('PersonalCenter.usernameHint')">
                  <a-button type="text" size="small" class="account-basic__hint-btn" :aria-label="$t('PersonalCenter.usernameHint')"><AIcon type="QuestionCircleOutlined" /></a-button>
                </a-tooltip>
              </div>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('PersonalCenter.accountIdLabel')">
                <div class="account-basic__item-value">
                  <span class="account-basic__mono" :title="accountId">{{ shortAccountId }}</span>
                  <a-tooltip :title="$t('PersonalCenter.copyId')">
                    <a-button type="text" size="small" class="account-basic__copy-btn" :aria-label="$t('PersonalCenter.copyId')" @click="copyAccountId">
                      <template #icon><AIcon type="CopyOutlined" /></template>
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('PersonalCenter.accountIdHint')">
                    <a-button type="text" size="small" class="account-basic__hint-btn" :aria-label="$t('PersonalCenter.accountIdHint')"><AIcon type="QuestionCircleOutlined" /></a-button>
                  </a-tooltip>
                </div>
            </a-descriptions-item>
          </a-descriptions>
        </div>
      </div>

      <div class="account-basic__organization">
        <a-descriptions layout="vertical" size="small" :colon="false" :column="2">
          <a-descriptions-item v-for="item in organizationFields" :key="item.key" :label="item.label">
            <a-space v-if="item.tags?.length" :size="4" wrap>
              <a-tag v-for="tag in item.tags" :key="tag" :bordered="false">{{ tag }}</a-tag>
            </a-space>
            <span v-else :title="item.value">{{ item.key === 'createTime' ? item.value.slice(0, 10) : item.value }}</span>
          </a-descriptions-item>
        </a-descriptions>
        <div class="account-basic__item-hint account-basic__organization-note">{{ orgNote }}</div>
      </div>
      <div class="account-basic__illustration personal-center-summary__illustration" aria-hidden="true">
        <img src="../../../../assets/personal-center/identity.webp" alt="" width="340" height="243" draggable="false" />
      </div>
    </ContentPanel>
    <LoginMethods :profile="profile" @edit="emit('edit', $event)" @password="emit('password')" @notification-settings="emit('notification-settings')" />
  </div>
</template>

<style scoped lang="less">
.account-basic {
  --account-avatar-size: 5.25rem;
  container: account-basic personal-center-summary / inline-size;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-width: 0;
  &__profile { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) var(--personal-center-summary-illustration-width); flex: none; overflow: visible; }
  &__profile-top { display: flex; gap: var(--space-5); align-items: center; min-width: 0; }
  &__fields { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: var(--space-3); }
  &__item { display: flex; flex-direction: column; gap: var(--space-1); }
  &__item-value { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-1); min-height: 1.5rem; min-width: 0; font-size: var(--fs-14); color: var(--text-color); }
  &__name { max-width: 24rem; font-size: var(--fs-20); font-weight: 600; line-height: var(--lh-normal); }
  &__name > .input-editable { width: 100%; }
  &__name :deep(.input-editable__text:hover) { color: var(--accent); }
  &__mono { font-family: var(--font-mono); font-size: var(--fs-13); overflow-wrap: anywhere; }
  &__copy-btn, &__hint-btn { width: 1.5rem; height: 1.5rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--text-color-secondary); }
  &__hint-btn { font-size: var(--fs-12); }
  &__item-hint { font-size: var(--fs-12); color: var(--text-color-secondary); line-height: var(--lh-relaxed); }
  &__name-hint { display: none; }
  &__item:focus-within > &__name-hint { display: block; }
  &__avatar-container { display: flex; flex: none; align-items: center; min-width: 0; }
  &__avatar-uploader {
    position: relative; width: var(--account-avatar-size); height: var(--account-avatar-size); flex: none; border-radius: 50%;
    :deep(.ant-upload.ant-upload-select.ant-upload-select-picture-card) { width: 100%; height: 100%; margin: 0; border: 0; background: transparent; }
    :deep(.ant-upload[role='button']:focus-visible) { outline: 2px solid var(--jet-theme-primary); outline-offset: -2px; border-radius: 50%; }
    &:hover .account-basic__avatar-camera, &:focus-within .account-basic__avatar-camera { color: var(--accent); border-color: var(--accent); }
  }
  &__avatar { width: var(--account-avatar-size); height: var(--account-avatar-size); line-height: var(--account-avatar-size); background: var(--accent); color: var(--accent-ink); font-size: var(--fs-32); font-weight: 500; flex: none; }
  &__avatar-camera { position: absolute; right: -0.1875rem; bottom: -0.125rem; width: var(--space-7); height: var(--space-7); display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid var(--line); color: var(--text-color-secondary); background: var(--bg-elev); box-shadow: var(--jet-theme-shadow-secondary); font-size: var(--fs-14); pointer-events: none; transition: color 0.15s, border-color 0.15s; }
  &__visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  &__organization { min-width: 0; padding-inline-start: var(--space-4); border-inline-start: 1px solid var(--line); }
  &__credentials :deep(.ant-descriptions-view table), &__organization :deep(.ant-descriptions-view table) { table-layout: fixed; }
  &__credentials :deep(.ant-descriptions-item-label) { min-width: 3.5rem; font-size: var(--fs-13); color: var(--text-color-secondary); }
  &__organization :deep(.ant-descriptions-item-label) { font-size: var(--fs-12); color: var(--text-color-secondary); }
  &__credentials :deep(.ant-descriptions-item-container) { align-items: center; gap: var(--space-2); }
  &__credentials :deep(.ant-descriptions-item-content), &__organization :deep(.ant-descriptions-item-content) { font-size: var(--fs-14); color: var(--text-color); overflow-wrap: anywhere; }
  &__organization :deep(.ant-descriptions-item-content) { font-weight: 500; min-width: 0; }
  &__organization :deep(.ant-descriptions-view table) { border-collapse: collapse; }
  &__organization :deep(.ant-descriptions-row > th) { padding-bottom: var(--space-1); padding-inline-end: var(--space-6); }
  &__organization :deep(.ant-descriptions-row > td) { padding-bottom: var(--space-5); padding-inline-end: var(--space-6); }
  &__organization :deep(.ant-descriptions-row > th:last-child), &__organization :deep(.ant-descriptions-row > td:last-child) { padding-inline-end: 0; }
  &__organization :deep(.ant-descriptions-row:last-child > td) { padding-bottom: 0; }
  &__organization-note { margin-top: var(--space-3); }
  &__credentials :deep(.ant-descriptions-row:last-child > td) { padding-bottom: 0; }
}
@container account-basic (max-width: 64rem) {
  .account-basic__profile-top { gap: var(--space-4); }
}
@container account-basic (max-width: 54rem) {
  .account-basic__profile { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}
@container account-basic (max-width: 38rem) {
  .account-basic__profile { grid-template-columns: minmax(0, 1fr); }
  .account-basic__organization { padding-inline-start: 0; padding-top: var(--space-5); border-inline-start: 0; border-top: 1px solid var(--line); }
}
@container account-basic (max-width: 25rem) {
  .account-basic__profile { --account-avatar-size: 4rem; }
  .account-basic__profile-top { align-items: flex-start; }
  .account-basic__credentials :deep(.ant-descriptions-item-container) { flex-wrap: wrap; gap: var(--space-1); }
}
@media (prefers-reduced-motion: reduce) {
  .account-basic__avatar-camera { transition: none; }
}
</style>

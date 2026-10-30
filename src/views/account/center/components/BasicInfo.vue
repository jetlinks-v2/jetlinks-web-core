<script setup lang="ts">
import { computed, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import UploadAvatar from './UploadAvatar/index.vue'
import InputEditable from '@jetlinks-web-core/components/Editable/InputEditable.vue'
import KvGrid from '@jetlinks-web-core/components/KvGrid/index.vue'
import { useBasicProfile } from './useBasicProfile'
import type { AccountCardProfile, AccountEditTarget } from '../types'

const { t } = useI18n()
const props = defineProps({
  profile: { type: Object as PropType<AccountCardProfile>, required: true },
})
const emit = defineEmits<{
  (event: 'edit', target: AccountEditTarget): void
  (event: 'sso'): void
}>()
const { saving, saveError, saveName, saveAvatar, fields, accountType, userType } = useBasicProfile(() => props.profile)
const boundAccounts = computed(() => props.profile.thirdAccounts.filter(item => item.value === t('BindThirdAccount.index.483756-0')))
</script>

<template>
  <section class="account-basic">
    <a-alert v-if="saveError" type="error" show-icon :message="$t('PersonalCenter.saveFailed')" />
    <div class="account-basic__identity">
      <UploadAvatar
        v-if="profile.canEdit"
        :model-value="profile.avatar || ''"
        :disabled="saving"
        :border-style="{ width: '3.5rem', height: '3.5rem' }"
        accept="image/jpeg,image/png"
        @change="saveAvatar"
      >
        <template #placeholder><a-avatar :size="56" class="account-basic__avatar">{{ profile.name.trim().slice(0, 1) }}</a-avatar></template>
      </UploadAvatar>
      <a-avatar v-else class="account-basic__avatar" :size="56" :src="profile.avatar">{{ profile.name.slice(0, 1) }}</a-avatar>
      <div class="account-basic__summary">
        <div class="account-basic__name"><h3>{{ profile.name }}</h3><AppTag :name="accountType" /><a-tag v-if="userType">{{ userType }}</a-tag></div>
        <div class="account-basic__account">{{ profile.username }}</div>
        <div v-if="profile.canEdit" class="account-basic__hint">
          {{ $t('PersonalCenter.avatarHint') }}
          <a-button v-if="profile.avatar" type="link" size="small" :disabled="saving" @click="saveAvatar('')">
            {{ $t('PersonalCenter.resetAvatar') }}
          </a-button>
        </div>
      </div>
    </div>
    <a-spin :spinning="saving">
      <KvGrid :cols="3" :gap="24" class="account-basic__fields">
        <div class="kv-cell account-basic__field">
          <dt>{{ $t('AccountInfo.basicName') }}</dt>
          <dd>
            <InputEditable v-if="profile.canEdit" :value="profile.name" @change="saveName" />
            <span v-else>{{ profile.name }}</span>
          </dd>
        </div>
        <div v-for="field in fields" :key="field.key" class="kv-cell account-basic__field">
          <dt>{{ field.label }}</dt>
          <dd>
            <span>{{ field.value }}</span>
            <a-button
              v-if="profile.canEdit && field.editTarget"
              type="link" size="small"
              @click="emit('edit', field.editTarget)"
            >{{ $t('PersonalCenter.edit') }}</a-button>
          </dd>
        </div>
        <div class="kv-cell account-basic__field account-basic__field--wide">
          <dt>{{ $t('PersonalCenter.sso') }}</dt>
          <dd>
            <a-space wrap>
              <template v-if="boundAccounts.length">
                <span v-for="binding in boundAccounts" :key="binding.key">{{ binding.label }}</span>
                <a-button type="link" size="small" @click="emit('sso')">{{ $t('PersonalCenter.manageBindings') }}</a-button>
              </template>
              <template v-else>
                <span class="account-basic__empty">{{ $t('AccountInfo.unbound') }}</span>
                <a-button type="link" size="small" class="account-basic__binding-link" @click="emit('sso')">{{ $t('PersonalCenter.goToBind') }} ›</a-button>
              </template>
            </a-space>
          </dd>
        </div>
      </KvGrid>
    </a-spin>
  </section>
</template>

<style scoped lang="less">
.account-basic {
  display: flex; flex-direction: column;
  &__identity { display: flex; align-items: center; gap: var(--space-4); padding: 0 0 var(--space-4); border-bottom: 1px solid var(--line); }
  > .ant-alert { margin-bottom: var(--space-4); }
  &__avatar { background: var(--jet-theme-primary); color: var(--brand-mark-ink, var(--bg)); }
  &__summary { min-width: 0; }
  &__name { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); }
  h3 { margin: 0; font-size: var(--fs-18); font-weight: 600; color: var(--text-color); }
  &__account { margin-top: var(--space-1); color: var(--text-color-secondary); overflow-wrap: anywhere; }
  &__hint { margin-top: var(--space-2); color: var(--text-color-secondary); font-size: var(--fs-12); }
  &__fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-6) var(--space-8); margin: 0; padding: var(--space-4) 0 0; }
  &__field { min-width: 0; }
  &__empty { color: var(--text-color-secondary); }
  &__binding-link { padding-inline: 0; }
  &__field--wide { grid-column: span 2; }
  dt { color: var(--text-color-secondary); font-size: var(--fs-12); margin-bottom: var(--space-2); }
  dd { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-2); margin: 0; font-size: var(--fs-14); overflow-wrap: anywhere; }
}
@media (max-width: 70rem) { .account-basic__fields.kv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 48rem) {
  .account-basic__fields.kv-grid { grid-template-columns: minmax(0, 1fr); }
  .account-basic__field--wide { grid-column: auto; }
  .account-basic__identity { align-items: flex-start; }
}
</style>

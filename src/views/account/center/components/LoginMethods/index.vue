<script setup lang="ts">
import type { PropType } from 'vue'
import type { AccountCardProfile, AccountEditTarget } from '../../types'
import LoginMethodRow from './LoginMethodRow.vue'
import SsoAuthorization from '../BindThirdAccount/SsoAuthorization.vue'
import { useLoginMethods } from './useLoginMethods'

const props = defineProps({ profile: { type: Object as PropType<AccountCardProfile>, required: true } })
const emit = defineEmits<{ (event: 'edit', target: AccountEditTarget): void; (event: 'password'): void; (event: 'notification-settings'): void }>()
const { entries, loading, failed, unbinding, load, canBindSso, bind, unbind, binding, authorizationUrl, bindingState, closeBinding, ssoSettings, canManageSso, openSsoSettings } = useLoginMethods(() => props.profile)
</script>

<template>
  <ContentPanel id="login-methods" :background="false" :padding="0" fill class="login-methods">
    <template #title><a-typography-title :level="2" class="login-methods__heading"><span aria-hidden="true"><AIcon type="SafetyCertificateOutlined" /></span>{{ $t('PersonalCenter.loginMethods') }}</a-typography-title></template>
    <div class="login-methods__note">
        {{ $t('PersonalCenter.loginMethodsNoteBoth') }}<i18n-t keypath="PersonalCenter.loginMethodsSsoNote" tag="span">
          <template #settings>
            <a-typography-link v-if="canManageSso" @click="openSsoSettings">{{ ssoSettings.label }}</a-typography-link>
            <span v-else>{{ ssoSettings.label }}</span>
          </template>
        </i18n-t>
    </div>
      <a-alert v-if="failed" type="warning" show-icon :message="$t('PersonalCenter.bindingFailed')" class="login-methods__alert">
        <template #action><a-button type="link" @click="load">{{ $t('AccountCenter.retry') }}</a-button></template>
      </a-alert>
    <a-list :data-source="entries" :loading="loading" bordered class="login-methods__list">
      <template #renderItem="{ item: entry }">
        <LoginMethodRow :entry="entry">
          <template v-if="entry.kind === 'mobile' || entry.kind === 'email'" #description>
            <i18n-t :keypath="entry.descriptionKey || ''" tag="span">
              <template #settings><a-typography-link @click="emit('notification-settings')">{{ $t('PersonalCenter.notifications') }}</a-typography-link></template>
            </i18n-t>
          </template>
          <a-button v-if="entry.kind === 'password'" :aria-label="$t('AccountInfo.editPassword')" @click="emit('password')">{{ $t('PersonalCenter.edit') }}</a-button>
          <a-button
            v-else-if="entry.kind === 'mobile' || entry.kind === 'email'"
            :disabled="!profile.canEdit"
            :aria-label="$t(profile.contacts?.[entry.kind]?.value ? 'PersonalCenter.editContact' : 'PersonalCenter.bindContact', { contact: entry.label })"
            @click="emit('edit', entry.kind === 'mobile' ? 'phone-section' : 'email-section')"
          >{{ $t(profile.contacts?.[entry.kind]?.value ? 'PersonalCenter.edit' : 'PersonalCenter.bind') }}</a-button>
          <template v-else-if="entry.binding">
            <a-popconfirm v-if="entry.binding.bound" :title="$t('BindThirdAccount.index.483756-3')" @confirm="unbind(entry.binding.id)">
              <a-button :loading="unbinding === entry.binding.id" :disabled="!!unbinding">{{ $t('PersonalCenter.unbind') }}</a-button>
            </a-popconfirm>
            <a-tooltip v-else :title="!canBindSso(entry.binding) ? $t('PersonalCenter.bindingUnsupported') : undefined">
              <a-button :disabled="!canBindSso(entry.binding)" :aria-label="$t('PersonalCenter.bindContact', { contact: entry.label })" @click="bind(entry.binding)">{{ $t('PersonalCenter.bind') }}</a-button>
            </a-tooltip>
          </template>
        </LoginMethodRow>
      </template>
    </a-list>
  </ContentPanel>
  <SsoAuthorization :binding="binding" :state="bindingState" :url="authorizationUrl" @close="closeBinding" @retry="binding && bind(binding)" />
</template>

<style scoped>
.login-methods { min-width: 0; flex: none; overflow: visible; }
.login-methods :deep(> .content-panel__header) { margin-bottom: var(--space-2); }
.login-methods__heading { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: var(--fs-18); font-weight: 600; line-height: var(--lh-normal); }
.login-methods__heading > span { display: inline-flex; align-items: center; color: var(--accent); font-size: var(--fs-20); }
.login-methods__note { margin-bottom: var(--space-5); font-size: var(--fs-13); line-height: var(--lh-relaxed); color: var(--text-color-secondary); }
.login-methods__list { min-width: 0; border-color: var(--line); border-radius: var(--r-3); overflow: hidden; }
.login-methods__alert { margin-bottom: var(--space-3); }
</style>

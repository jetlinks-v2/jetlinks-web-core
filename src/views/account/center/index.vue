<script setup lang="ts" name="Center">
import { defineAsyncComponent } from 'vue'
import FullPage from '@jetlinks-web-core/layout/FullPage.vue'
import ProjectSecondaryMenu from '@jetlinks-web-core/layout/components/ProjectSecondaryMenu.vue'
import BasicInfo from './components/BasicInfo.vue'
import SecuritySettings from './components/SecuritySettings.vue'
import { useCenter } from './useCenter'

const StationMessage = defineAsyncComponent(() => import('./components/StationMessage/index.vue'))
const Subscribe = defineAsyncComponent(() => import('./components/Subscribe/index.vue'))
const PersonalToken = defineAsyncComponent(() => import('./components/PersonalToken/index.vue'))
const SsoBindings = defineAsyncComponent(() => import('./components/BindThirdAccount/index.vue'))
const ContactDialog = defineAsyncComponent(() => import('./components/ContactDialog/index.vue'))
const HomeView = defineAsyncComponent(() => import('./components/HomeView/index.vue'))
const EditPassword = defineAsyncComponent(() => import('./components/EditPassword/index.vue'))

const {
  activeKey, frameworkItems, hasFrameworkNavigation,
  profile, loading, loadError, editableProviders, contactTarget,
  accountInfoVisible, homeViewVisible, editPasswordVisible,
  selectContent, loadAccount, openAccountInfo, closeAccountInfo,
} = useCenter()

</script>

<template>
  <j-page-container>
    <FullPage transparent-background show-scroll class="personal-center">
      <ProjectSecondaryMenu
        v-if="!hasFrameworkNavigation"
        grouped
        :items="frameworkItems"
        :selected-key="activeKey"
        tab-position="top"
        @select="selectContent"
      />
      <div class="personal-center__content">
        <a-alert v-if="loadError && activeKey === 'BasicInfo'" type="warning" show-icon :message="$t('AccountCenter.loadError')">
          <template #action><a-button type="link" @click="loadAccount">{{ $t('AccountCenter.retry') }}</a-button></template>
        </a-alert>
        <a-spin v-if="loading && activeKey === 'BasicInfo'" />
        <BasicInfo v-else-if="activeKey === 'BasicInfo'" :profile="profile" @edit="openAccountInfo" @sso="selectContent('Sso')" />
        <SecuritySettings v-else-if="activeKey === 'Security'" @password="editPasswordVisible = true" />
        <SsoBindings v-else-if="activeKey === 'Sso'" />
        <PersonalToken v-else-if="activeKey === 'PersonalToken'" />
        <StationMessage v-else-if="activeKey === 'StationMessage'" />
        <Subscribe v-else-if="activeKey === 'Subscribe'" :can-edit-profile="profile.canEdit" @edit-contact="openAccountInfo" />
      </div>
    </FullPage>
    <ContactDialog
      v-if="accountInfoVisible"
      :provider="contactTarget === 'phone-section' ? 'mobile' : 'email'"
      :identity-enabled="editableProviders.includes(contactTarget === 'phone-section' ? 'mobile' : 'email')"
      @close="closeAccountInfo"
    />
    <a-modal v-if="homeViewVisible" open :title="$t('center.data.756829-2')" width="64rem" :footer="null" @cancel="homeViewVisible = false">
      <HomeView />
    </a-modal>
    <EditPassword v-if="editPasswordVisible" @close="editPasswordVisible = false" />
  </j-page-container>
</template>

<style scoped lang="less">
.personal-center {
  min-width: 0;
  &__content {
    display: flex; flex-direction: column; gap: var(--space-4); min-width: 0;
    box-sizing: border-box; padding: var(--space-4);
  }
}
@media (max-width: 48rem) {
  .personal-center__content { padding: var(--space-2); }
}
</style>

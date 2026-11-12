<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import FullPage from '@jetlinks-web-core/layout/FullPage.vue'
import ProjectSecondaryMenu from '@jetlinks-web-core/layout/components/ProjectSecondaryMenu.vue'
import BasicInfo from './components/BasicInfo.vue'
import { useCenter } from './useCenter'

defineOptions({ name: 'Center' })

const StationMessage = defineAsyncComponent(() => import('./components/StationMessage/index.vue'))
const Subscribe = defineAsyncComponent(() => import('./components/Subscribe/index.vue'))
const PersonalToken = defineAsyncComponent(() => import('./components/PersonalToken/index.vue'))
const ContactDialog = defineAsyncComponent(() => import('./components/ContactDialog/index.vue'))
const HomeView = defineAsyncComponent(() => import('./components/HomeView/index.vue'))
const EditPassword = defineAsyncComponent(() => import('./components/EditPassword/index.vue'))

const {
  activeKey, activeTitle, frameworkItems, hasFrameworkNavigation,
  profile, loading, loadError, contactVerificationState, contactTarget, confirmedContactValue,
  accountInfoVisible, homeViewVisible, editPasswordVisible,
  selectContent, loadAccount, openAccountInfo, closeAccountInfo,
} = useCenter()

</script>

<template>
  <j-page-container>
    <FullPage transparent-background :fixed="false" :padding="0" margin="0" class="personal-center">
      <ProjectSecondaryMenu
        v-if="!hasFrameworkNavigation"
        grouped
        :items="frameworkItems"
        :selected-key="activeKey"
        tab-position="top"
        @select="selectContent"
      />
      <div
        class="personal-center__content"
        :class="{
          'personal-center__content--summary': activeKey === 'BasicInfo' || activeKey === 'PersonalToken',
          'personal-center__content--full': activeKey === 'StationMessage',
          'personal-center__content--stretch': activeKey === 'Subscribe',
        }"
      >
        <PageHeader
          v-if="activeKey === 'BasicInfo' || activeKey === 'Subscribe'"
          variant="plain"
          :class="{ 'personal-center__basic-header': activeKey === 'BasicInfo' }"
          :title="activeKey === 'Subscribe' ? $t('PersonalCenter.notificationReceivingMethods') : (activeTitle || '')"
        />
        <a-alert v-if="loadError && activeKey === 'BasicInfo'" type="warning" show-icon :message="$t('AccountCenter.loadError')">
          <template #action><a-button type="link" @click="loadAccount">{{ $t('AccountCenter.retry') }}</a-button></template>
        </a-alert>
        <a-spin v-if="loading && activeKey === 'BasicInfo'" />
        <BasicInfo v-else-if="activeKey === 'BasicInfo'" :profile="profile" @edit="openAccountInfo" @password="editPasswordVisible = true" @notification-settings="selectContent('Subscribe')" />
        <PersonalToken v-else-if="activeKey === 'PersonalToken'" />
        <StationMessage v-else-if="activeKey === 'StationMessage'" @notification-settings="selectContent('Subscribe')" />
        <Subscribe v-else-if="activeKey === 'Subscribe'" :can-edit-profile="profile.canEdit" @edit-contact="openAccountInfo" />
      </div>
    </FullPage>
    <ContactDialog
      v-if="accountInfoVisible"
      :key="contactTarget"
      v-model:confirmed-value="confirmedContactValue"
      :provider="contactTarget === 'phone-section' ? 'mobile' : 'email'"
      :verification-state="contactVerificationState"
      @close="closeAccountInfo"
      @notification-settings="selectContent('Subscribe')"
      @retry-verification="loadAccount"
    />
    <a-modal v-if="homeViewVisible" open :title="$t('center.data.756829-2')" width="64rem" :footer="null" @cancel="homeViewVisible = false">
      <HomeView />
    </a-modal>
    <EditPassword v-if="editPasswordVisible" @close="editPasswordVisible = false" />
  </j-page-container>
</template>

<style lang="less" src="./centerLayout.less"></style>

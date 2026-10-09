<script setup lang="ts" name="Center">
import { defineAsyncComponent } from 'vue'
import FullPage from '@jetlinks-web-core/layout/FullPage.vue'
import EqualHeightColumns from '@jetlinks-web-core/components/EqualHeightColumns/index.vue'
import AccountCard from './components/AccountCard.vue'
import { useCenter } from './useCenter'

const StationMessage = defineAsyncComponent(() => import('./components/StationMessage/index.vue'))
const Subscribe = defineAsyncComponent(() => import('./components/Subscribe/index.vue'))
const PersonalToken = defineAsyncComponent(() => import('./components/PersonalToken/index.vue'))
const AccountInfo = defineAsyncComponent(() => import('./components/AccountInfo/index.vue'))
const HomeView = defineAsyncComponent(() => import('./components/HomeView/index.vue'))
const EditPassword = defineAsyncComponent(() => import('./components/EditPassword/index.vue'))

const {
  activeKey, activeTitle, segments, profile, loading, loadError,
  accountInfoVisible, homeViewVisible, editPasswordVisible,
  selectContent, loadAccount, openAccountInfo, closeAccountInfo,
} = useCenter()
</script>

<template>
  <j-page-container>
    <div class="person-center">
      <FullPage transparent-background flex>
        <EqualHeightColumns class="person-center__columns" left-width="20rem" right-width="1fr" :collapsible="false">
          <template #left>
            <AccountCard
              :profile="profile"
              :loading="loading"
              :error="loadError"
              @edit="openAccountInfo"
              @password="editPasswordVisible = true"
              @retry="loadAccount"
            />
          </template>
          <template #right>
            <section class="person-center__content">
              <header class="person-center__header">
                <h2 class="person-center__title">{{ activeTitle }}</h2>
                <a-segmented class="person-center__segments" block :value="activeKey" :options="segments" @change="selectContent" />
              </header>
              <div class="person-center__body">
                <StationMessage v-if="activeKey === 'StationMessage'" />
                <Subscribe v-else-if="activeKey === 'Subscribe'" />
                <PersonalToken v-else />
              </div>
            </section>
          </template>
        </EqualHeightColumns>
      </FullPage>
    </div>
    <a-modal
      v-if="accountInfoVisible"
      open
      :title="$t('center.data.accountInfo')"
      width="54rem"
      :footer="null"
      :body-style="{ maxHeight: '70vh', overflow: 'auto' }"
      @cancel="closeAccountInfo"
    >
      <div class="person-center__account-editor">
        <AccountInfo @open-edit-password="editPasswordVisible = true" />
      </div>
    </a-modal>
    <a-modal
      v-if="homeViewVisible"
      open
      :title="$t('center.data.756829-2')"
      width="64rem"
      :footer="null"
      :body-style="{ maxHeight: '70vh', overflow: 'auto' }"
      @cancel="homeViewVisible = false"
    >
      <HomeView />
    </a-modal>
    <EditPassword v-if="editPasswordVisible" @close="editPasswordVisible = false" />
  </j-page-container>
</template>

<style scoped lang="less">
.person-center {
  width: 100%;
  min-width: 0;
  height: 100%;
  box-sizing: border-box;

  &__content {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: var(--space-4);
  }

  &__title {
    margin: 0;
    color: var(--ink-1);
    font-size: var(--fs-18);
    font-weight: 600;
    line-height: var(--lh-snug);
  }

  &__body {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  &__segments {
    width: auto;
    min-width: 0;
    max-width: 100%;
  }
}

@media (max-width: 64rem) {
  .person-center__columns {
    grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
    gap: var(--space-4);
  }

  .person-center__header {
    flex-wrap: wrap;
    gap: var(--space-2);
  }
}

@media (max-width: 48rem) {
  .person-center__columns {
    display: flex;
    flex-direction: column;
    overflow: auto;

    &::before { content: none; }

    :deep(.equal-height-columns__pane) {
      height: auto;
      min-height: 0 !important;
      overflow: visible;
      flex-shrink: 0;
    }

    :deep(.equal-height-columns__pane--right) {
      flex: 1 0 30rem;
    }

    :deep(.equal-height-columns__pane--left) {
      height: min(32rem, 100%);
    }
  }

  .person-center__account-editor {
    :deep(.basic-layout) {
      flex-direction: column-reverse;
      gap: var(--space-4);
    }

    :deep(.basic-form-meta) { grid-template-columns: minmax(0, 1fr); }

    :deep(.content-item) {
      height: auto;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    :deep(.content-item-left) {
      flex-wrap: wrap;
      gap: var(--space-2);
    }
  }
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import TokenDialog from './components/TokenDialog.vue'
import TokenDetails from './components/TokenDetails.vue'
import TokenCard from './components/TokenCard.vue'
import { usePersonalToken } from './usePersonalToken'
const {
  tokenList, tokenGroups, deleting, deleteError, dialogVisible, dialogMode, selectedToken, loading, loadError, reload,
  handleAdd, handleView, handleEdit, handleRegenerate, handleDelete, handleDialogOk,
} = usePersonalToken()
const expanded = ref<string[]>([])
</script>

<template>
  <div class="personal-token">
    <PageHeader variant="plain" :title="$t('center.data.756829-4')" class="personal-center__summary-header" />
    <ContentPanel :background="false" :padding="0" fill class="personal-token__hero personal-center-summary">
      <div class="personal-token__hero-content">
        <div class="personal-token__usage-block">
          <h2 class="personal-token__usage-title">{{ $t('PersonalToken.apiUsage') }}</h2>
          <a-typography-paragraph class="personal-token__usage-hint">
            <i18n-t keypath="PersonalCenter.tokenAuthorizationHint" tag="span"><template #header><a-typography-text code>Authorization: Bearer &lt;token&gt;</a-typography-text></template><template #lineBreak><wbr /></template></i18n-t>
          </a-typography-paragraph>
          <a-typography-paragraph type="secondary" class="personal-token__secret-hint">{{ $t('PersonalCenter.tokenSecretHint') }}</a-typography-paragraph>
        </div>
      </div>
      <div class="personal-token__illustration personal-center-summary__illustration" aria-hidden="true"><img src="../../../../../assets/personal-token/api-access.webp" alt="" width="340" height="243" draggable="false" /></div>
    </ContentPanel>
    <a-alert v-if="loadError" type="error" show-icon :message="$t('PersonalToken.index.loadFailed')">
      <template #action><a-button type="link" @click="reload">{{ $t('AccountCenter.retry') }}</a-button></template>
    </a-alert>
    <a-alert v-if="deleteError" type="error" show-icon :message="$t('PersonalCenter.tokenRevokeFailed')" />
    <section class="personal-token__group">
      <div class="personal-token__section-heading">
        <h2>{{ $t('PersonalToken.myTokens') }}</h2>
        <a-button type="primary" @click="handleAdd"><template #icon><AIcon type="PlusOutlined" /></template>{{ $t('PersonalToken.empty.create') }}</a-button>
      </div>
      <a-spin v-if="loading" class="personal-token__loading" />
      <a-list v-else-if="tokenGroups.active.length" :data-source="tokenGroups.active" bordered class="personal-token__list">
        <template #renderItem="{ item: token }"><TokenCard :token="token" :busy="deleting === token.id" @view="handleView" @delete="handleDelete" /></template>
      </a-list>
      <CloudEmpty v-else-if="!loadError" class="personal-token__empty" :image-style="{ height: '64px' }" :description="$t(tokenList.length ? 'PersonalCenter.tokenNoActive' : 'PersonalToken.empty.title')">
        <p v-if="!tokenList.length">{{ $t('PersonalToken.empty.description') }}</p>
      </CloudEmpty>
    </section>
    <section v-if="tokenGroups.inactive.length" class="personal-token__group">
      <a-collapse v-model:active-key="expanded" ghost class="personal-token__inactive">
        <a-collapse-panel key="inactive">
          <template #header><a-space :size="8" wrap><strong>{{ $t('PersonalCenter.tokenInvalidTitle', { count: tokenGroups.inactive.length }) }}</strong><a-typography-text class="personal-token__inactive-hint">{{ $t('PersonalCenter.tokenInvalidHint') }}</a-typography-text></a-space></template>
          <a-list :data-source="tokenGroups.inactive" bordered class="personal-token__list">
            <template #renderItem="{ item: token }"><TokenCard :token="token" :busy="deleting === token.id" @view="handleView" @delete="handleDelete" /></template>
          </a-list>
        </a-collapse-panel>
      </a-collapse>
    </section>
    <section v-if="tokenGroups.unknown.length" class="personal-token__group">
      <h2 class="personal-token__group-title">{{ $t('PersonalCenter.tokenOtherTitle') }}</h2>
      <a-list :data-source="tokenGroups.unknown" bordered class="personal-token__list">
        <template #renderItem="{ item: token }"><TokenCard :token="token" :busy="deleting === token.id" @view="handleView" @delete="handleDelete" /></template>
      </a-list>
    </section>
    <TokenDetails v-if="dialogVisible && dialogMode === 'view' && selectedToken" :token="selectedToken" @close="dialogVisible = false" @edit="handleEdit" @regenerate="handleRegenerate" />
    <TokenDialog v-else-if="dialogVisible" :visible="dialogVisible" :mode="dialogMode" :token="selectedToken" :existing-names="tokenList.filter(token => token.id !== selectedToken?.id).map(token => token.name || '')" @save="handleDialogOk" @close="dialogVisible = false" />
  </div>
</template>

<style scoped>
.personal-token { min-width: 0; container: personal-token personal-center-summary / inline-size; }
.personal-token__hero { display: grid; grid-template-columns: minmax(0, 1fr) var(--personal-center-summary-illustration-width); flex: none; overflow: visible; margin-bottom: var(--space-8); }
.personal-token__hero-content { min-width: 0; }
.personal-token__usage-block { min-width: 0; }
.personal-token__usage-title { margin: 0 0 var(--space-2); color: var(--text-color); font-size: var(--fs-16); font-weight: 600; line-height: var(--lh-normal); }
.personal-token__usage-hint { margin: 0; color: var(--text-color-secondary); font-size: var(--fs-13); line-height: var(--lh-relaxed); overflow-wrap: anywhere; text-wrap: pretty; }
.personal-token__usage-hint :deep(code) { margin: 0 var(--space-1); padding: 0 var(--space-1); border: 1px solid var(--line); border-radius: var(--r-1); background: var(--bg-elev); color: var(--text-color); font-family: var(--font-mono); font-size: var(--fs-13); white-space: nowrap; }
.personal-token__secret-hint { margin: var(--space-2) 0 0; color: color-mix(in srgb, var(--text-color-secondary) 80%, var(--bg-elev)); font-size: var(--fs-13); line-height: var(--lh-relaxed); }
.personal-token__group { display: flex; flex-direction: column; gap: var(--space-4); margin-bottom: var(--space-5); }
.personal-token__section-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
.personal-token__section-heading h2, .personal-token__group-title { margin: 0; color: var(--text-color); font-size: var(--fs-18); font-weight: 600; line-height: var(--lh-snug); }
.personal-token__list { border-color: var(--line); border-radius: var(--r-3); overflow: hidden; }
.personal-token__inactive :deep(> .ant-collapse-item > .ant-collapse-header) { align-items: center; padding: var(--space-3) var(--space-4); border-radius: var(--r-3); background: var(--bg-2); }
.personal-token__inactive :deep(.ant-collapse-header strong) { color: var(--text-color); font-size: var(--fs-16); font-weight: 600; }
.personal-token__inactive-hint { color: var(--text-color-secondary); font-size: var(--fs-13); }
.personal-token__inactive :deep(> .ant-collapse-item > .ant-collapse-content > .ant-collapse-content-box) { padding: var(--space-2) 0 0; }
.personal-token__loading, .personal-token__empty { padding: var(--space-6); }
.personal-token__empty p { max-width: 35rem; margin: 0 auto var(--space-4); }
.personal-token > .ant-alert { margin-bottom: var(--space-4); }
@container personal-token (max-width: 54rem) {
  .personal-token__hero { grid-template-columns: minmax(0, 1fr); }
}
@container personal-token (max-width: 38rem) {
  .personal-token__usage-hint :deep(code) { white-space: normal; overflow-wrap: anywhere; }
}
</style>

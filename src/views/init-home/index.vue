<template>
  <main class="initialization-page">
    <div class="initialization-content">
      <header class="initialization-header"><h1>{{ t('init-home.index.011430-0') }}</h1><p>{{ t('PlatformSettings.initHint') }}</p></header>
      <Basic ref="basicRef" />
      <ContentPanel :title="t('init-home.index.011430-3')" class="initialization-card"><Menu ref="menuRef" /></ContentPanel>
      <ContentPanel :title="t('init-home.index.011072-0')" class="initialization-card"><Role ref="roleRef" /></ContentPanel>
      <ContentPanel :title="t('init-home.index.011072-23')" class="initialization-card"><InitData ref="initDataRef" /></ContentPanel>
      <footer class="initialization-actions">
        <a-alert v-if="failedStep" type="error" show-icon :message="t('PlatformSettings.initFailed', { step: t(stepLabels[failedStep] || 'PlatformSettings.initialization') })" />
        <a-button type="primary" size="large" :loading="loading" @click="submit">{{ t('PlatformSettings.initialize') }}</a-button>
      </footer>
    </div>
  </main>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ContentPanel from '../../components/ContentPanel/index.vue'
import Basic from './Basic/index.vue'
import Menu from './Menu/index.vue'
import Role from './Role/index.vue'
import InitData from './initData/index.vue'
import { saveInit } from '@jetlinks-web-core/api/initHome'
import { useInitialization } from './useInitialization'
const { t } = useI18n()
const basicRef = ref<InstanceType<typeof Basic>>()
const menuRef = ref<InstanceType<typeof Menu>>()
const roleRef = ref<InstanceType<typeof Role>>()
const initDataRef = ref<InstanceType<typeof InitData>>()
const stepLabels: Record<string, string> = {
  basic: 'PlatformSettings.basic', menu: 'init-home.index.011430-3', role: 'init-home.index.011072-0',
  roleGroup: 'init-home.index.011072-0', data: 'init-home.index.011072-23', finish: 'PlatformSettings.initialization',
}
const { loading, failedStep, submit } = useInitialization([
  { key: 'basic', run: async () => basicRef.value?.submitBasic() },
  { key: 'menu', run: async () => menuRef.value?.updateMenu() },
  { key: 'role', run: async () => roleRef.value?.submitRole() },
  { key: 'roleGroup', run: async () => roleRef.value?.submitRoleGroup() },
  { key: 'data', run: async () => initDataRef.value?.save() },
  { key: 'finish', run: async () => (await saveInit()).success },
], () => { window.location.href = '/' })
</script>
<style scoped>
.initialization-page { min-height: 100vh; padding: var(--space-6) var(--space-4); background: var(--jet-theme-bg-layout); }
.initialization-content { max-width: 90rem; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.initialization-header h1 { margin: 0; font-size: var(--fs-24); color: var(--text-color); }
.initialization-header p { margin: var(--space-2) 0 0; color: var(--text-color-secondary); }
.initialization-card { height: auto; flex: none; min-width: 0; }
.initialization-actions { position: sticky; bottom: 0; z-index: 5; display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: var(--space-4); padding: var(--space-4); border-radius: var(--panel-radius); background: var(--jet-theme-bg-container); border: 1px solid var(--line); }
.initialization-card :deep(.init-home-role-content), .initialization-card :deep(.group) { flex-wrap: wrap; }
.initialization-card :deep(.role-item) { max-width: 100%; }
.initialization-card :deep(.init-data-img) { max-width: 100%; height: auto; }
@media (max-width: 48rem) { .initialization-page { padding: var(--space-4) var(--space-3); } }
</style>

<template>
  <aside class="appearance-preview" :aria-label="t('PlatformSettings.preview')">
    <div class="appearance-preview__header">
      <strong>{{ t('PlatformSettings.preview') }}</strong>
      <a-segmented v-model:value="view" :options="views" size="small" />
    </div>
    <div class="preview-browser">
      <div class="preview-tab">
        <a-button type="text" size="small" :disabled="hidden.includes('ico')" :class="mark('ico')" :aria-label="t('PlatformSettings.icon')" @click="emit('locate', 'ico')"><img :src="assets.ico" alt="" /></a-button>
        <a-button type="text" size="small" :class="mark('title')" @click="emit('locate', 'title')">{{ model.title || t('PlatformSettings.defaultName') }}</a-button>
      </div>
      <PlatformLoginPreview v-if="view === 'login'" v-bind="props" @locate="emit('locate', $event)" />
      <div v-else class="preview-topbar">
        <div class="preview-brand">
          <a-button type="text" :class="mark('logo')" :aria-label="t('PlatformSettings.logo')" @click="emit('locate', 'logo')"><img :src="assets.logo" alt="" /></a-button>
          <a-button type="text" :class="mark('title')" @click="emit('locate', 'title')">{{ model.title || t('PlatformSettings.defaultName') }}</a-button>
        </div>
        <span>{{ t('PlatformSettings.overview') }}</span><span>{{ t('PlatformSettings.settings') }}</span>
      </div>
    </div>
  </aside>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PlatformLoginPreview from './PlatformLoginPreview.vue'
import type { PlatformSettingKey, PlatformSettingsAssets, PlatformSettingsModel } from './types'
const props = defineProps<{ model: PlatformSettingsModel; assets: PlatformSettingsAssets; hidden: readonly string[]; active?: string }>()
const emit = defineEmits<{ locate: [key: PlatformSettingKey] }>()
const { t } = useI18n()
const view = ref('login')
const views = computed(() => [{ value: 'login', label: t('PlatformSettings.loginPage') }, { value: 'top', label: t('PlatformSettings.topbar') }])
const mark = (key: string) => ({ 'preview-active': props.active === key })
</script>
<style scoped>
.appearance-preview { background: var(--bg-sunken); border-radius: var(--panel-radius); padding: var(--space-4); min-width: 0; align-self: stretch; }
.appearance-preview__header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; font-size: var(--fs-13); }
.preview-browser { border: 1px solid var(--line); border-radius: var(--r-3); overflow: hidden; background: var(--jet-theme-bg-container); }
.preview-tab { display: flex; align-items: center; background: var(--jet-theme-bg-elevated); padding: var(--space-2); height: 2.5rem; min-width: 0; }
.preview-tab img { width: 1rem; height: 1rem; object-fit: contain; }
.preview-tab .ant-btn:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.preview-brand { display: flex; align-items: center; min-width: 0; margin-bottom: var(--space-4); }
.preview-brand .ant-btn { padding: var(--space-1); height: auto; pointer-events: auto; }
.preview-brand .ant-btn:last-child { min-width: 0; white-space: normal; overflow-wrap: anywhere; font-weight: 600; }
.preview-brand img { width: 1.75rem; height: 1.75rem; object-fit: contain; }
.preview-topbar { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-4); padding: var(--space-4); min-height: 5rem; font-size: var(--fs-12); }
.preview-topbar .preview-brand { margin: 0; }
.preview-active { outline: 2px solid var(--jet-theme-primary); outline-offset: -2px; }
</style>

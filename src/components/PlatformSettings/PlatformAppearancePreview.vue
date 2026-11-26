<template>
  <aside class="appearance-preview" :class="{ 'appearance-preview--compact': hidden.includes('background') }" :aria-label="t('PlatformSettings.preview')">
    <div class="appearance-preview__header">
      <strong>{{ t('PlatformSettings.preview') }}</strong>
      <a-segmented v-model:value="view" :options="views" size="small" />
    </div>
    <div class="preview-browser">
      <div class="preview-tabbar">
        <div class="preview-window-controls" aria-hidden="true"><i /><i /><i /></div>
        <div class="preview-tab">
          <a-button class="preview-tab__icon" type="text" size="small" :disabled="hidden.includes('ico')" :class="mark('ico')" :aria-label="t('PlatformSettings.icon')" @click="emit('locate', 'ico')"><img :src="assets.ico" alt="" /></a-button>
          <a-button class="preview-tab__title" type="text" size="small" :class="mark('title')" :title="model.title || t('PlatformSettings.defaultName')" @click="emit('locate', 'title')">{{ model.title || t('PlatformSettings.defaultName') }}</a-button>
          <AIcon class="preview-tab__close" type="CloseOutlined" aria-hidden="true" />
        </div>
        <span class="preview-new-tab" aria-hidden="true"><AIcon type="PlusOutlined" /></span>
      </div>
      <div class="preview-viewport">
        <PlatformLoginPreview v-if="view === 'login'" v-bind="props" @locate="emit('locate', $event)" />
        <PlatformTopbarPreview v-else :model="model" :assets="assets" :active="active" @locate="emit('locate', $event)" />
      </div>
    </div>
  </aside>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PlatformLoginPreview from './PlatformLoginPreview.vue'
import PlatformTopbarPreview from './PlatformTopbarPreview.vue'
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
.appearance-preview--compact { align-self: start; }
.appearance-preview__header { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; font-size: var(--fs-13); }
.preview-browser { border: 1px solid var(--line); border-radius: var(--r-4); overflow: hidden; background: var(--jet-theme-bg-container); box-shadow:var(--shadow-lifted); }
.preview-tabbar { display: flex; align-items: flex-end; gap: var(--space-2); padding: var(--space-2) var(--space-3) 0; background: var(--bg-sunken); }
.preview-window-controls { display: flex; align-self: center; flex: none; gap: var(--space-1); padding-bottom: var(--space-2); }
.preview-window-controls i { width: 0.5rem; height: 0.5rem; border-radius: var(--r-pill); background: var(--danger); }
.preview-window-controls i:nth-child(2) { background: var(--warning); }
.preview-window-controls i:nth-child(3) { background: var(--success); }
.preview-tab { display: flex; align-items: center; gap: var(--space-1); flex: 1; min-width: 0; max-width: 10rem; height: 2rem; padding: var(--space-1) var(--space-2); border-radius: var(--r-2) var(--r-2) 0 0; background: var(--jet-theme-bg-container); }
.preview-tab img { width: 1rem; height: 1rem; object-fit: contain; }
.preview-tab__icon.ant-btn { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 1.5rem; height: 1.5rem; padding: 0; }
.preview-tab__title.ant-btn { flex: 1; min-width: 0; height: 1.5rem; padding: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; font-size: var(--fs-12); }
.preview-tab__close { flex: none; margin-left: var(--space-1); font-size: var(--fs-12); color: var(--text-color-secondary); }
.preview-new-tab { display: flex; align-items: center; justify-content: center; flex: none; width: 1.5rem; height: 2rem; color: var(--text-color-secondary); font-size: var(--fs-12); }
.preview-viewport { position: relative; aspect-ratio: 8 / 5; overflow: hidden; background: var(--bg-sunken); }
.appearance-preview--compact .preview-viewport { aspect-ratio: 12 / 5; }
.preview-active { outline: 2px solid var(--jet-theme-primary); outline-offset: -2px; }
</style>

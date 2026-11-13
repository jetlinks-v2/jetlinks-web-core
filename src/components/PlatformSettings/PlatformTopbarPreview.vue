<template>
  <div ref="viewport" class="preview-topbar">
    <div class="preview-topbar__canvas" :style="canvasStyle">
      <header class="preview-topbar__header">
        <div class="preview-brand">
          <a-button type="text" class="preview-brand__logo" :class="mark('logo')" :aria-label="t('PlatformSettings.logo')" @click="emit('locate', 'logo')">
            <img :src="assets.logo" alt="" />
          </a-button>
          <a-button type="text" class="preview-brand__title" :class="mark('title')" :title="title" @click="emit('locate', 'title')">{{ title }}</a-button>
        </div>
        <div class="preview-topbar__tools" inert>
          <a-input class="preview-topbar__search" :placeholder="t('layout.menuSearch.placeholder')" readonly>
            <template #prefix><AIcon type="SearchOutlined" /></template>
          </a-input>
          <span class="preview-topbar__language"><AIcon type="GlobalOutlined" />{{ language }}</span>
          <AIcon type="BellOutlined" />
          <a-avatar class="preview-topbar__avatar" :size="32"><template #icon><AIcon type="UserOutlined" /></template></a-avatar>
        </div>
      </header>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useElementSize } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { PlatformSettingKey, PlatformSettingsAssets, PlatformSettingsModel } from './types'

const props = defineProps<{ model: PlatformSettingsModel; assets: PlatformSettingsAssets; active?: string }>()
const emit = defineEmits<{ locate: [key: PlatformSettingKey] }>()
const { t, locale } = useI18n()
const viewport = ref<HTMLElement>()
const { width } = useElementSize(viewport)
const title = computed(() => props.model.title || t('PlatformSettings.defaultName'))
const language = computed(() => t(locale.value.startsWith('en') ? 'Login.languageEn' : locale.value.startsWith('ja') ? 'Login.languageJa' : 'Login.languageZh'))
const mark = (key: string) => ({ 'preview-active': props.active === key })
// Use a compact canvas to double the header's visible size while keeping the browser viewport unchanged.
const canvasStyle = computed(() => ({ width: '960px', height: '600px', transform: `scale(${width.value / 960})` }))
</script>
<style scoped>
.preview-topbar { position: absolute; inset: 0; overflow: hidden; }
.preview-topbar__canvas { position: absolute; inset: 0 auto auto 0; transform-origin: top left; background: var(--bg-sunken) url('../../assets/layout/workbench-background.svg') center top / 100% auto no-repeat; }
.preview-topbar__header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: var(--space-4); padding: 0 var(--space-4); color: var(--text-color); font-size: var(--fs-14); }
.preview-brand { display: flex; align-items: center; gap: var(--space-2); max-width: 14rem; min-width: 0; min-height: var(--chrome-header-height); }
.preview-brand .ant-btn { height: auto; padding: 0; border: 0; border-radius: 0; }
.preview-brand__logo { display: flex; align-items: center; flex: none; }
.preview-brand__logo img { width: 1.5rem; height: 1.5rem; object-fit: contain; }
.preview-brand__title.ant-btn { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--fs-20); font-weight: 600; color: var(--jet-theme-primary); }
.preview-topbar__tools { display: flex; align-items: center; gap: var(--space-6); }
.preview-topbar__search.ant-input-affix-wrapper { width: 12.5rem; border: 0; border-radius: var(--r-2); }
.preview-topbar__language { display: flex; align-items: center; gap: var(--space-1); white-space: nowrap; }
.preview-topbar__avatar { background: var(--jet-theme-primary); }
.preview-active { outline: 0.375rem solid var(--jet-theme-primary); outline-offset: -0.375rem; }
</style>

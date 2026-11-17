<template>
  <ContentPanel :title="t('PlatformSettings.appearance')" class="platform-card">
    <p class="platform-card__description">{{ t('PlatformSettings.appearanceHint') }}</p>
    <div ref="root" class="appearance-content">
      <div class="appearance-fields" @mouseleave="active = ''">
        <PlatformSettingsFields group="appearance">
          <PlatformTextSetting key="title" v-bind="section" field-key="title" edit-button :label="t('PlatformSettings.name')" :hint="t('PlatformSettings.nameHint')" icon="TagOutlined" :active="active === 'title'" @mouseenter="active = 'title'" @focusin="active = 'title'" @change="emit('change', $event)" />
          <PlatformSettingRow v-for="item in images" :key="item.key" :field="item.key" :label="t(item.label)" :description="t(item.hint)" :icon="item.icon" :active="active === item.key" @mouseenter="active = item.key" @focusin="active = item.key">
            <template #action>
              <PlatformImageSetting :kind="item.key" :value="model[item.key]" :src="assets[item.key]" :mode="mode" :busy="busy" :disabled="disabled" :submit="submit" @change="emit('change', $event)" @busy-change="emit('uploading', item.key, $event)" />
            </template>
          </PlatformSettingRow>
          <PlatformTextSetting key="showRecordNumber" v-bind="section" field-key="recordNumber" :label="t('PlatformSettings.record')" :hint="t('PlatformSettings.recordHint')" icon="SafetyCertificateOutlined" :active="active === 'recordNumber'" @mouseenter="active = 'recordNumber'" @focusin="active = 'recordNumber'" @change="emit('change', $event)">
            <template #action>
              <span class="record-switch"><a-switch :checked="model.showRecordNumber" :loading="busy" :disabled="disabled || !model.recordNumber.trim()" :aria-label="t('PlatformSettings.showRecord')" @change="toggleRecord" /><a-button v-if="recordFailure" type="link" danger size="small" :disabled="busy" @click="toggleRecord(model.showRecordNumber)">{{ t('PlatformSettings.retry') }}</a-button></span>
              <small v-if="recordFailure" role="alert">{{ recordFailure }}</small>
            </template>
          </PlatformTextSetting>
        </PlatformSettingsFields>
      </div>
      <PlatformAppearancePreview :model="model" :assets="assets" :hidden="hidden || []" :active="active" @locate="locate" />
    </div>
  </ContentPanel>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ContentPanel from '../ContentPanel/index.vue'
import PlatformSettingsFields from './PlatformSettingsFields'
import PlatformSettingRow from './PlatformSettingRow.vue'
import PlatformTextSetting from './PlatformTextSetting.vue'
import PlatformImageSetting from './PlatformImageSetting.vue'
import PlatformAppearancePreview from './PlatformAppearancePreview.vue'
import { sectionProps } from './sectionProps'
import type { PropType } from 'vue'
import type { PlatformSettingKey, PlatformSettingsAssets, PlatformSettingsPatch } from './types'
const props = defineProps({ ...sectionProps, assets: { type: Object as PropType<PlatformSettingsAssets>, required: true } })
const emit = defineEmits<{ change: [patch: PlatformSettingsPatch]; uploading: [key: string, busy: boolean] }>()
const { t } = useI18n()
const active = ref('')
const root = ref<HTMLElement>()
const recordFailure = ref('')
const section = computed(() => { const { assets, ...section } = props; return section })
const images = [
  { key: 'logo', label: 'PlatformSettings.logo', hint: 'PlatformSettings.logoHint', icon: 'PictureOutlined' },
  { key: 'ico', label: 'PlatformSettings.icon', hint: 'PlatformSettings.iconHint', icon: 'LayoutOutlined' },
  { key: 'background', label: 'PlatformSettings.background', hint: 'PlatformSettings.backgroundHint', icon: 'DesktopOutlined' },
] as const
function locate(key: PlatformSettingKey) {
  active.value = key
  const row = root.value?.querySelector<HTMLElement>(`[data-setting="${key}"]`)
  row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  row?.querySelector<HTMLElement>('button, input, [tabindex="0"]')?.focus()
}
async function toggleRecord(checked: boolean | string | number) {
  const result = await props.submit({ showRecordNumber: checked === true, recordNumber: props.model.recordNumber })
  recordFailure.value = result.ok ? '' : result.error || t('PlatformSettings.saveFailed')
}
</script>
<style scoped>
.appearance-content { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: var(--space-4); }
.appearance-fields { display: flex; flex-direction: column; min-width: 0; align-self: start; overflow: hidden; }
.appearance-fields:has([data-setting="background"]) { align-self: stretch; }
.appearance-fields :deep(.settings-row) { flex: none; padding: var(--space-4) var(--space-2); }
.appearance-fields :deep([data-setting="background"]) { flex: 1; }
.appearance-fields :deep([data-setting="background"] .settings-row__action) { align-self: stretch; width: 40%; min-width: 9rem; max-width: 24rem; }
.appearance-fields :deep(.settings-row:hover), .appearance-fields :deep(.settings-row--active) { background: color-mix(in srgb, var(--accent-soft) 20%, var(--bg-elev)); }
.appearance-fields :deep(.settings-row__icon) { width: 2.375rem; height: 2.375rem; border-radius: var(--r-3); background: var(--accent-soft); color: var(--accent); font-size: var(--fs-20); }
.appearance-fields :deep(.settings-row__label), .appearance-fields :deep(.inline-edit-field__label) { font-size:
    var(--fs-14);}
.appearance-fields :deep(.inline-edit-field--detail .inline-edit-field__label) { color: var(--text-color); }
.appearance-fields :deep(.settings-row__description), .appearance-fields :deep(.inline-edit-field__hint) { font-size: var(--fs-13); line-height: var(--lh-relaxed); color: var(--text-color-secondary); }
.record-switch { display: flex; align-items: center; gap: var(--space-2); font-size: var(--fs-12); }
@media (max-width: 64rem) { .appearance-content { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 48rem) {
  .appearance-fields :deep(.settings-row) { display: grid; grid-template-columns: 2.375rem minmax(0, 1fr); align-items: start; padding: var(--space-3) var(--space-4); }
  .appearance-fields :deep(.settings-row__action) { grid-column: 2; justify-content: flex-end; margin-left: 0; }
  .appearance-fields :deep([data-setting="background"] .settings-row__action) { justify-self: end; width: 9rem; }
}
</style>

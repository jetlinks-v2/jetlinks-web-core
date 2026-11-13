<template>
  <ContentPanel :title="t('PlatformSettings.map')" class="platform-card">
    <template #titleRightRender>
      <a-space wrap>
        <a-tag :color="configured ? 'success' : 'default'">{{ t(configured ? 'PlatformSettings.configured' : 'PlatformSettings.notConfigured') }}</a-tag>
        <PlatformSectionActions v-if="mode === 'detail' && !disabled" :editing="editing" :disabled="actionsDisabled" :saving="saving" @edit="start" @cancel="cancel" @save="save" />
      </a-space>
    </template>
    <p class="platform-card__description">{{ t('PlatformSettings.mapHint') }}</p>
    <a-alert v-if="failure" type="error" show-icon :message="failure" />
    <a-form layout="vertical" class="map-form" @submit.prevent>
      <PlatformSettingsFields group="map">
        <PlatformSettingRow v-for="field in fields" :key="field.key" :field="field.key" :icon="field.icon">
          <a-form-item :label="t(field.label)" :validate-status="errors?.[field.key] ? 'error' : undefined" :help="errors?.[field.key] || t(field.hint)">
            <span v-if="!editing || disabled" class="map-value">{{ saved[field.key] ? (field.key === 'secretKey' ? '••••••••' : saved[field.key]) : t('PlatformSettings.notConfigured') }}</span>
            <a-input-password v-else-if="field.key === 'secretKey'" :value="model.secretKey" :disabled="controlsDisabled" :aria-label="t(field.label)" autocomplete="new-password" @update:value="change({ secretKey: $event })" />
            <a-input v-else :value="model[field.key]" :disabled="controlsDisabled" :aria-label="t(field.label)" @update:value="change({ [field.key]: $event })" />
          </a-form-item>
        </PlatformSettingRow>
      </PlatformSettingsFields>
    </a-form>
  </ContentPanel>
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ContentPanel from '../ContentPanel/index.vue'
import PlatformSettingsFields from './PlatformSettingsFields'
import PlatformSettingRow from './PlatformSettingRow.vue'
import PlatformSectionActions from './PlatformSectionActions.vue'
import { usePlatformSettingsSection } from './usePlatformSettingsSection'
import { sectionProps } from './sectionProps'
import type { PlatformSettingsPatch } from './types'
const props = defineProps(sectionProps)
const emit = defineEmits<{ change: [patch: PlatformSettingsPatch] }>()
const { t } = useI18n()
const { editing, disabled: controlsDisabled, actionsDisabled, saving, failure, configured, start, cancel, change, save } = usePlatformSettingsSection(
  props, 'amap', patch => emit('change', patch),
)
const fields = [
  { key: 'apiKey', icon: 'EnvironmentOutlined', label: 'PlatformSettings.jsKey', hint: 'PlatformSettings.jsKeyHint' },
  { key: 'secretKey', icon: 'LockOutlined', label: 'PlatformSettings.secret', hint: 'PlatformSettings.secretHint' },
  { key: 'webKey', icon: 'KeyOutlined', label: 'PlatformSettings.webKey', hint: 'PlatformSettings.webKeyHint' },
] as const
</script>
<style scoped>
.platform-card :deep(.settings-row__icon) { width: 2.375rem; height: 2.375rem; border-radius: var(--r-3); background: var(--accent-soft); color: var(--accent); font-size: var(--fs-20); }
.map-form :deep(.ant-form-item) { max-width: 40rem; margin-bottom: 0; }
.map-value { display: block; overflow-wrap: anywhere; white-space: pre-wrap; }
</style>

<template>
  <div class="platform-settings">
    <div v-if="loading" class="platform-settings__loading"><a-spin /></div>
    <a-result v-else-if="error" status="error" :title="error"><template #extra><a-button @click="emit('reload')">{{ t('PlatformSettings.retry') }}</a-button></template></a-result>
    <template v-else>
      <a-alert v-if="warning" type="warning" show-icon :message="warning"><template #action><a-button size="small" :disabled="busy" @click="emit('reload')">{{ t('PlatformSettings.refresh') }}</a-button></template></a-alert>
      <PlatformAppearanceSection v-bind="section" :assets="assets" @change="emit('change', $event)" @uploading="(key, busy) => emit('uploading', key, busy)" />
      <PlatformMapSection v-bind="section" @change="emit('change', $event)" />
      <PlatformSettingsFields group="address">
        <ContentPanel v-if="!hidden?.includes('base-path')" key="base-path" :title="t('PlatformSettings.address')" class="platform-card">
          <PlatformTextSetting v-bind="section" field-key="base-path" icon="GlobalOutlined" :label="t('PlatformSettings.address')" :hint="t('PlatformSettings.addressHint')" @change="emit('change', $event)" />
        </ContentPanel>
      </PlatformSettingsFields>
      <slot />
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ContentPanel from '../ContentPanel/index.vue'
import PlatformSettingsFields from './PlatformSettingsFields'
import PlatformAppearanceSection from './PlatformAppearanceSection.vue'
import PlatformMapSection from './PlatformMapSection.vue'
import PlatformTextSetting from './PlatformTextSetting.vue'
import { sectionProps } from './sectionProps'
import type { PropType } from 'vue'
import type { PlatformSettingsAssets, PlatformSettingsPatch } from './types'
const props = defineProps({ ...sectionProps, assets: { type: Object as PropType<PlatformSettingsAssets>, required: true }, loading: Boolean, error: String, warning: String })
const emit = defineEmits<{ change: [patch: PlatformSettingsPatch]; reload: []; uploading: [key: string, busy: boolean] }>()
const { t } = useI18n()
const section = computed(() => ({ model: props.model, saved: props.saved, mode: props.mode, busy: props.busy, disabled: props.disabled, errors: props.errors, hidden: props.hidden, submit: props.submit }))
</script>
<style scoped>
.platform-settings { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
.platform-settings__loading { padding: var(--space-6); text-align: center; }
.platform-settings :deep(.platform-card) { height: auto; flex: none; min-width: 0; overflow: visible; }
.platform-settings :deep(.platform-card__description) { color: var(--text-color-secondary); font-size: var(--fs-12); margin: 0 0 var(--space-3); line-height: 1.7; }
</style>

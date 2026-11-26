<template>
  <ContentPanel :title="t('PlatformSettings.map')" class="platform-card">
    <template #titleRightRender>
      <a-space>
        <a-tag :color="configured ? 'success' : 'default'">{{ t(configured ? 'PlatformSettings.configured' : 'PlatformSettings.notConfigured') }}</a-tag>
        <a-popconfirm v-if="mode === 'detail' && configured && !disabled" :title="t('PlatformSettings.clearMapConfirm')" @confirm="clear">
          <a-button type="text" danger :disabled="busy">{{ t('PlatformSettings.clear') }}</a-button>
        </a-popconfirm>
      </a-space>
    </template>
    <p class="platform-card__description">{{ t('PlatformSettings.mapHint') }}</p>
    <a-alert v-if="failure" type="error" show-icon :message="failure" />
    <a-form v-if="mode === 'form' || !configured && !disabled" layout="vertical" class="map-first-form">
      <PlatformSettingsFields group="map">
      <a-form-item key="apiKey" :label="t('PlatformSettings.jsKey')" :validate-status="errors?.apiKey ? 'error' : undefined" :help="errors?.apiKey || t('PlatformSettings.jsKeyHint')">
        <a-input :value="model.apiKey" :disabled="busy || disabled" @update:value="emit('change', { apiKey: $event })" />
      </a-form-item>
      <a-form-item key="secretKey" :label="t('PlatformSettings.secret')" :validate-status="errors?.secretKey ? 'error' : undefined" :help="errors?.secretKey || t('PlatformSettings.secretHint')">
        <a-input-password :value="model.secretKey" :disabled="busy || disabled" autocomplete="new-password" @update:value="emit('change', { secretKey: $event })" />
      </a-form-item>
      <a-form-item key="webKey" :label="t('PlatformSettings.webKey')" :validate-status="errors?.webKey ? 'error' : undefined" :help="errors?.webKey || t('PlatformSettings.webKeyHint')">
        <a-input :value="model.webKey" :disabled="busy || disabled" @update:value="emit('change', { webKey: $event })" />
      </a-form-item>
      </PlatformSettingsFields>
      <a-button v-if="mode === 'detail'" type="primary" :loading="busy" @click="saveInitial">{{ t('PlatformSettings.save') }}</a-button>
    </a-form>
    <PlatformSettingsFields v-else group="map">
      <PlatformSettingRow key="apiKey" field="apiKey" icon="EnvironmentOutlined" :label="t('PlatformSettings.jsKey')" :description="t('PlatformSettings.jsKeyHint')">
        <a-typography-text v-if="saved.apiKey" copyable class="map-key">{{ saved.apiKey }}</a-typography-text>
        <span v-else>{{ t('PlatformSettings.notConfigured') }}</span>
        <template #action><a-button v-if="!disabled" :disabled="busy" @click="editPair">{{ t('PlatformSettings.modify') }}</a-button></template>
      </PlatformSettingRow>
      <PlatformSettingRow key="secretKey" field="secretKey" icon="LockOutlined" :label="t('PlatformSettings.secret')" :description="t('PlatformSettings.secretHint')">
        <span class="map-key">{{ saved.secretKey ? (showSecret ? saved.secretKey : '••••••••') : t('PlatformSettings.notConfigured') }}</span>
        <template #action><a-button v-if="saved.secretKey" type="text" :aria-label="t(showSecret ? 'PlatformSettings.hideSecret' : 'PlatformSettings.showSecret')" @click="showSecret = !showSecret"><AIcon :type="showSecret ? 'EyeInvisibleOutlined' : 'EyeOutlined'" /></a-button></template>
      </PlatformSettingRow>
      <PlatformSettingRow key="webKey" field="webKey" icon="KeyOutlined" :label="t('PlatformSettings.webKey')" :description="t('PlatformSettings.webKeyHint')">
        <span class="map-key">{{ saved.webKey || t('PlatformSettings.notConfigured') }}</span>
      </PlatformSettingRow>
    </PlatformSettingsFields>
    <a-modal :open="pairOpen" :title="t('PlatformSettings.editMapPair')" :confirm-loading="busy" :cancel-button-props="{ disabled: busy }" :closable="!busy" :mask-closable="false" :keyboard="!busy" @ok="savePair" @cancel="cancelPair">
      <a-form layout="vertical">
        <a-form-item :label="t('PlatformSettings.jsKey')"><a-input v-model:value="pair.apiKey" :disabled="busy" /></a-form-item>
        <a-form-item :label="t('PlatformSettings.secret')"><a-input-password v-model:value="pair.secretKey" :disabled="busy" autocomplete="new-password" /></a-form-item>
        <a-form-item :label="t('PlatformSettings.webKey')" :help="t('PlatformSettings.webKeyHint')"><a-input v-model:value="pair.webKey" :disabled="busy" /></a-form-item>
        <a-alert v-if="pairError" type="error" show-icon :message="pairError" />
      </a-form>
    </a-modal>
  </ContentPanel>
</template>
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ContentPanel from '../ContentPanel/index.vue'
import PlatformSettingsFields from './PlatformSettingsFields'
import PlatformSettingRow from './PlatformSettingRow.vue'
import { sectionProps } from './sectionProps'
import type { PlatformSettingsPatch } from './types'
const props = defineProps(sectionProps)
const emit = defineEmits<{ change: [patch: PlatformSettingsPatch] }>()
const { t } = useI18n()
const configured = computed(() => !!(props.saved.apiKey || props.saved.secretKey || props.saved.webKey))
const showSecret = ref(false)
const pairOpen = ref(false)
const pairError = ref('')
const failure = ref('')
const pair = reactive({ apiKey: '', secretKey: '', webKey: '' })
function editPair() { Object.assign(pair, { apiKey: props.saved.apiKey, secretKey: props.saved.secretKey, webKey: props.saved.webKey }); pairError.value = ''; pairOpen.value = true }
function cancelPair() {
  emit('change', { apiKey: props.saved.apiKey, secretKey: props.saved.secretKey, webKey: props.saved.webKey })
  pairOpen.value = false
}
async function savePair() {
  const result = await props.submit({ ...pair })
  if (result.ok) pairOpen.value = false
  else pairError.value = result.error || t('PlatformSettings.saveFailed')
}
async function saveInitial() {
  const result = await props.submit({ apiKey: props.model.apiKey, secretKey: props.model.secretKey, webKey: props.model.webKey })
  failure.value = result.ok ? '' : result.error || t('PlatformSettings.saveFailed')
}
async function clear() {
  const result = await props.submit({ apiKey: '', secretKey: '', webKey: '' })
  showSecret.value = false
  failure.value = result.ok ? '' : result.error || t('PlatformSettings.saveFailed')
}
</script>
<style scoped>
.platform-card :deep(.settings-row__icon) { width: 2.375rem; height: 2.375rem; border-radius: var(--r-3); background: var(--accent-soft); color: var(--accent); font-size: var(--fs-20); }
.map-first-form { max-width: 40rem; padding-top: var(--space-4); }
.map-key { display: inline-block; max-width: 100%; overflow-wrap: anywhere; font-family: monospace; }
</style>

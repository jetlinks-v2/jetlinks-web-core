<template>
  <div class="setting-image">
    <FileUpload v-if="kind === 'ico' && !disabled" :size="1" :disabled="busy || imageBusy" accept=".ico,image/x-icon,image/vnd.microsoft.icon" :multiple="false" :max-count="1" :before-upload="checkIcon" @upload-change="iconChanged">
      <PlatformImageTrigger v-bind="triggerProps" :loading="fileUploading" :style="imageStyle" />
    </FileUpload>
    <ImageUpload v-else-if="!disabled" :value="value" :size="4" :disabled="busy || imageBusy" :style="imageStyle" :border-style="{ border: 'none' }" :cropper-props="{ fixed: true, fixedNumber: kind === 'background' ? [16, 9] : [1, 1] }" @update:value="uploaded" @crop-visible-change="cropOpen = $event" @crop-interact-busy="processing = $event">
      <template #content="{ loading }">
        <PlatformImageTrigger v-bind="triggerProps" :loading="loading || processing" :style="imageStyle" />
      </template>
    </ImageUpload>
    <img v-else-if="src" :src="src" :alt="t(`PlatformSettings.${kind === 'ico' ? 'icon' : kind}`)" :class="{ 'setting-image__background': kind === 'background' }" />
    <span v-else>{{ t('PlatformSettings.notConfigured') }}</span>
    <a-button v-if="failed" type="link" danger size="small" :disabled="busy" @click="uploaded(value)">{{ t('PlatformSettings.retry') }}</a-button>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, type UploadChangeParam, type UploadProps } from 'ant-design-vue'
import FileUpload from '../Upload/File/index.vue'
import ImageUpload from '../Upload/Image/ImageUpload.vue'
import PlatformImageTrigger from './PlatformImageTrigger.vue'
import type { PlatformSettingsMode, PlatformSettingsSubmit } from './types'
const props = defineProps<{ kind: 'logo' | 'ico' | 'background'; value: string; src: string; mode: PlatformSettingsMode; busy?: boolean; disabled?: boolean; submit: PlatformSettingsSubmit }>()
const emit = defineEmits<{ change: [patch: Partial<Record<'logo' | 'ico' | 'background', string>>]; busyChange: [busy: boolean] }>()
const { t } = useI18n()
const failed = ref(false)
const cropOpen = ref(false)
const processing = ref(false)
const fileUploading = ref(false)
const imageBusy = computed(() => cropOpen.value || processing.value || fileUploading.value)
watch(imageBusy, value => emit('busyChange', value))
onBeforeUnmount(() => emit('busyChange', false))
const imageStyle = computed(() => ({ width: props.kind === 'background' ? '9rem' : '3rem', height: '3rem', padding: 0 }))
const triggerProps = computed(() => ({
  src: props.src,
  label: t(`PlatformSettings.${props.kind === 'ico' ? 'icon' : props.kind}`),
  disabled: props.busy || imageBusy.value,
}))
const checkIcon: UploadProps['beforeUpload'] = file => /\.ico$/i.test(file.name) ? true : Upload.LIST_IGNORE
async function uploaded(value: string) {
  const patch = { [props.kind]: value }
  emit('change', patch)
  const result = await props.submit(patch)
  failed.value = !result.ok
}
function iconChanged(event: UploadChangeParam) {
  fileUploading.value = event.file.status === 'uploading'
  if (event.file.status === 'done') {
    const response = event.file.response as { success?: boolean; result?: { accessUrl?: string } } | undefined
    if (response?.success !== false && response?.result?.accessUrl) void uploaded(response.result.accessUrl)
    // Transport failures are reported by FileUpload; only a failed settings save offers a save retry.
  }
}
</script>
<style scoped>
.setting-image { display: flex; align-items: center; gap: var(--space-2); max-width: 100%; flex-wrap: wrap; }
.setting-image > img { width: 2rem; height: 2rem; object-fit: contain; border-radius: var(--r-2); }
.setting-image > img.setting-image__background { width: 4rem; height: 2.25rem; object-fit: cover; }
.setting-image :deep(.ant-upload-select) { margin: 0 !important; padding: 0; width: auto !important; height: auto !important; border: 0 !important; background: transparent; }
</style>

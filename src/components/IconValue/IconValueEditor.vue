<template>
  <div class="ive">
    <div class="ive__preview">
      <IconValueView
        :value="model"
        :size="previewSize"
        :fallback-text="previewFallback"
        :round="roundPreview"
      />
    </div>

    <a-tabs v-model:activeKey="activeTab" size="small" class="ive__tabs">
      <a-tab-pane key="color" :tab="mergedTexts.tabColor">
        <div class="ive__pane">
          <div v-if="mergedSwatches.length" class="ive__swatches-title">{{ mergedTexts.colorSwatches }}</div>
          <div v-if="mergedSwatches.length" class="ive__swatches">
            <button
              v-for="c in mergedSwatches"
              :key="c"
              type="button"
              class="ive__swatch"
              :style="{ background: c }"
              :aria-label="c"
              :title="c"
              @click="pickPreset(c)"
            />
          </div>
          <div class="ive__row">
            <span class="ive__label">{{ mergedTexts.colorPicker }}</span>
            <input v-model="colorHex" class="ive__native-color" type="color" @input="onNativeColorInput" />
          </div>
          <a-input v-model:value="colorText" :placeholder="mergedTexts.colorPlaceholder" @change="onColorTextSyncHex" />
          <a-input
            v-model:value="colorLabel"
            :placeholder="mergedTexts.colorBlockLabel"
            allow-clear
          />
          <a-button type="primary" block class="ive__apply" @click="applyColorFromInputs">
            {{ mergedTexts.applyColor }}
          </a-button>
        </div>
      </a-tab-pane>

      <a-tab-pane key="font" :tab="mergedTexts.tabFont">
        <div class="ive__pane">
          <div class="ive__library-picker">
            <IconLibrary
              :type="selectedFontType"
              @visible-change="(v) => emit('libraryVisibleChange', v)"
              @update:type="selectLibraryFont"
            />
          </div>
        </div>
      </a-tab-pane>

      <a-tab-pane key="image" :tab="mergedTexts.tabImage">
        <div class="ive__pane">
          <div v-if="enableCropUpload" class="ive__image-upload-wrap">
            <ImageUpload
              ref="imageUploadRef"
              :value="imageUrl"
              :style="mergedImageCardStyle"
              :border-style="mergedImageCardStyle"
              :cropper-title="mergedTexts.cropTitle"
              :cropper-props="mergedCropperProps"
              :cropper-style="cropperBodyStyle"
              :types="imageMimeTypes"
              :size="imageMaxMb"
              :accept="imageAccept"
              @update:value="onCropUploadResult"
              @crop-visible-change="(v) => emit('cropVisibleChange', v)"
              @crop-interact-busy="(v) => emit('cropInteractBusy', v)"
            />
          </div>
          <a-input
            v-model:value="imageUrl"
            :placeholder="mergedTexts.imageUrlPlaceholder"
            allow-clear
            @press-enter="applyImageUrl"
            @blur="applyImageUrl"
          />
          <p v-if="!enableCropUpload" class="ive__hint">{{ mergedTexts.uploadHint }}</p>
          <p v-else class="ive__hint">{{ mergedTexts.imageUrlHint }}</p>
        </div>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import IconLibrary from '../IconLibrary/index.vue'
import ImageUpload from '../Upload/Image/ImageUpload.vue'
import { DEFAULT_SAFE_COLORS, formatIconValueColor, formatIconValueFont, parseIconValue } from './iconValue'
import IconValueView from './IconValueView.vue'

type IconValueEditorTexts = {
  tabColor: string
  tabFont: string
  tabImage: string
  colorSwatches: string
  colorPicker: string
  colorPlaceholder: string
  colorBlockLabel: string
  applyColor: string
  imageUrlPlaceholder: string
  cropTitle: string
  imageUrlHint: string
  uploadHint: string
}

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    previewSize?: number
    previewFallback?: string
    roundPreview?: boolean
    /** 纯色快捷选择，默认内置安全色 */
    safeColors?: string[]
    /** 是否启用「图片裁剪 + 上传」（走项目标准 ImageUpload / fileUpload） */
    enableCropUpload?: boolean
    /** 裁剪区高度等 */
    cropperBodyStyle?: CSSProperties
    /** 合并到 ImageUpload 的 cropperProps（如裁剪比例、输出尺寸） */
    imageCropperProps?: Record<string, unknown>
    /** 图片卡片占位尺寸 */
    imageCardSize?: number
    imageMimeTypes?: string[]
    imageMaxMb?: number
    imageAccept?: string
    texts?: Partial<IconValueEditorTexts>
  }>(),
  {
    modelValue: '',
    previewSize: 56,
    previewFallback: '',
    roundPreview: false,
    safeColors: undefined,
    enableCropUpload: true,
    cropperBodyStyle: () => ({ height: '17.5rem' }),
    imageCropperProps: () => ({}),
    imageCardSize: 120,
    imageMimeTypes: () => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as string[],
    imageMaxMb: 5,
    imageAccept: 'image/png,image/jpeg,image/webp,image/gif',
  },
)

const { t: $t } = useI18n()

const emit = defineEmits<{
  'update:modelValue': [v: string]
  cropVisibleChange: [visible: boolean]
  cropInteractBusy: [busy: boolean]
  libraryVisibleChange: [visible: boolean]
}>()

const imageUploadRef = ref<{ abortCrop?: () => void } | null>(null)

defineExpose({
  abortCrop: () => imageUploadRef.value?.abortCrop?.(),
})

const defaultTexts = computed<IconValueEditorTexts>(() => ({
  tabColor: $t('components.IconValueEditor.tabColor'),
  tabFont: $t('components.IconValueEditor.tabFont'),
  tabImage: $t('components.IconValueEditor.tabImage'),
  colorSwatches: $t('components.IconValueEditor.colorSwatches'),
  colorPicker: $t('components.IconValueEditor.colorPicker'),
  colorPlaceholder: $t('components.IconValueEditor.colorPlaceholder'),
  colorBlockLabel: $t('components.IconValueEditor.colorBlockLabel'),
  applyColor: $t('components.IconValueEditor.applyColor'),
  imageUrlPlaceholder: $t('components.IconValueEditor.imageUrlPlaceholder'),
  cropTitle: $t('components.IconValueEditor.cropTitle'),
  imageUrlHint: $t('components.IconValueEditor.imageUrlHint'),
  uploadHint: $t('components.IconValueEditor.uploadHint'),
}))

const mergedTexts = computed(() => ({ ...defaultTexts.value, ...props.texts }))

const mergedSwatches = computed(() => props.safeColors ?? [...DEFAULT_SAFE_COLORS])

const mergedImageCardStyle = computed<CSSProperties>(() => {
  const n = props.imageCardSize ?? 120
  return { width: `${n}px`, height: `${n}px` }
})

const mergedCropperProps = computed(() => ({
  fixedBox: false,
  fixed: true,
  fixedNumber: [1, 1],
  centerBox: true,
  canScale: false,
  canMove: false,
  canMoveBox: true,
  autoCrop: true,
  autoCropWidth: 256,
  autoCropHeight: 256,
  outputType: 'png',
  ...props.imageCropperProps,
}))

const model = computed({
  get: () => (props.modelValue == null ? '' : String(props.modelValue)),
  set: (v: string) => emit('update:modelValue', v),
})

const activeTab = ref<'color' | 'font' | 'image'>('color')
const colorHex = ref('#1677ff')
const colorText = ref('#1677ff')
const colorLabel = ref('')
const imageUrl = ref('')
const selectedFontType = computed(() => {
  const p = parseIconValue(model.value)
  return p.kind === 'font' ? p.iconType : ''
})

function syncFromModel(v: string) {
  const p = parseIconValue(v)
  if (p.kind === 'color') {
    colorText.value = p.color
    colorHex.value = toHexOrFallback(p.color, colorHex.value)
    colorLabel.value = p.label ?? ''
  } else if (p.kind === 'image') {
    imageUrl.value = p.url
  } else if (p.kind !== 'font') {
    imageUrl.value = ''
  }
}
watch(
  () => props.modelValue,
  (v) => {
    syncFromModel(v == null ? '' : String(v))
  },
  { immediate: true },
)

function toHexOrFallback(css: string, fb: string): string {
  const s = String(css || '').trim()
  const m = /^#([0-9A-Fa-f]{6})$/.exec(s)
  if (m) return `#${m[1]}`
  return fb
}

function pickPreset(c: string) {
  colorHex.value = c
  colorText.value = c
  emit('update:modelValue', formatIconValueColor(c, colorLabel.value.trim() || undefined))
}

function onNativeColorInput() {
  colorText.value = colorHex.value
  emit('update:modelValue', formatIconValueColor(colorHex.value, colorLabel.value.trim() || undefined))
}

function applyColorFromInputs() {
  const raw = String(colorText.value || colorHex.value || '').trim()
  if (!raw) return
  emit('update:modelValue', formatIconValueColor(raw, colorLabel.value.trim() || undefined))
}

function onColorTextSyncHex() {
  const raw = String(colorText.value || '').trim()
  if (/^#([0-9A-Fa-f]{6})$/.test(raw)) colorHex.value = raw
}

function selectLibraryFont(name: string) {
  emit('update:modelValue', formatIconValueFont(name))
}

function applyImageUrl() {
  const u = String(imageUrl.value || '').trim()
  if (u) emit('update:modelValue', u)
}

function onCropUploadResult(url: string) {
  imageUrl.value = url
  emit('update:modelValue', url)
}
</script>

<style scoped>
.ive {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}
.ive__preview {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
}
.ive__tabs :deep(.ant-tabs-nav) {
  margin-bottom: var(--space-2);
}
.ive__pane {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ive__swatches-title {
  font-size: var(--fs-12);
  color: var(--ink-4);
}
.ive__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}
.ive__swatch {
  width: 1.625rem;
  height: 1.625rem;
  border-radius: var(--r-2);
  border: 1px solid color-mix(in srgb, var(--ink-1) 12%, transparent);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.ive__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ive__label {
  font-size: var(--fs-14);
  color: var(--ink-2);
  white-space: nowrap;
}
.ive__native-color {
  width: 2.75rem;
  height: 1.75rem;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--ink-1) 15%, transparent);
  border-radius: var(--r-1);
  cursor: pointer;
  background: transparent;
}
.ive__apply {
  margin-top: var(--space-1);
}
.ive__library-picker {
  display: flex;
  justify-content: center;
}
.ive__image-upload-wrap {
  display: flex;
  justify-content: flex-start;
}
.ive__hint {
  margin: 0;
  font-size: var(--fs-12);
  color: var(--ink-4);
  line-height: 1.5;
}</style>

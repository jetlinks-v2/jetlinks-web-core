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
        </div>
      </a-tab-pane>

      <a-tab-pane key="font" :tab="mergedTexts.tabFont">
        <div class="ive__pane">
          <div class="ive__font-picker">
            <IconLibrary :type="currentFontIcon" @update:type="selectFont" />
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
    /** 字体图标候选 */
    fontIconNames?: string[]
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
    fontIconNames: undefined,
    enableCropUpload: true,
    cropperBodyStyle: () => ({ height: '280px' }),
    imageCropperProps: () => ({}),
    imageCardSize: 120,
    imageMimeTypes: () => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as string[],
    imageMaxMb: 5,
    imageAccept: 'image/png,image/jpeg,image/webp,image/gif',
  },
)

const emit = defineEmits<{
  'update:modelValue': [v: string]
  cropVisibleChange: [visible: boolean]
  cropInteractBusy: [busy: boolean]
}>()

const imageUploadRef = ref<{ abortCrop?: () => void } | null>(null)

defineExpose({
  abortCrop: () => imageUploadRef.value?.abortCrop?.(),
})

const defaultTexts = computed<IconValueEditorTexts>(() => ({
  tabColor: '纯色',
  tabFont: '图标',
  tabImage: '图片',
  colorSwatches: '常用色',
  colorPicker: '选择颜色',
  colorPlaceholder: '如 #RRGGBB 或 rgb(...)',
  colorBlockLabel: '色块文字（可选，留空则用名称缩写）',
  applyColor: '应用',
  imageUrlPlaceholder: '或粘贴图片地址',
  cropTitle: '裁剪图片',
  imageUrlHint: '上传后自动填入地址，也可手动粘贴外链。',
  uploadHint: '关闭裁剪上传时，请直接粘贴图片地址。',
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
const syncingColorDraft = ref(false)
const currentFontIcon = computed(() => {
  const parsed = parseIconValue(model.value)
  return parsed.kind === 'font' ? parsed.iconType : ''
})

function syncFromModel(v: string) {
  const p = parseIconValue(v)
  if (p.kind === 'color') {
    syncingColorDraft.value = true
    colorText.value = p.color
    colorHex.value = toHexOrFallback(p.color, colorHex.value)
    colorLabel.value = p.label ?? ''
    syncingColorDraft.value = false
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
}

function onNativeColorInput() {
  colorText.value = colorHex.value
}

function emitColorDraft(raw?: string) {
  const value = String(raw ?? colorText.value ?? colorHex.value ?? '').trim()
  if (!value) return
  emit('update:modelValue', formatIconValueColor(value, colorLabel.value.trim() || undefined))
}

watch(
  colorText,
  (value) => {
    if (syncingColorDraft.value) return
    const raw = String(value || '').trim()
    if (/^#([0-9A-Fa-f]{6})$/.test(raw)) colorHex.value = raw
    emitColorDraft(raw)
  },
  { flush: 'sync' },
)

watch(
  colorLabel,
  () => {
    if (syncingColorDraft.value) return
    emitColorDraft()
  },
  { flush: 'sync' },
)

function onColorTextSyncHex() {
  const raw = String(colorText.value || '').trim()
  if (/^#([0-9A-Fa-f]{6})$/.test(raw)) colorHex.value = raw
}

function selectFont(name: string) {
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

<style scoped lang="less">
.ive {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.ive__preview {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}
.ive__tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}
.ive__pane {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ive__swatches-title {
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
}
.ive__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 4px;
}
.ive__swatch {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.ive__row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ive__label {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.65);
  white-space: nowrap;
}
.ive__native-color {
  width: 44px;
  height: 28px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
}
.ive__font-picker {
  display: flex;
  justify-content: flex-start;
}
.ive__image-upload-wrap {
  display: flex;
  justify-content: flex-start;
}
.ive__hint {
  margin: 0;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.45);
  line-height: 1.5;
}
</style>

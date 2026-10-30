<template>
  <a-modal
    :open="open"
    :title="title || $t('ImagePreview.title')"
    :width="modalWidth"
    :style="{ top: '24px' }"
    :body-style="{ padding: '16px 24px 20px' }"
    :footer="null"
    destroy-on-close
    @cancel="emit('close')"
  >
    <div
      ref="stageRef"
      class="visual-alarm-image-preview"
      :class="{ 'is-ready': naturalSize.width, 'is-pan-enabled': canPan, 'is-dragging': dragging }"
      :style="stageStyle"
      @wheel.prevent="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="cancelDragging"
    >
      <img
        v-if="!imageLayout"
        ref="imageRef"
        class="visual-alarm-image-preview__loader"
        :src="url"
        alt=""
        @load="handleImageLoad"
      />
      <div v-else class="visual-alarm-image-preview__canvas" :class="{ 'is-dragging': dragging }" :style="imageStyle">
        <img :src="url" alt="" draggable="false" />
        <span
          v-for="(box, index) in boxes"
          :key="`${box.label}-${index}-${box.left}-${box.top}-${box.right}-${box.bottom}`"
          class="visual-alarm-image-preview__box"
          :class="`is-${box.color}`"
          :data-label="box.label"
          :style="boxStyle(box)"
        />
      </div>
    </div>

    <footer class="visual-alarm-image-preview__tools">
      <span>{{ zoomPercent }}</span>
      <a-button size="small" @click="resetZoom">{{ $t('ImagePreview.reset') }}</a-button>
    </footer>
  </a-modal>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImagePreview } from './useImagePreview'
import type { ImagePreviewProps } from './types'

// setup-name-support 匿名预编译无法解析外部宏类型，使用运行时声明保留公共类型约束。
const props = defineProps({
  open: { type: Boolean, required: true },
  url: { type: String, required: true },
  title: { type: String, default: '' },
  boxes: { type: Array as PropType<ImagePreviewProps['boxes']>, default: () => [] },
})
const emit = defineEmits<{ close: [] }>()
const { t: $t } = useI18n()
const {
  stageRef, imageRef, naturalSize, modalWidth, stageStyle, imageLayout,
  imageStyle, zoomPercent, canPan, dragging, handleWheel, handlePointerDown, handlePointerMove,
  handlePointerUp, cancelDragging, handleImageLoad, resetZoom, boxStyle,
} = useImagePreview(props)
</script>

<style scoped>
.visual-alarm-image-preview { display: grid; width: 100%; min-height: 320px; overflow: hidden; place-items: center; border-radius: 10px; background: #101318; touch-action: none; user-select: none; }
.visual-alarm-image-preview.is-ready { min-height: 0; }
.visual-alarm-image-preview.is-pan-enabled { cursor: grab; }
.visual-alarm-image-preview.is-dragging { cursor: grabbing; }
.visual-alarm-image-preview__loader { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.visual-alarm-image-preview__canvas { position: relative; flex: none; transform-origin: center; transition: transform 120ms ease-out; }
.visual-alarm-image-preview__canvas.is-dragging { transition: none; }
.visual-alarm-image-preview__canvas > img { display: block; width: 100%; height: 100%; user-select: none; }
.visual-alarm-image-preview__box { position: absolute; box-sizing: border-box; border: 2px solid var(--box-color, #34d399); background: rgb(52 211 153 / 4%); box-shadow: 0 0 0 1px rgb(255 255 255 / 55%), 0 0 10px rgb(15 23 42 / 35%); pointer-events: none; }
.visual-alarm-image-preview__box::after { position: absolute; top: -24px; left: -2px; padding: 3px 6px; border-radius: 4px 4px 4px 0; background: var(--box-color, #34d399); color: #fff; content: attr(data-label); font-size: 12px; font-weight: 700; line-height: 1.15; white-space: nowrap; }
.visual-alarm-image-preview__box.is-red { --box-color: #ff4050; }
.visual-alarm-image-preview__box.is-amber { --box-color: #f59f00; }
.visual-alarm-image-preview__box.is-blue { --box-color: #2f7dff; }
.visual-alarm-image-preview__box.is-green { --box-color: #18a058; }
.visual-alarm-image-preview__box.is-violet { --box-color: #8b5cf6; }
.visual-alarm-image-preview__box.is-cyan { --box-color: #0891b2; }
.visual-alarm-image-preview__box.is-pink { --box-color: #db2777; }
.visual-alarm-image-preview__tools { display: flex; align-items: center; justify-content: center; gap: 16px; padding-top: 14px; }
.visual-alarm-image-preview__tools > span { min-width: 48px; color: var(--ink-2); text-align: center; font-size: 13px; font-weight: 600; }
@media (max-width: 760px) { .visual-alarm-image-preview { min-height: 240px; } .visual-alarm-image-preview.is-ready { min-height: 0; } }
</style>

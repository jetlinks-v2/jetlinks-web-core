<script setup lang="ts">
import { ref } from 'vue'
import { TrackRecorder } from '../utils'

defineProps({
  tip: {
    type: String,
    default: '',
  }
})

const trackRecorder = new TrackRecorder()

const status = ref<'ready' | 'moving' | 'validating' | 'success' | 'fail'>('ready')
const isDragging = ref(false)
const sliderPercent = ref(0)
const trackWidth = ref(0)
const startX = ref(0)

const emits = defineEmits(['end', 'move'])

const handleDragMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return
  if ('touches' in e && e.cancelable) e.preventDefault()

  trackRecorder.handleMove(e)

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const deltaX = clientX - startX.value
  const percent = Math.max(0, Math.min(deltaX / trackWidth.value, 1))

  sliderPercent.value = percent * 100

  emits('move', percent)
}

const handleDragEnd = async (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return

  isDragging.value = false
  removeEventListeners()

  const trackData = trackRecorder.stopTracking(e)
  status.value = 'validating'
  emits('end', trackData)
}

const handleDragStart = (e: MouseEvent | TouchEvent) => {
  if (status.value === 'validating' || status.value === 'success') return

  e.preventDefault()
  isDragging.value = true
  status.value = 'moving'
  trackRecorder.startTracking(e)

  const trackEl = (e.currentTarget as HTMLElement).parentElement
  trackWidth.value = trackEl?.offsetWidth || 0
  startX.value = 'touches' in e ? e.touches[0].clientX : e.clientX

  document.addEventListener('mousemove', handleDragMove)
  document.addEventListener('mouseup', handleDragEnd)
  document.addEventListener('touchmove', handleDragMove, { passive: false })
  document.addEventListener('touchend', handleDragEnd)
}

const removeEventListeners = () => {
  document.removeEventListener('mousemove', handleDragMove)
  document.removeEventListener('mouseup', handleDragEnd)
  document.removeEventListener('touchmove', handleDragMove)
  document.removeEventListener('touchend', handleDragEnd)
}

defineExpose({
  reset: () => {
    console.log(sliderPercent.value)
    status.value = 'ready'
    sliderPercent.value = 0
  }
})

</script>

<template>
  <div class="track">
    <div class="track-mask" :style="{ width: `${sliderPercent}%` }"></div>
    <span v-if="!isDragging" class="track-tip">{{ tip || '拖动滑块旋转图片' }}</span>
    <div
      class="slider-btn"
      :class="{ active: isDragging }"
      :style="{ left: `${sliderPercent}%` }"
      @mousedown="handleDragStart"
      @touchstart.passive="handleDragStart"
    >
      <AIcon type="ArrowRightOutlined" />
    </div>
  </div>
</template>

<style scoped>

.track {
  position: relative;
  height: 2.5rem;
  background: var(--bg);
  border: 1px solid var(--line-strong);
  border-radius: var(--r-1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.track-mask {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--info);
  opacity: 0.2;
  border-radius: var(--r-1) 0 0 var(--r-1);
}

.track-tip {
  font-size: var(--fs-14);
  color: var(--ink-4);
  user-select: none;
  pointer-events: none;
}

.slider-btn {
  position: absolute;
  width: 2.25rem;
  height: 2.25rem;
  background: var(--bg);
  border: 1px solid var(--line-strong);
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-1);
  transition: background 0.2s;
  z-index: 2;
}

.slider-btn:hover,
.slider-btn.active {
  background: var(--info);
  border-color: var(--info);
  color: var(--accent-ink);
  cursor: grabbing;
}</style>
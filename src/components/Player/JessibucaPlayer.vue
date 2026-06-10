<template>
  <div ref="rootRef" :class="['jmp', props.className]" @click="props.onClick?.()">
    <video
      v-if="playerMode === 'native'"
      ref="nativeVideoRef"
      class="jmp__native-video"
      :muted="muted"
      :crossorigin="props.crossOriginVideo ? 'anonymous' : undefined"
      playsinline
      preload="auto"
      @canplay="handleNativeCanPlay"
      @playing="handleNativePlaying"
      @pause="handleNativePause"
      @ended="handleNativeEnded"
      @timeupdate="handleNativeTimeUpdate"
      @error="handleNativeError"
    />
    <div v-else ref="containerRef" class="jmp__container" />
    <div v-if="!hasSource" class="jmp__empty">No Video</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { mediaPlayerProps } from './types';
import { useJessibucaPlayer } from './useJessibucaPlayer';

defineOptions({
  name: 'JessibucaPlayer',
});

const props = defineProps(mediaPlayerProps);

const rootRef = ref<HTMLElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const nativeVideoRef = ref<HTMLVideoElement | null>(null);
const hasSource = computed(() => Boolean(props.url));

const handleNativeCanPlay = () => props.onCanPlay?.();
const handleNativePlaying = () => props.onPlay?.();
const handleNativePause = () => props.onPause?.();
const handleNativeEnded = () => props.onEnded?.();
const handleNativeTimeUpdate = (event: Event) => props.onTimeUpdate?.(event.target);
const handleNativeError = (event: Event) => props.onError?.(event);
const {
  muted,
  playerMode,
  play,
  pause,
  paused,
  setPlaybackRate,
  getCurrentTime,
  getDuration,
  screenshot,
  getPlayer,
} = useJessibucaPlayer(props, rootRef, containerRef, nativeVideoRef);

defineExpose({
  play,
  pause,
  paused,
  screenshot,
  setPlaybackRate,
  getCurrentTime,
  getDuration,
  getPlayer,
});
</script>

<style scoped>
.jmp,
.jmp__container,
.jmp__native-video {
  width: 100%;
  height: 100%;
}

.jmp {
  display: block;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background-color: var(--ink-1);
}

.jmp__container,
.jmp__native-video {
  display: block;
  position: absolute;
  inset: 0;
}

.jmp__container.jessibuca-container {
  width: 100% !important;
  height: 100% !important;
  inset: 0;
}

.jmp__native-video {
  object-fit: contain;
  background-color: var(--ink-1);
}

.jmp__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-ink);
  pointer-events: none;
}

.jmp__container :deep(.jessibuca-container),
.jmp__container :deep(.jessibuca-video-box),
.jmp__container :deep(.jessibuca-play-big),
.jmp__container :deep(.jessibuca-poster),
.jmp__container :deep(canvas),
.jmp__container :deep(video) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
}

.jmp__container :deep(.xgplayer) {
  width: 100%;
  height: 100%;
}

.jmp__container :deep(video) {
  object-fit: contain;
}

.jmp__container :deep(.jessibuca-controls),
.jmp__container :deep(.jessibuca-control),
.jmp__container :deep(.jessibuca-operate),
.jmp__container :deep(.xgplayer-controls),
.jmp__container :deep(.xgplayer-start) {
  display: none !important;
}
</style>

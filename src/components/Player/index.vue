<template>
  <JessibucaPlayer ref="playerRef" v-bind="props" />
</template>

<script setup lang="ts">
import JessibucaPlayer from './JessibucaPlayer.vue';
import { mediaPlayerProps } from './types';

defineOptions({
  name: 'LivePlayer',
});

const props = defineProps(mediaPlayerProps);

const playerRef = ref<InstanceType<typeof JessibucaPlayer>>();

defineExpose({
  play: () => playerRef.value?.play?.(),
  pause: () => playerRef.value?.pause?.(),
  paused: () => playerRef.value?.paused?.(),
  screenshot: (
    filename?: string,
    format?: 'png' | 'jpeg' | 'webp',
    quality?: number,
  ) => playerRef.value?.screenshot?.(filename, format, quality),
  setPlaybackRate: (value: number) => playerRef.value?.setPlaybackRate?.(value),
  getCurrentTime: () => playerRef.value?.getCurrentTime?.(),
  getDuration: () => playerRef.value?.getDuration?.(),
  getPlayer: () => playerRef.value?.getPlayer?.(),
});
</script>

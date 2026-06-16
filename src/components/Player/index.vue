<template>
  <component :is="playerComponent" ref="playerRef" v-bind="props" />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import LegacyPlayer from './LegacyPlayer.vue';
import JessibucaPlayer from './JessibucaPlayer.vue';
import { shouldUseJessibuca } from './legacyPlayerUtils';
import { mediaPlayerProps } from './types';

defineOptions({
  name: 'LivePlayer',
});

const props = defineProps(mediaPlayerProps);
const playerRef = ref<InstanceType<typeof JessibucaPlayer> | InstanceType<typeof LegacyPlayer>>();
// Shared Player keeps FLV on Jessibuca, while the rest stays on the legacy path for compatibility.
const playerComponent = computed(() =>
  shouldUseJessibuca(props.url, props.protocol) ? JessibucaPlayer : LegacyPlayer,
);

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

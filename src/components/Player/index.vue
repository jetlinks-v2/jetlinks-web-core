<template>
  <component :is="playerComponent" ref="playerRef" v-bind="props" />
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue';

import { createAiOverlayDebugLogger } from './aiOverlay/debug';
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
const playerComponentName = computed(() =>
  shouldUseJessibuca(props.url, props.protocol) ? 'JessibucaPlayer' : 'LegacyPlayer',
);

watchEffect(() => {
  createAiOverlayDebugLogger(
    typeof props.aiOverlay === 'object' ? props.aiOverlay.debug : false,
    Boolean(props.aiOverlay),
  ).trace('LivePlayer entry resolved', {
    componentName: playerComponentName.value,
    protocol: props.protocol,
    url: props.url,
    hasAiOverlay: Boolean(props.aiOverlay),
    aiOverlayType: typeof props.aiOverlay,
  });
});

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

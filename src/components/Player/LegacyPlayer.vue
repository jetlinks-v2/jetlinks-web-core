<template>
  <div ref="rootRef" :class="['jmp', props.className]" @click="props.onClick?.()">
    <video
      v-if="isMp4Mse"
      ref="mp4MseVideoRef"
      class="jmp__native-video"
      :muted="muted"
      :crossorigin="props.crossOriginVideo ? 'anonymous' : undefined"
      playsinline
      webkit-playsinline
      preload="auto"
      @canplay="props.onCanPlay?.()"
      @play="props.onPlay?.()"
      @pause="props.onPause?.()"
      @ended="props.onEnded?.()"
      @timeupdate="handleNativeTimeUpdate"
      @error="handleMp4MseError"
    />
    <video
      v-else-if="isRtc"
      ref="rtcVideoRef"
      class="jmp__native-video"
      :muted="muted"
      :crossorigin="props.crossOriginVideo ? 'anonymous' : undefined"
      playsinline
      webkit-playsinline
      preload="auto"
      @canplay="props.onCanPlay?.()"
      @play="props.onPlay?.()"
      @pause="props.onPause?.()"
      @ended="props.onEnded?.()"
      @timeupdate="handleNativeTimeUpdate"
      @error="handleNativeError"
    />
    <div v-else ref="playerHostRef" class="jmp__container">
      <div v-if="!props.url" class="jmp__empty">No Video</div>
    </div>
    <AiOverlayCanvas
      :root="rootRef"
      :video="resolveVideoElement()"
      :snapshot="aiOverlaySnapshot"
      :options="props.aiOverlay"
    />
  </div>
</template>

<script setup lang="ts">
import Player, { Events } from 'xgplayer';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import AiOverlayCanvas from './aiOverlay/AiOverlayCanvas.vue';
import { createAiOverlayDebugLogger } from './aiOverlay/debug';
import { useAiOverlay } from './aiOverlay/useAiOverlay';
import { createMp4SamePipelineSource } from './aiOverlay/mp4OverlaySource';
import { createXgplayerSeiSource } from './aiOverlay/xgplayerSource';
import { captureVideoFrame } from './playerSnapshot';
import { createLegacyRtcController } from './legacyRtc';
import {
  inferLegacyPlayerProtocol,
  isMediaStreamValue,
  legacyPlayerOptions,
} from './legacyPlayerUtils';
import { mediaPlayerProps } from './types';
import 'xgplayer/dist/index.min.css'

defineOptions({
  name: 'LegacyPlayer',
});

const props = defineProps(mediaPlayerProps);

const rootRef = ref<HTMLElement | null>(null);
const playerHostRef = ref<HTMLElement | null>(null);
const rtcVideoRef = ref<HTMLVideoElement | null>(null);
const mp4MseVideoRef = ref<HTMLVideoElement | null>(null);
const isMp4Mse = computed(
  () => protocol.value === 'mp4' && Boolean(props.aiOverlay),
);
const muted = computed(() => props.muted ?? false);
const protocol = computed(() =>
  inferLegacyPlayerProtocol(
    isMediaStreamValue(props.url) ? props.url : (props.url as string | undefined),
    props.protocol,
  ),
);
const isRtc = computed(() => protocol.value === 'rtc');
const aiOverlayLogger = () =>
  createAiOverlayDebugLogger(
    typeof props.aiOverlay === 'object' ? props.aiOverlay.debug : false,
    Boolean(props.aiOverlay),
  );

let xgPlayer: any = null;
let playbackSyncToken = 0;
let disposed = false;
let reconnectTimer: number | null = null;

const rtcController = createLegacyRtcController({
  getVideoElement: () => rtcVideoRef.value,
  getAutoplay: () => props.autoplay ?? true,
  getMuted: () => muted.value,
});

const clearReconnectTimer = () => {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

const resolveVideoElement = () => {
  if (isMp4Mse.value) return mp4MseVideoRef.value;
  return (
    rtcVideoRef.value ||
    xgPlayer?.video ||
    xgPlayer?.media ||
    playerHostRef.value?.querySelector?.('video') ||
    null
  );
};

const {
  snapshot: aiOverlaySnapshot,
  startOverlay,
  stopOverlay,
} = useAiOverlay(props, (emitPayload, options) => {
  aiOverlayLogger().trace('LegacyPlayer overlay source factory', {
    protocol: protocol.value,
    url: props.url,
    enabled: options.enabled,
  });
  if (!options.enabled || typeof props.url !== 'string') return undefined;
  if (protocol.value === 'mp4') {
    return createMp4SamePipelineSource({
      url: props.url,
      getVideoElement: () => mp4MseVideoRef.value,
      emitPayload,
      debug: options.debug,
      autoplay: props.autoplay ?? true,
      muted: muted.value,
    });
  }
  if (protocol.value === 'm3u8') {
    return createXgplayerSeiSource(xgPlayer, emitPayload, options);
  }
  return undefined;
});

const handleMp4MseError = (event: Event) => {
  // Don't reconnect for MSE — the stream lifecycle is managed by the overlay source.
  props.onError?.(event);
};

const handleNativeTimeUpdate = (event: Event) => {
  props.onTimeUpdate?.(event.target);
};

const scheduleReconnect = () => {
  if (!props.live) return;
  clearReconnectTimer();
  reconnectTimer = window.setTimeout(() => {
    if (props.url) {
      void syncPlayback();
    }
  }, 5000);
};

const handleNativeError = (event: Event) => {
  scheduleReconnect();
  props.onError?.(event);
};

const destroyXgPlayer = () => {
  if (!xgPlayer) return;
  xgPlayer.destroy?.();
  xgPlayer = null;
};

const destroyPlayer = () => {
  stopOverlay();
  clearReconnectTimer();
  rtcController.stop();
  destroyXgPlayer();
  props.onDestroy?.();
};

const bindXgPlayerEvents = () => {
  if (!xgPlayer?.on) return;
  xgPlayer.on(Events.PLAY, () => props.onPlay?.());
  xgPlayer.on(Events.PAUSE, () => props.onPause?.());
  xgPlayer.on(Events.ENDED, () => props.onEnded?.());
  xgPlayer.on(Events.TIME_UPDATE, (event: any) => props.onTimeUpdate?.(event));
  xgPlayer.on(Events.CANPLAY, () => props.onCanPlay?.());
  xgPlayer.on(Events.ERROR, (error: any) => {
    scheduleReconnect();
    props.onError?.(error);
  });
};

const createXgPlayer = (host: HTMLElement) => {
  if (typeof props.url !== 'string' || !props.url) return;
  aiOverlayLogger().trace('LegacyPlayer creating xgplayer', {
    protocol: protocol.value,
    url: props.url,
    live: props.live,
    hasAiOverlay: Boolean(props.aiOverlay),
  });
  xgPlayer = new Player({
    el: host,
    url: props.url,
    isLive: props.live,
    width: '100%',
    height: '100%',
    hasStart: false,
    playbackRate: false,
    cssFullscreen: false,
    lang: props.lang || 'zh-cn',
    muted: muted.value,
    autoplay: props.autoplay ?? true,
    volume: props.volume ?? 0.6,
    loop: props.loop ?? false,
    ignores: ['progress', 'replay'],
    closeVideoClick: true,
    closeVideoDblclick: true,
    closeVideoTouch: true,
    closePlayerBlur: true,
    closeControlsBlur: true,
    closeFocusVideoFocus: true,
    closePlayVideoFocus: true,
    controls: { mode: 'bottom' },
    ...legacyPlayerOptions[protocol.value],
    ...(props.options || {})
  });
  bindXgPlayerEvents();
  startOverlay();
};

const syncPlayback = async () => {
  const token = ++playbackSyncToken;
  destroyPlayer();
  if (!props.url) return;

  await nextTick();
  // A pending sync may resume after unmount or after Vue swaps the host branch.
  if (disposed || token !== playbackSyncToken) return;

  if (!isRtc.value) {
    if (isMp4Mse.value) {
      // MP4 + MSE: overlay source handles both playback and SEI parsing
      startOverlay();
      return;
    }
    const host = playerHostRef.value;
    if (!host || disposed || token !== playbackSyncToken) return;
    createXgPlayer(host);
    return;
  }

  if (typeof props.url === 'string' || isMediaStreamValue(props.url)) {
    rtcController.play(props.url).catch((error) => {
      rtcController.stop();
      scheduleReconnect();
      props.onError?.(error);
    });
    return;
  }

  props.onError?.(new Error('RTC source is invalid'));
};

const play = () => {
  return isRtc.value ? rtcVideoRef.value?.play() : xgPlayer?.play?.();
};

const pause = () => {
  return isRtc.value ? rtcVideoRef.value?.pause() : xgPlayer?.pause?.();
};

const paused = () => {
  return isRtc.value ? rtcVideoRef.value?.paused : xgPlayer?.paused;
};

const screenshot = (
  filename?: string,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality?: number,
) => {
  const video = resolveVideoElement();
  if (!video) {
    throw new Error('video element is not ready');
  }
  return captureVideoFrame(video, format, quality);
};

const setPlaybackRate = (value: number) => {
  const video = resolveVideoElement();
  if (!video) return false;
  video.playbackRate = Number(value) || 1;
  return true;
};

const getCurrentTime = () => resolveVideoElement()?.currentTime ?? 0;
const getDuration = () => resolveVideoElement()?.duration ?? 0;

watch(
  () =>
    [
      props.url,
      props.protocol,
      props.live,
      props.updateTime,
      Boolean(props.aiOverlay),
    ] as const,
  () => {
    void syncPlayback();
  },
);

// Initial sync must wait until the host <div> is mounted. An immediate watcher
// would fire during setup(), before playerHostRef is assigned, so on a hard
// refresh (url present synchronously) createXgPlayer would silently bail out.
onMounted(() => {
  void syncPlayback();
});

watch(
  () => [props.muted, props.volume] as const,
  () => {
    const video = resolveVideoElement();
    if (video) {
      video.muted = muted.value;
    }
    if (xgPlayer) {
      xgPlayer.volume = muted.value ? 0 : props.volume ?? 0.6;
    }
  },
);

onBeforeUnmount(() => {
  disposed = true;
  playbackSyncToken += 1;
  destroyPlayer();
});

defineExpose({
  play,
  pause,
  paused,
  screenshot,
  setPlaybackRate,
  getCurrentTime,
  getDuration,
  getPlayer: () => ({
    video: resolveVideoElement(),
    xgplayer: xgPlayer,
    rtcPeer: rtcController.getPeer(),
  }),
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

.jmp__container :deep(.xgplayer),
.jmp__container :deep(.xgplayer-video-wrap),
.jmp__container :deep(.xgplayer-video),
.jmp__container :deep(video) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
}

.jmp__container :deep(video) {
  object-fit: contain;
}
</style>

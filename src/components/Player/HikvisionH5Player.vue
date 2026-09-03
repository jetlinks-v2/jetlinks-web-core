<template>
  <div class="hikvision-h5-player">
    <div :id="containerId" ref="containerRef" class="hikvision-h5-player__container" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch, type PropType } from 'vue';

import { mediaPlayerProps } from './types';

type HikvisionH5Player = {
  JS_Destroy?: () => Promise<unknown> | unknown;
  JS_Play: (
    url: string,
    options: Record<string, unknown>,
    windowIndex: number,
    startTime?: string,
    endTime?: string,
  ) => Promise<unknown>;
  JS_Resize?: () => Promise<unknown> | unknown;
  JS_ArrangeWindow?: (split: number) => Promise<unknown> | unknown;
  JS_SetWindowControlCallback?: (events: Record<string, (...args: any[]) => void>) => Promise<unknown> | unknown;
  JS_Stop?: () => Promise<unknown> | unknown;
  JS_Pause?: (windowIndex?: number) => Promise<unknown> | unknown;
  JS_Resume?: (windowIndex?: number) => Promise<unknown> | unknown;
  JS_SelectWnd?: (windowIndex: number) => Promise<unknown> | unknown;
  JS_Speed?: (windowIndex?: number, speed?: number) => Promise<unknown> | unknown;
  JS_GetOSDTime?: (windowIndex?: number) => Promise<number> | number;
};

type HikvisionStream = {
  url?: string;
  protocol?: string;
};

type HikvisionH5PlayerConstructor = new (options: Record<string, unknown>) => HikvisionH5Player;

declare global {
  interface Window {
    JSPlugin?: HikvisionH5PlayerConstructor;
  }
}

let instanceSequence = 0;
let runtimePromise: Promise<HikvisionH5PlayerConstructor> | undefined;

defineOptions({
  name: 'HikvisionH5Player',
});

const props = defineProps({
  ...mediaPlayerProps,
  streams: {
    type: Array as PropType<HikvisionStream[]>,
    default: undefined,
  },
  screen: {
    type: Number,
    default: 1,
  },
  activeIndex: {
    type: Number,
    default: 0,
  },
  playbackStartTime: String,
  playbackEndTime: String,
  playbackRate: {
    type: Number,
    default: 1,
  },
});
const emit = defineEmits<{
  (event: 'window-select', index: number): void;
}>();
const containerRef = ref<HTMLElement>();
const player = shallowRef<HikvisionH5Player>();
const playing = ref(false);
const containerId = `hikvision-h5-player-${++instanceSequence}`;
let requestVersion = 0;
let currentLayout = 0;
let currentUrls: string[] = [];
let pausedTimes: Array<number | undefined> = [];
let mounted = false;

const getAssetBasePath = () => {
  const basePath = import.meta.env.BASE_URL || '/';
  return `${basePath.endsWith('/') ? basePath : `${basePath}/`}hikvision-h5player/`;
};

const loadRuntime = (): Promise<HikvisionH5PlayerConstructor> => {
  if (window.JSPlugin) {
    return Promise.resolve(window.JSPlugin);
  }
  if (runtimePromise) {
    return runtimePromise;
  }

  runtimePromise = new Promise<HikvisionH5PlayerConstructor>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>('script[data-hikvision-h5player-runtime="true"]');
    if (current) {
      current.addEventListener('load', () => window.JSPlugin ? resolve(window.JSPlugin) : reject(new Error('Hikvision H5Player runtime is unavailable')), { once: true });
      current.addEventListener('error', () => reject(new Error('Hikvision H5Player runtime load failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.dataset.hikvisionH5playerRuntime = 'true';
    script.src = `${getAssetBasePath()}h5player.min.js`;
    script.onload = () => window.JSPlugin ? resolve(window.JSPlugin) : reject(new Error('Hikvision H5Player runtime is unavailable'));
    script.onerror = () => reject(new Error(`Hikvision H5Player runtime load failed: ${script.src}`));
    document.head.appendChild(script);
  }).catch((error) => {
    runtimePromise = undefined;
    throw error;
  });

  return runtimePromise;
};

const stop = async () => {
  const current = player.value;
  player.value = undefined;
  playing.value = false;
  currentLayout = 0;
  currentUrls = [];
  if (!current) {
    return;
  }
  try {
    await current.JS_Stop?.();
  } catch {
    // The stream can already be closed by Hikvision before the component is unmounted.
  }
  try {
    await current.JS_Destroy?.();
  } catch {
    // Cleanup must not prevent the next stream from being created.
  }
  containerRef.value?.replaceChildren();
};

const normalizeLayout = (value: number) => value === 4 || value === 9 ? value : 1;

const getStreams = (layout: number) => {
  const source = props.streams?.length
    ? props.streams
    : [{ url: typeof props.url === 'string' ? props.url : '', protocol: props.protocol }];
  return Array.from({ length: layout }, (_, index) => source[index] || {});
};

const getStreamsSignature = () => getStreams(normalizeLayout(props.screen))
  .map(item => `${item.url || ''}:${item.protocol || ''}`)
  .join('|');

const selectWindow = async () => {
  const current = player.value;
  const index = Math.max(0, Math.min(normalizeLayout(props.screen) - 1, props.activeIndex || 0));
  await current?.JS_SelectWnd?.(index);
};

const toHikvisionPlaybackRate = (rate: number) => rate > 0 && rate < 1 ? -1 / rate : rate;
const isPlayback = () => Boolean(props.playbackStartTime?.trim() || props.playbackEndTime?.trim());

const applyPlaybackRate = async (rate = props.playbackRate) => {
  const current = player.value;
  if (!current || !isPlayback()) return;
  const normalizedRate = Number(rate) > 0 ? Number(rate) : 1;
  for (let index = 0; index < currentLayout; index++) {
    if (currentUrls[index]) {
      await current.JS_Speed?.(index, toHikvisionPlaybackRate(normalizedRate));
    }
  }
};

const ensurePlayer = async (layout: number, version: number) => {
  if (player.value && currentLayout === layout) {
    return player.value;
  }

  await stop();
  const Runtime = await loadRuntime();
  if (version !== requestVersion) {
    return undefined;
  }
  await nextTick();
  const nextPlayer = new Runtime({
    szId: containerId,
    szBasePath: getAssetBasePath(),
    iMaxSplit: layout,
    iCurrentSplit: Math.sqrt(layout),
    mseWorkerEnable: false,
    openDebug: false,
    bSupporDoubleClickFull: true,
    oStyle: {
      borderSelect: 'transparent',
    },
  });
  if (version !== requestVersion) {
    await nextPlayer.JS_Destroy?.();
    return undefined;
  }
  player.value = nextPlayer;
  currentLayout = layout;
  currentUrls = Array(layout).fill('');
  await nextPlayer.JS_ArrangeWindow?.(Math.sqrt(layout));
  await nextPlayer.JS_Resize?.();
  await nextPlayer.JS_SetWindowControlCallback?.({
    windowEventSelect: index => emit('window-select', index),
    firstFrameDisplay: () => props.onCanPlay?.(),
    pluginErrorHandler: (_index, code, detail) => props.onError?.({ code, detail }),
    StreamEnd: () => props.onEnded?.(),
    windowFullCcreenChange: () => props.onFullscreen?.(),
  });
  return nextPlayer;
};

const play = async () => {
  const version = ++requestVersion;
  const layout = normalizeLayout(props.screen);
  const streams = getStreams(layout);
  const targetUrls = streams.map(item => typeof item.url === 'string' ? item.url.trim() : '');
  if (!targetUrls.some(Boolean)) {
    await stop();
    return;
  }

  try {
    const current = await ensurePlayer(layout, version);
    if (!current || version !== requestVersion) {
      return;
    }
    for (let index = 0; index < layout; index++) {
      const url = targetUrls[index];
      if (currentUrls[index] === url) {
        if (!playing.value) {
          let resumed = false;
          if (current.JS_Resume) {
            try {
              await current.JS_Resume(index);
              resumed = true;
            } catch {
              resumed = false;
            }
          }
          if (!resumed && pausedTimes[index]) {
            await current.JS_Play(url, {
              playURL: url,
              mode: 0,
              keepDecoder: 0,
            }, index, new Date(pausedTimes[index]!).toISOString(), props.playbackEndTime);
            if (isPlayback()) {
              await current.JS_Speed?.(
                index,
                toHikvisionPlaybackRate(Number(props.playbackRate) > 0 ? props.playbackRate : 1),
              );
            }
          }
        }
        continue;
      }
      if (currentUrls[index]) {
        // The SDK only stops its currently selected window. Select the target
        // first so a stream replacement never stops the first split by mistake.
        await current.JS_SelectWnd?.(index);
        await current.JS_Stop?.();
      }
      if (version !== requestVersion) {
        return;
      }
      if (url) {
        const startTime = props.playbackStartTime?.trim();
        const endTime = props.playbackEndTime?.trim();
        await current.JS_Play(url, {
          playURL: url,
          mode: 0,
          keepDecoder: 0,
        }, index, startTime, endTime);
        // JS_Speed is a playback-only SDK operation; invoking it for live preview
        // rejects the first window and prevents the remaining split windows from starting.
        if (isPlayback()) {
          await current.JS_Speed?.(
            index,
            toHikvisionPlaybackRate(Number(props.playbackRate) > 0 ? props.playbackRate : 1),
          );
        }
      }
      currentUrls[index] = url;
    }
    if (version !== requestVersion) {
      return;
    }
    await selectWindow();
    playing.value = true;
    props.onPlay?.();
  } catch (error) {
    if (version === requestVersion) {
      props.onError?.(error);
    }
  }
};

const pause = async () => {
  const current = player.value;
  if (!current) {
    return;
  }
  const index = Math.max(0, Math.min(normalizeLayout(props.screen) - 1, props.activeIndex || 0));
  await current.JS_SelectWnd?.(index);
  pausedTimes[index] = await getCurrentTime();
  if (current.JS_Pause) {
    await current.JS_Pause(index);
    playing.value = false;
  } else {
    await stop();
  }
  props.onPause?.();
};

const resize = () => {
  void player.value?.JS_Resize?.();
};

const resizeAfterFullscreenChange = () => {
  void nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resize);
    });
  });
};

const screenshot = (
  _filename?: string,
  _format?: 'png' | 'jpeg' | 'webp',
  _quality?: number,
) => undefined;

const setPlaybackRate = (value: number) => applyPlaybackRate(value);

const getCurrentTime = async () => {
  const current = player.value;
  if (!current) return undefined;
  const index = Math.max(0, Math.min(normalizeLayout(props.screen) - 1, props.activeIndex || 0));
  try {
    const time = await current.JS_GetOSDTime?.(index);
    return Number.isFinite(time) ? Number(time) : undefined;
  } catch {
    return undefined;
  }
};

const getDuration = () => undefined;

onMounted(() => {
  mounted = true;
  window.addEventListener('resize', resize);
  document.addEventListener('fullscreenchange', resizeAfterFullscreenChange);
  if (props.autoplay) {
    void play();
  }
});

onBeforeUnmount(() => {
  mounted = false;
  requestVersion++;
  window.removeEventListener('resize', resize);
  document.removeEventListener('fullscreenchange', resizeAfterFullscreenChange);
  void stop();
});

watch(
  () => [
    props.url,
    props.protocol,
    props.autoplay,
    props.screen,
    props.playbackStartTime,
    props.playbackEndTime,
    getStreamsSignature(),
  ] as const,
  () => {
    if (mounted && props.autoplay) {
      void play();
    }
  },
);

watch(
  () => props.playbackRate,
  rate => {
    if (mounted && player.value) {
      void applyPlaybackRate(rate);
    }
  },
);

watch(
  () => props.activeIndex,
  () => {
    if (mounted && player.value) {
      void selectWindow();
    }
  },
);

defineExpose({
  play,
  pause,
  paused: () => !playing.value,
  screenshot,
  setPlaybackRate,
  getCurrentTime,
  getDuration,
  getPlayer: () => player.value,
});
</script>

<style scoped>
.hikvision-h5-player,
.hikvision-h5-player__container {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #000;
}
</style>

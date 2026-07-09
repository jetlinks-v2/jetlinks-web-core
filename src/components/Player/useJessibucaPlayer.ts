import { computed, nextTick, ref, watch, type Ref } from 'vue';

import {
  createJessibucaConfig,
  getJessibucaConfigKey,
  isMediaStreamValue,
  loadJessibuca,
  normalizePlaybackUrl,
  type JessibucaCtor,
} from './jessibuca';
import { createAiOverlayDebugLogger } from './aiOverlay/debug';
import { createJessibucaInlineFlvSeiSource } from './aiOverlay/jessibucaInlineFlvSource';
import { useAiOverlay } from './aiOverlay/useAiOverlay';
import { captureVideoFrame } from './playerSnapshot';
import type { MediaPlayerProps } from './types';
import type { AiOverlayVideoInfo } from './aiOverlay/types';
import { useJessibucaLifecycle } from './useJessibucaLifecycle';

export function useJessibucaPlayer(
  props: MediaPlayerProps,
  rootRef: Ref<HTMLElement | null>,
  containerRef: Ref<HTMLElement | null>,
  nativeVideoRef: Ref<HTMLVideoElement | null>,
) {
  let jessibucaPlayer: InstanceType<JessibucaCtor> | null = null;
  let jessibucaConfigKey = '';
  let resizeObserver: ResizeObserver | null = null;
  let resizeFrame = 0;
  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  const aiOverlayVideoInfo = ref<AiOverlayVideoInfo | null>(null);
  const clearAiOverlayVideoInfo = () => {
    aiOverlayVideoInfo.value = null;
  };

  const normalizedUrl = computed(() =>
    typeof props.url === 'string' ? normalizePlaybackUrl(props.url) : '',
  );
  const isRtcPlayer = computed(
    () => props.protocol === 'rtc' || isMediaStreamValue(props.url),
  );
  const muted = computed(() => props.muted === true);
  const playerMode = computed<'native' | 'jessibuca'>(() =>
    isRtcPlayer.value ? 'native' : 'jessibuca',
  );
  const configKey = computed(() =>
    getJessibucaConfigKey({
      muted: muted.value,
      protocol: props.protocol,
      url: normalizedUrl.value,
    }),
  );
  const {
    snapshot: aiOverlaySnapshot,
    startOverlay,
    stopOverlay,
    syncVideoTimestamp,
  } = useAiOverlay(props, (emitPayload, options) => {
    const logger = createAiOverlayDebugLogger(options.debug, options.enabled);
    logger.trace('Jessibuca overlay source factory', {
      enabled: options.enabled,
      protocol: props.protocol,
      url: normalizedUrl.value,
      hasPlayer: Boolean(jessibucaPlayer),
    });
    if (!options.enabled || !normalizedUrl.value) return undefined;
    if (!isJessibucaFlvOverlayUrl(normalizedUrl.value, props.protocol)) {
      logger.trace('Jessibuca overlay source skipped: not FLV overlay URL');
      return undefined;
    }
    return createJessibucaInlineFlvSeiSource({
      getPlayer: () => jessibucaPlayer,
      emitPayload,
      debug: options.debug,
    });
  });

  const resizePlayer = (withDelay = false) => {
    if (typeof window === 'undefined') return;
    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame);
    }
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      jessibucaPlayer?.resize();
    });

    if (!withDelay) return;
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      resizeTimer = null;
      jessibucaPlayer?.resize();
    }, 160);
  };

  const observePlayerSize = () => {
    if (typeof ResizeObserver === 'undefined' || resizeObserver || !rootRef.value) return;
    // 弹窗和分屏容器在流启动后还会继续布局，监听真实尺寸避免播放器只占角落。
    resizeObserver = new ResizeObserver(() => resizePlayer());
    resizeObserver.observe(rootRef.value);
  };

  const stopObservingPlayerSize = () => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = 0;
    }
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
      resizeTimer = null;
    }
  };

  const destroyJessibuca = async () => {
    if (!jessibucaPlayer) return;
    try {
      await jessibucaPlayer.destroy();
    } finally {
      stopOverlay();
      clearAiOverlayVideoInfo();
      jessibucaPlayer = null;
      jessibucaConfigKey = '';
      props.onDestroy?.();
    }
  };

  const clearNativeSource = () => {
    clearAiOverlayVideoInfo();
    const native = nativeVideoRef.value;
    if (!native) return;
    native.pause();
    native.srcObject = null;
    native.removeAttribute('src');
    native.load();
  };

  const pauseActivePlayback = async () => {
    clearNativeSource();
    if (!jessibucaPlayer) return;
    try {
      await jessibucaPlayer.pause();
    } catch {
      // Ignore pause failures from detached instances.
    }
  };

  const applyJessibucaMuted = () => {
    if (!jessibucaPlayer) return;
    if (muted.value) {
      jessibucaPlayer.setVolume?.(0);
      return;
    }
    jessibucaPlayer.setVolume?.(1);
    jessibucaPlayer.audioResume?.();
  };

  const createJessibuca = async () => {
    if (!containerRef.value) return;
    const logger = createAiOverlayDebugLogger(
      typeof props.aiOverlay === 'object' ? props.aiOverlay.debug : false,
      Boolean(props.aiOverlay),
    );
    logger.trace('Jessibuca create requested', {
      protocol: props.protocol,
      url: normalizedUrl.value,
      playerMode: playerMode.value,
      hasAiOverlay: Boolean(props.aiOverlay),
    });
    const nextConfigKey = configKey.value;
    if (jessibucaPlayer) {
      if (jessibucaConfigKey === nextConfigKey) {
        return;
      }
      // Jessibuca 3.3.26 会在初始化时锁定音频和 flv 模式，配置变更后需要重建实例。
      await destroyJessibuca();
    }
    const JessibucaRuntime = await loadJessibuca();
    if (!containerRef.value || jessibucaPlayer) return;

    const config = createJessibucaConfig(containerRef.value, {
      muted: muted.value,
      protocol: props.protocol,
      timeout: props.timeout,
      url: normalizedUrl.value,
    });
    jessibucaPlayer = new JessibucaRuntime(config);
    jessibucaConfigKey = nextConfigKey;

    jessibucaPlayer.on('start', () => {
      resizePlayer(true);
      props.onCanPlay?.();
      props.onPlay?.();
    });
    jessibucaPlayer.on('pause', () => props.onPause?.());
    jessibucaPlayer.on('error', (error) => props.onError?.(error));
    jessibucaPlayer.on('videoInfo', (info: any) => {
      const width = Number(info?.width ?? info?.w ?? info?.videoWidth ?? 0);
      const height = Number(info?.height ?? info?.h ?? info?.videoHeight ?? 0);
      const videoInfo = {
        width: Number.isFinite(width) && width > 0 ? width : 0,
        height: Number.isFinite(height) && height > 0 ? height : 0,
        codec: info?.codec || info?.codecName,
      };
      aiOverlayVideoInfo.value = videoInfo;
      if (videoInfo.width > 0 && videoInfo.height > 0) {
        props.onVideoInfo?.(videoInfo);
      }
      resizePlayer(true);
    });
    jessibucaPlayer.on('timeUpdate', (payload) => {
      props.onTimeUpdate?.({ currentTime: payload });
    });
    jessibucaPlayer.on('videoTimeUpdate', (payload) => {
      props.onTimeUpdate?.({ currentTime: payload });
    });
    jessibucaPlayer.on('streamEnd', () => props.onEnded?.());
  };

  const syncNativePlayback = async () => {
    await destroyJessibuca();
    await nextTick();

    const native = nativeVideoRef.value;
    if (!native) return;
    clearNativeSource();
    native.muted = muted.value;
    native.defaultMuted = muted.value;
    native.loop = props.loop;
    if (!muted.value) {
      native.volume = typeof props.volume === 'number' ? props.volume : 1;
    }

    if (isRtcPlayer.value) {
      if (!isMediaStreamValue(props.url)) return;
      native.srcObject = props.url;
    } else if (normalizedUrl.value) {
      native.src = normalizedUrl.value;
    } else {
      return;
    }

    if (props.autoplay === false) return;
    try {
      await native.play();
    } catch (error) {
      props.onError?.(error);
    }
  };

  const syncPlayback = async () => {
    if (!props.url) {
      await pauseActivePlayback();
      return;
    }
    if (playerMode.value === 'native') {
      return syncNativePlayback();
    }
    clearNativeSource();
    await createJessibuca();
    if (!jessibucaPlayer || !normalizedUrl.value) return;
    applyJessibucaMuted();
    if (props.autoplay === false) {
      resizePlayer(true);
      return;
    }
    try {
      await jessibucaPlayer.play(normalizedUrl.value);
      await nextTick();
      resizePlayer(true);
      startOverlay();
    } catch (error) {
      props.onError?.(error);
    }
  };

  const handleResize = () => resizePlayer();

  const play = async () => {
    if (playerMode.value === 'native') return nativeVideoRef.value?.play();
    if (jessibucaPlayer && normalizedUrl.value) {
      applyJessibucaMuted();
      const result = await jessibucaPlayer.play(normalizedUrl.value);
      startOverlay();
      return result;
    }
  };

  const pause = () => {
    clearAiOverlayVideoInfo();
    if (playerMode.value === 'native') return nativeVideoRef.value?.pause();
    stopOverlay();
    void jessibucaPlayer?.pause();
  };

  const paused = () =>
    playerMode.value === 'native' ? nativeVideoRef.value?.paused : false;

  const setPlaybackRate = (value: number) => {
    const rate = Number(value) || 1;
    const native = nativeVideoRef.value;
    if (native && typeof native.playbackRate === 'number') {
      native.playbackRate = rate;
      return true;
    }
    return false;
  };

  const getCurrentTime = () => nativeVideoRef.value?.currentTime ?? 0;
  const getDuration = () => nativeVideoRef.value?.duration ?? 0;

  const screenshot = (
    filename?: string,
    format: 'png' | 'jpeg' | 'webp' = 'png',
    quality?: number,
  ) => {
    if (playerMode.value === 'native') {
      const native = nativeVideoRef.value;
      if (!native) throw new Error('video element is not ready');
      if (native.videoWidth <= 0 || native.videoHeight <= 0) {
        throw new Error('video frame is not ready');
      }
      return captureVideoFrame(native, format, quality);
    }

    const result = jessibucaPlayer?.screenshot(filename, format, quality, 'base64');
    if (!result) throw new Error('player screenshot is unavailable');
    return result;
  };

  watch(() => [props.url, props.protocol, props.muted, props.live, props.timeout, configKey.value] as const, () => void syncPlayback(), {
    immediate: true,
  });

  useJessibucaLifecycle({
    observePlayerSize,
    stopObservingPlayerSize,
    syncPlayback,
    clearNativeSource,
    destroyJessibuca,
    handleResize,
  });

  return {
    muted,
    playerMode,
    play,
    pause,
    paused,
    aiOverlaySnapshot,
    aiOverlayVideoInfo,
    setPlaybackRate,
    getCurrentTime,
    getDuration,
    screenshot,
    getPlayer: () => ({
      video: nativeVideoRef.value,
      jessibuca: jessibucaPlayer,
    }),
  };
}

function isJessibucaFlvOverlayUrl(url: string, protocol?: string) {
  return protocol === 'flv' || /\.flv(?:$|[?#])/i.test(url);
}

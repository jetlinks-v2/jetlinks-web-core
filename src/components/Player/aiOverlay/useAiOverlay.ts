import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';

import { createAiOverlayDebugLogger } from './debug';
import { createAiOverlayState } from './overlayState';
import type {
  AiOverlayPayload,
  AiOverlaySnapshot,
  AiOverlaySource,
  NormalizedAiOverlayOptions,
} from './types';
import { normalizeAiOverlayOptions } from './types';
import type { MediaPlayerProps } from '../types';

export type AiOverlaySourceFactory = (
  emitPayload: (payload: AiOverlayPayload) => void,
  options: NormalizedAiOverlayOptions,
) => AiOverlaySource | undefined | null;

export function useAiOverlay(
  props: MediaPlayerProps,
  createSource: AiOverlaySourceFactory,
) {
  const options = computed(() => normalizeAiOverlayOptions(props.aiOverlay));
  const state = computed(() =>
    createAiOverlayState({ liveObjectTtlMs: options.value.liveObjectTtlMs }),
  );
  const snapshot = ref<AiOverlaySnapshot>({
    regions: [],
    objects: [],
  }) as Ref<AiOverlaySnapshot>;

  let source: AiOverlaySource | undefined | null;
  let ttlTimer: ReturnType<typeof window.setInterval> | null = null;
  let startToken = 0;

  const getLogger = () =>
    createAiOverlayDebugLogger(options.value.debug, options.value.enabled);

  const startTtlTimer = () => {
    if (ttlTimer || typeof window === 'undefined') return;
    ttlTimer = window.setInterval(() => {
      snapshot.value = state.value.snapshot();
    }, Math.max(250, Math.min(options.value.liveObjectTtlMs || 1000, 1000)));
  };

  const resolveStartResult = async (
    result: ReturnType<AiOverlaySource['start']>,
  ) => {
    if (result && typeof (result as Promise<boolean | void>).then === 'function') {
      return (result as Promise<boolean | void>).catch((error) => {
        getLogger().warn('overlay source start failed', error);
        return false;
      });
    }
    return result;
  };

  const syncVideoTimestamp = (timestamp: number) => {
    source?.syncVideoTimestamp?.(timestamp);
  };

  const stopOverlay = () => {
    startToken += 1;
    getLogger().trace('overlay stop requested', {
      hasSource: Boolean(source),
      hasTtlTimer: Boolean(ttlTimer),
    });
    source?.stop();
    source = null;
    if (ttlTimer) {
      window.clearInterval(ttlTimer);
      ttlTimer = null;
    }
    snapshot.value = state.value.clear();
  };

  const handlePayload = (payload: AiOverlayPayload) => {
    getLogger().trace('overlay payload accepted', {
      pts: payload.pts,
      video: payload.video,
      regions: payload.regions.length,
      objects: payload.objects.length,
    });
    snapshot.value = state.value.push(payload);
    getLogger().trace('overlay snapshot updated', {
      regions: snapshot.value.regions.length,
      objects: snapshot.value.objects.length,
      hasVideo: Boolean(snapshot.value.video),
    });
    props.onAiOverlay?.(payload);
  };

  const startOverlay = async () => {
    const logger = getLogger();
    logger.trace('overlay start requested', {
      enabled: options.value.enabled,
      showText: options.value.showText,
      liveObjectTtlMs: options.value.liveObjectTtlMs,
    });
    stopOverlay();
    const token = startToken + 1;
    startToken = token;
    if (!options.value.enabled) {
      logger.trace('overlay start skipped: disabled');
      return;
    }

    try {
      source = createSource(handlePayload, options.value);
      logger.trace('overlay source created', { hasSource: Boolean(source) });
      if (!source) return;
      const started = await resolveStartResult(source.start());
      if (token !== startToken || source == null) {
        logger.trace('overlay start result ignored: superseded');
        return;
      }
      if (started === false) {
        logger.trace('overlay TTL timer skipped: source start returned false');
        return;
      }
      startTtlTimer();
    } catch (error) {
      logger.warn('overlay source create failed', error);
      stopOverlay();
    }
  };

  watch(
    () => props.aiOverlay,
    () => startOverlay(),
    { deep: true },
  );

  onBeforeUnmount(() => stopOverlay());

  return {
    options,
    snapshot,
    handlePayload,
    startOverlay,
    stopOverlay,
    syncVideoTimestamp,
  };
}

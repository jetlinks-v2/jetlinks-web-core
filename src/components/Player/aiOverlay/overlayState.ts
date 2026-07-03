import type {
  AiOverlayPayload,
  AiOverlayRegion,
  AiOverlaySnapshot,
  AiOverlayStateController,
  NormalizedAiOverlayOptions,
} from './types';

const emptySnapshot: AiOverlaySnapshot = {
  regions: [],
  objects: [],
};

export function createAiOverlayState(
  options: Pick<NormalizedAiOverlayOptions, 'liveObjectTtlMs'>,
): AiOverlayStateController {
  let regions: AiOverlayRegion[] = [];
  let current: AiOverlaySnapshot = { ...emptySnapshot };
  let lastObjectUpdateMs = 0;

  const buildSnapshot = (nowMs = Date.now()): AiOverlaySnapshot => {
    const expired =
      current.objects.length > 0 &&
      options.liveObjectTtlMs > 0 &&
      lastObjectUpdateMs > 0 &&
      nowMs - lastObjectUpdateMs > options.liveObjectTtlMs;

    return {
      ...current,
      regions,
      objects: expired ? [] : current.objects,
    };
  };

  return {
    push(payload, nowMs = Date.now()) {
      if (payload.regions.length) {
        regions = payload.regions;
      }
      lastObjectUpdateMs = nowMs;
      current = {
        regions,
        objects: payload.objects,
        video: payload.video,
        payload,
      };
      return buildSnapshot(nowMs);
    },
    clear() {
      regions = [];
      current = { ...emptySnapshot };
      lastObjectUpdateMs = 0;
      return current;
    },
    snapshot: buildSnapshot,
  };
}

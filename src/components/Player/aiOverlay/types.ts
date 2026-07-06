import type { Ref } from 'vue';

export type AiOverlayPoint = {
  x: number;
  y: number;
};

export type AiOverlayRegion = {
  area?: string[];
  line?: string[];
};

export type AiOverlayObject = {
  id?: string;
  type: 'bbox' | string;
  class_id?: number;
  class_name?: string;
  confidence?: number;
  bbox?: [number, number, number, number];
  text?: string;
};

export type AiOverlayVideoInfo = {
  width: number;
  height: number;
  codec?: 'H264' | 'H265' | string;
};

export type AiOverlayPayload = {
  schema: 'aizlm.overlay.v1' | string;
  task_id?: string;
  algorithm_id?: string;
  pts: number;
  frame_id?: number;
  frame_ref?: string;
  video: AiOverlayVideoInfo;
  regions: AiOverlayRegion[];
  objects: AiOverlayObject[];
};

export type AiOverlayColors = {
  object: string;
  region: string;
  line: string;
  text: string;
  textBackground: string;
};

export type AiOverlayOptions = {
  showText?: boolean;
  debug?: boolean;
  liveObjectTtlMs?: number;
  colors?: Partial<AiOverlayColors>;
  lineWidth?: number;
  fontSize?: number;
};

export type NormalizedAiOverlayOptions = {
  enabled: boolean;
  showText: boolean;
  debug: boolean;
  liveObjectTtlMs: number;
  colors: AiOverlayColors;
  lineWidth: number;
  fontSize: number;
};

export type AiOverlaySnapshot = {
  regions: AiOverlayRegion[];
  objects: AiOverlayObject[];
  video?: AiOverlayVideoInfo;
  payload?: AiOverlayPayload;
};

export type AiOverlayStateController = {
  push: (payload: AiOverlayPayload, nowMs?: number) => AiOverlaySnapshot;
  clear: () => AiOverlaySnapshot;
  snapshot: (nowMs?: number) => AiOverlaySnapshot;
};

export type AiOverlaySource = {
  start: () => boolean | Promise<boolean> | void | Promise<void>;
  stop: () => void;
  /** Called by the player when a video frame is displayed, carrying its PTS in milliseconds. */
  syncVideoTimestamp?: (timestamp: number) => void;
};

export type AiOverlayEmit = (payload: AiOverlayPayload) => void;

export type AiOverlayDebugLogger = {
  warn: (message: string, detail?: unknown) => void;
};

export type ContainedVideoRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

export type AiOverlayCanvasSnapshotRef = Ref<AiOverlaySnapshot>;

const defaultColors: AiOverlayColors = {
  object: '#22c55e',
  region: '#38bdf8',
  line: '#f97316',
  text: '#ffffff',
  textBackground: 'rgba(15, 23, 42, 0.82)',
};

export function normalizeAiOverlayOptions(
  value?: boolean | AiOverlayOptions,
): NormalizedAiOverlayOptions {
  if (!value) {
    return {
      enabled: false,
      showText: true,
      debug: false,
      liveObjectTtlMs: 1500,
      colors: { ...defaultColors },
      lineWidth: 2,
      fontSize: 12,
    };
  }

  if (value === true) {
    return {
      enabled: true,
      showText: true,
      debug: false,
      liveObjectTtlMs: 1500,
      colors: { ...defaultColors },
      lineWidth: 2,
      fontSize: 12,
    };
  }

  return {
    enabled: true,
    showText: value.showText ?? true,
    debug: value.debug ?? false,
    liveObjectTtlMs: value.liveObjectTtlMs ?? 1500,
    colors: {
      ...defaultColors,
      ...(value.colors || {}),
    },
    lineWidth: value.lineWidth ?? 2,
    fontSize: value.fontSize ?? 12,
  };
}

<template>
  <canvas v-show="normalizedOptions.enabled" ref="canvasRef" class="jmp-ai-overlay" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue';

import {
  computeContainedVideoRect,
  denormalizePoints,
  mapVideoPoint,
  parsePointList,
} from './coordinate';
import { createAiOverlayDebugLogger } from './debug';
import type {
  AiOverlayObject,
  AiOverlayOptions,
  AiOverlaySnapshot,
  AiOverlayVideoInfo,
  NormalizedAiOverlayOptions,
} from './types';
import { normalizeAiOverlayOptions } from './types';

const props = defineProps({
  root: { type: Object as PropType<HTMLElement | null>, default: null },
  video: { type: Object as PropType<HTMLVideoElement | null>, default: null },
  videoInfo: { type: Object as PropType<AiOverlayVideoInfo | null>, default: null },
  snapshot: {
    type: Object as PropType<AiOverlaySnapshot>,
    required: true,
  },
  options: {
    type: [Boolean, Object] as PropType<boolean | AiOverlayOptions>,
    default: false,
  },
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
const normalizedOptions = computed(() => normalizeAiOverlayOptions(props.options));
let resizeObserver: ResizeObserver | null = null;
let frame = 0;

const getOptions = (): NormalizedAiOverlayOptions => normalizedOptions.value;
const getLogger = () =>
  createAiOverlayDebugLogger(getOptions().debug, getOptions().enabled);
const traceDrawSkipped = (reason: string, detail?: Record<string, unknown>) => {
  getLogger().trace('canvas draw skipped', { reason, ...(detail || {}) });
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getVideoSize = () => {
  const snapshotVideo = props.snapshot.video;
  const videoWidth = snapshotVideo?.width || props.videoInfo?.width || props.video?.videoWidth || 0;
  const videoHeight = snapshotVideo?.height || props.videoInfo?.height || props.video?.videoHeight || 0;
  return { videoWidth, videoHeight };
};

const syncCanvasSize = (canvas: HTMLCanvasElement, root: HTMLElement) => {
  const rect = root.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(0, Math.round(rect.width));
  const height = Math.max(0, Math.round(rect.height));
  const backingWidth = Math.max(1, Math.round(width * dpr));
  const backingHeight = Math.max(1, Math.round(height * dpr));

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return { width, height };
};

const objectPalette = [
  '#13c2c2', '#9254de', '#1677ff', '#eb2f96', '#52c41a', '#faad14',
];

const getObjectColor = (index: number) => objectPalette[index % objectPalette.length];

const calcLabelFontSize = (boxWidth: number, boxHeight: number) => {
  const shortSide = Math.min(boxWidth, boxHeight);
  if (!Number.isFinite(shortSide) || shortSide <= 0) return 10;
  return clamp(Math.round(shortSide / 7), 8, 11);
};

const formatObjectLabel = (object: AiOverlayObject) => {
  const label = object.text || object.class_name || '';
  if (!label) return '';
  const confidence = object.confidence;
  return confidence !== undefined && Number.isFinite(confidence)
    ? `${label} ${confidence.toFixed(2)}`
    : label;
};

const drawObject = (
  ctx: CanvasRenderingContext2D,
  object: AiOverlayObject,
  options: NormalizedAiOverlayOptions,
  rect: ReturnType<typeof computeContainedVideoRect>,
  objectIndex: number,
) => {
  if (!object.bbox || object.bbox.length !== 4) return;
  const [x1, y1, x2, y2] = object.bbox;
  const start = mapVideoPoint({ x: x1, y: y1 }, rect);
  const end = mapVideoPoint({ x: x2, y: y2 }, rect);
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width <= 0 || height <= 0) return;

  // Use palette colors unless user explicitly passed a custom object color
  const defaultColor = '#22c55e';
  const color = options.colors.object !== defaultColor
    ? options.colors.object
    : getObjectColor(objectIndex);

  // Box border
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, width, height);

  // Label
  const label = formatObjectLabel(object);
  if (options.showText && label) {
    const fontSize = calcLabelFontSize(width, height);
    ctx.font = `600 ${fontSize}px sans-serif`;
    const padX = 3;
    const padY = 1;
    const metrics = ctx.measureText(label);
    const labelW = Math.ceil(metrics.width + padX * 2);
    const labelH = fontSize + padY * 2 + 3;
    const labelLeft = clamp(left - 1, 0, Math.max(0, rect.x + rect.width - labelW));
    const labelTop = Math.max(0, top - labelH + 1);

    // Background
    ctx.fillStyle = color;
    ctx.fillRect(labelLeft, labelTop, labelW, labelH);

    // Text
    ctx.fillStyle = '#fff';
    ctx.fillText(label, labelLeft + padX, labelTop + fontSize + padY + 1);
  }
};

const drawAreaPath = (
  ctx: CanvasRenderingContext2D,
  pointsText: string,
  options: NormalizedAiOverlayOptions,
  rect: ReturnType<typeof computeContainedVideoRect>,
  videoWidth: number,
  videoHeight: number,
) => {
  const rawPoints = parsePointList(pointsText);
  if (rawPoints.length < 2) return;
  const points = denormalizePoints(rawPoints, videoWidth, videoHeight);

  ctx.strokeStyle = options.colors.region;
  ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
  ctx.lineWidth = Math.max(1, options.lineWidth - 0.5);
  ctx.beginPath();

  if (points.length === 2) {
    const start = mapVideoPoint(points[0], rect);
    const end = mapVideoPoint(points[1], rect);
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    ctx.rect(left, top, width, height);
  } else {
    const first = mapVideoPoint(points[0], rect);
    ctx.moveTo(first.x, first.y);
    points.slice(1).forEach((point) => {
      const next = mapVideoPoint(point, rect);
      ctx.lineTo(next.x, next.y);
    });
    ctx.closePath();
  }

  ctx.fill();
  ctx.stroke();
};

const drawLinePath = (
  ctx: CanvasRenderingContext2D,
  pointsText: string,
  options: NormalizedAiOverlayOptions,
  rect: ReturnType<typeof computeContainedVideoRect>,
  videoWidth: number,
  videoHeight: number,
) => {
  const rawPoints = parsePointList(pointsText);
  if (rawPoints.length < 2) return;
  const points = denormalizePoints(rawPoints, videoWidth, videoHeight);

  ctx.strokeStyle = options.colors.line;
  ctx.lineWidth = options.lineWidth;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  const first = mapVideoPoint(points[0], rect);
  ctx.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => {
    const next = mapVideoPoint(point, rect);
    ctx.lineTo(next.x, next.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
};

const draw = () => {
  frame = 0;
  const logger = getLogger();
  const canvas = canvasRef.value;
  const root = props.root;
  if (!canvas || !root) {
    traceDrawSkipped('missing canvas or root', {
      hasCanvas: Boolean(canvas),
      hasRoot: Boolean(root),
    });
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    traceDrawSkipped('2d context unavailable');
    return;
  }

  const options = getOptions();
  const { width, height } = syncCanvasSize(canvas, root);
  ctx.clearRect(0, 0, width, height);

  if (!options.enabled) {
    traceDrawSkipped('overlay disabled', { width, height });
    return;
  }

  const { videoWidth, videoHeight } = getVideoSize();
  if (!videoWidth || !videoHeight) {
    traceDrawSkipped('video size unavailable', {
      width,
      height,
      videoWidth,
      videoHeight,
      snapshotVideo: props.snapshot.video,
      videoInfo: props.videoInfo,
      elementVideoWidth: props.video?.videoWidth,
      elementVideoHeight: props.video?.videoHeight,
    });
    return;
  }
  const rect = computeContainedVideoRect(width, height, videoWidth, videoHeight);
  if (!rect.width || !rect.height) {
    traceDrawSkipped('contained video rect unavailable', {
      width,
      height,
      videoWidth,
      videoHeight,
      rect,
    });
    return;
  }

  props.snapshot.regions.forEach((region) => {
    region.area?.forEach((area) => drawAreaPath(ctx, area, options, rect, videoWidth, videoHeight));
    region.line?.forEach((line) => drawLinePath(ctx, line, options, rect, videoWidth, videoHeight));
  });
  props.snapshot.objects.forEach((object, idx) => drawObject(ctx, object, options, rect, idx));
  logger.trace('canvas draw completed', {
    width,
    height,
    videoWidth,
    videoHeight,
    rect,
    regions: props.snapshot.regions.length,
    objects: props.snapshot.objects.length,
  });
};

const requestDraw = () => {
  if (frame) return;
  frame = window.requestAnimationFrame(draw);
};

onMounted(() => {
  if (props.root && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => requestDraw());
    resizeObserver.observe(props.root);
  }
  requestDraw();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (frame) {
    window.cancelAnimationFrame(frame);
    frame = 0;
  }
});

watch(
  () => [props.root, props.video, props.videoInfo, props.snapshot, props.options] as const,
  () => requestDraw(),
  { deep: true },
);
</script>

<style scoped>
.jmp-ai-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: block;
  pointer-events: none;
}
</style>

import type { AiOverlayPoint, ContainedVideoRect } from './types';

export function computeContainedVideoRect(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): ContainedVideoRect {
  if (containerWidth <= 0 || containerHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      scale: 0,
    };
  }

  const scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;

  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
    scale,
  };
}

export function mapVideoPoint(
  point: AiOverlayPoint,
  rect: ContainedVideoRect,
): AiOverlayPoint {
  return {
    x: rect.x + point.x * rect.scale,
    y: rect.y + point.y * rect.scale,
  };
}

export function parsePointList(value: string): AiOverlayPoint[] {
  // Strip wrapping brackets: "[x1,y1;x2,y2]" → "x1,y1;x2,y2"
  let raw = value.trim();
  if (raw.startsWith('[') && raw.endsWith(']')) {
    raw = raw.slice(1, -1);
  }
  return raw
    .split(';')
    .map((part) => {
      const [x, y] = part.split(',').map((item) => Number(item.trim()));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
      return { x, y };
    })
    .filter((point): point is AiOverlayPoint => !!point);
}

/** Convert normalized (0–100) region coordinates to video pixel space. */
export function denormalizePoints(
  points: AiOverlayPoint[],
  videoWidth: number,
  videoHeight: number,
): AiOverlayPoint[] {
  return points.map((p) => ({
    x: (p.x / 100) * videoWidth,
    y: (p.y / 100) * videoHeight,
  }));
}

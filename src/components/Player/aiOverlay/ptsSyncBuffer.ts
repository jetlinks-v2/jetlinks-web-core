import { createAiOverlayDebugLogger } from './debug';
import type { AiOverlayPayload } from './types';

export type PtsSyncBufferOptions = {
  /** Maximum PTS difference (ms) for a match. Default 150ms. */
  toleranceMs?: number;
  /** Maximum age (ms) before an entry is forcibly evicted. Default 3000ms. */
  maxBufferMs?: number;
  /** Maximum number of buffered entries before the oldest is evicted. Default 30. */
  maxEntries?: number;
};

export type PtsSyncBuffer = {
  push: (payload: AiOverlayPayload) => void;
  match: (videoTimestampMs: number) => AiOverlayPayload | undefined;
  reset: () => void;
};

interface BufferedEntry {
  pts: number;
  payload: AiOverlayPayload;
}

function isValidPts(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function createPtsSyncBuffer(
  options: PtsSyncBufferOptions = {},
): PtsSyncBuffer {
  const toleranceMs = options.toleranceMs ?? 150;
  const maxBufferMs = options.maxBufferMs ?? 3000;
  const maxEntries = options.maxEntries ?? 30;
  const logger = createAiOverlayDebugLogger();

  let entries: BufferedEntry[] = [];
  let lastVideoTimestamp = -1;

  const insertSorted = (entry: BufferedEntry) => {
    let lo = 0;
    let hi = entries.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (entries[mid].pts < entry.pts) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    entries.splice(lo, 0, entry);
  };

  const evictStale = (videoTimestampMs: number) => {
    const cutoff = videoTimestampMs - maxBufferMs;
    let removeCount = 0;
    while (entries.length && entries[0].pts < cutoff) {
      entries.shift();
      removeCount += 1;
    }
    if (removeCount) {
      logger.trace('PTS buffer stale eviction', {
        removeCount,
        cutoff,
        remaining: entries.length,
      });
    }
  };

  const push = (payload: AiOverlayPayload) => {
    if (!isValidPts(payload.pts)) {
      logger.trace('PTS buffer push skipped: invalid PTS', {
        pts: payload.pts,
        frameId: payload.frame_id,
      });
      return;
    }

    if (entries.length >= maxEntries) {
      const evicted = entries.shift()!;
      logger.trace('PTS buffer full: evicting oldest', {
        evictedPts: evicted.pts,
        newPts: payload.pts,
      });
    }

    insertSorted({ pts: payload.pts, payload });
    logger.trace('PTS buffer pushed', {
      pts: payload.pts,
      bufferSize: entries.length,
      oldestPts: entries[0].pts,
      newestPts: entries[entries.length - 1].pts,
    });
  };

  const match = (videoTimestampMs: number) => {
    if (!isValidPts(videoTimestampMs)) {
      logger.trace('PTS buffer match skipped: invalid video timestamp', {
        videoTimestampMs,
      });
      return undefined;
    }

    // Detect large PTS backward jump (discontinuity / wraparound).
    if (
      lastVideoTimestamp > 0 &&
      lastVideoTimestamp - videoTimestampMs > 5000
    ) {
      logger.warn('PTS discontinuity detected: resetting buffer', {
        lastVideoTimestamp,
        videoTimestampMs,
        bufferSize: entries.length,
      });
      entries = [];
    }
    lastVideoTimestamp = videoTimestampMs;

    evictStale(videoTimestampMs);

    if (!entries.length) {
      return undefined;
    }

    // Find the best match: the entry whose pts is closest to videoTimestampMs
    // within the tolerance window, preferring the one with pts <= videoTimestampMs.
    let bestIndex = -1;
    let bestDiff = Infinity;

    for (let i = 0; i < entries.length; i += 1) {
      const diff = Math.abs(entries[i].pts - videoTimestampMs);
      if (diff > toleranceMs) {
        // Since entries are sorted, if we've passed the tolerance window
        // and entries are now too far ahead, stop searching.
        if (entries[i].pts > videoTimestampMs + toleranceMs) {
          break;
        }
        continue;
      }

      // Prefer the entry whose pts is ≤ videoTimestampMs (already passed)
      // over one that's ahead, when diffs are close.
      const ahead = entries[i].pts > videoTimestampMs;
      const prevBestAhead =
        bestIndex >= 0 ? entries[bestIndex].pts > videoTimestampMs : true;

      if (
        diff < bestDiff ||
        (diff === bestDiff && !ahead && prevBestAhead)
      ) {
        bestIndex = i;
        bestDiff = diff;
      }
    }

    if (bestIndex < 0) {
      logger.trace('PTS buffer match: no match within tolerance', {
        videoTimestampMs,
        toleranceMs,
        bufferSize: entries.length,
        oldestPts: entries[0].pts,
        newestPts: entries[entries.length - 1].pts,
      });
      return undefined;
    }

    const matched = entries[bestIndex];
    // Remove the matched entry and all older entries.
    entries = entries.slice(bestIndex + 1);

    logger.trace('PTS buffer matched', {
      videoTimestampMs,
      matchedPts: matched.pts,
      diff: bestDiff,
      remainingBuffer: entries.length,
    });

    return matched.payload;
  };

  const reset = () => {
    const count = entries.length;
    entries = [];
    lastVideoTimestamp = -1;
    logger.trace('PTS buffer reset', { clearedEntries: count });
  };

  return {
    push,
    match,
    reset,
  };
}

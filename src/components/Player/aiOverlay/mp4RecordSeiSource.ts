/**
 * SEI parser for standard (non-fragmented) MP4 recording files.
 *
 * Fetches the entire file once, parses the moov sample table,
 * and scans for AIZLM SEI payloads directly in the file buffer.
 * Time-syncs with video.currentTime for overlay display.
 */

import { parseMp4SampleTable, parseMp4Codec } from './mp4Transmuxer';
import { parseAizlmSeiPayloadEntries } from './aizlmSeiParser';
import { createAiOverlayDebugLogger } from './debug';
import type { AiOverlayEmit, AiOverlayPayload, AiOverlaySource } from './types';

function r32(b: Uint8Array, o: number): number {
  return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
}

export async function createMp4RecordSeiSource(
  url: string,
  getVideoElement: () => HTMLVideoElement | null,
  emitPayload: AiOverlayEmit,
  debug?: boolean,
): Promise<AiOverlaySource | null> {
  const logger = createAiOverlayDebugLogger(debug);
  let aborted = false;

  // 1. Fetch entire file
  let fullBuf: Uint8Array;
  try {
    const fullResp = await fetch(url);
    if (!fullResp.ok) return null;
    fullBuf = new Uint8Array(await fullResp.arrayBuffer());
  } catch {
    return null;
  }

  // 2. Find moov at end
  let moovData: Uint8Array | null = null;
  for (let i = fullBuf.length - 8; i >= 0; i--) {
    if (
      fullBuf[i + 4] === 0x6d && fullBuf[i + 5] === 0x6f &&
      fullBuf[i + 6] === 0x6f && fullBuf[i + 7] === 0x76
    ) {
      const sz = r32(fullBuf, i);
      if (i + sz <= fullBuf.length) { moovData = fullBuf.subarray(i, i + sz); break; }
    }
  }
  if (!moovData) return null;

  const moovContent = moovData.subarray(8);
  const table = parseMp4SampleTable(moovContent);
  if (!table) return null;

  // 3. Scan full file for AIZLM SEI
  const entries = parseAizlmSeiPayloadEntries(fullBuf);
  if (!entries.length) return null;

  logger.trace('mp4RecordSeiSource: parsed', {
    samples: table.samples.length,
    seiEntries: entries.length,
  });

  // 4. Map payloads to sample timestamps
  const timeEntries: { ts: number; payloads: AiOverlayPayload[] }[] = [];
  for (const entry of entries) {
    let bestTs = 0;
    for (const s of table.samples) {
      if (s.offset <= entry.end && s.offset + s.size > entry.end) { bestTs = s.timestamp; break; }
      if (s.offset <= entry.end) bestTs = s.timestamp;
    }
    timeEntries.push({ ts: bestTs, payloads: [entry.payload] });
  }
  timeEntries.sort((a, b) => a.ts - b.ts);

  const seen = new Set<number>();
  let ticker: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      if (!timeEntries.length) return false;
      ticker = setInterval(() => {
        if (aborted) return;
        const ve = getVideoElement();
        if (!ve) return;
        const ctMs = ve.currentTime * 1000;
        for (const entry of timeEntries) {
          if (seen.has(entry.ts)) continue;
          if (entry.ts <= ctMs + 100) {
            seen.add(entry.ts);
            for (const p of entry.payloads) {
              emitPayload(p);
            }
          }
        }
        // Keep last frame alive after all entries emitted
        if (timeEntries.length > 0 && seen.size === timeEntries.length) {
          const lastEntry = timeEntries[timeEntries.length - 1];
          if (ctMs >= lastEntry.ts) {
            for (const p of lastEntry.payloads) {
              try { emitPayload(p); } catch { /* ignore */ }
            }
          }
        }
      }, 200);
      return true;
    },
    stop() {
      aborted = true;
      if (ticker) { clearInterval(ticker); ticker = null; }
    },
  };
}

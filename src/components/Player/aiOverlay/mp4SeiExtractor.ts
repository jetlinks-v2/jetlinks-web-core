import { readBoxes, type Mp4Box } from './mp4BoxStream';
import { extractAizlmPayloadsFromVideoBytes } from './nalu';
import { createAiOverlayDebugLogger } from './debug';
import type { AiOverlayPayload } from './types';

export type Mp4SeiExtractor = {
  start: (
    stream: ReadableStream<Uint8Array>,
    onPayload: (p: AiOverlayPayload[]) => void,
  ) => Promise<void>;
  abort: () => void;
};

type ExtractorOptions = { debug?: boolean };

function r32(b: Uint8Array, o: number) {
  return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
}

function findBox(
  data: Uint8Array,
  target: string,
  start = 0,
): Uint8Array | null {
  let o = start;
  while (o + 8 <= data.length) {
    let s = r32(data, o);
    if (s === 1) {
      if (o + 16 > data.length) return null;
      s = r32(data, o + 8) * 0x100000000 + r32(data, o + 12);
      o += 16;
      continue;
    }
    if (s === 0) s = data.length - o;
    if (s < 8 || o + s > data.length) return null;
    const t = String.fromCharCode(
      data[o + 4],
      data[o + 5],
      data[o + 6],
      data[o + 7],
    );
    if (t === target) return data.subarray(o + 8, o + s);
    o += s;
  }
  return null;
}

function walkPath(data: Uint8Array, ...path: string[]): Uint8Array | null {
  let cur = data;
  for (const p of path) {
    const n = findBox(cur, p);
    if (!n) return null;
    cur = n;
  }
  return cur;
}

function parseTimescale(moovData: Uint8Array): number {
  const mdhd = walkPath(moovData, 'trak', 'mdia', 'mdhd');
  if (!mdhd || mdhd.length < 20) return 0;
  const v = mdhd[0];
  if (v === 0 && mdhd.length >= 20) return r32(mdhd, 12);
  if (v === 1 && mdhd.length >= 28) return r32(mdhd, 20);
  return 0;
}

function parseCodec(
  moovData: Uint8Array,
): { codec: 'H264' | 'H265'; lenSize: number } | null {
  const stsd = walkPath(moovData, 'trak', 'mdia', 'minf', 'stbl', 'stsd');
  if (!stsd || stsd.length < 16) return null;
  const count = r32(stsd, 4);
  if (count < 1) return null;
  let o = 8;
  let es = r32(stsd, o);
  if (es === 1) es = r32(stsd, o + 8) * 0x100000000 + r32(stsd, o + 12);
  const et = String.fromCharCode(
    stsd[o + 4],
    stsd[o + 5],
    stsd[o + 6],
    stsd[o + 7],
  );
  const ed = stsd.subarray(o + 8, o + es);

  if (et === 'avc1') {
    for (let i = 0; i <= ed.length - 8; i++) {
      if (
        ed[i + 4] === 0x61 &&
        ed[i + 5] === 0x76 &&
        ed[i + 6] === 0x63 &&
        ed[i + 7] === 0x43
      ) {
        const as = r32(ed, i);
        if (as < 12 || i + as > ed.length) continue;
        const avcc = ed.subarray(i + 8, i + as);
        if (avcc.length < 5) return null;
        return { codec: 'H264', lenSize: (avcc[4] & 0x03) + 1 };
      }
    }
    return null;
  }
  if (et === 'hvc1' || et === 'hev1') {
    for (let i = 0; i <= ed.length - 8; i++) {
      if (
        ed[i + 4] === 0x68 &&
        ed[i + 5] === 0x76 &&
        ed[i + 6] === 0x63 &&
        ed[i + 7] === 0x43
      ) {
        const hs = r32(ed, i);
        if (hs < 12 || i + hs > ed.length) continue;
        const hvcc = ed.subarray(i + 8, i + hs);
        if (hvcc.length < 23) return null;
        return { codec: 'H265', lenSize: (hvcc[21] & 0x03) + 1 };
      }
    }
    return null;
  }
  return null;
}

type Sample = { size: number; cts: number };

function parseTrun(trun: Uint8Array): Sample[] {
  if (trun.length < 8) return [];
  const flags = (trun[1] << 16) | (trun[2] << 8) | trun[3];
  let o = 4;
  const n = r32(trun, o);
  o += 4;
  if (flags & 0x000001) o += 4;
  if (flags & 0x000004) o += 4;
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    if (flags & 0x000100) o += 4;
    const sz = flags & 0x000200 ? r32(trun, o) : 0;
    if (flags & 0x000200) o += 4;
    if (flags & 0x000400) o += 4;
    const cts = flags & 0x000800 ? r32(trun, o) : 0;
    if (flags & 0x000800) o += 4;
    out.push({ size: sz, cts });
  }
  return out;
}

function parseTfdt(tfdt: Uint8Array): number {
  if (tfdt.length < 12) return 0;
  return tfdt[0] === 1 && tfdt.length >= 20
    ? r32(tfdt, 4) * 0x100000000 + r32(tfdt, 8)
    : r32(tfdt, 4);
}

export function createMp4SeiExtractor(
  opts: ExtractorOptions = {},
): Mp4SeiExtractor {
  const log = createAiOverlayDebugLogger(opts.debug);
  let aborted = false;
  let running = false;

  return {
    async start(stream, onPayload) {
      // Abort any previous run to prevent concurrent extraction loops
      if (running) {
        aborted = true;
        running = false;
      }
      aborted = false;
      running = true;
      let codecInfo: { codec: 'H264' | 'H265'; lenSize: number } | null = null;
      let timescale = 0;
      let pendingMoof: Mp4Box | null = null;
      let fragIdx = 0;

      try {
        for await (const box of readBoxes(stream)) {
          if (aborted) break;

          if (box.type === 'moov') {
            codecInfo = parseCodec(box.data);
            timescale = parseTimescale(box.data);
            log.trace('mp4SeiExtractor: moov codec', {
              hasCodec: Boolean(codecInfo),
              codec: codecInfo?.codec,
            });
            continue;
          }

          if (box.type === 'moof') {
            pendingMoof = box;
            continue;
          }

          if (box.type === 'mdat' && pendingMoof && codecInfo) {
            const moof = pendingMoof;
            pendingMoof = null;
            fragIdx++;

            const traf = findBox(moof.data, 'traf');
            let baseTime = 0;
            let samples: Sample[] = [];
            if (traf) {
              const tfdt = findBox(traf, 'tfdt');
              if (tfdt) baseTime = parseTfdt(tfdt);
              const trun = findBox(traf, 'trun');
              if (trun) samples = parseTrun(trun);
            }

            if (!samples.length) continue;

            let mdatOff = 0;
            let sampIdx = 0;
            for (const s of samples) {
              // trun may omit per-sample size; last sample takes remainder of mdat
              const sz = s.size > 0 ? s.size : (box.data.length - mdatOff);
              if (sz <= 0 || mdatOff + sz > box.data.length) break;
              const bytes = box.data.subarray(mdatOff, mdatOff + sz);
              mdatOff += sz;

              let samplePayloads: AiOverlayPayload[] = [];
              try {
                const payloads = extractAizlmPayloadsFromVideoBytes(bytes, {
                  codec: codecInfo.codec,
                  lengthSize: codecInfo.lenSize,
                });
                const dtMs = timescale > 0
                  ? ((baseTime + s.cts) / timescale) * 1000
                  : (baseTime + s.cts);
                for (const p of payloads) {
                  (p as any)._fragIndex = fragIdx;
                  (p as any)._sampleIndex = sampIdx;
                  (p as any)._displayTime = dtMs;
                }
                samplePayloads = payloads;
              } catch {
                /* ignore single sample parse failure */
              }

              if (samplePayloads.length) {
                try {
                  onPayload(samplePayloads);
                } catch (e) {
                  log.warn('mp4SeiExtractor: onPayload error', e);
                }
              }
              sampIdx++;
            }
          }
        }
      } catch (e) {
        if (!aborted) log.warn('mp4SeiExtractor: stream error', e);
      } finally {
        running = false;
      }
    },
    abort() {
      aborted = true;
      running = false;
    },
  };
}

import { readBoxes, type Mp4Box } from './mp4BoxStream';

export type Mp4MsePlayer = {
  play: () => Promise<void>;
  pause: () => void;
  reset: () => void;
  getCurrentTime: () => number;
  destroy: () => void;
};

type Opts = {
  autoplay?: boolean;
  muted?: boolean;
  volume?: number;
  fallbackUrl?: string;
  onStandardMp4?: () => void;
};

function boxToBuffer(boxes: Mp4Box[]): Uint8Array {
  const len = boxes.reduce((s, b) => s + b.headerSize + b.data.length, 0);
  const r = new Uint8Array(len);
  let o = 0;
  for (const b of boxes) {
    const sz = b.headerSize + b.data.length;
    r[o] = (sz >>> 24) & 0xff;
    r[o + 1] = (sz >>> 16) & 0xff;
    r[o + 2] = (sz >>> 8) & 0xff;
    r[o + 3] = sz & 0xff;
    for (let i = 0; i < 4; i++) r[o + 4 + i] = b.type.charCodeAt(i);
    r.set(b.data, o + b.headerSize);
    o += sz;
  }
  return r;
}

function findCodec(moovData: Uint8Array): string | null {
  for (let i = 0; i <= moovData.length - 12; i++) {
    if (
      moovData[i + 4] === 0x61 &&
      moovData[i + 5] === 0x76 &&
      moovData[i + 6] === 0x63 &&
      moovData[i + 7] === 0x43
    ) {
      const sz = (moovData[i] << 24) | (moovData[i + 1] << 16) | (moovData[i + 2] << 8) | moovData[i + 3];
      if (sz >= 12 && i + sz <= moovData.length) {
        const d = moovData.subarray(i + 8, i + sz);
        if (d.length < 4) return null;
        const p = d[1].toString(16).padStart(2, '0');
        const c = d[2].toString(16).padStart(2, '0');
        const l = d[3].toString(16).padStart(2, '0');
        return `avc1.${p}${c}${l}`;
      }
    }
  }
  for (let i = 0; i <= moovData.length - 12; i++) {
    if (
      moovData[i + 4] === 0x68 &&
      moovData[i + 5] === 0x76 &&
      moovData[i + 6] === 0x63 &&
      moovData[i + 7] === 0x43
    ) {
      const sz = (moovData[i] << 24) | (moovData[i + 1] << 16) | (moovData[i + 2] << 8) | moovData[i + 3];
      if (sz >= 12 && i + sz <= moovData.length) {
        const d = moovData.subarray(i + 8, i + sz);
        if (d.length < 23) return null;
        const profileIdc = d[1] & 0x1f;
        const compat = ((d[2] << 24) | (d[3] << 16) | (d[4] << 8) | d[5]) >>> 0;
        const levelIdc = d[12];
        return `hvc1.${profileIdc}.${compat.toString(16).toUpperCase()}.L${levelIdc}.B0`;
      }
    }
  }
  return null;
}

function hasMvex(moovData: Uint8Array): boolean {
  for (let i = 0; i <= moovData.length - 8; i++) {
    if (
      moovData[i + 4] === 0x6d && moovData[i + 5] === 0x76 &&
      moovData[i + 6] === 0x65 && moovData[i + 7] === 0x78
    ) {
      return true;
    }
  }
  return false;
}

const SKIP = new Set(['styp', 'sidx']);

export function createMp4MsePlayer(
  stream: ReadableStream<Uint8Array>,
  video: HTMLVideoElement,
  opts: Opts = {},
): Mp4MsePlayer {
  let ms: MediaSource | null = null;
  let sb: SourceBuffer | null = null;
  let openCb: (() => void) | null = null;
  let pend = Promise.resolve();
  let dead = false;

  video.muted = opts.muted ?? false;

  function append(buf: Uint8Array): Promise<void> {
    pend = pend.then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (!sb) { resolve(); return; }
          const onEnd = () => {
            sb!.removeEventListener('updateend', onEnd);
            sb!.removeEventListener('error', onErr);
            resolve();
          };
          const onErr = () => {
            sb!.removeEventListener('updateend', onEnd);
            sb!.removeEventListener('error', onErr);
            reject(new Error('SourceBuffer error'));
          };
          sb.addEventListener('updateend', onEnd);
          sb.addEventListener('error', onErr);
          try {
            sb.appendBuffer(buf);
          } catch (e) {
            sb.removeEventListener('updateend', onEnd);
            sb.removeEventListener('error', onErr);
            reject(e);
          }
        }),
      (e: unknown) => {
        console.warn('[Mp4MsePlayer] append error, resetting pend:', e);
        pend = Promise.resolve();
        return Promise.reject(e);
      },
    );
    return pend;
  }

  (async () => {
    try {
      let codec: string | null = null;
      let inited = false;
      const init: Mp4Box[] = [];
      const seg: Mp4Box[] = [];
      let sawMoov = false;
      let sawFtyp = false;
      let segCount = 0;

      for await (const box of readBoxes(stream)) {
        if (dead) break;

        if (!sawMoov) {
          if (!sawFtyp) {
            init.push(box);
            sawFtyp = true;
            continue;
          }
          if (box.type !== 'moov') {
            dead = true;
            opts.onStandardMp4?.();
            if (opts.fallbackUrl) {
              video.src = opts.fallbackUrl;
              video.load();
              if (opts.autoplay !== false) video.play().catch(() => {});
            }
            return;
          }
          init.push(box);
          sawMoov = true;
          codec = findCodec(box.data);
          if (!codec) throw new Error('avcC/hvcC not found in moov');
          if (!hasMvex(box.data)) {
            dead = true;
            opts.onStandardMp4?.();
            if (opts.fallbackUrl) {
              video.src = opts.fallbackUrl;
              video.load();
              if (opts.autoplay !== false) video.play().catch(() => {});
            }
            return;
          }
          continue;
        }

        if (SKIP.has(box.type)) { seg.push(box); continue; }

        if (box.type === 'moof' || box.type === 'mdat') {
          seg.push(box);
          if (box.type === 'mdat') {
            segCount++;
            if (!inited && codec) {
              await new Promise<void>((r) => {
                if (ms && ms.readyState === 'open') r();
                else openCb = r;
              });
              openCb = null;
              if (!sb) sb = ms!.addSourceBuffer(`video/mp4; codecs="${codec}"`);
              await append(boxToBuffer(init));
              inited = true;
              if (opts.autoplay !== false && video.paused) {
                video.play().catch(() => {});
              }
            }
            if (inited && sb) {
              await append(boxToBuffer(seg));
              if (segCount === 1 && sb.buffered.length > 0) {
                video.currentTime = sb.buffered.start(0);
              }
              if (sb.buffered.length > 1) {
                const last = sb.buffered.length - 1;
                const prevEnd = sb.buffered.end(last - 1);
                const newStart = sb.buffered.start(last);
                if (video.currentTime >= prevEnd - 1 && video.currentTime < newStart) {
                  video.currentTime = newStart;
                }
              }
            }
            seg.length = 0;
          }
        }
      }
    } catch (e) {
      if (!dead) console.warn('[Mp4MsePlayer] stream error:', e);
    }
  })();

  // Sync video with live edge when tab becomes visible again
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && !dead && sb && sb.buffered.length > 0) {
        const bufEnd = sb.buffered.end(sb.buffered.length - 1);
        // Only seek forward if video is significantly behind the buffered data
        if (bufEnd - video.currentTime > 1) {
          video.currentTime = bufEnd - 0.5;
        }
      }
    });
  }

  ms = new MediaSource();
  ms.addEventListener('sourceopen', () => openCb?.());
  video.src = URL.createObjectURL(ms);

  return {
    async play() {
      if (dead || !video) return;
      try { await video.play(); } catch { /* autoplay blocked */ }
    },
    pause() {
      if (dead || !video) return;
      video.pause();
    },
    getCurrentTime() { return video?.currentTime ?? 0; },
    reset() {
      if (sb && ms && ms.readyState === 'open') {
        try {
          const r = sb.buffered;
          if (r.length > 0) sb.remove(r.start(0), r.end(r.length - 1));
        } catch { /* ignore */ }
      }
    },
    destroy() {
      dead = true;
      if (sb && ms && ms.readyState === 'open') {
        try {
          const r = sb.buffered;
          if (r.length > 0) sb.remove(r.start(0), r.end(r.length - 1));
        } catch { /* ignore */ }
        sb = null;
      }
      if (ms) {
        try { if (ms.readyState !== 'closed') URL.revokeObjectURL(video.src); } catch { /* ignore */ }
        ms = null;
      }
      video.removeAttribute('src');
      video.load();
    },
  };
}

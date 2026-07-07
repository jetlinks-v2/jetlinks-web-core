import { fetchMp4Stream } from './mp4Fetcher';
import { createMp4MsePlayer, type Mp4MsePlayer } from './mp4MsePlayer';
import { createMp4SeiExtractor, type Mp4SeiExtractor } from './mp4SeiExtractor';
import { createMp4RecordSeiSource } from './mp4RecordSeiSource';
import { createAiOverlayDebugLogger } from './debug';
import type { AiOverlayEmit, AiOverlayPayload, AiOverlaySource } from './types';

export type Mp4OverlaySourceOptions = {
  url: string;
  getVideoElement: () => HTMLVideoElement | null;
  emitPayload: AiOverlayEmit;
  debug?: boolean;
  autoplay?: boolean;
  muted?: boolean;
};

function createScheduler(emitPayload: AiOverlayEmit, debug?: boolean) {
  const logger = createAiOverlayDebugLogger(debug);
  let q: (AiOverlayPayload & { _dt: number; _key: string })[] = [];
  let seen = new Set<string>();
  const TOL = 80;

  return {
    push(payloads: AiOverlayPayload[]) {
      for (const p of payloads) {
        const dt = (p as any)._displayTime ?? p.pts ?? 0;
        const key = `${(p as any)._fragIndex ?? 0}-${(p as any)._sampleIndex ?? 0}`;
        if (seen.has(key)) continue;
        q.push({ ...p, _dt: dt, _key: key });
      }
      q.sort((a, b) => a._dt - b._dt);
      logger.trace('scheduler push', { n: payloads.length, q: q.length });
    },

    tick(currentTime: number) {
      const emitted: typeof q = [];
      while (q.length > 0 && q[0]._dt <= currentTime + TOL) {
        const p = q.shift()!;
        if (seen.has(p._key)) continue;
        seen.add(p._key);
        emitted.push(p);
      }
      const cutoff = currentTime - 5000;
      while (q.length > 0 && q[0]._dt < cutoff) {
        q.shift();
      }
      for (const p of emitted) {
        emitPayload(p);
      }
      if (emitted.length) {
        logger.trace('scheduler tick', {
          emitted: emitted.length,
          q: q.length,
          ct: currentTime,
        });
      }
    },

    clear() {
      q = [];
      seen = new Set();
    },
  };
}

export function createMp4SamePipelineSource(
  opts: Mp4OverlaySourceOptions,
): AiOverlaySource {
  const logger = createAiOverlayDebugLogger(opts.debug);
  let mse: Mp4MsePlayer | null = null;
  let ext: Mp4SeiExtractor | null = null;
  let abortFetch: (() => void) | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let dead = false;
  const sched = createScheduler(opts.emitPayload, opts.debug);

  return {
    async start() {
      logger.trace('mp4OverlaySource: start');
      if (dead) return false;

      const ve = opts.getVideoElement();
      if (!ve) {
        logger.warn('mp4OverlaySource: no video element available');
        return false;
      }

      try {
        const { playbackStream, seiStream, abort } = await fetchMp4Stream(
          opts.url,
        );
        // Recheck: stop() may have been called during the await
        if (dead) { abort(); return false; }
        abortFetch = abort;

        mse = createMp4MsePlayer(playbackStream, ve, {
          autoplay: opts.autoplay,
          muted: opts.muted,
          fallbackUrl: opts.url,
          onStandardMp4: () => {
            createMp4RecordSeiSource(opts.url, opts.getVideoElement, opts.emitPayload, opts.debug)
              .then((recordSrc) => {
                if (recordSrc) recordSrc.start();
              });
          },
        });

        ext = createMp4SeiExtractor({ debug: opts.debug });
        ext.start(seiStream, (p) => {
          sched.push(p);
          for (let i = 0; i < p.length; i++) {
            try {
              opts.emitPayload(p[i]);
            } catch {
              /* ignore emit errors */
            }
          }
        });

        let lastCt = 0;
        timer = setInterval(() => {
          if (!dead && ve) {
            const ct = ve.currentTime * 1000;
            if (lastCt > 0 && ct - lastCt > 3000) {
              sched.clear();
            }
            lastCt = ct;
            sched.tick(ct);
          }
        }, 100);

        return true;
      } catch (e) {
        logger.warn('mp4OverlaySource: setup failed, falling back to native src', e);
        const ve = opts.getVideoElement();
        if (ve) {
          ve.src = opts.url;
          if (opts.autoplay !== false) {
            ve.play().catch(() => {});
          }
        }
        return false;
      }
    },

    stop() {
      logger.trace('mp4OverlaySource: stop');
      dead = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      abortFetch?.();
      abortFetch = null;
      ext?.abort();
      ext = null;
      mse?.destroy();
      mse = null;
      sched.clear();
    },

    syncVideoTimestamp(ts: number) {
      if (!dead) {
        sched.tick(ts * 1000);
      }
    },
  };
}

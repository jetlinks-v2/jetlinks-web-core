import type { Jessibuca } from '../jessibuca';
import { createAiOverlayDebugLogger } from './debug';
import { createFlvChunkSeiParser } from './flvInlineParser';
import { createPtsSyncBuffer } from './ptsSyncBuffer';
import type { AiOverlayEmit, AiOverlayPayload, AiOverlaySource } from './types';

type Options = {
  getPlayer: () => Jessibuca | null;
  emitPayload: AiOverlayEmit;
  debug?: boolean;
};

function hasValidPts(payload: AiOverlayPayload): boolean {
  return typeof payload.pts === 'number' && Number.isFinite(payload.pts) && payload.pts >= 0;
}

export function createJessibucaInlineFlvSeiSource({
  getPlayer,
  emitPayload,
  debug,
}: Options): AiOverlaySource {
  const logger = createAiOverlayDebugLogger(debug);
  const ptsBuffer = createPtsSyncBuffer();

  const handleSeiPayload = (payload: AiOverlayPayload) => {
    if (hasValidPts(payload.pts)) {
      ptsBuffer.push(payload);
    } else {
      // Fallback: emit directly when PTS is unavailable (current behavior).
      logger.trace('SEI payload emitted directly: no valid PTS', {
        pts: payload.pts,
        frameId: payload.frame_id,
      });
      emitPayload(payload);
    }
  };

  const parser = createFlvChunkSeiParser(handleSeiPayload, {
    debug,
    getCurrentVideoTimestamp: () => getPlayer()?.player?.videoTimestamp,
  });

  let demux: NonNullable<NonNullable<Jessibuca['player']>['demux']> | null = null;
  let originalDispatch: ((chunk: ArrayBuffer | Uint8Array) => unknown) | null = null;
  let callOriginalDispatch: ((chunk: ArrayBuffer | Uint8Array) => unknown) | null = null;

  return {
    start() {
      logger.trace('Jessibuca inline source start requested');
      const player = getPlayer();
      const nextDemux = player?.player?.demux;
      const nextDispatch = nextDemux?.dispatch;

      if (!nextDemux || typeof nextDispatch !== 'function') {
        logger.warn('Jessibuca inline demux.dispatch is unavailable', {
          hasPlayer: Boolean(player),
          hasInternalPlayer: Boolean(player?.player),
          hasDemux: Boolean(nextDemux),
          dispatchType: typeof nextDispatch,
        });
        return;
      }

      if (originalDispatch) {
        logger.trace('Jessibuca demux.dispatch already hooked');
        return;
      }

      demux = nextDemux;
      originalDispatch = nextDispatch;
      callOriginalDispatch = nextDispatch.bind(nextDemux);
      nextDemux.dispatch = (chunk: ArrayBuffer | Uint8Array) => {
        const byteLength =
          chunk instanceof Uint8Array ? chunk.length : chunk.byteLength;
        logger.trace('Jessibuca demux.dispatch chunk received', { byteLength });
        try {
          parser.push(chunk);
        } catch (error) {
          logger.warn('Jessibuca inline FLV SEI parse failed', error);
        }
        return callOriginalDispatch?.(chunk);
      };
      logger.trace('Jessibuca demux.dispatch hooked');
    },
    stop() {
      if (demux && originalDispatch) {
        demux.dispatch = originalDispatch;
        logger.trace('Jessibuca demux.dispatch restored');
      }
      demux = null;
      originalDispatch = null;
      callOriginalDispatch = null;
      parser.reset();
      ptsBuffer.reset();
    },
    syncVideoTimestamp(timestamp: number) {
      const matched = ptsBuffer.match(timestamp);
      if (matched) {
        emitPayload(matched);
      }
    },
  };
}

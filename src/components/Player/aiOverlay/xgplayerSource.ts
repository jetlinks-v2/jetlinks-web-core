import { parseAizlmSeiPayload } from './aizlmSeiParser';
import { createAiOverlayDebugLogger } from './debug';
import type {
  AiOverlayEmit,
  AiOverlaySource,
  NormalizedAiOverlayOptions,
} from './types';

type XgplayerLike = {
  on?: (event: string, callback: (payload: any) => void) => void;
  off?: (event: string, callback: (payload: any) => void) => void;
};

function toBytes(value: unknown): Uint8Array | undefined {
  if (!value) return undefined;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (Array.isArray(value)) return new Uint8Array(value);
  return undefined;
}

function extractEventBytes(event: any): Uint8Array | undefined {
  return (
    toBytes(event?.sei?.content) ||
    toBytes(event?.data?.payload) ||
    toBytes(event?.payload) ||
    toBytes(event?.content)
  );
}

const hlsSeiEventNames = new Set([
  'sei',
  'sei_in_time',
  'core.sei',
  'core.seiintime',
]);

function normalizeEventName(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function isSeiCoreEvent(event: any) {
  const name = normalizeEventName(event?.eventName);
  return hlsSeiEventNames.has(name);
}

export function createXgplayerSeiSource(
  player: XgplayerLike | null | undefined,
  emitPayload: AiOverlayEmit,
  options: Pick<NormalizedAiOverlayOptions, 'debug'>,
): AiOverlaySource {
  let listening = false;
  const logger = createAiOverlayDebugLogger(options.debug);

  const handler = (event: any) => {
    const eventName = normalizeEventName(event?.eventName);
    logger.trace('xgplayer core_event received', {
      eventName,
      hasSei: Boolean(event?.sei),
      hasData: Boolean(event?.data),
      hasPayload: Boolean(event?.payload),
      hasContent: Boolean(event?.content),
    });
    if (!isSeiCoreEvent(event)) {
      logger.trace('xgplayer core_event skipped: not SEI event', { eventName });
      return;
    }
    const bytes = extractEventBytes(event);
    if (!bytes) {
      logger.warn('xgplayer SEI event has no bytes', event);
      return;
    }
    logger.trace('xgplayer SEI bytes extracted', { byteLength: bytes.length });

    const payloads = parseAizlmSeiPayload(bytes);
    logger.trace('xgplayer AIZLM payload parsed', { payloadCount: payloads.length });
    if (!payloads.length) {
      logger.warn('ignored non-AIZLM xgplayer SEI event', event);
    }
    payloads.forEach(emitPayload);
  };

  return {
    start() {
      if (listening) return;
      if (!player?.on) {
        logger.warn('xgplayer core_event API is unavailable');
        return;
      }
      player.on('core_event', handler);
      listening = true;
      logger.trace('xgplayer core_event listener attached');
    },
    stop() {
      if (!listening) return;
      player?.off?.('core_event', handler);
      listening = false;
      logger.trace('xgplayer core_event listener detached');
    },
  };
}

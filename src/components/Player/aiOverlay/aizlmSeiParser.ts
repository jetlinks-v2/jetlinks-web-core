import type { AiOverlayPayload } from './types';
import { createAiOverlayDebugLogger, summarizeBytesForDebug } from './debug';

const magic = new Uint8Array([65, 73, 90, 76, 77]);
const headerLength = 11;
const decoder = new TextDecoder();
const logger = createAiOverlayDebugLogger();

export type ParsedAizlmSeiPayload = {
  payload: AiOverlayPayload;
  end: number;
};

type ParsedJsonObject = {
  value: unknown;
  end: number;
  text: string;
};

function hasMagic(bytes: Uint8Array, offset: number) {
  if (offset + magic.length > bytes.length) return false;
  for (let index = 0; index < magic.length; index += 1) {
    if (bytes[offset + index] !== magic[index]) return false;
  }
  return true;
}

function readUint32BE(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function findJsonObjectByteEnd(bytes: Uint8Array, start: number, end: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < end; index += 1) {
    const value = bytes[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (value === 0x5c) {
        escaped = true;
      } else if (value === 0x22) {
        inString = false;
      }
      continue;
    }

    if (value === 0x22) {
      inString = true;
    } else if (value === 0x7b) {
      depth += 1;
    } else if (value === 0x7d) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  return -1;
}

function parseJsonObjectBytes(
  bytes: Uint8Array,
  start: number,
  end = bytes.length,
): ParsedJsonObject | undefined {
  let jsonStart = -1;
  for (let index = start; index < end; index += 1) {
    if (bytes[index] === 0x7b) {
      jsonStart = index;
      break;
    }
  }
  if (jsonStart < 0) return undefined;

  const jsonEnd = findJsonObjectByteEnd(bytes, jsonStart, end);
  if (jsonEnd < 0) return undefined;

  const text = decoder.decode(bytes.subarray(jsonStart, jsonEnd));
  return {
    value: JSON.parse(text),
    end: jsonEnd,
    text,
  };
}

function isValidPayload(value: unknown): value is AiOverlayPayload {
  if (!isRecord(value)) return false;
  if (value.schema !== 'aizlm.overlay.v1') return false;
  if (typeof value.pts !== 'number' || !Number.isFinite(value.pts)) return false;
  if (!isRecord(value.video)) return false;
  if (typeof value.video.width !== 'number' || value.video.width < 0) return false;
  if (typeof value.video.height !== 'number' || value.video.height < 0) return false;
  if (!Array.isArray(value.regions)) return false;
  if (!Array.isArray(value.objects)) return false;
  return true;
}

export function parseAizlmSeiPayloadEntries(bytes: Uint8Array): ParsedAizlmSeiPayload[] {
  const payloads: ParsedAizlmSeiPayload[] = [];
  let magicFound = false;
  logger.trace('AIZLM parser input', { byteLength: bytes.length });
  logger.trace('AIZLM raw SEI bytes', summarizeBytesForDebug(bytes));

  for (let offset = 0; offset <= bytes.length - headerLength; offset += 1) {
    if (!hasMagic(bytes, offset)) continue;
    magicFound = true;

    const version = bytes[offset + 5];
    const type = bytes[offset + 6];
    const length = readUint32BE(bytes, offset + 7);
    const payloadStart = offset + headerLength;
    const payloadEnd = payloadStart + length;
    let parsedJson: ParsedJsonObject | undefined;

    if (version === 1 && type === 1 && length > 0 && payloadEnd <= bytes.length) {
      parsedJson = parseJsonObjectBytes(bytes, payloadStart, payloadEnd);
    }

    if (!parsedJson) {
      parsedJson = parseJsonObjectBytes(bytes, offset + magic.length);
    }

    if (!parsedJson) {
      logger.warn('invalid AIZLM SEI header', {
        bytesLength: bytes.length,
        offset,
        version,
        type,
        length,
        payloadEnd,
      });
      continue;
    }

    try {
      const parsed = parsedJson.value;
      logger.trace('AIZLM raw SEI JSON text', {
        byteLength: parsedJson.text.length,
        text: parsedJson.text,
      });
      logger.trace('AIZLM raw SEI JSON parsed', parsed);
      if (isValidPayload(parsed)) {
        payloads.push({
          payload: parsed,
          end: parsedJson.end,
        });
        logger.trace('AIZLM payload accepted', {
          pts: parsed.pts,
          video: parsed.video,
          regions: parsed.regions.length,
          objects: parsed.objects.length,
        });
      } else {
        logger.warn('AIZLM invalid SEI JSON shape', {
          text: parsedJson.text,
          parsed,
        });
      }
    } catch (error) {
      logger.warn('SEI JSON parse failed', error);
      continue;
    }

    offset = parsedJson.end - 1;
  }

  if (!magicFound) {
    logger.trace('AIZLM magic not found', { byteLength: bytes.length });
  }
  logger.trace('AIZLM parser completed', {
    magicFound,
    payloadCount: payloads.length,
  });
  return payloads;
}

export function parseAizlmSeiPayload(bytes: Uint8Array): AiOverlayPayload[] {
  return parseAizlmSeiPayloadEntries(bytes).map((entry) => entry.payload);
}

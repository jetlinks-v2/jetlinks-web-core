import { parseAizlmSeiPayload } from './aizlmSeiParser';
import { createAiOverlayDebugLogger, summarizeBytesForDebug } from './debug';
import type { AiOverlayPayload } from './types';

export type NaluExtractOptions = {
  codec?: 'H264' | 'H265';
  lengthSize?: number;
  annexB?: boolean;
};

const startCode3 = [0, 0, 1];
const startCode4 = [0, 0, 0, 1];
const logger = createAiOverlayDebugLogger();

function matches(bytes: Uint8Array, offset: number, pattern: number[]) {
  if (offset + pattern.length > bytes.length) return false;
  return pattern.every((value, index) => bytes[offset + index] === value);
}

function findStartCode(bytes: Uint8Array, from: number) {
  for (let index = from; index <= bytes.length - 3; index += 1) {
    if (matches(bytes, index, startCode3)) return { offset: index, length: 3 };
    if (matches(bytes, index, startCode4)) return { offset: index, length: 4 };
  }
  return undefined;
}

function splitAnnexB(bytes: Uint8Array): Uint8Array[] {
  const units: Uint8Array[] = [];
  let current = findStartCode(bytes, 0);
  while (current) {
    const next = findStartCode(bytes, current.offset + current.length);
    const start = current.offset + current.length;
    const end = next?.offset ?? bytes.length;
    if (end > start) {
      units.push(bytes.subarray(start, end));
    }
    current = next;
  }
  return units;
}

function readLength(bytes: Uint8Array, offset: number, lengthSize: number) {
  let value = 0;
  for (let index = 0; index < lengthSize; index += 1) {
    value = (value << 8) | bytes[offset + index];
  }
  return value;
}

function splitLengthPrefixed(bytes: Uint8Array, lengthSize: number) {
  const units: Uint8Array[] = [];
  let offset = 0;
  while (offset + lengthSize <= bytes.length) {
    const length = readLength(bytes, offset, lengthSize);
    offset += lengthSize;
    if (length <= 0 || offset + length > bytes.length) break;
    units.push(bytes.subarray(offset, offset + length));
    offset += length;
  }
  return units;
}

function removeEmulationPreventionBytes(bytes: Uint8Array) {
  const result: number[] = [];
  let zeroCount = 0;

  bytes.forEach((value) => {
    if (zeroCount >= 2 && value === 0x03) {
      zeroCount = 0;
      return;
    }
    result.push(value);
    zeroCount = value === 0 ? zeroCount + 1 : 0;
  });

  return new Uint8Array(result);
}

function isH264Sei(unit: Uint8Array) {
  if (!unit.length) return false;
  return (unit[0] & 0x1f) === 6;
}

function isH265Sei(unit: Uint8Array) {
  if (unit.length < 2) return false;
  const type = (unit[0] >> 1) & 0x3f;
  return type === 39 || type === 40;
}

function inferCodec(unit: Uint8Array, codec?: 'H264' | 'H265') {
  if (codec) return codec;
  if (isH265Sei(unit)) return 'H265';
  return 'H264';
}

function stripNaluHeader(unit: Uint8Array, codec: 'H264' | 'H265') {
  return unit.subarray(codec === 'H265' ? 2 : 1);
}

export function extractSeiPayloadsFromNalUnits(
  bytes: Uint8Array,
  options: NaluExtractOptions = {},
): Uint8Array[] {
  const units =
    options.annexB === true
      ? splitAnnexB(bytes)
      : splitLengthPrefixed(bytes, options.lengthSize || 4);
  const payloads: Uint8Array[] = [];

  units.forEach((unit) => {
    const codec = inferCodec(unit, options.codec);
    const isSei = codec === 'H265' ? isH265Sei(unit) : isH264Sei(unit);
    if (!isSei) return;
    // SEI RBSP may contain emulation-prevention bytes after the NALU header.
    const rawPayload = removeEmulationPreventionBytes(stripNaluHeader(unit, codec));
    logger.trace('raw SEI RBSP bytes', {
      codec,
      naluByteLength: unit.length,
      ...summarizeBytesForDebug(rawPayload),
    });
    payloads.push(rawPayload);
  });

  return payloads;
}

export function extractAizlmPayloadsFromVideoBytes(
  bytes: Uint8Array,
  options: NaluExtractOptions = {},
): AiOverlayPayload[] {
  return extractSeiPayloadsFromNalUnits(bytes, options).flatMap((payload) =>
    parseAizlmSeiPayload(payload),
  );
}

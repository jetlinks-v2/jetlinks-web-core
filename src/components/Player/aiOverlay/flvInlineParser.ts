import { extractAizlmPayloadsFromVideoBytes } from './nalu';
import { createAiOverlayDebugLogger } from './debug';
import type { AiOverlayEmit } from './types';

const flvHeaderLength = 9;
const previousTagSizeLength = 4;
const tagHeaderLength = 11;
const videoTagType = 9;
const avcCodecId = 7;
const hevcCodecId = 12;
const maxBufferLength = 2 * 1024 * 1024;
const retainedBufferLength = 256 * 1024;

function readUint24(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
}

function readFlvTimestamp(bytes: Uint8Array, offset: number) {
  return readUint24(bytes, offset + 4) + bytes[offset + 7] * 0x1000000;
}

function concatBytes(left: Uint8Array, right: Uint8Array) {
  const result = new Uint8Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

function toOwnedBytes(bytes: Uint8Array) {
  const result = new Uint8Array(bytes.length);
  result.set(bytes);
  return result;
}

function toBytes(chunk: ArrayBuffer | Uint8Array) {
  return chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
}

function parseVideoTag(
  body: Uint8Array,
  flvTagTimestamp: number,
  emitPayload: AiOverlayEmit,
  logger: ReturnType<typeof createAiOverlayDebugLogger>,
  getCurrentVideoTimestamp?: () => number | undefined,
) {
  if (body.length < 5) {
    logger.trace('FLV video tag skipped: body too short', { bodyLength: body.length });
    return;
  }
  const codecId = body[0] & 0x0f;
  const packetType = body[1];
  if (packetType !== 1) {
    logger.trace('FLV video tag skipped: not NALU packet', { codecId, packetType });
    return;
  }
  if (codecId !== avcCodecId && codecId !== hevcCodecId) {
    logger.trace('FLV video tag skipped: unsupported codec', { codecId });
    return;
  }

  const codec = codecId === hevcCodecId ? 'H265' : 'H264';
  const naluBytes = body.subarray(5);
  logger.trace('FLV video tag parsed', {
    codec,
    packetType,
    flvTagTimestamp,
    naluByteLength: naluBytes.length,
  });
  const payloads = extractAizlmPayloadsFromVideoBytes(naluBytes, {
    codec,
    lengthSize: 4,
  });
  logger.trace('FLV AIZLM payload parsed', { payloadCount: payloads.length });
  payloads.forEach((payload) => {
    const currentVideoTimestamp = getCurrentVideoTimestamp?.();
    const inferPts = (payload as { infer_pts?: number }).infer_pts;
    logger.trace('FLV SEI raw payload', {
      flvTagTimestamp,
      currentVideoTimestamp,
      payloadPts: payload.pts,
      inferPts,
      frameId: payload.frame_id,
      objectCount: payload.objects.length,
      regionCount: payload.regions.length,
      firstObjectBbox: payload.objects[0]?.bbox,
    });
  });
  payloads.forEach(emitPayload);
}

export function createFlvChunkSeiParser(
  emitPayload: AiOverlayEmit,
  options: {
    debug?: boolean;
    force?: boolean;
    getCurrentVideoTimestamp?: () => number | undefined;
  } = {},
) {
  let buffer = new Uint8Array();
  const logger = createAiOverlayDebugLogger(options.debug, options.force);

  const parseBuffer = () => {
    let offset = 0;
    if (buffer.length < flvHeaderLength + previousTagSizeLength) {
      logger.trace('FLV buffer waiting for header', { bufferLength: buffer.length });
      return;
    }

    if (buffer[0] === 0x46 && buffer[1] === 0x4c && buffer[2] === 0x56) {
      const dataOffset =
        (buffer[5] << 24) | (buffer[6] << 16) | (buffer[7] << 8) | buffer[8];
      offset = Math.max(flvHeaderLength, dataOffset) + previousTagSizeLength;
      logger.trace('FLV header parsed', { dataOffset, offset });
    }

    while (offset + tagHeaderLength <= buffer.length) {
      const tagType = buffer[offset];
      const dataSize = readUint24(buffer, offset + 1);
      const tagEnd = offset + tagHeaderLength + dataSize + previousTagSizeLength;
      if (tagEnd > buffer.length) {
        logger.trace('FLV tag waiting for more bytes', {
          offset,
          tagType,
          dataSize,
          bufferLength: buffer.length,
        });
        break;
      }

      if (tagType === videoTagType) {
        const flvTagTimestamp = readFlvTimestamp(buffer, offset);
        parseVideoTag(
          buffer.subarray(offset + tagHeaderLength, offset + tagHeaderLength + dataSize),
          flvTagTimestamp,
          emitPayload,
          logger,
          options.getCurrentVideoTimestamp,
        );
      } else {
        logger.trace('FLV tag skipped: not video', { tagType, dataSize });
      }
      offset = tagEnd;
    }

    buffer = toOwnedBytes(buffer.subarray(offset));
    if (buffer.length > maxBufferLength) {
      logger.warn('FLV parser buffer exceeded limit; retaining tail bytes', {
        bufferLength: buffer.length,
        retainedBufferLength,
      });
      buffer = toOwnedBytes(buffer.subarray(buffer.length - retainedBufferLength));
    }
  };

  return {
    push(chunk: ArrayBuffer | Uint8Array) {
      const bytes = toBytes(chunk);
      logger.trace('FLV chunk received', {
        chunkByteLength: bytes.length,
        previousBufferLength: buffer.length,
      });
      buffer = concatBytes(buffer, bytes);
      parseBuffer();
    },
    reset() {
      logger.trace('FLV parser reset', { bufferLength: buffer.length });
      buffer = new Uint8Array();
    },
  };
}

export type Mp4Box = {
  type: string;
  data: Uint8Array;
  headerSize: number;
  totalSize: number;
};

function read32BE(b: Uint8Array, o: number): number {
  return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
}

function boxType(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const r = new Uint8Array(a.length + b.length);
  r.set(a, 0);
  r.set(b, a.length);
  return r;
}

export async function* readBoxes(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Mp4Box> {
  const reader = stream.getReader();
  let buf = new Uint8Array(0);
  try {
    while (true) {
      while (buf.length >= 8) {
        let size = read32BE(buf, 0);
        const type = boxType(buf, 4);
        let hdr = 8;
        if (size === 1) {
          if (buf.length < 16) break;
          size = read32BE(buf, 8) * 0x100000000 + read32BE(buf, 12);
          hdr = 16;
        } else if (size === 0) {
          size = buf.length;
        }
        if (size < hdr) {
          buf = buf.subarray(1);
          continue;
        }
        if (buf.length < size) break;
        yield {
          type,
          data: buf.subarray(hdr, size),
          headerSize: hdr,
          totalSize: size,
        };
        buf = buf.subarray(size);
      }
      const { done, value } = await reader.read();
      if (done) break;
      buf = concat(buf, value);
    }
  } finally {
    reader.releaseLock();
  }
}

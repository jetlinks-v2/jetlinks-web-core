/**
 * Standard MP4 → fMP4 transmuxer for recorded (non-fragmented) MP4 files.
 *
 * Problem: Standard MP4 has moov at the END of the file, so we can't stream it
 * directly into MSE. We need to range-request the moov first, parse the sample
 * table, then fetch video samples and transmux them into fMP4 segments.
 *
 * This also enables same-pipeline SEI extraction from recording files.
 */

function r32(b: Uint8Array, o: number): number {
  return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
}

function boxType(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
}

function write32(buf: Uint8Array, o: number, v: number) {
  buf[o] = (v >>> 24) & 0xff;
  buf[o + 1] = (v >>> 16) & 0xff;
  buf[o + 2] = (v >>> 8) & 0xff;
  buf[o + 3] = v & 0xff;
}

export type Mp4Sample = {
  offset: number;
  size: number;
  timestamp: number; // in track timescale
  duration: number;
  isSync: boolean;
};

export type TransmuxResult = {
  initSegment: Uint8Array;
  timescale: number;
  samples: Mp4Sample[];
};

/** Scan bytes for a box by type. Returns { data, end } where end is byte after the box. */
function findBoxData(
  buf: Uint8Array,
  target: string,
  start = 0,
): { data: Uint8Array; end: number } | null {
  let o = start;
  while (o + 8 <= buf.length) {
    let s = r32(buf, o);
    if (s === 1) { if (o + 16 > buf.length) return null; s = r32(buf, o + 8) * 0x100000000 + r32(buf, o + 12); }
    if (s === 0) s = buf.length - o;
    if (s < 8 || o + s > buf.length) return null;
    const t = boxType(buf, o + 4);
    if (t === target) return { data: buf.subarray(o + 8, o + s), end: o + s };
    o += s;
  }
  return null;
}

function walkPath(buf: Uint8Array, ...path: string[]): Uint8Array | null {
  let cur = buf;
  for (const p of path) {
    const n = findBoxData(cur, p);
    if (!n) return null;
    cur = n.data;
  }
  return cur;
}

/** Parse stco or co64 box to get chunk offsets. */
function parseStco(stco: Uint8Array, _version: number): number[] {
  if (stco.length < 8) return [];
  const count = r32(stco, 4);
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(r32(stco, 8 + i * 4));
  }
  return offsets;
}

/** Parse stsc (sample-to-chunk) box. Returns array of {firstChunk, samplesPerChunk, descIndex}. */
function parseStsc(stsc: Uint8Array): { firstChunk: number; samplesPerChunk: number }[] {
  if (stsc.length < 8) return [];
  const count = r32(stsc, 4);
  const entries: { firstChunk: number; samplesPerChunk: number }[] = [];
  for (let i = 0; i < count; i++) {
    entries.push({
      firstChunk: r32(stsc, 8 + i * 12),
      samplesPerChunk: r32(stsc, 12 + i * 12),
    });
  }
  return entries;
}

/** Parse stsz (sample size) box. Returns array of sample sizes. */
function parseStsz(stsz: Uint8Array): number[] {
  if (stsz.length < 12) return [];
  const sampleSize = r32(stsz, 4);
  const count = r32(stsz, 8);
  if (sampleSize !== 0) {
    return new Array(count).fill(sampleSize);
  }
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    sizes.push(r32(stsz, 12 + i * 4));
  }
  return sizes;
}

/** Parse stts (time-to-sample) box. Returns {sampleCount, sampleDelta}[]. */
function parseStts(stts: Uint8Array): { count: number; delta: number }[] {
  if (stts.length < 8) return [];
  const entries = r32(stts, 4);
  const result: { count: number; delta: number }[] = [];
  for (let i = 0; i < entries; i++) {
    result.push({
      count: r32(stts, 8 + i * 8),
      delta: r32(stts, 12 + i * 8),
    });
  }
  return result;
}

/** Parse ctts (composition time offset) box. */
function parseCtts(ctts: Uint8Array): number[] {
  if (ctts.length < 8) return [];
  const count = r32(ctts, 4);
  const offsets: number[] = [];
  for (let i = 0; i < count; i++) {
    offsets.push(r32(ctts, 8 + i * 4));
  }
  return offsets;
}

/** Parse stss (sync sample) box. Returns Set of sync sample indices (1-based). */
function parseStss(stss: Uint8Array): Set<number> {
  if (stss.length < 8) return new Set();
  const count = r32(stss, 4);
  const set = new Set<number>();
  for (let i = 0; i < count; i++) {
    set.add(r32(stss, 8 + i * 4));
  }
  return set;
}

/** Parse mdhd to get timescale. */
function parseMdhdTimescale(mdhd: Uint8Array): number {
  if (mdhd.length < 20) return 0;
  return r32(mdhd, 12);
}

/** Parse avcC to get lengthSize. */
function parseAvccLenSize(avcc: Uint8Array): number {
  return avcc.length >= 5 ? (avcc[4] & 0x03) + 1 : 4;
}

/** Parse the codec info from moov for SEI extraction. */
export function parseMp4Codec(moovData: Uint8Array): { codec: 'H264' | 'H265'; lenSize: number } | null {
  const stsd = walkPath(moovData, 'trak', 'mdia', 'minf', 'stbl', 'stsd');
  if (!stsd || stsd.length < 16) return null;
  const count = r32(stsd, 4);
  if (count < 1) return null;
  let o = 8;
  let es = r32(stsd, o);
  if (es === 1) es = r32(stsd, o + 8) * 0x100000000 + r32(stsd, o + 12);
  const et = boxType(stsd, o + 4);
  const ed = stsd.subarray(o + 8, o + es);

  if (et === 'avc1') {
    const avcC = findBoxData(ed, 'avcC', 78);
    return avcC?.data ? { codec: 'H264', lenSize: parseAvccLenSize(avcC.data) } : null;
  }
  if (et === 'hvc1' || et === 'hev1') {
    const hvcC = findBoxData(ed, 'hvcC', 78);
    return hvcC?.data ? { codec: 'H265', lenSize: hvcC.data.length >= 23 ? (hvcC.data[21] & 0x03) + 1 : 4 } : null;
  }
  return null;
}

/**
 * Parse the moov box of a standard MP4 and return the sample table.
 * This is the core of the transmuxer — from this we can read individual
 * samples via Range requests.
 */
export function parseMp4SampleTable(moovData: Uint8Array): {
  timescale: number;
  samples: Mp4Sample[];
} | null {
  const mdhd = walkPath(moovData, 'trak', 'mdia', 'mdhd');
  if (!mdhd) return null;
  const timescale = parseMdhdTimescale(mdhd);
  if (!timescale) return null;

  const stbl = walkPath(moovData, 'trak', 'mdia', 'minf', 'stbl');
  if (!stbl) return null;

  const stco = findBoxData(stbl, 'stco') || findBoxData(stbl, 'co64');
  const stsc = findBoxData(stbl, 'stsc');
  const stsz = findBoxData(stbl, 'stsz');
  const stts = findBoxData(stbl, 'stts');

  if (!stco || !stsc || !stsz || !stts) return null;

  const chunkOffsets = parseStco(stco.data, 0);
  const stscEntries = parseStsc(stsc.data);
  const sampleSizes = parseStsz(stsz.data);
  const timeEntries = parseStts(stts.data);

  // Optional boxes
  const cttsData = findBoxData(stbl, 'ctts');
  const ctts = cttsData ? parseCtts(cttsData.data) : [];
  const stssData = findBoxData(stbl, 'stss');
  const syncSet = stssData ? parseStss(stssData.data) : new Set();

  if (!chunkOffsets.length || !stscEntries.length || !sampleSizes.length) return null;

  // Build sample index
  const samples: Mp4Sample[] = [];
  const totalSamples = sampleSizes.length;

  // Build chunk→sample mapping
  let sampleIdx = 0;
  for (let chunkIdx = 0; chunkIdx < chunkOffsets.length; chunkIdx++) {
    const chunkNum = chunkIdx + 1;
    // Find the stsc entry for this chunk (last entry with firstChunk <= chunkNum)
    let entry = stscEntries[0];
    for (const e of stscEntries) {
      if (e.firstChunk <= chunkNum) entry = e;
    }
    const n = entry.samplesPerChunk;
    for (let j = 0; j < n && sampleIdx < totalSamples; j++, sampleIdx++) {
      const sample = samples[sampleIdx - chunkIdx * 0]; // placeholder
      // Actual sample offset is cumulative within chunk
    }
  }

  // Proper chunk offset accumulation
  let offset = 0;
  for (let ci = 0, si = 0; ci < chunkOffsets.length; ci++) {
    const chunkNum = ci + 1;
    let entry = stscEntries[0];
    for (const e of stscEntries) {
      if (e.firstChunk <= chunkNum) entry = e;
    }
    const n = entry.samplesPerChunk;
    // Adjust offset for this chunk: first sample starts at chunkOffset, subsequent at cumulative sum
    let chunkOffset = chunkOffsets[ci];
    for (let j = 0; j < n && si < totalSamples; j++, si++) {
      const size = j < sampleSizes.length - si ? sampleSizes[si] : 0;
      samples.push({
        offset: chunkOffset,
        size: size,
        timestamp: 0, // filled below
        duration: 0,  // filled below
        isSync: syncSet.has(si + 1),
      });
      chunkOffset += size;
    }
  }

  // Compute timestamps from stts
  let time = 0;
  let si = 0;
  for (const entry of timeEntries) {
    for (let i = 0; i < entry.count && si < samples.length; i++, si++) {
      samples[si].timestamp = time;
      samples[si].duration = entry.delta;
      time += entry.delta;
    }
  }

  // Apply ctts (composition time offsets) if present
  for (let i = 0; i < Math.min(ctts.length, samples.length); i++) {
    samples[i].timestamp += ctts[i];
  }

  return { timescale, samples };
}

/** Build an fMP4 init segment (ftyp + moov with mvex) from the original moov data. */
export function buildFmp4Init(moovData: Uint8Array, samples: Mp4Sample[]): Uint8Array {
  // Minimal init: we'll reconstruct the moov with only video track
  // For simplicity, we use the original moov with mvex injected, and stream the mdat separately

  // Strategy: slice moov to remove the full stco/stsz data and add mvex
  // For now, use a simpler approach: create init from moov + mvex stub

  // Compute sample data sizes for mvex/trex
  // We need to find the video trak's track ID
  const tkhdData = walkPath(moovData, 'trak', 'tkhd');
  const mdhdData = walkPath(moovData, 'trak', 'mdia', 'mdhd');
  const trackId = tkhdData && tkhdData.length >= 12 ? r32(tkhdData, 4) : 1;

  // Build mvex box (needed for fMP4 playback)
  const mvexSize = 8 /* mvex */ + 8 /* mehd */ + 8 /* trex */;
  const mvex = new Uint8Array(mvexSize + 8 /* mvex header */);
  const mehdSize = 8 /* mehd empty */;
  const trexSize = 8 /* trex empty */;

  // mvex header
  write32(mvex, 0, mvexSize + 8);
  mvex[4] = 0x6d; mvex[5] = 0x76; mvex[6] = 0x65; mvex[7] = 0x78; // 'mvex'

  // mehd (movie extends header) — minimal
  let o = 8;
  write32(mvex, o, mehdSize);
  mvex[o + 4] = 0x6d; mvex[o + 5] = 0x65; mvex[o + 6] = 0x68; mvex[o + 7] = 0x64; // 'mehd'
  o += mehdSize;

  // trex (track extends) — minimal, track ID default
  write32(mvex, o, trexSize);
  mvex[o + 4] = 0x74; mvex[o + 5] = 0x72; mvex[o + 6] = 0x65; mvex[o + 7] = 0x78; // 'trex'
  write32(mvex, o + 8, trackId);
  write32(mvex, o + 12, 1); // default_sample_description_index
  write32(mvex, o + 16, 1); // default_sample_duration
  write32(mvex, o + 20, 1); // default_sample_size
  o += trexSize; // unused but explicit

  // Build init: ftyp copied from response + moov + mvex
  // Actually, we need the ftyp from the stream.
  // For simplicity, return moov with mvex appended as the init segment.
  // The caller should prepend ftyp.

  const init = new Uint8Array(moovData.length + mvex.length);
  init.set(moovData, 0);
  init.set(mvex, moovData.length);

  return init;
}

/** Build a single moof+mdat fMP4 media segment for a group of samples. */
export function buildFmp4Segment(
  sampleData: Uint8Array,
  baseDecodeTime: number,
  sampleDuration: number,
  timescale: number,
): Uint8Array {
  // moof size: 8 + mfhd(8) + traf(tfhd(8)+tfdt(8)+trun(8+4*1))
  const moofSize = 8 + 16 + 8 + 8 + 12; // 52
  // mdat size: 8 + data
  const mdatSize = 8 + sampleData.length;

  const buf = new Uint8Array(moofSize + mdatSize);
  let o = 0;

  // moof header
  write32(buf, o, moofSize);
  buf[o + 4] = 0x6d; buf[o + 5] = 0x6f; buf[o + 6] = 0x6f; buf[o + 7] = 0x66; // 'moof'
  o += 8;

  // mfhd
  write32(buf, o, 16);
  buf[o + 4] = 0x6d; buf[o + 5] = 0x66; buf[o + 6] = 0x68; buf[o + 7] = 0x64; // 'mfhd'
  write32(buf, o + 8, 0); // version+flags
  write32(buf, o + 12, 1); // sequence_number
  o += 16;

  // traf
  const trafStart = o;
  write32(buf, o, 0); // placeholder for traf size
  buf[o + 4] = 0x74; buf[o + 5] = 0x72; buf[o + 6] = 0x61; buf[o + 7] = 0x66; // 'traf'
  o += 8;

  // tfhd
  write32(buf, o, 24);
  buf[o + 4] = 0x74; buf[o + 5] = 0x66; buf[o + 6] = 0x68; buf[o + 7] = 0x64; // 'tfhd'
  write32(buf, o + 8, 0x000000); // flags (default-base-is-moof)
  write32(buf, o + 12, 1); // track_ID
  write32(buf, o + 16, 1); // default_sample_duration (will be overridden)
  write32(buf, o + 20, 1); // default_sample_size
  o += 24;

  // tfdt
  write32(buf, o, 20);
  buf[o + 4] = 0x74; buf[o + 5] = 0x66; buf[o + 6] = 0x64; buf[o + 7] = 0x74; // 'tfdt'
  write32(buf, o + 8, 1); // version=1
  write32(buf, o + 12, 0); // flags
  write32(buf, o + 16, Math.floor(baseDecodeTime / 0x100000000));
  write32(buf, o + 20, baseDecodeTime >>> 0);
  o += 24;

  // trun
  const trunSize = 8 + 4 + 4 + 4 + 4; // header + count + size + duration + cts
  write32(buf, o, trunSize);
  buf[o + 4] = 0x74; buf[o + 5] = 0x72; buf[o + 6] = 0x75; buf[o + 7] = 0x6e; // 'trun'
  write32(buf, o + 8, 0x000305); // flags: sample-size, duration, cts present
  write32(buf, o + 12, 1); // sample count
  write32(buf, o + 16, sampleData.length); // sample size
  write32(buf, o + 20, sampleDuration); // sample duration
  write32(buf, o + 24, 0); // composition time offset (0 for non-B-frames)
  o += trunSize;

  // Fix traf size
  write32(buf, trafStart, o - trafStart);

  // mdat
  write32(buf, o, mdatSize);
  buf[o + 4] = 0x6d; buf[o + 5] = 0x64; buf[o + 6] = 0x61; buf[o + 7] = 0x74; // 'mdat'
  o += 8;
  buf.set(sampleData, o);

  return buf;
}

import HlsPlugin from 'xgplayer-hls';

import type { MediaPlayerProtocol } from './types';

type LegacyPlayerProtocol = 'mp4' | 'm3u8' | 'rtc';

export const isMediaStreamValue = (value: unknown): value is MediaStream =>
  typeof MediaStream !== 'undefined' && value instanceof MediaStream;

export const shouldUseJessibuca = (
  url?: string | MediaStream,
  protocol?: MediaPlayerProtocol,
) => {
  if (protocol === 'flv') return true;
  return typeof url === 'string' && /\.flv(?:$|[?#])/i.test(url);
};

export const inferLegacyPlayerProtocol = (
  url?: string | MediaStream,
  protocol?: MediaPlayerProtocol,
): LegacyPlayerProtocol => {
  if (protocol === 'rtc' || isMediaStreamValue(url)) {
    return 'rtc';
  }
  if (protocol === 'm3u8') {
    return 'm3u8';
  }
  if (typeof url === 'string' && /\.m3u8(?:$|[?#])/i.test(url)) {
    return 'm3u8';
  }
  return 'mp4';
};

export const legacyPlayerOptions = {
  mp4: {},
  m3u8: {
    plugins: [HlsPlugin],
  },
  rtc: {},
};

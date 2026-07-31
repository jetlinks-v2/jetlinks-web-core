import type { ExtractPropTypes, PropType } from 'vue';
import type { AiOverlayOptions, AiOverlayPayload, AiOverlayVideoInfo } from './aiOverlay/types';

export type MediaPlayerProtocol = 'mp4' | 'flv' | 'm3u8' | 'rtc' | 'ws' | 'wss' | string;

export const mediaPlayerProps = {
  url: {
    type: [String, Object] as PropType<string | MediaStream>,
    default: undefined,
  },
  live: {
    type: Boolean,
    default: false,
  },
  autoplay: {
    type: Boolean,
    default: true,
  },
  muted: {
    type: Boolean,
    default: false,
  },
  poster: {
    type: String,
    default: undefined,
  },
  timeout: {
    type: Number,
    default: undefined,
  },
  className: {
    type: String,
    default: '',
  },
  updateTime: {
    type: Number,
    default: undefined,
  },
  key: {
    type: [String, Number] as PropType<string | number>,
    default: undefined,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  volume: {
    type: Number,
    default: undefined,
  },
  loop: {
    type: Boolean,
    default: false,
  },
  lang: {
    type: String,
    default: undefined,
  },
  protocol: {
    type: String as PropType<MediaPlayerProtocol>,
    default: 'mp4',
  },
  crossOriginVideo: {
    type: Boolean,
    default: false,
  },
  aiOverlay: {
    type: [Boolean, Object] as PropType<boolean | AiOverlayOptions>,
    default: false,
  },
  onDestroy: {
    type: Function as PropType<(event?: any) => void>,
    default: undefined,
  },
  onMessage: {
    type: Function as PropType<(message: any) => void>,
    default: undefined,
  },
  onError: {
    type: Function as PropType<(error: any) => void>,
    default: undefined,
  },
  onTimeUpdate: {
    type: Function as PropType<(time: any) => void>,
    default: undefined,
  },
  onPause: {
    type: Function as PropType<(event?: any) => void>,
    default: undefined,
  },
  onPlay: {
    type: Function as PropType<(event?: any) => void>,
    default: undefined,
  },
  onFullscreen: {
    type: Function as PropType<() => void>,
    default: undefined,
  },
  onSnapOutside: {
    type: Function as PropType<(base64: any) => void>,
    default: undefined,
  },
  onSnapInside: {
    type: Function as PropType<(base64: any) => void>,
    default: undefined,
  },
  onCustomButtons: {
    type: Function as PropType<(name: any) => void>,
    default: undefined,
  },
  onEnded: {
    type: Function as PropType<(event?: any) => void>,
    default: undefined,
  },
  onClick: {
    type: Function as PropType<() => void>,
    default: undefined,
  },
  onCanPlay: {
    type: Function as PropType<() => void>,
    default: undefined,
  },
  onAiOverlay: {
    type: Function as PropType<(payload: AiOverlayPayload) => void>,
    default: undefined,
  },
  onVideoInfo: {
    type: Function as PropType<(info: AiOverlayVideoInfo) => void>,
    default: undefined,
  },
  options: {
    type: Object as PropType<Record<string, any>>,
    default: undefined,
  }
} as const;

export type MediaPlayerProps = Readonly<ExtractPropTypes<typeof mediaPlayerProps>>;

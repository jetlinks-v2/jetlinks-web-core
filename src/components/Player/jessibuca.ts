export type JessibucaCtor = typeof Jessibuca;
export type JessibucaPlayOptions = {
  headers?: Record<string, string>;
};
export type JessibucaOperateButtons = {
  fullscreen?: boolean;
  screenshot?: boolean;
  play?: boolean;
  audio?: boolean;
  record?: boolean;
};
export type JessibucaConfig = {
  container: HTMLElement | string;
  decoder?: string;
  videoBuffer?: number;
  videoBufferDelay?: number;
  isResize?: boolean;
  isFullResize?: boolean;
  isFlv?: boolean;
  loadingText?: string;
  hasAudio?: boolean;
  debug?: boolean;
  showBandwidth?: boolean;
  operateBtns?: JessibucaOperateButtons;
  forceNoOffscreen?: boolean;
  isNotMute?: boolean;
  timeout?: number;
  heartTimeout?: number;
  loadingTimeout?: number;
  useMSE?: boolean;
  useWCS?: boolean;
  wcsUseVideoRender?: boolean;
  autoWasm?: boolean;
  heartTimeoutReplay?: boolean;
  heartTimeoutReplayTimes?: number;
  loadingTimeoutReplay?: boolean;
  loadingTimeoutReplayTimes?: number;
  wasmDecodeErrorReplay?: boolean;
  controlAutoHide?: boolean;
  recordType?: 'webm' | 'mp4';
};

declare global {
  interface Window {
    Jessibuca?: JessibucaCtor;
    jessibuca?: JessibucaCtor;
  }
}

export declare class Jessibuca {
  constructor(config: JessibucaConfig);
  play(url?: string, options?: JessibucaPlayOptions): Promise<void>;
  pause(): Promise<void>;
  destroy(): Promise<void> | void;
  resize(): void;
  screenshot(
    filename?: string,
    format?: string,
    quality?: number,
    type?: string,
  ): string | Blob | void;
  setVolume?(value: number): void;
  audioResume?(): void;
  on(event: string, callback: (...args: unknown[]) => void): void;
}

let jessibucaLoadPromise: Promise<JessibucaCtor> | null = null;
const defaultOperateBtns: JessibucaOperateButtons = {
  fullscreen: false,
  screenshot: false,
  play: false,
  audio: false,
  record: false,
};

export const isMediaStreamValue = (value: unknown): value is MediaStream =>
  typeof MediaStream !== 'undefined' && value instanceof MediaStream;

export function normalizePlaybackUrl(url: string): string {
  const next = url.trim();
  if (!next) return next;
  if (/^https?:\/\//i.test(next)) return next;
  if (typeof window === 'undefined') return next;
  return new URL(next, window.location.origin).toString();
}

function getJessibucaAsset(fileName: string) {
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}jessibuca/${fileName}`;
}

export function getJessibucaDecoderSrc() {
  return getJessibucaAsset('decoder.js');
}

function getJessibucaRuntime() {
  return window.Jessibuca ?? window.jessibuca;
}

function isFlvStream(url: string, protocol?: string) {
  if (/\.flv(?:$|[?#])/i.test(url)) return true;
  if (/\.(?:mp4|m3u8|ts|ps|h264|h265|mpeg4)(?:$|[?#])/i.test(url)) return false;
  return protocol === 'flv';
}

export function getJessibucaConfigKey(options: {
  muted: boolean;
  protocol?: string;
  url: string;
}) {
  return [
    options.protocol || '',
    isFlvStream(options.url, options.protocol) ? 'flv' : 'stream',
    options.muted ? 'muted' : 'audio',
  ].join(':');
}

export function createJessibucaConfig(
  container: HTMLElement | string,
  options: {
    muted: boolean;
    protocol?: string;
    timeout?: number;
    url: string;
  },
): JessibucaConfig {
  const flvStream = isFlvStream(options.url, options.protocol);
  return {
    container,
    videoBuffer: 0.2,
    isResize: true,
    loadingText: '',
    decoder: getJessibucaDecoderSrc(),
    hasAudio: !options.muted,
    debug: false,
    showBandwidth: false,
    operateBtns: { ...defaultOperateBtns },
    forceNoOffscreen: true,
    isNotMute: !options.muted,
    timeout: options.timeout,
    useMSE: flvStream,
    useWCS: false,
    wcsUseVideoRender: true,
    autoWasm: true,
    heartTimeoutReplay: true,
    heartTimeoutReplayTimes: 3,
    loadingTimeoutReplay: true,
    loadingTimeoutReplayTimes: 3,
    wasmDecodeErrorReplay: true,
    controlAutoHide: false,
    isFlv: flvStream,
  };
}

export function loadJessibuca(): Promise<JessibucaCtor> {
  const runtime = getJessibucaRuntime();
  if (runtime) return Promise.resolve(runtime);
  if (jessibucaLoadPromise) return jessibucaLoadPromise;

  jessibucaLoadPromise = new Promise<JessibucaCtor>((resolve, reject) => {
    const current = document.querySelector<HTMLScriptElement>(
      'script[data-jessibuca-runtime="true"]',
    );
    if (current) {
      const loadedRuntime = getJessibucaRuntime();
      if (loadedRuntime) {
        resolve(loadedRuntime);
        return;
      }
      if (current.dataset.loaded === 'true') {
        reject(new Error('Jessibuca runtime loaded but constructor is missing'));
        return;
      }
      current.addEventListener(
        'load',
        () => {
          const nextRuntime = getJessibucaRuntime();
          current.dataset.loaded = 'true';
          if (nextRuntime) resolve(nextRuntime);
          else reject(new Error('Jessibuca runtime loaded but constructor is missing'));
        },
        { once: true },
      );
      current.addEventListener(
        'error',
        () => reject(new Error('Jessibuca runtime load failed')),
        { once: true },
      );
      return;
    }

    const script = document.createElement('script');
    script.src = getJessibucaAsset('jessibuca.js');
    script.async = true;
    script.dataset.jessibucaRuntime = 'true';
    script.onload = () => {
      script.dataset.loaded = 'true';
      const nextRuntime = getJessibucaRuntime();
      if (nextRuntime) resolve(nextRuntime);
      else reject(new Error('Jessibuca runtime loaded but constructor is missing'));
    };
    script.onerror = () =>
      reject(new Error(`Jessibuca runtime load failed: ${script.src}`));
    document.head.appendChild(script);
  }).finally(() => {
    if (!getJessibucaRuntime()) {
      jessibucaLoadPromise = null;
    }
  });

  return jessibucaLoadPromise;
}

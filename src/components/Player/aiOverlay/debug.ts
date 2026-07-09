const localStorageDebugKey = 'jetlinks-player-ai-overlay-debug';
const urlDebugKey = 'playerAiOverlayDebug';
const rawPreviewLength = 256;

function isLocalStorageDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage?.getItem(localStorageDebugKey) === '1' ||
      window.sessionStorage?.getItem(localStorageDebugKey) === '1' ||
      new URLSearchParams(window.location.search).get(urlDebugKey) === '1'
    );
  } catch {
    return false;
  }
}

function maskUrlToken(value: string) {
  return value.replace(/([?&:]X_Access_Token=)[^&#]*/gi, '$1***');
}

function sanitizeDetail(value: unknown): unknown {
  if (typeof value === 'string') return maskUrlToken(value);
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeDetail);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sanitizeDetail(item),
    ]),
  );
}

function toHexPreview(bytes: Uint8Array, limit = rawPreviewLength) {
  return Array.from(bytes.subarray(0, limit))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join(' ');
}

function toTextPreview(bytes: Uint8Array, limit = rawPreviewLength) {
  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export function summarizeBytesForDebug(bytes: Uint8Array) {
  return {
    byteLength: bytes.length,
    previewLength: Math.min(bytes.length, rawPreviewLength),
    truncated: bytes.length > rawPreviewLength,
    hexPreview: toHexPreview(bytes),
    textPreview: toTextPreview(bytes),
  };
}

export function isAiOverlayDebugEnabled(debug?: boolean) {
  return Boolean(debug || isLocalStorageDebugEnabled());
}

export function createAiOverlayDebugLogger(debug?: boolean, _force?: boolean) {
  const enabled = () => isAiOverlayDebugEnabled(debug);
  return {
    enabled,
    trace(_message: string, _detail?: unknown) {
      // trace logging disabled — enable via localStorage or URL param for debugging
    },
    warn(message: string, detail?: unknown) {
      if (enabled()) {
        console.warn(`[Player AI Overlay] ${message}`, sanitizeDetail(detail) ?? '');
      }
    },
  };
}

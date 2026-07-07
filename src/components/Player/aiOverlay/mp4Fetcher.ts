export type Mp4FetchResult = {
  playbackStream: ReadableStream<Uint8Array>;
  seiStream: ReadableStream<Uint8Array>;
  abort: () => void;
};

function combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any([a, b]);
  const c = new AbortController();
  const fn = () => c.abort();
  a.addEventListener('abort', fn, { once: true });
  b.addEventListener('abort', fn, { once: true });
  if (a.aborted || b.aborted) c.abort();
  return c.signal;
}

/**
 * Custom stream splitter — replacement for ReadableStream.tee()
 * which has a Chrome bug where one branch can end prematurely.
 *
 * Reads from the source stream once and enqueues each chunk to both
 * output streams. Both consumers read independently.
 */
function splitStream(
  source: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): [ReadableStream<Uint8Array>, ReadableStream<Uint8Array>] {
  let c1: ReadableStreamDefaultController<Uint8Array> | null = null;
  let c2: ReadableStreamDefaultController<Uint8Array> | null = null;

  const s1 = new ReadableStream<Uint8Array>({
    start(controller) {
      c1 = controller;
    },
    cancel() {
      // propagate cancel — handled by AbortController
    },
  });

  const s2 = new ReadableStream<Uint8Array>({
    start(controller) {
      c2 = controller;
    },
    cancel() {
      // propagate cancel — handled by AbortController
    },
  });

  (async () => {
    const reader = source.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        c1?.enqueue(value);
        c2?.enqueue(value);
      }
    } catch (e) {
      // AbortError on cancellation — expected
      if ((e as Error)?.name !== 'AbortError') {
        console.warn('[mp4Fetcher] splitStream error:', e);
      }
    } finally {
      try { c1?.close(); } catch { /* already closed */ }
      try { c2?.close(); } catch { /* already closed */ }
      reader.releaseLock();
    }
  })();

  return [s1, s2];
}

export async function fetchMp4Stream(
  url: string,
  signal?: AbortSignal,
): Promise<Mp4FetchResult> {
  const ctrl = new AbortController();
  const sig = signal ? combineSignals(signal, ctrl.signal) : ctrl.signal;
  const resp = await fetch(url, { signal: sig });

  if (!resp.ok) {
    throw new Error(`MP4 fetch failed: HTTP ${resp.status}`);
  }
  if (!resp.body) {
    throw new Error('Response has no body');
  }

  const [playbackStream, seiStream] = splitStream(resp.body, sig);

  return {
    playbackStream: playbackStream as ReadableStream<Uint8Array>,
    seiStream: seiStream as ReadableStream<Uint8Array>,
    abort: () => ctrl.abort(),
  };
}

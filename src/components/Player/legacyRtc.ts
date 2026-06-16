import { isMediaStreamValue } from './legacyPlayerUtils';

type CreateLegacyRtcControllerOptions = {
  getVideoElement: () => HTMLVideoElement | null;
  getAutoplay: () => boolean;
  getMuted: () => boolean;
};

export function createLegacyRtcController(
  options: CreateLegacyRtcControllerOptions,
) {
  let rtcPeer: RTCPeerConnection | null = null;
  let rtcAbortController: AbortController | null = null;
  let rtcSessionId = 0;

  const stop = () => {
    rtcSessionId += 1;
    rtcAbortController?.abort();
    rtcAbortController = null;
    rtcPeer?.close();
    rtcPeer = null;

    const video = options.getVideoElement();
    if (!video) return;
    video.pause?.();
    video.srcObject = null;
    video.removeAttribute('src');
    video.load?.();
  };

  const attachStream = async (stream: MediaStream, sessionId: number) => {
    const video = options.getVideoElement();
    if (!video || sessionId !== rtcSessionId) return;

    video.srcObject = stream;
    video.autoplay = options.getAutoplay();
    video.muted = options.getMuted();

    if (options.getAutoplay()) {
      await video.play();
    }
  };

  const waitIceComplete = (peer: RTCPeerConnection, sessionId: number) =>
    new Promise<void>((resolve) => {
      if (peer.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const handleStateChange = () => {
        if (sessionId !== rtcSessionId || peer.iceGatheringState === 'complete') {
          window.clearTimeout(timer);
          peer.removeEventListener('icegatheringstatechange', handleStateChange);
          resolve();
        }
      };

      const timer = window.setTimeout(() => {
        peer.removeEventListener('icegatheringstatechange', handleStateChange);
        resolve();
      }, 2000);

      peer.addEventListener('icegatheringstatechange', handleStateChange);
    });

  const requestAnswer = async (rtcUrl: string, sdp: string, sessionId: number) => {
    // Different upstream RTC endpoints may return pure SDP text or JSON with an sdp field.
    const payloads = [
      { body: sdp, headers: { 'Content-Type': 'application/sdp' } },
      {
        body: JSON.stringify({ sdp, type: 'offer' }),
        headers: { 'Content-Type': 'application/json' },
      },
    ];

    for (const payload of payloads) {
      const response = await fetch(rtcUrl, {
        method: 'POST',
        body: payload.body,
        headers: payload.headers,
        signal: rtcAbortController?.signal,
      });

      if (!response.ok) continue;

      const text = await response.text();
      if (!text || sessionId !== rtcSessionId) return '';

      try {
        const json = JSON.parse(text);
        return json?.sdp || '';
      } catch {
        return text;
      }
    }

    throw new Error('RTC request failed');
  };

  const startFromUrl = async (rtcUrl: string) => {
    const video = options.getVideoElement();
    if (!video) return;
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error('WebRTC is not supported');
    }

    stop();
    const sessionId = rtcSessionId;
    rtcAbortController = new AbortController();
    rtcPeer = new RTCPeerConnection();
    rtcPeer.addTransceiver('video', { direction: 'recvonly' });
    rtcPeer.addTransceiver('audio', { direction: 'recvonly' });
    rtcPeer.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream();
      if (!event.streams?.length && event.track) {
        stream.addTrack(event.track);
      }
      void attachStream(stream, sessionId);
    };

    const offer = await rtcPeer.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await rtcPeer.setLocalDescription(offer);
    await waitIceComplete(rtcPeer, sessionId);

    const localSdp = rtcPeer.localDescription?.sdp || offer.sdp;
    if (!localSdp) {
      throw new Error('RTC local SDP is empty');
    }

    const answerSdp = await requestAnswer(rtcUrl, localSdp, sessionId);
    if (!answerSdp || sessionId !== rtcSessionId) return;

    await rtcPeer.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp: answerSdp }),
    );
  };

  const play = async (source: string | MediaStream) => {
    if (isMediaStreamValue(source)) {
      await attachStream(source, rtcSessionId);
      return;
    }
    await startFromUrl(source);
  };

  return {
    play,
    stop,
    getPeer: () => rtcPeer,
  };
}

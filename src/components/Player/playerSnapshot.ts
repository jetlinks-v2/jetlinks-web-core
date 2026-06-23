export function captureVideoFrame(
  video: HTMLVideoElement,
  format: 'png' | 'jpeg' | 'webp' = 'png',
  quality?: number,
) {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error('video frame is not ready');
  }
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas context is unavailable');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(`image/${format}`, quality);
}

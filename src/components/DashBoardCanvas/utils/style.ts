import type { CSSProperties } from 'vue'
import type { DashboardCanvasConfig } from '../types'

/** File IDs are resolved by the host; the renderer never imports project-specific request helpers. */
export function getCanvasStyle(canvas: DashboardCanvasConfig, resolveImage?: (fileId: string) => string): CSSProperties {
  const image = canvas.backgroundImage
  const url = image?.url || (image?.fileId ? resolveImage?.(image.fileId) : '')
  const filter = canvas.filter
  return {
    backgroundColor: canvas.backgroundColor,
    backgroundImage: url ? `url(${JSON.stringify(url)})` : undefined,
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    filter: filter ? [
      `hue-rotate(${filter.hue ?? 0}deg)`,
      `saturate(${100 + (filter.saturation ?? 0)}%)`,
      `brightness(${100 + (filter.brightness ?? 0)}%)`,
      `contrast(${100 + (filter.contrast ?? 0)}%)`,
      `opacity(${filter.opacity ?? 100}%)`,
      `grayscale(${filter.grayscale ?? 0}%)`,
    ].join(' ') : undefined,
  }
}

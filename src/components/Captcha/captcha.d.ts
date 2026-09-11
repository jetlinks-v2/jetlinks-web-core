export type CaptchaType = 'SLIDER' | 'ROTATE' | 'CONCAT' | 'WORD_IMAGE_CLICK'

export interface CaptchaConfig {
  imageUrl: string
  validateUrl: string
  requestHeaders?: Record<string, string>
  timeout?: number
  autoRefreshOnFail?: boolean
  onSuccess?: (response: CaptchaValidationSuccess) => void
  onFail?: (response: unknown) => void
}

export interface StyleConfig {
  primaryColor?: string
  bgColor?: string
  i18n?: {
    loading?: string
    success?: string
    fail?: string
    refresh?: string
    retry?: string
    title?: string
    slideTip?: string
    rotateTip?: string
    concatTip?: string
    clickTip?: string
  }
}

export interface CaptchaData {
  id: string
  type: CaptchaType
  backgroundImage: string
  templateImage?: string
  backgroundImageHeight: number
  backgroundImageWidth: number
  templateImageHeight: number
  templateImageWidth: number
  imageWidthScale: number
  tip?: string
  randomX?: number
  randomY?: number
  wordCount?: number
  data?: {
    key?: string
    [key: string]: unknown
  }
}

export interface CaptchaResponse {
  code: number
  msg?: string
  data: CaptchaData
}

export interface ValidationResponse {
  code: number
  msg?: string
  success: boolean
}

export type CaptchaValidationSuccess = string | Record<string, unknown> | true
export type CaptchaValidationResult = CaptchaValidationSuccess | false

export interface Track {
  x: number
  y: number
  t: number
  type: 'down' | 'move' | 'up'
}

export interface TrackData {
  startTime: number
  stopTime: number
  backgroundImageHeight?: number
  backgroundImageWidth?: number
  bgImageHeight?: number
  bgImageWidth?: number
  templateImageHeight?: number
  templateImageWidth?: number
  trackList: Track[]
  data?: string | Track[]
}

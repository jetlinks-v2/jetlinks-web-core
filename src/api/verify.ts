import { Request, request } from '@jetlinks-web/core'

/** 403 校验响应中的 result 结构 */
export interface VerifyRequiredResult {
  type: 'captcha' | 'identity'
  key: string
  disposable: boolean
}

/** 验证码确认请求 */
export interface VerifyCaptchaRequest {
  key: string
  provider: string
  params: Record<string, unknown>
}

export type AltchaCaptchaContext =
  | { key: string; contextToken?: never }
  | { key?: never; contextToken: string }

export interface AltchaCaptchaConfig {
  challengeUrl: string
  prevalidateUrl: string
  contextUrl: string
}

export type AltchaCaptchaChallenge = Record<string, unknown>

export interface AltchaCaptchaProof {
  proof: string
  expiresAt: number
}

export interface AltchaCaptchaRequestOptions {
  signal?: AbortSignal
}

export const isValidAltchaCaptchaProof = (
  proof: AltchaCaptchaProof | undefined
): proof is AltchaCaptchaProof =>
  typeof proof?.proof === 'string' &&
  proof.proof.trim().length > 0 &&
  Number.isFinite(proof.expiresAt) &&
  proof.expiresAt > Date.now()

/** 验证码/校验确认结果 */
export interface VerifyResultResponse {
  token: string
}

/** 身份校验确认请求 */
export interface IdentityVerifyRequest {
  key: string
  provider: string
  requestId?: string
  token?: string
  context?: Record<string, unknown>
  params?: Record<string, string>
}

/** 获取验证码配置（与登录一致，走 CaptchaController） */
export const getVerifyCaptchaConfig = () =>
  request.get<{ result: { enabled: boolean; type: string; types?: string[]; [key: string]: unknown } }>(
    '/authorize/captcha/config', {}, { projectContext: false }
  )

/** 获取验证码图片（与登录一致） */
export const getVerifyCaptchaImage = (params?: { width?: number; height?: number }) =>
  request.get<{ result: { base64: string; key: string } }>(
    `/authorize/captcha/image?width=${params?.width ?? 130}&height=${params?.height ?? 40}`, {}, { projectContext: false }
  )

/** 验证码确认（VerifyController） */
export const confirmCaptcha = (data: VerifyCaptchaRequest) =>
  request.post<{ result: VerifyResultResponse }>('/verify/captcha/_confirm', data, { projectContext: false, withCredentials: true })

const captchaRequestConfig = { projectContext: false, withCredentials: true }

const postCaptchaRequest = <T>(
  url: string,
  data: unknown,
  options?: AltchaCaptchaRequestOptions
) => new Request(url).post<T>('', data, { ...captchaRequestConfig, ...options })

/** Requests a server-bound context before an ALTCHA browser challenge is issued. */
export const createAltchaCaptchaContext = (
  url: string,
  data: { operation: string; target?: string },
  options?: AltchaCaptchaRequestOptions
) => postCaptchaRequest<{ contextToken: string; expiresAt: number }>(url, data, options)

/** Requests an official ALTCHA v2 challenge through the JetLinks response envelope. */
export const getAltchaCaptchaChallenge = (
  url: string,
  data: AltchaCaptchaContext,
  options?: AltchaCaptchaRequestOptions
) => postCaptchaRequest<AltchaCaptchaChallenge>(url, data, options)

/** Exchanges the widget payload for a server-validated, one-time proof. */
export const prevalidateAltchaCaptcha = (
  url: string,
  data: AltchaCaptchaContext & { payload: string },
  options?: AltchaCaptchaRequestOptions
) => postCaptchaRequest<AltchaCaptchaProof>(url, data, options)

/** 身份校验：请求验证（发送短信/邮件等） */
export const requestIdentityVerify = (identityId: string, data: { provider: string; identity: string; params?: Record<string, unknown> }) =>
  request.post<{ result: { requestId: string; token: string; context?: Record<string, unknown>; intervalSeconds?: number } }>(
    `/verify/identity/${identityId}/_request`,
    data, { projectContext: false }
  )

/** 身份校验：确认 */
export const confirmIdentityVerify = (data: IdentityVerifyRequest) =>
  request.post<{ result: VerifyResultResponse }>('/verify/identity/_confirm', data, { projectContext: false })

/** 获取当前用户已绑定的身份列表（用于身份校验选择） */
export const getSelfIdentitiesForVerify = () =>
  request.get<{ result: Array<{ id: string; userId: string; provider: string; identity: string }> }>(
    '/user/identity/_me'
  )

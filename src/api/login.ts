import { Request, ndJson, request } from '@jetlinks-web/core'
import type { AxiosResponseRewrite } from '@jetlinks-web/types'
import { isProjectStorageEnabled } from '@jetlinks-web-core/utils/project-storage'

/**
 * 登录
 * @param data
 * @returns
 */
export const login = (data: any) => request.post('/authorize/login', data)

/**
 * 退出登录
 */
export const logout = () => request.get('/user-token/reset')

/**
 * 获取验证码
 */
export const codeUrl = () => request.get<{ base64: string, key: string }>(`/authorize/captcha/image?width=130&height=30`)

/**
 * 登录加密信息
 * @returns
 */
export const encryptionConfig = () => request.get(`/authorize/login/configs`)

/**
 * 登录加密信息
 * @returns
 */
export const captchaConfig = () => request.get(`/authorize/captcha/config`, {},{ projectContext: false })


/**
 * 登录
 * @returns
 */
export const authLogin = (data: any) => request.post(`/authorize/login`, data)

/**
 * 获取当前登录用户信息
 */
export const userDetail = () => request.get<any>('/user/detail')

/**
 * 查询初始化配置信息
 * @returns
 */
export const getInitSet = () => request.get(`/user/settings/init`)

/**
 * 查看后端配置模块
 */
export const queryModal  = (serviceId:string) => request.get(`/command-supports/service/${serviceId}/exists`)

/**
 * 获取支持的SSO的应用
 * @returns
 */
export const bindInfo = () => request.get(`/application/sso/_all`)

export const getOAuth2 = (params: any) => request.get('/oauth2/authorize', params)

export const initApplication = (clientId: string | number) => request.get<{name: string}>(`/application/${clientId}/info`)

// ---------------------------------------------------------------------------
// 运行时登录页（src/views/login/）专用端点
//
// 登录发生在项目上下文建立之前，因此这些请求统一携带 projectContext: false。
// 既有导出 login / codeUrl / authLogin / bindInfo 仍被 src/views/relogin、
// src/views/oauth、src/views/share/authorize 使用，语义保持不变；这里只按需新增
// 导出，不改动它们的请求行为。
// ---------------------------------------------------------------------------

const userIdentityRequest = new Request('/user/identity')
const subAccountRequest = new Request('/sub-account')
const applicationRequest = new Request('/application')
const loginRequestConfig = { projectContext: false }

/**
 * 登录（不携带项目上下文）
 */
export const loginWithoutProjectContext = (data: any) =>
  request.post('/authorize/login', data, loginRequestConfig)

/**
 * 获取图片验证码（不携带项目上下文）
 */
export const codeUrlWithoutProjectContext = () =>
  request.get<{ base64: string; key: string }>(
    `/authorize/captcha/image?width=130&height=30`,
    {},
    loginRequestConfig
  )

/**
 * 获取支持的 SSO 应用（不携带项目上下文）
 */
export const bindInfoWithoutProjectContext = () =>
  request.get(`/application/sso/_all`, {}, loginRequestConfig)

export interface IdentityProvider {
  id: string
  name: string
  type: string
  properties?: Record<string, any>
}

export interface IdentityResponseResult {
  requestId: string
  token: string
  context: Record<string, any>
}

export interface IdentityRequestParams {
  provider: string
  identity: string
}

export interface IdentityConfirmParams extends IdentityResponseResult {
  params: {
    code?: string
    password?: string
    [key: string]: any
  }
}

/**
 * 获取登录方式
 */
export const getIdentityProviders = () =>
  userIdentityRequest.get<IdentityProvider[]>(`/providers`, {}, loginRequestConfig)

/**
 * 验证邮箱或者手机号等
 */
export const identityRequest = (data: IdentityRequestParams) =>
  userIdentityRequest.post<any>(`/login/_request`, data, loginRequestConfig)

/**
 * 验证码 / 密码确认登录
 */
export const identityConfirm = (data: IdentityConfirmParams) =>
  userIdentityRequest.post<any>(`/login/_confirm`, data, loginRequestConfig)

/**
 * SSO 扫码异步登录（NDJSON 流）
 * @param appId SSO 应用 ID
 * @param forBind 是否用于绑定流程
 */
export const scanLoginAsync = (appId: string, forBind = false) => {
  const query = forBind ? '?forBind=true' : ''
  return ndJson.get(`/application/sso/${appId}/login/_async${query}`)
}

export interface ApplicationSsoLoginResult {
  bound: boolean
  bindCode?: string
  token?: string
  userId?: string
}

/**
 * 微信授权回调后，使用 code 换取登录 token
 * @param appId 应用 ID
 * @param code 微信授权 code
 */
export const notifyApplicationLoginResult = (appId: string, code: string) =>
  applicationRequest.post<ApplicationSsoLoginResult>(`/${appId}/notify-result`, { code }, loginRequestConfig)

export interface SubAccountLoginResult {
  token?: string
  access: {
    accessUrl?: string
    apiUrl?: string
    code?: string
    redirect?: string
    token?: string
  }
  project: {
    code?: string
    id?: string
    name?: string
  }
}

export interface SubAccountLoginResponse extends AxiosResponseRewrite<SubAccountLoginResult> {
  /** 历史响应包装可能把这两个字段放在顶层。 */
  token?: string
  message?: string
}

/**
 * 子账号登录
 */
export const subAccountLogin = (data: { username: string; password: string; projectCode: string; expires?: number }) => {
  // 独立部署下不开放子账号登录，接口边界保持不变。
  if (!isProjectStorageEnabled()) {
    return Promise.reject(new Error('Sub-account login is disabled in standalone mode'))
  }

  // 后端统一包装为 { result: SubAccountLoginResult, status: 200 }
  return subAccountRequest.post<SubAccountLoginResult>('/login', data, loginRequestConfig) as Promise<SubAccountLoginResponse>
}


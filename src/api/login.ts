import { Request, ndJson, request, type NdJsonRequestConfig } from '@jetlinks-web/core'
import type { AxiosResponseRewrite } from '@jetlinks-web/types'
import { isProjectStorageEnabled } from '@jetlinks-web-core/utils/project-storage'

// 登录前尚未确认项目身份，URL 中的应用 ID 不能作为租户域名发送。
const loginRequestConfig = { projectContext: false, tenantDomain: false } as const

/**
 * 登录
 * @param data
 * @returns
 */
export const login = (data: any) => request.post('/authorize/login', data, loginRequestConfig)

/**
 * 退出登录
 */
export const logout = () => request.get('/user-token/reset')

/**
 * 获取验证码
 */
export const codeUrl = () => request.get<{ base64: string, key: string }>(`/authorize/captcha/image?width=130&height=30`, {}, loginRequestConfig)

/**
 * 登录加密信息
 * @returns
 */
export const encryptionConfig = () => request.get(`/authorize/login/configs`, {}, loginRequestConfig)

/**
 * 验证码配置
 * @returns
 */
export const captchaConfig = () => request.get(`/authorize/captcha/config`, {}, loginRequestConfig)


/**
 * 登录
 * @returns
 */
export const authLogin = (data: any) => request.post(`/authorize/login`, data, loginRequestConfig)

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
export const bindInfo = () => request.get(`/application/sso/_all`, {}, loginRequestConfig)

export const getOAuth2 = (params: any) => request.get('/oauth2/authorize', params)

export const initApplication = (clientId: string | number) => request.get<{name: string}>(`/application/${clientId}/info`)

// ---------------------------------------------------------------------------
// 运行时登录页（src/views/login/）专用端点
//
// 登录请求同时跳过本地项目 token / Scope 和租户头；
// 登录成功后由既有流程建立项目或应用上下文。
// ---------------------------------------------------------------------------

const userIdentityRequest = new Request('/user/identity')
const subAccountRequest = new Request('/sub-account')
const applicationRequest = new Request('/application')

/**
 * 登录（不复用本地项目会话和租户头）
 */
export const loginWithoutProjectContext = (data: any) =>
  request.post('/authorize/login', data, loginRequestConfig)

/**
 * 获取图片验证码（不复用本地项目会话和租户头）
 */
export const codeUrlWithoutProjectContext = () =>
  request.get<{ base64: string; key: string }>(
    `/authorize/captcha/image?width=130&height=30`,
    {},
    loginRequestConfig
  )

/**
 * 获取支持的 SSO 应用（不复用本地项目会话和租户头）
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
  // 登录后的账号绑定仍使用当前项目和应用上下文。
  const options: Partial<NdJsonRequestConfig> = forBind ? {} : loginRequestConfig
  return ndJson.get(`/application/sso/${appId}/login/_async${query}`, undefined, options)
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


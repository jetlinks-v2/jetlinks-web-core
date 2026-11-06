import { request } from '@jetlinks-web/core'

/** 主题读取供平台和共用登录页使用，不依赖账号中心的通知或组件注册。 */
export const getThemeStyle_api = () =>
  request.get<{ content: string }>('/user/settings/theme/style', undefined, { applicationScope: false })

/** 沿用当前用户的主题设置接口；账号 API 总出口继续公开同一实现。 */
export const saveThemeStyle_api = (data: { name: string; content: string }) =>
  request.patch('/user/settings/theme/style', data)

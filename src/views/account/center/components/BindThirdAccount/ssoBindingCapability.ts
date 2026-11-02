export interface SsoBindingCapability {
  provider?: string
  features?: string[]
}

/** 未实现重定向的入口仅在已有扫码流程时可从此页面发起绑定。 */
export const canBindSso = (item: SsoBindingCapability): boolean =>
  !item.features?.includes('ssoUnsupportedRedirect')
  || ['wechat-official-account', 'dingtalk-ent-app'].includes(item.provider || '')

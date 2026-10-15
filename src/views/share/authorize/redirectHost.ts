import type { InjectionKey } from 'vue'

/** 可选的授权跳转处理，在保存令牌前校验或转换地址；未注入时沿用服务端返回地址。 */
export const shareRedirectHostKey: InjectionKey<(url: URL) => Promise<URL>> = Symbol('share-redirect-host')

import defaultLoginBackground from '@jetlinks-web-core/assets/login/login-bg.png'
import { isPrivateDeployment } from './deployment'
import { resolvePublicAssetUrl } from './public-asset'

const PRIVATE_LOGIN_BACKGROUND = 'images/login/login.png'
const toCssUrl = (url: string) => `url("${url.replace(/["\\\r\n]/g, '')}")`

/** 登录页和外观预览共用背景优先级；SaaS 历史默认占位图不覆盖模块默认图。 */
export function resolveLoginBackground(background?: string) {
  const privateDeployment = isPrivateDeployment()
  const configured = resolvePublicAssetUrl(background)
  const privateDefault = resolvePublicAssetUrl(PRIVATE_LOGIN_BACKGROUND)
  const custom = !!configured && (privateDeployment || configured !== privateDefault)
  const image = custom ? configured : privateDeployment ? privateDefault : defaultLoginBackground
  return {
    image,
    style: {
      '--login-bg-image': custom ? toCssUrl(image) : `var(--jet-login-bg-image, ${toCssUrl(image)})`,
    },
  }
}

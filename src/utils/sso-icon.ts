import standalone from '@jetlinks-web-core/assets/apply/internal-standalone.png'
import dingtalk from '@jetlinks-web-core/assets/bindPage/dingtalk.png'
import wechat from '@jetlinks-web-core/assets/bindPage/wechat-webapp.png'
import thirdParty from '@jetlinks-web-core/assets/apply/third-party.png'
import wechatMiniapp from '@jetlinks-web-core/assets/apply/wechat-miniapp.png'

/**
 * SSO 应用 provider → 图标。
 *
 * 登录页（`src/views/login/`）的重登录弹窗（`src/views/relogin/`）都要按 provider
 * 渲染 SSO 入口图标，这里统一维护一份，避免两边各存一套资源映射。
 */
export const ssoIconMap = new Map<string, string>([
  ['dingtalk-ent-app', dingtalk],
  ['wechat-webapp', wechat],
  ['internal-standalone', standalone],
  ['third-party', thirdParty],
  ['wechat-miniapp', wechatMiniapp],
])

/** SSO 应用图标缺失时的兜底图，与 provider 无对应关系时使用。 */
export const defaultSsoIcon = standalone

/** 解析一个 SSO 应用的展示图标：优先接口返回的 logoUrl，其次 provider 映射，最后兜底图。 */
export const resolveSsoIcon = (item?: { provider?: string; logoUrl?: string } | null) =>
  item?.logoUrl || ssoIconMap.get(String(item?.provider)) || defaultSsoIcon

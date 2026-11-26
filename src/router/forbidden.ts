import type { LocationQuery } from 'vue-router'
import { APPLICATION_SCOPE_QUERY_KEY } from '@jetlinks-web-core/utils/application-scope'

export const FORBIDDEN_PATH = '/403'
export const NO_MENU_REASON = 'no-menu'

/** 仅保留当前入口，不将来源页面的业务参数或未经验证的拒绝原因转交给 403。 */
export const forbiddenLocation = (query: LocationQuery, noMenu = false) => ({
  path: FORBIDDEN_PATH,
  query: {
    [APPLICATION_SCOPE_QUERY_KEY]: query[APPLICATION_SCOPE_QUERY_KEY],
    ...(noMenu ? { reason: NO_MENU_REASON } : {}),
  },
  replace: true,
})

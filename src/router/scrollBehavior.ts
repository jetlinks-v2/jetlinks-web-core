import type { RouterScrollBehavior } from 'vue-router'

/** 同页筛选/选日只更新 query，不应打断浏览；返回/前进时优先恢复历史位置。 */
export const routeScrollBehavior: RouterScrollBehavior = (to, from, savedPosition) => {
  if (savedPosition) return savedPosition
  if (to.path === from.path && to.hash === from.hash) return false
  return { top: 0 }
}

import type { RouteMeta } from 'vue-router'

export const COMING_SOON_MENU_BADGE_TYPE = 'comingSoon'
export const DEFAULT_COMING_SOON_MENU_BADGE_I18N_KEY = 'layout.menuBadge.comingSoon'

export const isComingSoonMenuMeta = (meta?: RouteMeta) => (
  meta?.menuBadge?.type === COMING_SOON_MENU_BADGE_TYPE
)

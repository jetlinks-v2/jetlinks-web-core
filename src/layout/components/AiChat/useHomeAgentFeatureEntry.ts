import { onActivated, onDeactivated, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import router from '@jetlinks-web-core/router'
import i18n from '@jetlinks-web-core/locales'
import { useAIStore } from '@jetlinks-web-core/store/ai'
import { onlyMessage } from '@jetlinks-web/utils'
import { createFeatureEntryNavigation } from './featureEntryNavigation'

type FeatureEntryNavigation = ReturnType<typeof createFeatureEntryNavigation>
let navigation: FeatureEntryNavigation | undefined

// Router loads business modules that can import this hook before router initialization finishes.
const getNavigation = () => {
  navigation ??= createFeatureEntryNavigation(router, {
    onOpened: () => useAIStore().setDrawer(false),
    onUnavailable: () => onlyMessage(i18n.global.t('components.AiChat.homeAgent.featureEntry.unavailable'), 'warning'),
    onBlocked: () => onlyMessage(i18n.global.t('components.AiChat.homeAgent.featureEntry.blocked'), 'warning'),
  })
  return navigation
}

export const openHomeAgentFeatureEntry: FeatureEntryNavigation['open'] = (...args) => getNavigation().open(...args)

/** Register only UI-opening handlers, with the same availability checks as the actual page control. */
export const useHomeAgentFeatureEntry = (capabilityId: string, open: () => boolean) => {
  const route = useRoute()
  let release: (() => void) | undefined
  const register = () => {
    if (!release) release = getNavigation().register(capabilityId, route.path, open)
  }
  const unregister = () => { release?.(); release = undefined }
  onMounted(register)
  onActivated(register)
  onDeactivated(unregister)
  onUnmounted(unregister)
}

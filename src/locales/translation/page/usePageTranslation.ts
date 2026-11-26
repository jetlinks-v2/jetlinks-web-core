import { computed, onMounted, onScopeDispose, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { builtInLanguage, DEFAULT_LANGUAGE } from '../languages'
import { provideTranslationRuntime } from '../runtime'
import { PageTranslationController } from './controller'
import { PageSourceCatalog } from './source'

/** 保留当前内置词库作为页面原文，并观察 body 以覆盖 Teleport。 */
export function usePageTranslation(activeRoute: () => boolean, isMenuSourceText?: (text: string) => boolean) {
  const { locale, messages } = useI18n({ useScope: 'global' })
  const base = builtInLanguage(locale.value) ?? DEFAULT_LANGUAGE
  const runtime = provideTranslationRuntime()
  const pairs = computed(() => activeRoute() ? runtime.activePairs.value : undefined)
  let controller: PageTranslationController | undefined
  let catalog: PageSourceCatalog | undefined
  let dictionaries: typeof messages.value | undefined

  function prepareOnInteraction(event: MouseEvent): void {
    if (event.isTrusted && navigator.userActivation?.isActive && activeRoute() && !runtime.activePairs.value.length) {
      runtime.preparePendingSupplements()
    }
  }

  onMounted(() => {
    if (base !== DEFAULT_LANGUAGE) window.addEventListener('click', prepareOnInteraction)
    watch(activeRoute, enabled => {
      if (enabled) runtime.resume()
    }, { immediate: true })
    watch(runtime.readyModels, () => controller?.refresh(), { flush: 'post' })

    watch([pairs, messages], ([route, nextMessages]) => {
      controller?.stop()
      controller = undefined
      if (!route || (!route.length && base === DEFAULT_LANGUAGE)) return
      if (!catalog || dictionaries !== nextMessages) {
        catalog = new PageSourceCatalog(nextMessages, isMenuSourceText)
        dictionaries = nextMessages
      }
      const sourceCatalog = catalog
      controller = new PageTranslationController({
        root: document.body,
        route: (text, hint) => {
          if (route.length) return sourceCatalog.isSourceText(text, base, hint) ? route : undefined
          const sourceLanguage = sourceCatalog.supplementSource(text, base, hint)
          if (sourceLanguage) return [{ sourceLanguage, targetLanguage: base }]
        },
        isReady: path => !!route.length || runtime.requireSupplement(path[0]),
        translate: runtime.translate,
      })
    }, { immediate: true, flush: 'post' })
  })

  onScopeDispose(() => {
    window.removeEventListener('click', prepareOnInteraction)
    controller?.stop()
  })
}

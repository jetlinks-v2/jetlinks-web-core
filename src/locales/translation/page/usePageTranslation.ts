import { computed, onMounted, onScopeDispose, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { builtInLanguage, DEFAULT_LANGUAGE } from '../languages'
import { provideTranslationRuntime } from '../runtime'
import { PageTranslationController } from './controller'
import { PageSourceCatalog } from './source'

/** 保留当前内置词库作为页面原文，并观察 body 以覆盖 Teleport。 */
export function usePageTranslation(activeRoute: () => boolean, isMenuSourceText?: (text: string) => boolean) {
  const { locale, messages } = useI18n({ useScope: 'global' })
  const source = builtInLanguage(locale.value) ?? DEFAULT_LANGUAGE
  const runtime = provideTranslationRuntime()
  const pairs = computed(() => activeRoute() ? runtime.activePairs.value : undefined)
  let controller: PageTranslationController | undefined
  let catalog: PageSourceCatalog | undefined
  let dictionaries: typeof messages.value | undefined

  onMounted(() => {
    watch(activeRoute, enabled => {
      if (enabled) runtime.resume()
    }, { immediate: true })

    watch([pairs, messages], ([route, nextMessages]) => {
      controller?.stop()
      controller = undefined
      if (!route?.length) return
      if (!catalog || dictionaries !== nextMessages) {
        catalog = new PageSourceCatalog(nextMessages, isMenuSourceText)
        dictionaries = nextMessages
      }
      const sourceCatalog = catalog
      controller = new PageTranslationController({
        root: document.body,
        isSourceText: (text, hint) => sourceCatalog.isSourceText(text, source, hint),
        translate: (text, signal) => runtime.translate(route, text, signal),
      })
    }, { immediate: true, flush: 'post' })
  })

  onScopeDispose(() => controller?.stop())
}

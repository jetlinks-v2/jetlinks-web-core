import { watch, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ExpressionFunction } from './types'

type Loader = () => Promise<ExpressionFunction[]>
const catalogs = new WeakMap<Loader, ReturnType<typeof createCatalog>>()
function createCatalog() {
  return { functions: shallowRef<ExpressionFunction[]>([]), error: shallowRef(false),
    loadedLocale: undefined as string | undefined, pending: undefined as Promise<void> | undefined }
}
/** 使用者声明目录来源；同一来源共享请求，业务之间不共享声明或权限结果。 */
export function useExpressionFunctions(load: Loader) {
  let catalog = catalogs.get(load)
  if (!catalog) { catalog = createCatalog(); catalogs.set(load, catalog) }
  const state = catalog
  const {locale}=useI18n()
  async function refresh(language: string) {
    while (state.pending) {
      await state.pending
      if (locale.value !== language) return
      if (state.loadedLocale === language) return
    }
    state.error.value = false
    state.pending = load().then(result => {
      if (locale.value === language) { state.functions.value = result; state.loadedLocale = language }
    }, () => { if (locale.value === language) state.error.value = true }).finally(() => { state.pending = undefined })
    return state.pending
  }
  watch(locale, language => { if (state.loadedLocale !== language) void refresh(language) }, { immediate: true })
  return { functions: state.functions, error: state.error, refresh: () => refresh(locale.value) }
}

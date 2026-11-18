import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import { langKey, ruleEditorKey } from '@jetlinks-web-core/utils/consts'
import i18n from './index'

const labels = { zh: '中文', en: 'English', ja: '日本語' }
const dateLocales = { zh: 'zh-cn', en: 'en', ja: 'ja' }
const defaultLanguages = ['zh', 'en', 'ja'] as const
// Accept-Language 缓存的是实际请求语言；单独记录手动偏好，避免把自动回退当作用户选择。
const preferenceKey = 'jetlinks-front-language-preference'

type FrontLanguage = keyof typeof labels

const isFrontLanguage = (value: unknown): value is FrontLanguage => (
  typeof value === 'string' && Object.hasOwn(labels, value)
)

const parseLanguages = (value: unknown): FrontLanguage[] => (
  Array.isArray(value) ? [...new Set(value.filter(isFrontLanguage))] : []
)

export const createFrontLanguageState = (supportsPolicy: () => boolean) => {
  const storage = window.localStorage
  const cached = storage.getItem(langKey)
  const language = ref<FrontLanguage>(isFrontLanguage(cached) ? cached : 'zh')
  const configured = ref<FrontLanguage[]>([])
  const available = computed(() => configured.value.length ? configured.value : defaultLanguages)
  const languageOptions = computed(() => available.value.map(value => ({ value, label: labels[value] })))
  const languageLabel = computed(() => labels[language.value])
  const browserLocale = (navigator.language || 'en').toLocaleLowerCase()

  const syncLanguage = (value: FrontLanguage) => {
    language.value = value
    i18n.global.locale.value = value
    dayjs.locale(dateLocales[value])
    storage.setItem(langKey, value)
    storage.setItem(ruleEditorKey, value)
  }

  const applyFrontLanguages = (value: unknown) => {
    if (!supportsPolicy()) return
    const languages = parseLanguages(value)
    const storedPreference = storage.getItem(preferenceKey)
    const preferred = storedPreference ?? storage.getItem(langKey)
    configured.value = languages

    if (!languages.length) {
      if (storedPreference === null) return
      // 移除配置时恢复手动偏好或原有浏览器默认值，不保留之前的环境回退值。
      storage.removeItem(preferenceKey)
      i18n.global.fallbackLocale.value = browserLocale
      if (isFrontLanguage(preferred)) {
        syncLanguage(preferred)
      } else {
        storage.removeItem(langKey)
        storage.removeItem(ruleEditorKey)
        language.value = 'zh'
        i18n.global.locale.value = browserLocale.split('-')[0] || 'en'
        dayjs.locale(i18n.global.locale.value === 'ja' ? 'ja' : 'zh-cn')
      }
      return
    }

    const browserLanguage = browserLocale.split(/[-_]/)[0]
    const next = isFrontLanguage(preferred) && languages.includes(preferred) ? preferred
      : isFrontLanguage(browserLanguage) && languages.includes(browserLanguage) ? browserLanguage
      : languages[0]

    storage.setItem(preferenceKey, isFrontLanguage(preferred) ? preferred : '')
    i18n.global.fallbackLocale.value = languages
    syncLanguage(next)
  }

  const selectLanguage = (value: unknown) => {
    if (!isFrontLanguage(value) || !available.value.includes(value)) return
    if (supportsPolicy() && storage.getItem(preferenceKey) !== null) {
      storage.setItem(preferenceKey, value)
    }
    if (value === language.value) return
    syncLanguage(value)
    window.location.reload()
  }

  return { language, languageOptions, languageLabel, applyFrontLanguages, selectLanguage }
}

import type {Locale} from 'vue-i18n'
import {createI18n} from 'vue-i18n'
import {langKey} from '@jetlinks-web-core/utils/consts'
import { builtInLanguage } from './translation/languages'

export const createRuntimeI18n = (allModules: Record<string, any>) => {
  function loadLocalesMapFromDir(regexp: RegExp, modules: Record<string, any>) {
    const localesRaw: Record<Locale, Record<string, () => Promise<unknown>>> = {};
    for (const path in modules) {
      const match = path.match(regexp);
      if (match) {
        const [_, locale] = match;
        if (locale) {
          if (!localesRaw[locale]) {
            localesRaw[locale] = {};
          }
          if (modules[path]) {
            localesRaw[locale] = Object.assign(localesRaw[locale], modules[path]?.default);
          }
        }
      }
    }
    return localesRaw;
  }
  const messages = loadLocalesMapFromDir(/([^/]*)\.json$/, allModules);

  const language = (navigator.language || 'en').toLocaleLowerCase() // 这是获取浏览器的语言

  return createI18n({
      legacy: false,
      silentTranslationWarn: true,
      locale: builtInLanguage(localStorage.getItem(langKey)) || builtInLanguage(language) || 'zh',
      // 页面机器翻译只处理已渲染的字符串；无基础词库时不能把 vue-i18n key 当成原文。
      fallbackLocale: builtInLanguage(language) ? language : 'zh',
      messages,
  })
}

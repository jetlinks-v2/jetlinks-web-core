import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../../package.json', import.meta.url))
const vueI18n = require.resolve('vue-i18n')
const vue = require.resolve('vue')
const zh = fileURLToPath(new URL('../../src/locales/lang/zh.json', import.meta.url))
const en = fileURLToPath(new URL('../../src/locales/lang/en.json', import.meta.url))

/** Node 定向测试复用真实语言资源，替代仅由 Vite 处理的 import.meta.glob 装配。 */
export const coreI18nPlugin = () => ({
  name: 'core-i18n-test',
  setup(build) {
    // Hook 测试可替换业务侧 Vue；vue-i18n 自身仍使用完整的真实 Vue 运行时。
    build.onResolve({ filter: /^vue$/ }, args => args.importer.startsWith(dirname(vueI18n))
      ? { path: vue }
      : undefined)
    build.onResolve({ filter: /^@jetlinks-web-core\/locales$/ }, () => ({
      path: 'core-i18n',
      namespace: 'core-i18n-test',
    }))
    build.onLoad({ filter: /.*/, namespace: 'core-i18n-test' }, () => ({
      contents: `
        import { createI18n } from ${JSON.stringify(vueI18n)}
        import zh from ${JSON.stringify(zh)}
        import en from ${JSON.stringify(en)}
        export default createI18n({
          legacy: false, locale: 'zh', fallbackLocale: 'en', messages: { zh, en },
          missingWarn: false, fallbackWarn: false,
        })
      `,
      loader: 'js',
      resolveDir: dirname(zh),
    }))
  },
})

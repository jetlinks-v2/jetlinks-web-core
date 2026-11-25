import { createApp, h } from 'vue'
import { ConfigProvider } from 'ant-design-vue'
import enUS from 'ant-design-vue/es/locale/en_US'
import zh from '../src/locales/lang/zh.json'
import en from '../src/locales/lang/en.json'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { createI18n } from 'vue-i18n'
import Example from '../src/components/Form/examples/FormWorkspaceExample.vue'
import 'ant-design-vue/dist/reset.css'
import '../src/style.css'

const i18n = createI18n({ legacy: false, locale: 'zh', fallbackLocale: 'en', flatJson: true, messages: { zh, en } })
createApp({ render: () => h(ConfigProvider, { locale: i18n.global.locale.value.startsWith('zh') ? zhCN : enUS, autoInsertSpaceInButton: false }, () => h(Example)) })
  .use(i18n).mount('#app')

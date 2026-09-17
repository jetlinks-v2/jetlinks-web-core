import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createI18n } from 'vue-i18n'
import 'ant-design-vue/dist/reset.css'
import Harness from './Harness.vue'
import zh from '../../src/locales/lang/zh.json'
import en from '../../src/locales/lang/en.json'

createApp(Harness)
  .use(Antd)
  .use(createI18n({ legacy: false, locale: 'zh', messages: { zh, en } }))
  .mount('#app')

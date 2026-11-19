import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createI18n } from 'vue-i18n'
import AIcon from '@jetlinks-web/components/es/Icon/index.js'
import 'ant-design-vue/dist/reset.css'
import '../../src/style.css'
import zh from '../../src/locales/lang/zh.json'
import Preview from './Preview.vue'

createApp(Preview)
  .use(Antd)
  .use(createI18n({ legacy: false, locale: 'zh', messages: { zh } }))
  .component('AIcon', AIcon)
  .mount('#app')

import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'
import AIcon from '@jetlinks-web/components/es/Icon/index.js'
import Ellipsis from '@jetlinks-web/components/es/Ellipsis/index.js'
import 'ant-design-vue/dist/reset.css'
import '../../src/style.css'
import zh from '../../src/locales/lang/zh.json'
import Preview from './Preview.vue'
createApp(Preview)
  .use(Antd)
  .use(createI18n({ legacy: false, locale: 'zh', messages: { zh } }))
  .use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] }))
  .component('AIcon', AIcon)
  .component('j-ellipsis', Ellipsis)
  .mount('#app')

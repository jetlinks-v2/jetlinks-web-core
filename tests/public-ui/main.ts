import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import AIcon from '@jetlinks-web/components/es/Icon/index.js'
import Ellipsis from '@jetlinks-web/components/es/Ellipsis/index.js'
import 'ant-design-vue/dist/reset.css'
import '../../src/style.css'
import i18n from './locale'
import Preview from './Preview.vue'
createApp(Preview)
  .use(Antd)
  .use(i18n)
  .use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] }))
  .component('AIcon', AIcon)
  .component('j-ellipsis', Ellipsis)
  .mount('#app')

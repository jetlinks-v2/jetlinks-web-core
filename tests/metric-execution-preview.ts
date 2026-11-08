import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import Antd from 'ant-design-vue'
import { AIcon } from '@jetlinks-web/components'
import Preview from './MetricExecutionPreview.vue'
import 'ant-design-vue/dist/reset.css'
import '../src/style.css'

// Fixed facts exercise production components without transport, accounts or saved configuration changes.
createApp(Preview).use(Antd).use(createI18n({legacy:false,locale:'zh',messages:{zh:{},en:{}},missingWarn:false,fallbackWarn:false}))
  .component('AIcon',AIcon).mount('#app')

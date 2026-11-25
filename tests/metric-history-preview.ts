import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import Antd from 'ant-design-vue'
import { AIcon } from '@jetlinks-web/components'
import Preview from './MetricHistoryPreview.vue'
import zh from '../src/locales/lang/zh.json'
import en from '../src/locales/lang/en.json'
import 'ant-design-vue/dist/reset.css'
import '../src/style.css'

// Deterministic UI fixture: production components, no account, transport, saved configuration or calculation changes.
const iconMessages=(messages:Record<string,string>)=>Object.fromEntries(Object.entries(messages).filter(([key])=>key.startsWith('components.IconValueEditor.')))
createApp(Preview).use(Antd).use(createI18n({ legacy:false, locale:'zh', flatJson:true, messages:{ zh:iconMessages(zh), en:iconMessages(en) }, missingWarn:false, fallbackWarn:false }))
  .component('AIcon',AIcon).mount('#app')

import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import Antd from 'ant-design-vue'
import zh from '../src/locales/lang/zh.json'
import en from '../src/locales/lang/en.json'
import Preview from './RuntimeBufferPreview.vue'
import 'ant-design-vue/dist/reset.css'
import '../src/style.css'
import '../src/style/global.less'
import '../src/components/RuntimeDiagnostics/style.css'

// 独立展示夹具：合成样本，不读取集群、身份或任何诊断端点。
createApp(Preview).use(Antd).use(createI18n({ legacy: false, locale: 'zh', flatJson: true, messages: { zh, en } })).mount('#app')

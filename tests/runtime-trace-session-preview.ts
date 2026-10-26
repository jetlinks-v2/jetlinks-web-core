import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import Antd from 'ant-design-vue'
import zh from '../src/locales/lang/zh.json'
import en from '../src/locales/lang/en.json'
import Preview from './RuntimeTraceSessionPreview.vue'
import 'ant-design-vue/dist/reset.css'
import '../src/style.css'
import '../src/components/RuntimeDiagnostics/style.css'

// 只加载正式展示组件和合成快照，不连接业务接口或读取登录状态。
createApp(Preview).use(Antd).use(createI18n({ legacy: false, locale: 'zh', flatJson: true, messages: { zh, en } })).mount('#app')

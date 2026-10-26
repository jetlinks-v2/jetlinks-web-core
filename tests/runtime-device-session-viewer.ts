import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import { createI18n } from 'vue-i18n'
import zh from '../src/locales/lang/zh.json'
import Preview from './RuntimeDeviceSessionPreview.vue'
import '../src/style.css'
import '../src/components/RuntimeDiagnostics/style.css'
import 'ant-design-vue/dist/reset.css'
createApp(Preview).use(Antd).use(createI18n({ legacy: false, locale: 'zh', flatJson: true, messages: { zh } })).mount('#app')

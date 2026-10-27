import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import Antd from 'ant-design-vue'
import zh from '../src/locales/lang/zh.json'
import en from '../src/locales/lang/en.json'
import hostZh from '../../modules/device-manager-ui/locales/lang/zh.json'
import hostEn from '../../modules/device-manager-ui/locales/lang/en.json'
import Preview from '../../modules/device-manager-ui/tests/RuntimeEdgeTracePreview.vue'
import 'ant-design-vue/dist/reset.css'
import '../src/style.css'
import '../src/components/RuntimeDiagnostics/style.css'

// 合成数据仅验收补全、失败重试和窄屏布局，不连接业务接口或修改登录状态。
createApp(Preview).use(Antd).use(createI18n({ legacy: false, locale: 'zh', flatJson: true, messages: { zh: { ...zh, ...hostZh }, en: { ...en, ...hostEn } } })).mount('#app')

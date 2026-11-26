import { Teleport, computed, createApp, defineComponent, h, reactive } from 'vue'
import { Button, ConfigProvider, Pagination, Popover, Tooltip } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import jaJP from 'ant-design-vue/es/locale/ja_JP'
import { CheckOutlined, DownloadOutlined, GlobalOutlined, LoadingOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons-vue'
import Language from '../src/layout/components/Language.vue'
import { createRuntimeI18n } from '../src/locales/create'
import { createFrontLanguageState } from '../src/locales/frontLanguage'
import { builtInLanguage } from '../src/locales/translation/languages'
import { usePageTranslation } from '../src/locales/translation/page/usePageTranslation'
import zh from '../src/locales/lang/zh.json'
import en from '../src/locales/lang/en.json'
import ja from '../src/locales/lang/ja.json'

export const i18n = createRuntimeI18n({
  'zh.json': { default: { ...zh, 'test.heading': '设备管理' } },
  'en.json': { default: { ...en, 'test.heading': 'Device management' } },
  'ja.json': { default: { ...ja, 'test.heading': '機器管理', 'test.count': '{count}件' } },
})
const systemStore = reactive(createFrontLanguageState(() => true))
export const useFixtureSystemStore = () => systemStore
const state = reactive({
  text: '旧设备文本', review: '复判目标：车辆违停检测。图片中未见任何车辆。',
  modal: false, login: false, mixed: false, exclude: false, foreign: false, translateRegion: false,
})
const componentLocales = { zh: zhCN, en: enUS, ja: jaJP }
const nativeLocale = computed(() => builtInLanguage(i18n.global.locale.value) ?? 'zh')
const menuTitles = { zh: '接入组件', en: 'Access components', ja: '接続コンポーネント' }
Object.assign(globalThis, {
  fixtureState: state,
  fixtureLocales: () => i18n.global.availableLocales,
  fixtureSetFrontLanguages: (languages: string[]) => systemStore.applyFrontLanguages(languages, 'save'),
})

const App = defineComponent({
  setup() {
    usePageTranslation(() => !state.login, () => !systemStore.hasFrontLanguagePolicy, text => text === menuTitles[nativeLocale.value])
    return () => h(ConfigProvider, { locale: componentLocales[nativeLocale.value] }, {
      default: () => [
        h('header', { style: 'display:flex;justify-content:flex-end' }, state.login ? [] : [h(Language)]),
        h('span', { id: 'unmarked-region', title: '区域外设备' }, '区域外设备'),
        h('div', { 'data-translate': state.translateRegion ? '' : undefined }, [
          h('strong', { id: 'marked-region', title: '区域状态' }, '区域状态'),
          h('span', { 'data-no-translate': '' }, h('span', { id: 'excluded-region', 'data-translate': '' }, '保护区域')),
        ]),
        h('main', { 'data-translate': '' }, [
          h('h1', { id: 'heading' }, i18n.global.t('test.heading')),
          h('nav', { id: 'access-menu' }, menuTitles[nativeLocale.value]),
          h('p', { id: 'resource-statistic' }, '功耗分布'),
          h('strong', { id: 'review', title: state.review }, state.review),
          h('div', { 'data-no-translate': '' }, h('span', { id: 'gateway', title: '测试网关' }, '测试网关')),
          state.foreign ? h('div', [
            h('p', { id: 'foreign-en' }, 'The gateway is offline.'),
            h('p', { id: 'hinted-zh', 'data-translation-source': 'zh' }, '管理'),
            h('p', { id: 'hinted-ja', 'data-translation-source': 'ja' }, '管理'),
          ]) : null,
          h('p', { id: 'dynamic' }, state.text),
          h('input', { id: 'input', value: '机房输入值', placeholder: '搜索设备' }),
          h('select', { id: 'select' }, [h('option', '表单原值')]),
          h('span', { id: 'identifier' }, 'DEVICE-01'),
          h('span', { id: 'editable', contenteditable: 'true' }, '编辑区内容'),
          h('div', { id: 'opt-out', 'data-no-translate': state.exclude ? '' : undefined }, '可关闭翻译'),
          state.mixed ? h('div', [
            h('p', { id: 'mixed-en' }, 'Device offline'),
            h('p', { id: 'mixed-ja', 'data-translation-source': 'ja' }, '通信機器'),
            h('p', { id: 'mixed-zh', 'data-translation-source': 'zh-CN' }, '网关异常'),
          ]) : null,
          h(Pagination, { id: 'pagination', total: 50 }),
          h('p', { id: 'offscreen', style: 'margin-top:1300px' }, '离屏内容'),
        ]),
        state.modal ? h(Teleport, { to: 'body' }, h('div', {
          id: 'modal', 'data-translate': '', style: 'position:fixed;left:16px;top:210px',
        }, '设备详情')) : null,
      ],
    })
  },
})

const icons = { CheckOutlined, DownloadOutlined, GlobalOutlined, LoadingOutlined, ReloadOutlined, StopOutlined }
const app = createApp(App)
app.component('AButton', Button)
app.component('APopover', Popover)
app.component('ATooltip', Tooltip)
app.component('AIcon', defineComponent({
  props: { type: { type: String, required: true } },
  setup: props => () => h(icons[props.type as keyof typeof icons]),
}))
app.use(i18n).mount('#app')

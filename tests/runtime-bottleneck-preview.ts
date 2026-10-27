import { createApp, computed, h, ref } from 'vue'
import Antd, { Button, Radio, Space } from 'ant-design-vue'
import { createI18n } from 'vue-i18n'
import Hints from '../../modules/device-manager-ui/views/link/diagnostics/diagnosis/NodeBottleneckHints.vue'
import type { Bottleneck } from '../../modules/device-manager-ui/views/link/diagnostics/diagnosis/bottleneckRules'
import zh from '../../modules/device-manager-ui/locales/lang/zh.json'
import en from '../../modules/device-manager-ui/locales/lang/en.json'
import '../src/style.css'
import 'ant-design-vue/dist/reset.css'

const i18n = createI18n({ legacy: false, locale: 'zh', flatJson: true, messages: { zh, en } })
const samples: Bottleneck[] = [
  { key: 'write', message: 'RuntimeMonitor.bottleneck.queueFailures', values: { name: '设备数据持久化缓冲队列-timescale-db-things-writer', count: 128 }, priority: 10, observedAt: Date.now(), target: { tool: 'mbean', bean: 'org.jetlinks:type=PersistenceBuffer,name=timescale-db-things-writer' } },
  { key: 'backlog', message: 'RuntimeMonitor.bottleneck.queueBacklog', values: { name: 'MediaDeviceService_syncMediaDeviceState_设备媒体状态同步缓冲队列' }, priority: 20, observedAt: Date.now(), target: { tool: 'mbean', bean: 'org.jetlinks:type=PersistenceBuffer,name=MediaDeviceService_syncMediaDeviceState' } },
  { key: 'heap', message: 'RuntimeMonitor.bottleneck.heap', priority: 40, observedAt: Date.now(), target: { tool: 'jvm' } },
  { key: 'cpu', message: 'RuntimeMonitor.bottleneck.applicationCpu', priority: 50, observedAt: Date.now(), target: { tool: 'jvm' } },
  { key: 'load', message: 'RuntimeMonitor.bottleneck.hostLoad', priority: 52, observedAt: Date.now(), target: { tool: 'overview' } },
]
createApp({ setup() {
  const mode = ref('current'), location = ref(''), restricted = ref(false)
  const issues = computed(() => mode.value === 'normal' ? [] : samples.map(value => ({ ...value, retained: mode.value === 'retained' })))
  return () => h('main', { style: 'max-width:1120px;margin:24px auto;padding:0 16px;color:var(--ink-1);' }, [
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:20px' }, [
      h('strong', '瓶颈提示组件验收 · 测试数据'),
      h(Space, { wrap: true }, { default: () => [
        h(Radio.Group, { value: mode.value, size: 'small', 'onUpdate:value': value => mode.value = value }, { default: () => ['current', 'retained', 'normal'].map((value, index) => h(Radio.Button, { value }, { default: () => ['当前异常', '上次观测', '正常'][index] })) }),
        h(Button, { size: 'small', onClick: () => restricted.value = !restricted.value }, { default: () => restricted.value ? '恢复动作权限' : '模拟动作无权限' }),
        h(Button, { size: 'small', onClick: () => i18n.global.locale.value = i18n.global.locale.value === 'zh' ? 'en' : 'zh' }, { default: () => '中文 / English' }),
      ] }),
    ]),
    h('section', { style: 'background:var(--bg-base,#fff);padding:16px;min-height:380px;' }, [
      h('div', { style: 'display:flex;gap:16px;font-weight:500;margin-bottom:16px;border-bottom:1px solid var(--line);padding-bottom:12px' }, ['iot-service:8200', '概览']),
      h(Hints, { issues: issues.value, access: { jvm: !restricted.value, monitor: !restricted.value, query: !restricted.value }, onInspect: target => location.value = `${target.tool}${target.bean ? ' · ' + target.bean : ''}` }),
      h('div', { style: 'height:180px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--ink-3);background:var(--bg-sunken,#fafafa)' }, '趋势内容区（占位）'),
      h('p', { role: 'status', style: 'font-size:12px;color:var(--ink-2);overflow-wrap:anywhere;margin-top:12px' }, location.value ? `排查入口事件：${location.value}` : '点击正式组件中的排查入口，检查事件目标。'),
    ]),
  ])
} }).use(Antd).use(i18n).mount('#app')

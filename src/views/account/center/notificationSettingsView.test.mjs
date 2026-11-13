import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createRenderer, defineComponent, h, nextTick, ref } from 'vue'

const require = createRequire(import.meta.url)
const directory = fileURLToPath(new URL('.', import.meta.url))
const fixtureKey = '__notificationSettingsViewFixture'
const bundle = await build({
  entryPoints: [directory + 'components/Subscribe/index.vue'], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue'],
  plugins: [{ name: 'notification-view-boundaries', setup(builder) {
    builder.onResolve({ filter: /^\.\/useNotificationSettings$/ }, () => ({ path: 'hook', namespace: 'fixture' }))
    builder.onResolve({ filter: /^\.\/components\/Unsubscribe\.vue$/ }, () => ({ path: 'binding', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: path === 'hook'
      ? `export const useNotificationSettings=()=>globalThis.${fixtureKey}`
      : 'export default {}' }))
    builder.onLoad({ filter: /\.vue$/ }, ({ path }) => {
      const { descriptor, errors } = parse(readFileSync(path, 'utf8'), { filename: path })
      assert.deepEqual(errors, [])
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts' }
    })
  }}],
})
const mod = new Module(directory + 'notification-view-fixture.cjs')
mod.filename = directory + 'notification-view-fixture.cjs'
mod.paths = require.resolve.paths('vue')
mod._compile(bundle.outputFiles[0].text, mod.filename)

function node(type, text = '') { return { type, text, props: {}, children: [], parent: null } }
const renderer = createRenderer({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
    target.parent = parent
  },
  remove(target) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
})
const Table = defineComponent({
  props: ['columns', 'dataSource'],
  setup(props, { slots }) { return () => h('table-boundary', [
    ...props.columns.map(column => h('heading', { column: column.key }, slots.headerCell?.({ column }))),
    ...props.dataSource.map(record => h('row', { provider: record.provider }, props.columns.map(column => h('cell', { column: column.key }, slots[column.key]?.(record))))),
  ]) },
})
const Slot = defineComponent({ setup(_props, { slots }) { return () => h('wrapper', Object.values(slots).flatMap(slot => slot?.() || [])) } })
const Tooltip = defineComponent({ props: ['title'], setup(props, { slots }) { return () => h('tooltip-boundary', { title: props.title }, slots.default?.()) } })
const Button = defineComponent({ inheritAttrs: false, props: ['disabled'], setup(props, { slots, attrs }) { return () => h('button', { ...attrs, disabled: props.disabled }, slots.default?.()) } })
const Checkbox = defineComponent({ inheritAttrs: false, props: { checked: Boolean, disabled: Boolean }, emits: ['change'], setup(props, { emit, attrs }) { return () => h('checkbox-boundary', { checked: props.checked, disabled: props.disabled, ariaLabel: attrs['aria-label'], change: value => emit('change', { target: { checked: value } }) }) } })
const Spin = defineComponent({ props: { spinning: Boolean }, setup(props, { slots }) { return () => h('spin-boundary', { spinning: props.spinning }, slots.default?.()) } })
const Icon = defineComponent({ props: ['type'], setup(props) { return () => h('icon-boundary', { icon: props.type }) } })
const Modal = defineComponent({ props: { open: Boolean }, setup(props, { slots }) { return () => props.open ? h('modal-boundary', slots.default?.()) : null } })
function all(target, predicate) { return [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))] }
function text(target) { return target.type === 'comment' ? '' : target.text + target.children.map(text).join('') }

test('通知设置使用复选框，动态渠道图标、禁用状态和保存事件相互对应', async t => {
  const calls = [], emitted = []
  const icons = { 'inside-mail': 'InboxOutlined', 'notifier-email': 'MailOutlined', 'notifier-dingTalk': 'DingdingOutlined', 'notifier-weixin': 'WechatOutlined', 'notifier-voice': 'PhoneOutlined', 'notifier-sms': 'MessageOutlined', 'notifier-webhook': 'ApiOutlined' }
  const types = Object.keys(icons)
  const channel = { id: 'site', name: '站内信' }
  const unavailableChannel = { id: 'voice', name: '语音通知' }
  const checked = ref(true)
  const saving = ref('')
  globalThis[fixtureKey] = {
    providers: ref([{ provider: 'alarm', matrixKey: 'alarm' }]), displayedTypes: ref(types), tableColumns: ref([{ key: 'topic' }, ...types.map(key => ({ key }))]),
    loading: ref(false), failed: ref(false), saving, pendingBinding: ref(), recipientsFailed: ref(false), recipientsLoading: ref(false),
    matrixRowNames: ref({ alarm: '告警' }), channelLabel: type => type, channelIcon: type => icons[type], receiverSummary: type => type, receiverStatus: () => '状态',
    channelHeaderAction: type => type === 'notifier-email' ? 'email' : type === 'notifier-dingTalk' ? 'configure' : undefined,
    openChannelSettings: type => calls.push(['configure', type]),
    matrixCells: (provider, type) => {
      if (provider !== 'alarm') return []
      if (type === 'inside-mail') return [{ channel, checked: checked.value, unavailable: '', saving: saving.value === 'alarm:site' }]
      if (type === 'notifier-voice') return [{ channel: unavailableChannel, checked: false, unavailable: '渠道不可用', saving: false }]
      return []
    },
    toggleMatrixChannel: (...args) => calls.push(['toggle', ...args]), unavailableType: () => '未配置',
    load() {}, loadRecipients() {}, bindingComplete() {}, canBindReceiver: () => false, beginReceiverBinding() {},
  }
  const root = node('root')
  const app = renderer.createApp({ render: () => h(mod.exports.default, { canEditProfile: true, onEditContact: target => emitted.push(target) }) })
  app.config.globalProperties.$t = key => key
  app.component('j-pro-table', Table).component('SectionCard', Slot).component('a-tooltip', Tooltip)
    .component('a-typography-text', Slot).component('a-typography-paragraph', Slot).component('a-spin', Spin).component('a-space', Slot)
    .component('a-button', Button).component('a-checkbox', Checkbox).component('AIcon', Icon)
    .component('a-alert', Slot).component('CloudEmpty', Slot).component('a-modal', Modal)
  app.mount(root)
  t.after(() => { app.unmount(); delete globalThis[fixtureKey] })
  await nextTick()
  assert.equal(all(root, item => item.type === 'table-boundary').length, 1)
  assert.deepEqual(all(root, item => item.type === 'heading').map(item => item.props.column), ['topic', ...types])
  const headings = all(root, item => item.type === 'heading')
  for (const type of types) {
    const header = headings.find(item => item.props.column === type)
    const iconsInHeader = all(header, item => item.type === 'icon-boundary')
    assert.equal(iconsInHeader[0].props.icon, icons[type])
    assert.equal(all(header, item => item.props.class === 'notification-settings__channel-icon')[0].props['aria-hidden'], 'true')
  }
  assert.equal(all(headings.find(item => item.props.column === 'inside-mail'), item => item.type === 'tooltip-boundary')[0].props.title, undefined)
  assert.equal(all(headings.find(item => item.props.column === 'notifier-email'), item => item.type === 'tooltip-boundary')[0].props.title, 'notifier-email')
  assert.equal(text(all(root, item => item.type === 'cell' && item.props.column === 'topic')[0]), '告警')
  const checkboxes = all(root, item => item.type === 'checkbox-boundary')
  assert.equal(checkboxes.length, types.length)
  assert.equal(checkboxes[0].props.checked, true)
  assert.equal(checkboxes[0].props.ariaLabel, '告警 · inside-mail')
  assert.equal(checkboxes[1].props.disabled, true)
  assert.equal(checkboxes[4].props.disabled, true)
  const voiceCell = all(root, item => item.type === 'cell' && item.props.column === 'notifier-voice')[0]
  assert.equal(all(voiceCell, item => item.type === 'tooltip-boundary')[0].props.title, '渠道不可用')
  const emailCell = all(root, item => item.type === 'cell' && item.props.column === 'notifier-email')[0]
  assert.equal(all(emailCell, item => item.type === 'tooltip-boundary')[0].props.title, '未配置')
  checkboxes[0].props.change(false)
  assert.deepEqual(calls[0], ['toggle', 'alarm', channel, false])
  checked.value = false
  await nextTick()
  assert.equal(all(root, item => item.type === 'checkbox-boundary')[0].props.checked, false)
  all(root, item => item.type === 'checkbox-boundary')[0].props.change(true)
  assert.deepEqual(calls[1], ['toggle', 'alarm', channel, true])
  saving.value = 'alarm:site'
  await nextTick()
  assert.equal(all(root, item => item.type === 'checkbox-boundary')[0].props.disabled, true)
  assert.ok(all(root, item => item.type === 'spin-boundary').some(item => item.props.spinning))
  saving.value = ''
  await nextTick()
  const buttons = all(root, item => item.type === 'button')
  buttons.find(item => text(item) === 'PersonalCenter.notificationFillContact').props.onClick({ stopPropagation() {} })
  buttons.find(item => text(item) === 'PersonalCenter.goConfigure').props.onClick({ stopPropagation() {} })
  assert.deepEqual(emitted, ['email-section'])
  assert.deepEqual(calls[2], ['configure', 'notifier-dingTalk'])
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createRenderer, defineComponent, h, nextTick, onMounted, reactive, ref, watch } from 'vue'

const require = createRequire(import.meta.url)
const directory = fileURLToPath(new URL('.', import.meta.url))
const fixtureKey = '__messageCenterViewFixture'
const fixtures = {
  'vue-i18n': 'export const useI18n=()=>({t:ctx.t,locale:ctx.locale})',
  '@jetlinks-web/hooks': 'export const useRouterParams=()=>({params:ctx.params,clear:()=>{ctx.params.value={}}})',
  '@jetlinks-web/utils': 'export const onlyMessage=(...args)=>ctx.messages.push(args);export const randomString=()=>"fixture"',
  '@jetlinks-web-core/locales': 'export default {global:{t:key=>key}}',
  '@jetlinks-web-core/store/user': 'export const useUserStore=()=>ctx.user',
  '@jetlinks-web-core/api/account/notificationRecord': [
    'getList_api', 'changeStatus_api',
  ].map(name => 'export const '+name+'=(...args)=>ctx.request('+JSON.stringify(name)+',args)').join('\n'),
  '@jetlinks-web-core/layout/components/noticeTextResolver': 'export const resolveNoticeTexts=async records=>records',
  '@jetlinks-web-core/components/ConditionFilter': 'export default {props:["modelValue","fields","commonFields"],emits:["update:modelValue","change"],setup(p,{emit}){return()=>require("vue").h("filter",{fields:p.fields,terms:p.modelValue,submit:(terms,filter)=>{emit("update:modelValue",terms);emit("change",{terms,filter,where:""})}})}}',
  'view-dialog': 'export default {props:[\"data\"],setup(p){return()=>require(\"vue\").h(\"detail\",{id:p.data.id})}}',
}

const bundle = await build({
  entryPoints: [directory + 'components/StationMessage/components/NotificationRecord/index.vue'],
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue', 'dayjs'],
  plugins: [{
    name: 'message-center-view-boundaries',
    setup(builder) {
      builder.onResolve({ filter: /^@jetlinks-web-core\/components\/ConditionFilter\/utils$/ }, () => ({
        path: fileURLToPath(new URL('../../../components/ConditionFilter/utils.ts', import.meta.url)),
      }))
      builder.onResolve({ filter: /.*/ }, ({ path }) => {
        if (path === './components/ViewDialog.vue') return { path: 'view-dialog', namespace: 'fixture' }
        if (Object.hasOwn(fixtures, path)) return { path, namespace: 'fixture' }
      })
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
        contents: 'const ctx=globalThis.' + fixtureKey + ';\n' + fixtures[path],
      }))
      builder.onLoad({ filter: /\.vue$/ }, ({ path }) => {
        const { descriptor, errors } = parse(readFileSync(path, 'utf8'), { filename: path })
        assert.deepEqual(errors, [])
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts' }
      })
    },
  }],
})

function node(type, text = '') { return { type, text, props: {}, children: [], parent: null } }
const renderer = createRenderer({
  createElement: type => node(type),
  createText: text => node('text', text),
  createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text },
  setElementText: (target, text) => { target.text = text; target.children = [] },
  patchProp: (target, key, _old, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target)
    target.parent = parent
  },
  remove(target) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    target.parent = null
  },
  parentNode: target => target.parent,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
})
const flush = async () => { await new Promise(setImmediate); await nextTick() }
function all(target, predicate) {
  return [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))]
}
function textContent(target) {
  return target.type === 'comment' ? '' : target.text + target.children.map(textContent).join('')
}

const ProTable = defineComponent({
  props: ['columns', 'request', 'params', 'defaultParams', 'rowSelection'],
  setup(props, { slots, expose }) {
    const rows = ref([])
    const reload = async () => {
      const params = {
        pageIndex: 0, pageSize: 12, ...props.defaultParams, ...props.params,
        terms: [...(props.defaultParams?.terms || []), ...(props.params?.terms || [])],
      }
      const response = await props.request(params)
      rows.value = response.result.data
    }
    onMounted(reload)
    watch(() => props.params, reload, { deep: true })
    expose({ reload })
    return () => h('table', { select: keys => props.rowSelection.onChange(keys) }, [
      slots.headerLeftRender?.(),
      slots.headerRightRender?.(),
      ...rows.value.map(record => h('row', { id: record.id }, [
        slots.state?.(record),
        slots.topicProvider?.(record),
        slots.message?.(record),
        slots.notifyTime?.(record),
        slots.action?.(record),
      ])),
    ])
  },
})

function mountRecord(t) {
  const labels = {
    'PersonalCenter.messageTitle': '标题',
    'PersonalCenter.messageContent': '消息内容',
    'PersonalCenter.messageType': '消息类型',
    'NotificationRecord.index.803553-1': '标为未读',
    'NotificationRecord.index.803553-2': '标为已读',
    'NotificationRecord.index.803553-3': '查看',
    'NotificationRecord.index.803553-7': '状态',
    'NotificationRecord.index.803553-8': '未读',
    'NotificationRecord.index.803553-9': '已读',
  }
  const fixture = {
    calls: [], messages: [], locale: ref('zh'), params: ref({}),
    user: reactive({ messageInfo: {}, alarmUpdateCount: 0, updateAlarm() { this.alarmUpdateCount++ } }),
    t: (key, values) => key === 'PersonalCenter.messageSelected'
      ? '已选 ' + values.count + ' 条'
      : labels[key] || key,
  }
  fixture.request = async (method, args) => {
    fixture.calls.push({ method, args })
    if (method === 'getList_api') return { success: true, result: { data: [
      {
        id: 'notice-1', topicProvider: 'alarm-device', topicName: '设备告警',
        state: { value: 'unread', text: '未读' }, notifyTime: 1700000000000,
        detail: { title: '烟感异常', summary: '一号楼传感器告警' }, message: '一号楼传感器告警',
      },
    ], total: 1 } }
    return { success: true, status: 200 }
  }
  globalThis[fixtureKey] = fixture
  const mod = new Module(directory + 'message-view.cjs')
  mod.filename = directory + 'message-view.cjs'
  mod.paths = require.resolve.paths('vue')
  mod._compile(bundle.outputFiles[0].text, mod.filename)
  const root = node('root')
  const app = renderer.createApp(mod.exports.default, {
    category: 'notification',
    children: [{ provider: 'alarm-device', name: '设备告警', type: { id: 'alarm', name: '告警通知' } }],
  })
  app.config.globalProperties.$t = fixture.t
  app.component('j-pro-table', ProTable)
  app.component('j-badge-status', defineComponent({
    props: ['text'], setup: props => () => h('badge', props.text),
  }))
  app.component('a-button', defineComponent({
    emits: ['click'], setup: (_props, { slots, emit }) => () => h('button', { onClick: () => emit('click') }, slots.default?.()),
  }))
  for (const [name, type] of [['a-space', 'space'], ['a-tag', 'tag'], ['j-ellipsis', 'ellipsis'], ['a-popconfirm', 'popconfirm']]) {
    app.component(name, defineComponent({ setup: (_props, { slots }) => () => h(type, slots.default?.()) }))
  }
  app.component('a-alert', defineComponent({ setup: () => () => h('alert') }))
  app.component('CloudEmpty', defineComponent({ setup: () => () => h('empty') }))
  app.mount(root)
  t.after(() => { app.unmount(); delete globalThis[fixtureKey] })
  return { root, fixture }
}

test('真实消息行展示状态、类型、标题摘要，并仅对选中项执行批量已读', async t => {
  const { root, fixture } = mountRecord(t)
  await flush()
  const firstQuery = fixture.calls.find(call => call.method === 'getList_api').args[0]
  assert.deepEqual(firstQuery.terms, [
    { column: 'topicProvider', termType: 'in', value: ['alarm-device'] },
  ])
  const filter = all(root, item => item.type === 'filter')[0]
  assert.deepEqual(filter.props.fields.map(field => field.dataIndex), ['message', 'topicProvider', 'state', 'notifyTime'])
  assert.deepEqual(filter.props.fields.find(field => field.dataIndex === 'notifyTime').search.options.map(option => option.value), ['today', '7', '30'])
  assert.deepEqual(filter.props.terms, [])
  const selectedTerms = [{ column: 'state', termType: 'eq', value: 'read' }]
  filter.props.submit(selectedTerms, { terms: selectedTerms })
  await flush()
  assert.equal(fixture.calls.filter(call => call.method === 'getList_api').at(-1).args[0].terms.some(term => term.column === 'state' && term.value === 'read'), true)
  filter.props.submit([], { terms: [] })
  await flush()
  const latestQuery = fixture.calls.filter(call => call.method === 'getList_api').at(-1).args[0]
  assert.equal(latestQuery.terms.some(term => term.column === 'state'), false)
  const row = all(root, item => item.type === 'row')[0]
  assert.match(textContent(row), /未读/)
  assert.match(textContent(row), /告警通知/)
  assert.match(textContent(row), /烟感异常/)
  assert.match(textContent(row), /一号楼传感器告警/)

  const view = all(row, item => item.type === 'button' && textContent(item) === '查看')[0]
  view.props.onClick()
  await flush()
  assert.equal(all(root, item => item.type === 'detail')[0].props.id, 'notice-1')
  assert.equal(fixture.calls.some(call => call.method === 'changeStatus_api'), false)

  all(root, item => item.type === 'table')[0].props.select(['notice-1'])
  await nextTick()
  assert.match(textContent(root), /已选 1 条/)
  const markRead = all(root, item => item.type === 'button' && textContent(item) === '标为已读')[0]
  markRead.props.onClick()
  await flush()
  assert.deepEqual(fixture.calls.find(call => call.method === 'changeStatus_api').args, ['_read', ['notice-1']])
  assert.equal(fixture.user.alarmUpdateCount, 1)
})

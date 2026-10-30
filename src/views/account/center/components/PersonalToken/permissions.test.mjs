import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { compileScript, parse } from 'vue/compiler-sfc'
import { build } from 'esbuild'
import { createRenderer, defineComponent, h, nextTick, reactive } from 'vue'

const require = createRequire(import.meta.url)
const moduleRoot = new URL('../../../../../../', import.meta.url)
const rootPath = fileURLToPath(moduleRoot)
const apiPath = fileURLToPath(new URL('src/api/account/center.ts', moduleRoot))
const contextKey = '__tokenPermissionModeFixture'
const fixtures = {
  '@jetlinks-web-core/locales': 'export default {global:{t:(key,args)=>args?key+":"+args.count:key}}',
  'vue-i18n': 'export const useI18n=()=>({t:(key,args)=>args?key+":"+args.count:key})',
  '@jetlinks-web-core/api/system/permission': 'export const queryPermission_api=data=>ctx.query(data)',
  '@jetlinks-web/core': 'export const request={post:(...args)=>ctx.post(...args)};export const ndJson={get(){throw Error("Unexpected SSO request")}}',
  '@jetlinks-web/utils': 'export const randomString=()=>"generated-source";export const onlyMessage=(...args)=>ctx.messages.push(args)',
}
const bundled = await build({
  stdin: {
    contents: "export {default as PermissionSelector} from './src/views/account/center/components/PersonalToken/components/PermissionSelector.vue';export {useTokenDialog} from './src/views/account/center/components/PersonalToken/components/useTokenDialog';export * from './src/views/account/center/components/PersonalToken/permissionMode';",
    resolveDir: rootPath, loader: 'ts',
  },
  bundle: true, write: false, format: 'cjs', platform: 'node', external: ['vue', '@vueuse/core'],
  plugins: [{ name: 'permission-mode-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => {
      if (args.path === '@jetlinks-web-core/api/account/center') return { path: apiPath }
      if (fixtures[args.path]) return { path: args.path, namespace: 'fixture' }
    })
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
      contents: 'const ctx=globalThis.'+contextKey+';\n'+fixtures[path],
    }))
    builder.onLoad({ filter: /\.vue$/ }, ({ path }) => {
      const { descriptor, errors } = parse(readFileSync(path, 'utf8'), { filename: path })
      assert.deepEqual(errors, [])
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts' }
    })
  }}],
})

const definitions = [
  { id: 'device', name: '设备', actions: [{ action: 'query', name: '查询' }, { action: 'save', name: '保存' }] },
  { id: 'ai-alarm', name: 'AI告警', actions: [{ action: 'query', name: '查询' }, { action: 'save', name: '保存' }, { action: 'delete', name: '删除' }] },
  { id: 'command', name: '指令', actions: [{ action: 'execute', name: '执行' }] },
  { id: 'empty', name: '无操作资源', actions: [] },
]
const oldScope = [{ id: 'device', actions: ['query'] }, { id: 'retired', actions: ['save'] }]
const inherited = [{ id: '*', actions: ['*'] }]
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const flush = async () => { await new Promise(setImmediate); await nextTick() }
const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
const renderer = createRenderer({
  createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
  setText: (target, text) => { target.text = text },
  setElementText: (target, text) => { target.text = text; target.children = [] },
  patchProp: (target, key, _previous, value) => { target.props[key] = value },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target); target.parent = parent
  },
  remove(target) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null },
  parentNode: target => target.parent,
  nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
})
function find(target, predicate) {
  if (!target) return
  if (predicate(target)) return target
  for (const child of target.children) { const value = find(child, predicate); if (value) return value }
}
const textContent = target => !target || target.type === 'comment' ? '' : target.text + target.children.map(textContent).join('')
const tags = target => !target ? [] : target.type === 'tag' ? [textContent(target)] : target.children.flatMap(tags)

function mountDialog(t, options = {}) {
  const fixture = { queries: [], posts: [], messages: [] }
  fixture.query = params => {
    fixture.queries.push(params)
    if (options.query) return options.query(params, fixture.queries.length)
    const keyword = params.terms?.[0]?.value.slice(1, -1)
    return Promise.resolve({ success: true, result: definitions.filter(item => !keyword || item.name.includes(keyword)) })
  }
  fixture.post = (...args) => { fixture.posts.push(args); return Promise.resolve({ success: true, result: { accessToken: 'fixture-only-token' } }) }
  globalThis[contextKey] = fixture
  const compiled = new Module(rootPath+'permission-mode-fixture.cjs')
  compiled.paths = require.resolve.paths('vue')
  compiled._compile(bundled.outputFiles[0].text, rootPath+'permission-mode-fixture.cjs')
  delete globalThis[contextKey]
  const mode = options.mode || 'edit'
  const props = reactive({
    visible: true, mode,
    token: mode === 'add' ? null : {
      id: 'old-token', name: '测试', expires: -1, sourceType: 'account-center', sourceId: 'original-source',
      scope: structuredClone(options.scope ?? { permissions: oldScope }),
    },
  })
  let dialog
  const root = node('root')
  const app = renderer.createApp({ setup() {
    dialog = compiled.exports.useTokenDialog(props, () => {})
    dialog.formRef.value = { validate: async () => {}, clearValidate() {} }
    if (mode === 'add') { dialog.formData.value.name = '新增'; dialog.formData.value.expires = -1; dialog.handleExpireTypeChange(-1); dialog.expireType.value = -1 }
    return () => h(compiled.exports.PermissionSelector, {
      value: dialog.formData.value.scope, disabled: mode === 'view', busy: dialog.loading.value,
      'onUpdate:value': scope => { dialog.formData.value.scope = scope },
      'onReady-change': ready => { dialog.permissionsReady.value = ready },
    })
  } })
  app.config.globalProperties.$t = (key, args) => args ? key+':'+args.count : key
  app.component('a-input-search', defineComponent({
    props: ['value', 'disabled'], emits: ['search'],
    setup: (props, { emit }) => () => h('search', { disabled: props.disabled, onSearch: value => emit('search', value) }),
  }))
  app.component('a-radio-group', defineComponent({
    props: ['value'], emits: ['change'],
    setup: (props, { emit, slots }) => () => h('mode-group', { value: props.value, onChange: value => emit('change', { target: { value } }) }, slots.default?.()),
  }))
  app.component('a-radio-button', defineComponent({ props: ['value', 'disabled'], setup: (props, { slots }) => () => h('mode', { value: props.value, disabled: props.disabled }, slots.default?.()) }))
  app.component('a-checkbox', defineComponent({
    props: ['checked', 'disabled', 'indeterminate'], emits: ['change'],
    setup: (props, { emit, slots, attrs }) => () => h('checkbox', {
      ...attrs, checked: props.checked, disabled: props.disabled, indeterminate: props.indeterminate,
      onChange: checked => emit('change', { target: { checked } }),
    }, slots.default?.()),
  }))
  app.component('a-table', defineComponent({
    props: ['columns', 'dataSource', 'loading'],
    setup: (props, { slots }) => () => h('table', { loading: props.loading }, [
      h('header', props.columns.map(column => slots.headerCell?.({ column }) || column.title)),
      ...props.dataSource.map(record => h('permission-row', { id: record.id }, props.columns.map(column => h('cell', slots.bodyCell?.({ column, record }))))),
    ]),
  }))
  app.component('a-alert', defineComponent({ props: ['message'], setup: (props, { slots }) => () => h('alert', [props.message, slots.action?.()]) }))
  for (const [name, type] of [['a-space','space'],['a-tag','tag'],['a-spin','spin'],['a-list','list'],['a-list-item','list-item'],['CloudEmpty','empty'],['a-button','button']]) {
    app.component(name, defineComponent({ setup: (_props, { slots }) => () => h(type, slots.default?.()) }))
  }
  app.mount(root)
  t.after(() => app.unmount())
  return {
    dialog, props, fixture, root, model: compiled.exports,
    row: id => find(root, target => target.type === 'permission-row' && target.props.id === id),
    selectMode: value => find(root, target => target.type === 'mode-group').props.onChange(value),
    search: keyword => find(root, target => target.type === 'search').props.onSearch(keyword),
    checkAction(id, label, checked) {
      const row = find(root, target => target.type === 'permission-row' && target.props.id === id)
      find(row, target => target.type === 'checkbox' && target.props['aria-label']?.endsWith(' · '+label)).props.onChange(checked)
    },
    checkGroup(id, checked) {
      const row = find(root, target => target.type === 'permission-row' && target.props.id === id)
      find(row, target => target.type === 'checkbox' && !target.props['aria-label']).props.onChange(checked)
    },
  }
}

test('新建默认跟随账号，提交通配范围与模式，不保存当前权限快照', async t => {
  const ctx = mountDialog(t, { mode: 'add' })
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions, inherited)
  await flush()
  assert.equal(ctx.row('device'), undefined)
  assert.match(textContent(ctx.root), /PersonalToken.permissions.scopeCount:6/)
  assert.equal(ctx.dialog.canSubmit.value, true)
  await ctx.dialog.handleOk()
  const data = ctx.fixture.posts[0][1]
  assert.deepEqual(data.scope.permissions, inherited)
  assert.equal(data.scope.attributes.personalTokenPermissionMode, 'follow')
})

test('只读只生成 query 操作，不包含保存、删除和指令', async t => {
  const ctx = mountDialog(t, { mode: 'add' })
  await flush(); ctx.selectMode('readonly'); await flush()
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions, [
    { id:'device',actions:['query'] }, { id:'ai-alarm',actions:['query'] },
  ])
  assert.equal(ctx.row('device'), undefined)
  assert.equal(ctx.row('command'), undefined)
  await ctx.dialog.handleOk()
  assert.equal(ctx.fixture.posts[0][1].scope.attributes.personalTokenPermissionMode, 'readonly')
})

test('自定义按资源与操作勾选，未选择时不能保存，空操作资源不展示', async t => {
  const ctx = mountDialog(t, { mode:'add' })
  await flush(); ctx.selectMode('custom'); await flush()
  assert.equal(ctx.dialog.canSubmit.value, false)
  assert.equal(ctx.row('empty'), undefined)
  ctx.checkAction('device','查询',true); await flush()
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions, [{ id:'device',actions:['query'] }])
  ctx.checkGroup('ai-alarm',true); await flush()
  assert.equal(ctx.dialog.formData.value.scope.permissions.find(p => p.id==='ai-alarm').actions.length,3)
  ctx.checkGroup('device',false); await flush()
  assert.equal(ctx.dialog.formData.value.scope.permissions.some(p => p.id==='device'),false)
  assert.equal(ctx.dialog.canSubmit.value,true)
})

test('旧令牌回填为实际自定义范围，加载不扩权，保存保留 Scope 元数据', async t => {
  const original = { permissions:oldScope, attributes:{ tenant:'fixture', asset_permission_ceiling:{ version:1 } }, dimensions:[{type:'tenant',id:'fixture'}], customFlag:{keep:true} }
  const ctx = mountDialog(t, { scope:original })
  await flush()
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions, oldScope)
  assert.equal(ctx.model.resolvePermissionMode(ctx.dialog.formData.value.scope),'custom')
  assert.equal(ctx.model.permissionModeLabel(ctx.props.token.scope),'PersonalToken.permissionMode.specified')
  assert.equal(ctx.dialog.canSubmit.value,true)
  await ctx.dialog.handleOk(false)
  const [url,data,options] = ctx.fixture.posts[0]
  assert.equal(url,'/personal/token/me/_save')
  assert.equal(data.id,'old-token'); assert.equal(data.sourceId,'original-source')
  assert.deepEqual(data.scope.permissions,oldScope)
  assert.deepEqual(data.scope.dimensions,original.dimensions)
  assert.deepEqual(data.scope.customFlag,original.customFlag)
  assert.deepEqual(data.scope.attributes.asset_permission_ceiling,original.attributes.asset_permission_ceiling)
  assert.equal(data.scope.attributes.personalTokenPermissionMode,'custom')
  assert.deepEqual(options,{params:{revokeAccessTokens:false}})
  assert.deepEqual(ctx.props.token.scope,original)
})

test('搜索、清空和模式往返保留自定义草稿及隐藏权限', async t => {
  for (const refresh of [false,true]) {
    const ctx = mountDialog(t)
    await flush()
    ctx.checkAction('device','保存',true); await flush()
    const expected = structuredClone(JSON.parse(JSON.stringify(ctx.dialog.formData.value.scope.permissions)))
    ctx.search('AI告警'); await flush()
    assert.equal(ctx.row('device'),undefined)
    ctx.selectMode('readonly'); await flush()
    ctx.selectMode('follow'); await flush()
    assert.deepEqual(ctx.dialog.formData.value.scope.permissions,inherited)
    ctx.selectMode('custom'); await flush()
    assert.deepEqual(ctx.dialog.formData.value.scope.permissions,expected)
    ctx.search(''); await flush()
    assert.ok(ctx.row('device'))
    await ctx.dialog.handleOk(refresh)
    assert.deepEqual(ctx.fixture.posts[0][1].scope.permissions,expected)
    assert.deepEqual(ctx.fixture.posts[0][2],{params:{revokeAccessTokens:refresh}})
  }
})

test('已保存的只读模式精确回填原查询范围，元数据与实际授权冲突时不误报模式', async t => {
  const ctx = mountDialog(t,{scope:{permissions:[{id:'device',actions:['query']}],attributes:{personalTokenPermissionMode:'readonly'}}})
  await flush()
  assert.equal(ctx.model.resolvePermissionMode(ctx.dialog.formData.value.scope),'readonly')
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions,[{id:'device',actions:['query']}])
  assert.equal(ctx.model.resolvePermissionMode({permissions:[{id:'device',actions:['save']}],attributes:{personalTokenPermissionMode:'readonly'}}),'custom')
  assert.equal(ctx.model.resolvePermissionMode({permissions:inherited,attributes:{personalTokenPermissionMode:'custom'}}),'follow')
  assert.equal(ctx.model.resolvePermissionMode({permissions:[{id:'device',actions:['query']}]}),'custom')
})

test('权限首次查询失败不改历史范围，自定义等待重试完成才允许保存', async t => {
  const ctx = mountDialog(t,{query:(_params,attempt)=>{if(attempt===1)throw Error('network');return {success:true,result:definitions}}})
  await flush()
  assert.equal(ctx.dialog.canSubmit.value,false)
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions,oldScope)
  assert.match(textContent(ctx.root),/PersonalToken.PermissionList.loadFailed/)
  ctx.selectMode('readonly'); await flush()
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions,oldScope)
  ctx.search(''); await flush()
  assert.equal(ctx.dialog.canSubmit.value,true)
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions,oldScope)
})

test('跟随账号不依赖权限预览成功，无查询能力时禁用只读模式', async t => {
  const failed = mountDialog(t,{mode:'add',query:()=>({success:false})})
  await flush()
  assert.equal(failed.dialog.canSubmit.value,true)
  await failed.dialog.handleOk()
  assert.deepEqual(failed.fixture.posts[0][1].scope.permissions,inherited)
  const noQuery = mountDialog(t,{mode:'add',query:()=>({success:true,result:[definitions[2]]})})
  await flush(); noQuery.selectMode('readonly'); await flush()
  assert.equal(noQuery.model.resolvePermissionMode(noQuery.dialog.formData.value.scope),'follow')
  assert.deepEqual(noQuery.model.readonlyPermissions([{id:'*',name:'全局',actions:[{action:'query',name:'查询'}]}]),[])
})

test('查看保留原授权，跟随账号可预览当前授权，忙碌时忽略权限修改', async t => {
  const view = mountDialog(t,{mode:'view'})
  await flush()
  assert.deepEqual(view.dialog.formData.value.scope.permissions,oldScope)
  assert.deepEqual(tags(view.row('device')),['查询'])
  assert.equal(find(view.root,target=>target.type==='mode-group'),undefined)
  assert.deepEqual(view.fixture.posts,[])
  const inheritedView = mountDialog(t,{mode:'view',scope:{permissions:inherited}})
  await flush()
  assert.deepEqual(tags(inheritedView.row('device')),['查询','保存'])
  const custom = mountDialog(t)
  await flush(); custom.dialog.loading.value=true; await flush()
  custom.checkAction('device','保存',true); custom.selectMode('follow'); await flush()
  assert.deepEqual(custom.dialog.formData.value.scope.permissions,oldScope)
})

test('历史单资源通配正确回显，取消一个动作会真正收窄而不是留下通配符', async t => {
  const ctx = mountDialog(t, { scope: { permissions: [{ id: 'device', actions: ['*'] }] } })
  await flush()
  const row = ctx.row('device')
  assert.equal(find(row, target => target.type === 'checkbox' && target.props['aria-label'] === '设备 · 查询').props.checked, true)
  assert.equal(find(row, target => target.type === 'checkbox' && target.props['aria-label'] === '设备 · 保存').props.checked, true)
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions, [{ id: 'device', actions: ['*'] }])
  ctx.checkAction('device', '保存', false)
  await flush()
  assert.deepEqual(ctx.dialog.formData.value.scope.permissions, [{ id: 'device', actions: ['query'] }])
  await ctx.dialog.handleOk(false)
  assert.deepEqual(ctx.fixture.posts[0][1].scope.permissions, [{ id: 'device', actions: ['query'] }])
})

test('权限 GET 查询保留 Spring 属性路径的搜索和排序契约', async () => {
  const queryPath = fileURLToPath(new URL('src/api/system/permission.ts',moduleRoot))
  const encodePath = fileURLToPath(new URL('src/utils/encodeQuery.ts',moduleRoot))
  const query = await build({ entryPoints:[queryPath],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{
    name:'grant-request',setup(builder){
      builder.onResolve({filter:/.*/},({path})=>{
        if(path==='@jetlinks-web/core')return {path,namespace:'request'}
        if(path==='@jetlinks-web-core/utils/encodeQuery')return {path:encodePath}
      })
      builder.onLoad({filter:/.*/,namespace:'request'},()=>({contents:'export const request={get:async(url,params)=>({url,params})}'}))
    },
  }]})
  const compiled=new Module(queryPath);compiled._compile(query.outputFiles[0].text,queryPath)
  const response=await compiled.exports.queryPermission_api({paging:false,pageIndex:0,pageSize:50,terms:[{column:'name$like',value:'%设备%'}],sorts:[{name:'name',order:'asc'}]})
  assert.equal(response.url,'/permission/_query/for-grant')
  assert.equal(response.params['terms[0].column'],'name$like')
  assert.equal(response.params['terms[0].value'],'%设备%')
  assert.equal(response.params['sorts[0].name'],'name')
  assert.equal(response.params.pageSize,50)
})

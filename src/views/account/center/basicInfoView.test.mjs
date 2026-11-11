import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { build } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createRenderer, defineComponent, h, nextTick, reactive, ref } from 'vue'
import { createI18n } from 'vue-i18n'

const require = createRequire(import.meta.url)
const directory = fileURLToPath(new URL('.', import.meta.url))
const core = fileURLToPath(new URL('../../../', import.meta.url))
const fixtureKey = '__basicInfoViewFixture'
const fixtures = {
  './LoginMethods/index.vue': 'export default {render(){return null}}',
  './useBasicProfile': `export const useBasicProfile=()=>globalThis.${fixtureKey}`,
  '@jetlinks-web/utils': 'export const onlyMessage=()=>{}',
  '@jetlinks-web-core/utils/public-asset': 'export const resolvePublicAssetUrl=value=>value',
}
const bundle = await build({
  stdin: { contents: "export {default as BasicInfo} from './components/BasicInfo.vue';export {default as InputEditable} from '../../../components/Editable/InputEditable.vue'", resolveDir: directory, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', external: ['vue', 'vue-i18n'],
  loader: { '.webp': 'dataurl' },
  plugins: [{ name: 'basic-info-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path }) => Object.hasOwn(fixtures, path) ? { path, namespace: 'fixture' } : undefined)
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ contents: fixtures[path] }))
    builder.onLoad({ filter: /\.vue$/ }, ({ path }) => {
      const { descriptor, errors } = parse(readFileSync(path, 'utf8'), { filename: path })
      assert.deepEqual(errors, [])
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts' }
    })
  }}],
})
const mod = new Module(directory + 'basic-view-fixture.cjs')
mod.filename = directory + 'basic-view-fixture.cjs'
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
const Slot = defineComponent({ setup(_props, { slots }) { return () => h('wrapper', slots.default?.()) } })
const Button = defineComponent({ inheritAttrs: false, props: ['disabled', 'loading'], setup(props, { slots, attrs }) { return () => h('button', { ...attrs, disabled: props.disabled }, slots.default?.()) } })
const Avatar = defineComponent({ props: ['size', 'src'], setup(props, { slots }) { return () => h('avatar-boundary', { size: props.size, src: props.src }, slots.default?.()) } })
const Input = defineComponent({
  props: ['value', 'disabled'], emits: ['update:value', 'blur', 'pressEnter', 'keydown'],
  setup(props, { emit, expose }) {
    expose({ focus() {} })
    return () => h('input', { value: props.value, disabled: props.disabled,
      input: value => emit('update:value', value), blur: () => emit('blur'), enter: () => emit('pressEnter'),
      escape: () => emit('keydown', { key: 'Escape', stopPropagation() {} }),
    })
  },
})
const Descriptions = defineComponent({ props: ['column'], setup(props, { slots }) { return () => h('descriptions', { column: props.column }, slots.default?.()) } })
const Upload = defineComponent({
  props: ['value', 'disabled', 'size', 'accept', 'cropperProps'], emits: ['update:value'],
  setup(props, { slots, emit }) { return () => h('upload-boundary', {
    value: props.value, disabled: props.disabled, size: props.size, accept: props.accept,
    cropperProps: props.cropperProps, update: value => emit('update:value', value),
  }, [h('button', slots.content?.())]) },
})
function all(target, predicate) { return [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))] }
function text(target) { return target.type === 'comment' ? '' : target.text + target.children.map(text).join('') }
const locales = Object.fromEntries(['zh', 'en', 'ja'].map(lang => [lang, JSON.parse(readFileSync(join(core, 'locales/lang', lang + '.json'), 'utf8'))]))

test('姓名复用公共就地编辑的提交取消行为，头像仍接入公共裁剪入口', async t => {
  const saves = []
  const names = []
  const profile = reactive({ name: '测试用户', username: 'tester', avatar: '/avatar.png', canEdit: true, items: [{ key: 'id', value: 'fixture-id' }] })
  globalThis[fixtureKey] = { saving: ref(false), saveError: ref(false), saveName: async value => { names.push(value); await new Promise(setImmediate); profile.name = value; return true }, saveAvatar: value => saves.push(value) }
  const root = node('root')
  const i18n = createI18n({ legacy: false, locale: 'zh', messages: locales })
  const app = renderer.createApp({ render: () => h(mod.exports.BasicInfo, { profile }) })
  app.use(i18n)
  app.component('ContentPanel', Slot).component('KvGrid', Slot).component('a-space', Slot).component('a-tooltip', Slot)
    .component('a-button', Button).component('a-avatar', Avatar).component('ImageUpload', Upload)
    .component('a-input', Input).component('a-alert', Slot).component('a-divider', Slot).component('AIcon', Slot)
    .component('InputEditable', mod.exports.InputEditable).component('j-ellipsis', Slot)
    .component('a-typography-text', Slot).component('a-descriptions', Descriptions).component('a-descriptions-item', Slot).component('a-tag', Slot)
  app.mount(root)
  t.after(() => { app.unmount(); delete globalThis[fixtureKey] })
  await nextTick()
  const uploader = all(root, item => item.type === 'upload-boundary')[0]
  assert.equal(uploader.props.value, '/avatar.png')
  assert.equal(uploader.props.accept, 'image/jpeg,image/png')
  assert.deepEqual(uploader.props.cropperProps.fixedNumber, [1, 1])
  assert.equal(all(uploader, item => item.type === 'avatar-boundary')[0].props.src, '/avatar.png')
  assert.equal(all(uploader, item => item.type === 'button').length, 1)
  assert.match(text(uploader), /更换头像/)
  uploader.props.update('/new-avatar.png')
  assert.deepEqual(saves, ['/new-avatar.png'])
  globalThis[fixtureKey].saving.value = true
  await nextTick()
  assert.equal(all(root, item => item.type === 'upload-boundary').length, 0)
  globalThis[fixtureKey].saving.value = false
  await nextTick()
  all(root, item => item.type === 'button').find(item => text(item).trim() === '测试用户').props.onClick()
  await nextTick()
  let input = all(root, item => item.type === 'input')[0]
  input.props.input('取消草稿')
  input.props.escape()
  await nextTick()
  assert.deepEqual(names, [])
  assert.equal(all(root, item => item.type === 'input').length, 0)
  all(root, item => item.type === 'button').find(item => text(item).trim() === '测试用户').props.onClick()
  await nextTick()
  input = all(root, item => item.type === 'input')[0]
  input.props.input('')
  await nextTick()
  input.props.enter()
  await nextTick()
  assert.match(text(root), /请填写姓名/)
  assert.deepEqual(names, [])
  input.props.input(' 修改后的姓名 ')
  await nextTick()
  input.props.enter()
  input.props.blur()
  await new Promise(setImmediate)
  await nextTick()
  assert.deepEqual(names, ['修改后的姓名'])
  assert.equal(all(root, item => item.type === 'input').length, 0)
  profile.canEdit = false
  await nextTick()
  assert.equal(all(root, item => item.type === 'upload-boundary').length, 0)
  assert.equal(all(root, item => item.type === 'avatar-boundary')[0].props.src, '/avatar.png')
})

test('组织缺项提示覆盖角色、部门和职位的组合，并随语言切换', async t => {
  const root = node('root')
  const missing = ref(7)
  const fields = [['roles', 'AccountInfo.roles'], ['orgs', 'PersonalCenter.department'], ['positions', 'AccountInfo.positions']]
  const i18n = createI18n({ legacy: false, locale: 'zh', messages: locales })
  globalThis[fixtureKey] = { saving: ref(false), saveError: ref(false), saveName() {}, saveAvatar() {} }
  const app = renderer.createApp({ render: () => h(mod.exports.BasicInfo, { profile: {
    name: '用户', username: 'user', canEdit: false,
    items: fields.map(([key, label], index) => ({ key, label: i18n.global.t(label), value: '值', unassigned: !!(missing.value & (1 << index)) })),
  } }) })
  app.use(i18n)
  for (const component of ['ContentPanel', 'a-space', 'a-tooltip', 'a-button', 'a-avatar', 'AIcon', 'a-descriptions', 'a-descriptions-item', 'a-tag', 'a-alert', 'ImageUpload', 'InputEditable']) app.component(component, Slot)
  app.mount(root)
  t.after(() => { app.unmount(); delete globalThis[fixtureKey] })
  const note = () => text(all(root, item => item.props.class === 'account-basic__item-hint account-basic__organization-note')[0])
  const combinations = ['', '角色', '所属部门', '角色和所属部门', '职位', '角色和职位', '所属部门和职位', '角色、所属部门和职位']
  for (let mask = 0; mask < combinations.length; mask++) {
    missing.value = mask
    await nextTick()
    assert.equal(note(), mask ? `还没有分配${combinations[mask]}，请联系管理员分配。` : locales.zh['PersonalCenter.orgNote'])
  }
  i18n.global.locale.value = 'en'
  await nextTick()
  assert.equal(note(), 'Not assigned: Roles, Department, and Positions. Contact an administrator for assignment.')
  missing.value = 2
  await nextTick()
  assert.equal(note(), 'Not assigned: Department. Contact an administrator for assignment.')
  i18n.global.locale.value = 'ja'
  missing.value = 7
  await nextTick()
  assert.equal(note(), 'ロール、所属部署、役職がまだ割り当てられていません。管理者に割り当てを依頼してください。')
})

test('公共编辑器默认图标入口保留原提交事件，禁用时不能进入编辑', async t => {
  const disabled = ref(true), changes = []
  const root = node('root')
  const app = renderer.createApp({ render: () => h(mod.exports.InputEditable, { value: '原名称', disabled: disabled.value, onChange: value => changes.push(value) }) })
  app.use(createI18n({ legacy: false, locale: 'zh', messages: locales }))
  app.component('a-button', Button).component('a-input', Input).component('j-ellipsis', Slot).component('AIcon', Slot).component('a-typography-text', Slot)
  app.mount(root)
  t.after(() => app.unmount())
  all(root, item => item.type === 'button')[0].props.onClick()
  await nextTick()
  assert.equal(all(root, item => item.type === 'input').length, 0)
  disabled.value = false
  await nextTick()
  all(root, item => item.type === 'button')[0].props.onClick()
  await nextTick()
  const input = all(root, item => item.type === 'input')[0]
  input.props.input('新名称')
  await nextTick()
  input.props.blur()
  await nextTick()
  assert.deepEqual(changes, ['新名称'])
})

test('个人中心可见语言键在三语言资源存在且无重复键', () => {
  const modules = join(core, '../../modules')
  const merged = Object.fromEntries(Object.entries(locales).map(([lang, values]) => [lang, { ...values }]))
  for (const lang of Object.keys(locales)) {
    const raw = readFileSync(join(core, 'locales/lang', lang + '.json'), 'utf8')
    const seen = new Set()
    for (const [, key] of raw.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
      assert.ok(!seen.has(key), `${lang} duplicate: ${key}`)
      seen.add(key)
    }
    for (const module of readdirSync(modules)) {
      const file = join(modules, module, 'locales/lang', lang + '.json')
      if (existsSync(file)) Object.assign(merged[lang], JSON.parse(readFileSync(file, 'utf8')))
    }
  }
  const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)])
  const prefixes = /^(PersonalCenter|PersonalToken|AccountInfo|AccountCenter|EditInfo|EditPassword|NotificationRecord|BindThirdAccount|center|comm|Save)\./
  for (const file of files(directory).filter(file => /\.(vue|ts)$/.test(file))) {
    const content = readFileSync(file, 'utf8')
    for (const [, key] of content.matchAll(/["']((?:[A-Za-z][\w-]*\.)+[A-Za-z0-9_-]+)["']/g)) {
      if (!prefixes.test(key)) continue
      for (const lang of Object.keys(locales)) assert.ok(key in merged[lang], `${lang}: ${key} in ${file}`)
    }
  }
  assert.equal(locales.zh['PersonalCenter.deliveryHint'], '每类消息通过哪些渠道发给你，改动立即生效')
  assert.equal(locales.zh['PersonalCenter.notificationEmpty'], '订阅的告警、导入导出等任务完成后，通知会发到这里。')
  assert.equal(locales.zh['PersonalCenter.passwordHint'], '8–20 位，同时包含字母和数字；建议每 90 天更换一次，不要和其他网站用同一个密码')
  assert.equal(locales.zh['PersonalToken.empty.description'], '调用开放 API 时，可以用个人令牌代替账号密码放在请求头里。令牌的权限不会超过你自己的账号权限，完整令牌只在新建后显示一次。')
})

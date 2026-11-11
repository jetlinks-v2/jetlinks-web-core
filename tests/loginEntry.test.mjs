import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { setImmediate } from 'node:timers/promises'
import { test } from 'node:test'
import { transformSync } from 'esbuild'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '..')
const messages = JSON.parse(readFileSync(resolve(root, 'src/locales/lang/zh.json'), 'utf8'))
const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
const detach = child => {
  const siblings = child.parent?.children
  if (siblings) siblings.splice(siblings.indexOf(child), 1)
  child.parent = null
}
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('text', text),
  createComment: text => node('comment', text),
  setText: (element, text) => { element.text = text },
  setElementText: (element, text) => { element.text = text; element.children = [] },
  patchProp: (element, key, _previous, value) => { element.props[key] = value },
  insert(child, parent, anchor) {
    detach(child)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
    child.parent = parent
  },
  remove: detach, parentNode: child => child.parent,
  nextSibling: child => child.parent?.children[child.parent.children.indexOf(child) + 1],
})
const descendants = parent => [parent, ...parent.children.flatMap(descendants)]
const flush = async () => { await Vue.nextTick(); await setImmediate(); await Vue.nextTick() }
const storage = () => {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

// Mount the production login, password form and login hooks; replace HTTP and component-library primitives.
const fixture = async (t, { pathname = '/ht_device/', environment = 'saas' } = {}) => {
  const previous = Object.fromEntries(['window', 'location', 'localStorage', 'sessionStorage'].map(key => [key, globalThis[key]]))
  const location = { origin: 'https://runtime.example.com', pathname, hash: '#/login', replace: () => assert.fail('login must preserve its entry URL') }
  globalThis.location = location
  globalThis.window = { location, innerWidth: 1440, addEventListener() {}, removeEventListener() {}, open() {} }
  globalThis.localStorage = storage()
  globalThis.sessionStorage = storage()
  sessionStorage.setItem('saas-manager-ui:login-redirect', `${pathname}#/overview`)
  const route = Vue.ref({ fullPath: '/login' })
  const calls = [], successes = [], cache = new Map()
  const response = result => Promise.resolve({ success: true, result })
  const api = {
    captchaConfig: () => response({ enabled: true, type: 'image', loginWithVerify: false }),
    encryptionConfig: () => response({ encrypt: { enabled: false } }),
    getIdentityProviders: () => response([{ id: 'mobile' }, { id: 'email' }]),
    bindInfoWithoutProjectContext: () => response([{ id: 'enterprise', name: '企业 SSO', provider: 'oauth2' }]),
    codeUrlWithoutProjectContext: () => { calls.push({ type: 'captcha' }); return response({ key: 'image-key', base64: 'data:image/png;base64,dGVzdA==' }) },
    loginWithoutProjectContext: data => { calls.push({ type: 'login', data }); return response({ token: 'new-token' }) },
    identityRequest: data => { calls.push({ type: 'identity', data }); return response({ intervalSeconds: 60 }) },
    identityConfirm: () => response({ token: 'identity-token' }),
  }
  const control = type => Vue.defineComponent({
    inheritAttrs: false, props: ['value'], emits: ['update:value'],
    setup(props, { attrs, emit, slots }) {
      return () => Vue.h('input', { ...attrs, type, value: props.value, onInput: event => emit('update:value', event.target.value) }, slots.addonAfter?.())
    },
  })
  const box = tag => Vue.defineComponent({ setup: (_props, { slots }) => () => Vue.h(tag, slots.default?.()) })
  const ui = {
    Form: Vue.defineComponent({ props: ['model', 'rules'], emits: ['finish'], setup: (_props, { emit, slots }) => () => Vue.h('form', { onSubmit: () => emit('finish') }, slots.default?.()) }),
    FormItem: box('form-item'), Input: control('text'), InputPassword: control('password'),
    Checkbox: box('checkbox'), Button: box('button'), Popover: box('popover'),
    message: Object.fromEntries(['info', 'warn', 'error', 'success'].map(type => [type, text => calls.push({ type, text })])),
  }
  const dependencies = {
    vue: Vue, 'vue-router': { useRouter: () => ({ currentRoute: route }) }, 'ant-design-vue': ui,
    '@jetlinks-web-core/locales': { global: { t: key => messages[key] || key } },
    '@jetlinks-web-core/api/login': api,
    '@jetlinks-web/utils': { encrypt: value => value, onlyMessage() {}, LocalStore: { set() {} } },
    '@jetlinks-web-core/utils/project-runtime': { getProjectCodeFromLocation: () => environment ? pathname.split('/').filter(Boolean)[0] || '' : '' },
    '@jetlinks-web-core/utils/sso-icon': { resolveSsoIcon: () => '/sso.svg' },
    '@jetlinks-web-core/components/Captcha': box('captcha'),
    '@jetlinks-web/hooks': {
      useRequest(fn, options = {}) {
        const data = Vue.ref()
        const run = async (...args) => {
          const result = await fn(...args)
          data.value = options.onSuccess?.(result) ?? result.result
          return result
        }
        if (options.immediate !== false) void run()
        return { data, run }
      },
    },
  }
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename)
    let source = readFileSync(filename, 'utf8')
    if (filename.endsWith('.vue')) {
      const { descriptor, errors } = parse(source, { filename })
      assert.deepEqual(errors, [])
      source = compileScript(descriptor, { id: 'login-entry-test', inlineTemplate: true }).content
    }
    const { code } = transformSync(source, { loader: 'ts', format: 'cjs', define: { 'import.meta.env': JSON.stringify({ VITE_APP_ENVIRONMENT: environment, VITE_APP_BASE_API: '/api' }) } })
    const module = { exports: {} }
    cache.set(filename, module.exports)
    new Function('require', 'module', 'exports', code)(name => {
      if (name in dependencies) return dependencies[name]
      if (name.endsWith('/useLoginSuccess') || name === './useLoginSuccess') return { useLoginSuccess: () => ({ handleLoginSuccess: async (...args) => successes.push(args) }) }
      if (name.endsWith('/CodeLogin.vue')) return Vue.defineComponent({ props: ['type'], setup: props => () => Vue.h('code-login', { type: props.type }) })
      if (name.endsWith('/WechatScanLogin.vue') || name.endsWith('/MobileWechatLogin.vue')) return box('wechat')
      if (name.endsWith('.png')) return '/login-image.png'
      if (name.startsWith('@jetlinks-web-core/')) return load(resolve(root, 'src', `${name.slice('@jetlinks-web-core/'.length)}.ts`))
      if (name.startsWith('.')) return load(resolve(dirname(filename), /\.(vue|ts)$/.test(name) ? name : `${name}.ts`))
      return require(name)
    }, module, module.exports)
    cache.set(filename, module.exports)
    return module.exports
  }
  const container = node('root')
  const app = renderer.createApp(load(resolve(root, 'src/views/login/components/Login.vue')).default)
  app.component('AIcon', box('icon'))
  t.after(() => {
    app.unmount()
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]
      else globalThis[key] = value
    }
  })
  app.mount(container)
  await flush()
  return { container, calls, successes, route, all: () => descendants(container), redirect: () => sessionStorage.getItem('saas-manager-ui:login-redirect') }
}

for (const entry of [
  { pathname: '/' },
  { pathname: '/ht_device/' },
  { pathname: '/application-a/' },
  { pathname: '/iot/', environment: '' },
]) {
  test(`new login remains visible at ${entry.pathname} (${entry.environment ?? 'saas'})`, async t => {
    const f = await fixture(t, entry)
    assert.equal(f.all().filter(element => element.type === 'form').length, 1)
    assert.ok(f.all().some(element => element.type === 'h2' && element.text === messages['Login.passwordTitle']))
    assert.equal(f.calls.filter(call => call.type === 'captcha').length, 1)
    assert.ok(f.all().some(element => element.type === 'img' && element.props.src.startsWith('data:image/')))
    assert.ok(f.all().some(element => element.props['aria-label'] === messages['Login.mobileMethod']))
    const redirect = f.redirect()
    f.route.value = { fullPath: '/login?redirect=%2Foverview' }
    await flush()
    assert.equal(f.all().filter(element => element.type === 'form').length, 1)
    assert.equal(f.redirect(), redirect)
  })
}

test('switching login methods keeps the project entry and its saved redirect', async t => {
  const f = await fixture(t)
  const redirect = f.redirect()
  f.all().find(element => element.props['aria-label'] === messages['Login.mobileMethod']).props.onClick()
  await flush()
  assert.ok(f.all().some(element => element.type === 'code-login' && element.props.type === 'mobile'))
  f.all().find(element => element.type === 'button' && element.props.class === 'back-button').props.onClick()
  await flush()
  assert.equal(f.all().filter(element => element.type === 'form').length, 1)
  assert.equal(f.redirect(), redirect)
  assert.equal(location.pathname, '/ht_device/')
})

for (const username of ['operator', 'operator@ht_device']) {
  test(`unified password login submits ${username} with its image verification`, async t => {
    const f = await fixture(t)
    for (const [name, value] of [['login-account', username], ['login-password', 'fixture-password'], ['login-verify-code', '1234']]) {
      f.all().find(element => element.type === 'input' && element.props.name === name).props.onInput({ target: { value } })
    }
    await flush()
    f.all().find(element => element.type === 'form').props.onSubmit()
    await flush()
    assert.ok(f.calls.some(call => call.type === 'login'), JSON.stringify(f.calls))
    assert.deepEqual(f.calls.find(call => call.type === 'login').data, {
      username, password: 'fixture-password', verifyCode: '1234', verifyKey: 'image-key', expires: 7 * 24 * 60 * 60 * 1000,
    })
    assert.deepEqual(f.successes, [['new-token', { username }]])
  })
}

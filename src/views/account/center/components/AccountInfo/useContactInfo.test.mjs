import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { createRenderer, h, nextTick, reactive } from 'vue'

const require = createRequire(import.meta.url)
const entry = fileURLToPath(new URL('./useContactInfo.ts', import.meta.url))
const contextKey = '__jetlinksContactInfoTestContext'
const sources = {
  '@jetlinks-web-core/store': 'export const useUserStore = () => context.user',
  '@jetlinks-web-core/api/account/center': 'export const updateMeInfo_api = data => context.update(data)',
  '@jetlinks-web/utils': 'export const onlyMessage = (...args) => context.messages.push(args)',
  'vue-i18n': 'export const useI18n = () => ({ t: key => key })',
}
const bundle = await build({
  entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs',
  external: ['vue', 'ant-design-vue'],
  plugins: [{
    name: 'contact-info-boundary-fixtures',
    setup(builder) {
      builder.onResolve({ filter: /^(?:@jetlinks-web|vue-i18n)/ }, ({ path }) => {
        if (sources[path]) return { path, namespace: 'contact-fixture' }
      })
      builder.onLoad({ filter: /.*/, namespace: 'contact-fixture' }, ({ path }) => ({
        contents: `const context = globalThis.${contextKey};\n${sources[path]}`,
      }))
    },
  }],
})
const renderer = createRenderer({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
  parentNode: () => null, nextSibling: () => null,
})

// 使用真实 Vue 状态与 Ant Design 表单校验，仅替换资料接口和 Store 边界。
const mountContacts = t => {
  let persisted = { id: 'contact-fixture', name: '测试账户', telephone: '13800009999', email: 'old@example.test' }
  const context = {
    calls: [], messages: [], response: { success: true }, beforeUpdate: undefined,
    user: reactive({
      userInfo: { ...persisted },
      async getUserInfo() { context.user.userInfo = { ...persisted } },
    }),
    async update(data) {
      context.calls.push({ ...data })
      await context.beforeUpdate?.()
      if (context.response.status === 200 || context.response.success) persisted = { ...data }
      return context.response
    },
  }
  globalThis[contextKey] = context
  const compiled = new Module(entry)
  compiled.filename = entry
  compiled.paths = require.resolve.paths('vue')
  compiled._compile(bundle.outputFiles[0].text, entry)
  delete globalThis[contextKey]
  let contacts
  const app = renderer.createApp({ setup() { contacts = compiled.exports.useContactInfo(); return () => h('div') } })
  app.mount({})
  t.after(() => app.unmount())
  return { contacts, context }
}

test('回填资料，非法手机号和邮箱阻止请求并展示字段错误', async t => {
  const { contacts, context } = mountContacts(t)
  assert.deepEqual({ ...contacts.contactForm }, { telephone: '13800009999', email: 'old@example.test' })
  assert.deepEqual(contacts.contactChanged.value, { telephone: false, email: false })
  contacts.contactForm.telephone = '123'
  await contacts.saveContact('telephone')
  assert.equal(context.calls.length, 0)
  assert.equal(contacts.validateInfos.telephone.validateStatus, 'error')
  contacts.contactForm.email = 'invalid-email'
  await contacts.saveContact('email')
  assert.equal(context.calls.length, 0)
  assert.equal(contacts.validateInfos.email.validateStatus, 'error')
  assert.equal(contacts.savingContact.value, undefined)
  assert.equal(contacts.contactForm.email, 'invalid-email')
})

test('分字段提交并去除首尾空格，刷新后保留另一字段草稿', async t => {
  const { contacts, context } = mountContacts(t)
  contacts.contactForm.email = 'draft@example.test'
  contacts.contactForm.telephone = ' 13900001234 '
  await contacts.saveContact('telephone')
  assert.equal(context.calls[0].telephone, '13900001234')
  assert.equal(context.calls[0].email, 'old@example.test')
  assert.equal(context.calls[0].name, '测试账户')
  assert.equal(contacts.contactChanged.value.telephone, false)
  assert.equal(contacts.contactForm.email, 'draft@example.test')
  assert.equal(contacts.contactChanged.value.email, true)
  await contacts.saveContact('email')
  assert.equal(context.calls[1].telephone, '13900001234')
  assert.equal(context.user.userInfo.email, 'draft@example.test')
  assert.equal(contacts.contactChanged.value.email, false)
})

test('保存期间阻止重复和并行提交，完成后允许继续保存', async t => {
  const { contacts, context } = mountContacts(t)
  let complete
  context.beforeUpdate = () => new Promise(resolve => { complete = resolve })
  contacts.contactForm.telephone = '13900001234'
  contacts.contactForm.email = 'draft@example.test'
  const saving = contacts.saveContact('telephone')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(contacts.savingContact.value, 'telephone')
  await contacts.saveContact('telephone')
  await contacts.saveContact('email')
  assert.equal(context.calls.length, 1)
  complete()
  await saving
  assert.equal(contacts.savingContact.value, undefined)
  context.beforeUpdate = undefined
  await contacts.saveContact('email')
  assert.equal(context.calls.length, 2)
})

test('联系方式允许清空，失败保留草稿且不重复提示并支持重试', async t => {
  const { contacts, context } = mountContacts(t)
  contacts.contactForm.email = '   '
  context.response = { success: false }
  await contacts.saveContact('email')
  assert.equal(context.calls[0].email, '')
  assert.equal(context.user.userInfo.email, 'old@example.test')
  assert.equal(contacts.contactForm.email, '')
  assert.equal(contacts.contactChanged.value.email, true)
  assert.equal(contacts.savingContact.value, undefined)
  // 失败提示由公共请求层负责，Hook 只维护草稿和提交状态。
  assert.deepEqual(context.messages, [])
  context.beforeUpdate = () => Promise.reject(new Error('fixture failure'))
  await contacts.saveContact('email')
  assert.equal(contacts.contactForm.email, '')
  assert.equal(context.user.userInfo.email, 'old@example.test')
  assert.equal(contacts.contactChanged.value.email, true)
  assert.equal(contacts.savingContact.value, undefined)
  assert.deepEqual(context.messages, [])
  context.beforeUpdate = undefined
  context.response = { status: 200 }
  await contacts.saveContact('email')
  await nextTick()
  assert.equal(context.user.userInfo.email, '')
  assert.equal(contacts.contactChanged.value.email, false)
  assert.deepEqual(context.messages.at(-1), ['AccountInfo.saveSuccess', 'success'])
})

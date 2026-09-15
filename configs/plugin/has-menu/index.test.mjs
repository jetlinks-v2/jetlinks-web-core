import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { build, transform } from 'esbuild'
import { compileTemplate, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import { createPinia } from 'pinia'
import vuePlugin from '@vitejs/plugin-vue'
import { build as viteBuild, createServer } from 'vite'

const require = createRequire(import.meta.url)
const directory = dirname(fileURLToPath(import.meta.url))
const core = resolve(directory, '../../..')
const temporary = await mkdtemp(join(directory, '.test-'))
after(async () => {
  assert.ok(temporary.startsWith(`${directory}\\`) || temporary.startsWith(`${directory}/`))
  await rm(temporary, { recursive: true, force: true })
})

// 保留真实菜单 Runtime 和响应式 Map，仅隔离路由装配、鉴权以及网络相关依赖。
await build({
  stdin: {
    contents: `export * from ${JSON.stringify(join(directory, 'index.ts'))};
      export { default as installHasMenu } from ${JSON.stringify(join(core, 'src/directive/hasMenu.ts'))};
      export { useMenuStore } from '@jetlinks-web-core/store/menu';`,
    resolveDir: directory,
    loader: 'ts',
  },
  bundle: true, packages: 'external', platform: 'node', format: 'esm',
  outfile: join(temporary, 'subject.mjs'),
  plugins: [{
    name: 'isolate-menu-runtime',
    setup(builder) {
      builder.onResolve({ filter: /^@jetlinks-web-core\/store\/menu$/ }, () => ({ path: 'menu', namespace: 'fixture' }))
      builder.onResolve({ filter: /^@jetlinks-web-core\/utils$/ }, () => ({ path: 'utils', namespace: 'fixture' }))
      builder.onResolve({ filter: /^\.\/auth$/ }, () => ({ path: 'auth', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
        resolveDir: directory,
        contents: path === 'menu'
          ? `import { defineStore } from 'pinia';
             import { createMenuStoreRuntime } from ${JSON.stringify(join(core, 'src/store/menuRuntime.ts'))};
             export const useMenuStore = defineStore('menu', () => createMenuStoreRuntime({
               getAsyncRoutes: () => ({}), resolveExtraMenus: () => ({})
             }));`
          : path === 'auth' ? 'export const useAuthStore = () => ({ setPermissionsAll() {} });'
            : `export const handleMenus = (menus) => ({ menuRoutes: [], menus: [], authButtons: {},
                menuMap: new Map(menus.map(menu => [menu.code, menu])) });`,
      }))
      builder.onLoad({ filter: /[/\\]menuRuntime\.ts$/ }, async ({ path }) => ({
        contents: `import { ref } from 'vue';\n${await readFile(path, 'utf8')}`, loader: 'ts',
        resolveDir: dirname(path),
      }))
    },
  }],
})
const { transformHasMenu, hasMenuPlugin, installHasMenu, useMenuStore } = await import(pathToFileURL(join(temporary, 'subject.mjs')))

/** 执行真实 Vue 模板编译结果，而非只断言转换后的字符串。 */
async function renderTemplate(template, isProd = false) {
  const input = `<template>${template}</template>`
  const output = transformHasMenu(input, 'Fixture.vue')
  const result = compileTemplate({
    source: parse(output?.code || input).descriptor.template.content,
    filename: 'Fixture.vue', id: 'fixture', isProd,
  })
  assert.deepEqual(result.errors, [])
  assert.doesNotMatch(result.code, /resolveDirective|withDirectives/)
  const compiled = await transform(result.code, { format: 'cjs' })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled.code)(name => name === 'vue' ? Vue : require(name), module, module.exports)
  return module.exports.render
}

/** 使用 Vue 官方自定义 Renderer 验证组件生命周期，无需浏览器或模拟 DOM 依赖。 */
function renderer() {
  const node = (text = '') => ({ text, children: [], parent: null })
  return Vue.createRenderer({
    createElement: node, createText: node, createComment: node,
    setText: (target, text) => { target.text = text },
    setElementText: (target, text) => { target.text = text; target.children = [] },
    parentNode: target => target.parent,
    nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
    patchProp() {},
    insert(target, parent, anchor = null) {
      if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
      const position = anchor ? parent.children.indexOf(anchor) : parent.children.length
      parent.children.splice(position, 0, target)
      target.parent = parent
    },
    remove(target) {
      target.parent?.children.splice(target.parent.children.indexOf(target), 1)
      target.parent = null
    },
  })
}

test('only transforms actual directives and retains source maps', () => {
  const input = `<script setup>const label = 'v-has-menu'</script>
<template><!-- v-has-menu --><div v-has-menu="code" /></template><style>.x{color:red}</style>`
  const output = transformHasMenu(input, 'Fixture.vue')
  assert.ok(output.map.mappings.length)
  assert.deepEqual(output.map.sourcesContent, [input])
  assert.match(output.code, /const label = 'v-has-menu'/)
  assert.match(output.code, /<!-- v-has-menu -->/)
  assert.match(output.code, /<style>\.x\{color:red\}<\/style>/)
  assert.equal(transformHasMenu('<template><div title="v-has-menu" /></template>', 'Fixture.vue'), null)
  assert.equal(transformHasMenu('<template><div v-pre v-has-menu="code" /></template>', 'Fixture.vue'), null)
  assert.equal(transformHasMenu('<template lang="pug">div(v-has-menu="code")</template>', 'Fixture.vue'), null)
  assert.equal(transformHasMenu('<template src="./template.html" /><!-- v-has-menu -->', 'Fixture.vue'), null)
})

test('plugin ignores dependency code and virtual SFC submodules', () => {
  const plugin = hasMenuPlugin()
  const source = '<template><div v-has-menu="code" /></template>'
  for (const id of ['Component.tsx', 'Component.vue?vue&type=template',
    '/node_modules/pkg/Component.vue', 'D:\\project\\node_modules\\pkg\\Component.vue']) {
    assert.equal(plugin.transform(source, id), null)
  }
})

test('literal code and existing conditional branches compile to native conditions', async () => {
  const render = await renderTemplate('<div v-has-menu="\'alpha\'" /><span v-else />')
  const seen = []
  let allowed = false
  const context = { $hasMenu: code => { seen.push(code); return allowed } }
  assert.equal(render(context, []).type, 'span')
  allowed = true
  assert.equal(render(context, []).type, 'div')
  assert.deepEqual(seen, ['alpha', 'alpha'])
})

for (const [template, message] of [
  ['<div v-has-menu />', '必须提供'],
  ['<div v-has-menu="" />', '必须提供'],
  ['<div v-has-menu.all="code" />', '修饰符'],
  ['<div v-has-menu:code="code" />', '参数'],
  ['<div v-has-menu="[\'a\', \'b\']" />', '数组'],
  ['<div v-has-menu="([\'a\'] as string[])" />', '数组'],
  ['<div v-has-menu="a +" />', 'expression'],
  ...['for="item in items"', 'else', 'else-if="ready"', 'slot="scope"']
    .map(other => [`<template v-${other} v-has-menu="code" />`, '不能与']),
]) {
  test(`rejects unsupported syntax: ${template}`, () => {
    assert.throws(() => transformHasMenu(`<template>${template}</template>`, 'Invalid.vue'),
      error => error.message.includes(message) && /Invalid.vue:\d+:\d+/.test(error.message))
  })
}

test('merges v-if and preserves quotes, entities, comparisons and multiline expressions', async () => {
  const render = await renderTemplate(`<div v-if='ready &amp;&amp; count &lt; 2'
    v-has-menu='ready\n ? "a&amp;quot;&amp;b" : "other"' />`)
  const seen = []
  const context = { ready: true, count: 1, $hasMenu: code => { seen.push(code); return true } }
  assert.equal(render(context, []).type, 'div')
  assert.deepEqual(seen, ['a&quot;&b'])
  context.ready = false
  assert.equal(render(context, []).type, Vue.Comment)
  assert.equal(seen.length, 1)
})

for (const isProd of [false, true]) {
  test(`reactive lifecycle with actual menu Runtime (${isProd ? 'production' : 'development'})`, async () => {
    const state = Vue.reactive({ code: 'alpha', ready: true })
    const counts = { setup: 0, requests: 0, unmount: 0 }
    const Child = Vue.defineComponent({
      setup() {
        counts.setup++
        Vue.onMounted(() => { counts.requests++ })
        Vue.onUnmounted(() => { counts.unmount++ })
        return () => [Vue.h('span'), Vue.h('span')]
      },
    })
    const app = renderer().createApp({
      components: { Child }, setup: () => state,
      render: await renderTemplate('<Child v-has-menu="code" v-if="ready" />', isProd),
    })
    const pinia = createPinia()
    app.use(pinia).use(installHasMenu)
    const menus = useMenuStore(pinia)
    app.mount({ children: [] })
    assert.deepEqual(counts, { setup: 0, requests: 0, unmount: 0 })
    await menus.createRoutes([{ code: 'alpha' }])
    await Vue.nextTick()
    assert.deepEqual(counts, { setup: 1, requests: 1, unmount: 0 })
    state.code = 'beta'
    await Vue.nextTick()
    assert.equal(counts.unmount, 1)
    menus.menusMap.set('beta', {})
    await Vue.nextTick()
    assert.equal(counts.setup, 2)
    menus.menusMap.delete('beta')
    await Vue.nextTick()
    assert.equal(counts.unmount, 2)
    await menus.createRoutes([{ code: 'beta' }])
    await Vue.nextTick()
    assert.equal(counts.setup, 3)
    menus.init()
    await Vue.nextTick()
    assert.equal(counts.unmount, 3)
    menus.menusMap.set('beta', {})
    state.ready = false
    await Vue.nextTick()
    assert.equal(counts.setup, 3)
    state.ready = true
    await Vue.nextTick()
    assert.equal(counts.setup, 4)
    app.unmount()
    assert.deepEqual(counts, { setup: 4, requests: 4, unmount: 4 })
  })
}

test('template groups and nested loop scope use ordinary Vue structural rendering', async () => {
  const app = renderer().createApp({
    setup: () => ({ codes: ['alpha', 'beta'] }),
    render: await renderTemplate(`<template v-for="code in codes" :key="code">
      <template v-has-menu="code"><span /><span /></template>
    </template>`),
  })
  const seen = []
  app.config.globalProperties.$hasMenu = code => { seen.push(code); return code === 'alpha' }
  app.mount({ children: [] })
  assert.deepEqual(seen, ['alpha', 'beta'])
  app.unmount()
})

test('runtime requires Pinia, isolates apps and rejects invalid runtime values', () => {
  assert.throws(() => renderer().createApp({}).use(installHasMenu), /Pinia/)
  const a = renderer().createApp({}).use(createPinia()).use(installHasMenu)
  const b = renderer().createApp({}).use(createPinia()).use(installHasMenu)
  const aMenu = useMenuStore(a.config.globalProperties.$pinia)
  aMenu.menusMap.set('alpha', {})
  // 第二应用最后激活，也不能影响第一应用的读取。
  useMenuStore(b.config.globalProperties.$pinia)
  assert.equal(a.config.globalProperties.$hasMenu('alpha'), true)
  assert.equal(b.config.globalProperties.$hasMenu('alpha'), false)
  for (const value of ['', undefined, null, [], ['alpha'], {}, 1]) {
    assert.equal(a.config.globalProperties.$hasMenu(value), false)
  }
})

test('Vite dev and production pipelines apply the transform before plugin-vue', async () => {
  const fixture = join(temporary, 'ViteFixture.vue')
  await writeFile(fixture, '<script setup lang="ts">const code = "alpha"</script><template><div v-has-menu="code" /></template>')
  const config = {
    configFile: false, root: temporary, logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [hasMenuPlugin(), vuePlugin()],
  }
  const server = await createServer({ ...config, server: { middlewareMode: true, watch: null, hmr: false } })
  try {
    const result = await server.transformRequest('/ViteFixture.vue')
    assert.match(result.code, /\$hasMenu/)
    assert.doesNotMatch(result.code, /resolveDirective|withDirectives/)
  } finally {
    await server.close()
  }
  const result = await viteBuild({ ...config, build: {
    write: false, minify: false, lib: { entry: fixture, formats: ['es'] },
    rollupOptions: { external: ['vue'] },
  } })
  const code = result[0].output.find(output => output.type === 'chunk').code
  assert.match(code, /\$hasMenu/)
  assert.doesNotMatch(code, /resolveDirective|withDirectives/)
})

test('plugin, runtime and public template interfaces pass strict targeted type checks', async () => {
  const store = join(temporary, 'menu.ts')
  await writeFile(store, `import type { Pinia } from 'pinia';
    export declare function useMenuStore(pinia: Pinia): { hasMenu(code: string): boolean };`)
  const fixture = join(temporary, 'Types.vue')
  const good = `<script setup lang="ts">\nconst code: string = 'alpha';\n</script>
    <template><div v-has-menu="code" /><span v-if="$hasMenu(code)" /></template>`
  await writeFile(fixture, good)
  const config = join(temporary, 'tsconfig.json')
  await writeFile(config, JSON.stringify({
    compilerOptions: {
      target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', strict: true,
      skipLibCheck: true, noEmit: true, esModuleInterop: true, lib: ['ESNext', 'DOM'],
      paths: { '@jetlinks-web-core/store/menu': [store] },
    },
    vueCompilerOptions: { strictTemplates: true },
    files: [join(directory, 'index.ts'), join(core, 'src/directive/index.ts'),
      join(core, 'src/directive/globals.d.ts'), fixture],
  }))
  const check = () => spawnSync(process.execPath, [require.resolve('vue-tsc/bin/vue-tsc.js'), '-p', config], { encoding: 'utf8' })
  const result = check()
  assert.equal(result.status, 0, result.stdout + result.stderr)
  await writeFile(fixture, good.replace('v-has-menu="code"', 'v-has-menu="[code]"'))
  const invalid = check()
  assert.notEqual(invalid.status, 0, 'array binding must fail template type checking')
  assert.match(invalid.stdout, /string\[\].*string/)
})

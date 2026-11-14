import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as Vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { build, createServer } from 'vite'

const require = createRequire(import.meta.url)
const workspace = fileURLToPath(new URL('../../', import.meta.url))
const core = join(workspace, 'jetlinks-web-core')

// Preserve a real filename: imported macro types are resolved relative to the SFC.
function compile(source, filename, isProd = false) {
  const { descriptor, errors } = parse(source, { filename })
  assert.deepEqual(errors, [])
  return compileScript(descriptor, { id: 'native-sfc-regression', inlineTemplate: true, isProd })
}

function component(source, filename) {
  const script = compile(source, filename)
  const module = { exports: {} }
  const { code } = transformSync(script.content, { loader: 'ts', format: 'cjs' })
  new Function('require', 'module', 'exports', code)(require, module, module.exports)
  return module.exports.default
}

test('platform settings intersection props compile with relative imported types in both modes', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jetlinks-platform-types-')))
  t.after(() => rm(root, { recursive: true, force: true }))
  const filename = join(root, 'PlatformAppearanceSection.vue')
  // A self-contained relative type graph reproduces the platform settings intersection.
  await writeFile(join(root, 'types.ts'), `
    export interface PlatformSettingsModel { title: string; logo: string }
    export type PlatformSettingsPatch = Partial<PlatformSettingsModel>
    export interface PlatformSettingsAssets { logo: string; ico: string; background: string }
    export interface PlatformSettingsSectionProps {
      model: PlatformSettingsModel
      saved: PlatformSettingsModel
      mode: 'detail' | 'form'
      busy?: boolean
      disabled?: boolean
      errors?: Partial<Record<keyof PlatformSettingsModel, string>>
      hidden?: readonly string[]
      submit: (patch: PlatformSettingsPatch) => Promise<unknown>
    }
  `)
  const source = `<script setup lang="ts">
    import type { PlatformSettingsAssets, PlatformSettingsPatch, PlatformSettingsSectionProps } from './types'
    defineProps<PlatformSettingsSectionProps & { assets: PlatformSettingsAssets; loading?: boolean; error?: string; warning?: string }>()
    defineEmits<{ change: [patch: PlatformSettingsPatch]; reload: []; uploading: [key: string, busy: boolean] }>()
  </script>`
  for (const isProd of [false, true]) {
    const compiled = compile(source, filename, isProd)
    assert.match(compiled.content, /model: \{/)
    assert.match(compiled.content, /assets: \{/)
    assert.match(compiled.content, /emits: \["change", "reload", "uploading"\]/)
  }
})

test('native names preserve existing options and unnamed SFCs retain filename inference', () => {
  const named = component(`<script setup lang="ts">
    defineOptions({ name: 'OriginalComponentName', inheritAttrs: false })
  </script>`, join(core, 'index.vue'))
  assert.equal(named.name, 'OriginalComponentName')
  assert.equal(named.inheritAttrs, false)
  const unnamed = component('<script setup>const value = 1</script>', join(core, 'InferredComponent.vue'))
  assert.equal(unnamed.__name, 'InferredComponent')
  assert.equal(unnamed.name, undefined)
})

// A small renderer exercises Vue's actual cache and self-recursion resolution.
function renderer() {
  const detach = child => {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
  }
  return Vue.createRenderer({
    createElement: tag => ({ tag, children: [] }),
    createText: text => ({ text }), createComment: text => ({ text }),
    insert(child, parent, anchor) {
      detach(child)
      child.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
    },
    remove: detach, setText: (node, text) => { node.text = text },
    setElementText: (node, text) => { node.text = text }, patchProp() {},
    parentNode: node => node.parent,
    nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1],
  })
}

test('KeepAlive include still caches a component whose original name differs from its filename', async () => {
  const child = component(`<script setup>
    import { inject } from 'vue'
    defineOptions({ name: 'OriginalCachedPage' })
    const instance = inject('nextInstance')()
  </script><template><span>{{ instance }}</span></template>`, join(core, 'index.vue'))
  const visible = Vue.ref(true)
  let instances = 0
  const app = renderer().createApp({
    setup: () => () => Vue.h(Vue.KeepAlive, { include: ['OriginalCachedPage'] }, {
      default: () => visible.value ? Vue.h(child) : Vue.h('div'),
    }),
  })
  app.provide('nextInstance', () => ++instances)
  try {
    app.mount({ children: [] })
    visible.value = false; await Vue.nextTick()
    visible.value = true; await Vue.nextTick()
    assert.equal(instances, 1)
  } finally { app.unmount() }
})

test('recursive template references resolve the explicitly preserved name', () => {
  const recursive = component(`<script setup>
    defineOptions({ name: 'OriginalTreeNode' })
    defineProps({ depth: Number })
  </script><template><div><OriginalTreeNode v-if="depth > 0" :depth="depth - 1" /></div></template>`, join(core, 'index.vue'))
  const host = { children: [] }
  const app = renderer().createApp(recursive, { depth: 2 })
  const count = node => (node.tag === 'div' ? 1 : 0) + (node.children || []).reduce((sum, child) => sum + count(child), 0)
  try { app.mount(host); assert.equal(count(host), 3) } finally { app.unmount() }
})

test('Vite dev and build support imported props/emits alongside API and component auto imports', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jetlinks-native-sfc-')))
  let server
  t.after(async () => { await server?.close(); await rm(root, { recursive: true, force: true }) })
  await symlink(join(workspace, 'node_modules'), join(root, 'node_modules'), 'dir')
  await mkdir(join(root, 'components'))
  await writeFile(join(root, 'types.ts'), `export interface Props { title: string }
    export interface Events { change: [value: string] }
    export interface Slots { default(props: { title: string }): unknown }`)
  await writeFile(join(root, 'components/AutoBadge.vue'), '<template><span>auto-badge</span></template>')
  await writeFile(join(root, 'Fixture.vue'), `<script setup lang="ts">
    import type { Props, Events, Slots } from './types'
    defineOptions({ name: 'NativeNamedFixture', inheritAttrs: false })
    const props = defineProps<Props & { enabled?: boolean }>()
    const emit = defineEmits<Events>()
    defineSlots<Slots>()
    const value = ref(1)
    const label = computed(() => props.title + value.value)
    const route = useRoute()
    watch(value, () => emit('change', label.value))
    onMounted(() => { value.value++ })
  </script><template><AutoBadge /><span>{{ label }} {{ route?.path }}</span></template>`)
  await writeFile(join(root, 'entry.ts'), "export { default } from './Fixture.vue'")
  const config = () => ({
    root, configFile: false, envFile: false, logLevel: 'silent',
    cacheDir: join(root, '.vite'),
    plugins: [vue(), Components({ dirs: [join(root, 'components')], dts: false }),
      AutoImport({ imports: ['vue', 'vue-router'], dts: false })],
    server: { middlewareMode: true, watch: null, hmr: false, fs: { allow: [root, workspace] } },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  server = await createServer(config())
  const transformed = await server.transformRequest('/Fixture.vue')
  assert.match(transformed.code, /NativeNamedFixture/)
  assert.match(transformed.code, /AutoBadge\.vue/)
  assert.match(transformed.code, /import[^\n]+\bref\b/)
  assert.match(transformed.code, /import[^\n]+\bcomputed\b/)
  assert.match(transformed.code, /import[^\n]+\buseRoute\b/)
  await server.close(); server = undefined
  const result = await build({ ...config(), build: {
    write: false, minify: false, lib: { entry: join(root, 'entry.ts'), formats: ['es'] },
    rollupOptions: { external: ['vue', 'vue-router'] },
  } })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap(item => item.output)
  const code = outputs.filter(item => item.type === 'chunk').map(item => item.code).join('\n')
  assert.match(code, /NativeNamedFixture/)
  assert.match(code, /auto-badge/)
  assert.match(code, /emits: \["change"\]/)
})

test('host and player keep auto-import plugins without registering the retired name transform', async () => {
  for (const file of ['jetlinks-web-core/vite.config.ts', 'modules/visualization-manager-ui/deployment/player/vite.config.ts']) {
    const source = await readFile(join(workspace, file), 'utf8')
    assert.doesNotMatch(source, /vite-plugin-vue-setup-extend|VueSetupExtend/)
    assert.match(source, /AutoImport\(\{/)
    assert.match(source, /imports: \['vue', 'vue-router'\]/)
    assert.match(source, /Components\(\{/)
  }
  const manifest = JSON.parse(await readFile(join(workspace, 'package.json'), 'utf8'))
  assert.equal(manifest.devDependencies['vite-plugin-vue-setup-extend'], undefined)
})

test('workspace SFCs no longer depend on the retired setup name attribute', async () => {
  const excluded = new Set(['node_modules', 'dist', 'target', 'coverage', '.git'])
  const legacy = []
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue
      const file = join(directory, entry.name)
      if (entry.isDirectory()) await walk(file)
      else if (entry.isFile() && entry.name.endsWith('.vue')) {
        const { descriptor } = parse(await readFile(file, 'utf8'), { filename: file })
        if (descriptor.scriptSetup?.attrs.name !== undefined) legacy.push(file)
      }
    }
  }
  await walk(join(core, 'src'))
  await walk(join(workspace, 'modules'))
  assert.deepEqual(legacy, [])
})

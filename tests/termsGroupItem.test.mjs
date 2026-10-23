import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { transformSync } from 'esbuild'
import * as vue from 'vue'
import * as lodash from 'lodash-es'
import { compileScript, parse } from 'vue/compiler-sfc'

const require = createRequire(import.meta.url)
const directory = resolve(import.meta.dirname, '../src/components/TermsCascader')
const cache = new Map()
const vueGlobals = ['ref', 'computed', 'watch']
let nextKey = 0
const load = filename => {
  if (cache.has(filename)) return cache.get(filename).exports
  const module = { exports: {} }
  cache.set(filename, module)
  let source = readFileSync(filename, 'utf8')
  if (filename.endsWith('.vue')) source = compileScript(parse(source, { filename }).descriptor, { id: filename, inlineTemplate: true }).content
  const { code } = transformSync(source, { loader: 'ts', format: 'cjs' })
  const imports = id => {
    if (id === 'lodash-es') return lodash
    if (id === '@jetlinks-web/utils') return { randomString: () => `key-${++nextKey}` }
    if (id === './Value/utils') return { ValueProps: () => ({ showValueType: { type: Boolean, default: true } }) }
    if (id === './Terms.vue') return { __esModule: true, default: vue.defineComponent({ render: () => null }) }
    if (id.startsWith('.')) return load(resolve(dirname(filename), id.endsWith('.vue') ? id : `${id}.ts`))
    return require(id)
  }
  new Function('require', 'module', 'exports', ...vueGlobals, code)(imports, module, module.exports, ...vueGlobals.map(key => vue[key]))
  return module.exports
}

test('changing only AND/OR emits the updated condition list', async () => {
  const component = load(resolve(directory, 'TermsGroupItem.vue')).default
  const changes = []
  let menu
  const renderer = vue.createRenderer({
    createElement: tag => ({ tag, children: [] }),
    createText: text => ({ text }), createComment: text => ({ text }),
    insert: (child, parent) => { child.parent = parent; parent.children.push(child) },
    remove: child => { const siblings = child.parent?.children; if (siblings) siblings.splice(siblings.indexOf(child), 1) },
    setText: (node, text) => { node.text = text },
    setElementText: (node, text) => { node.text = text },
    parentNode: node => node.parent, nextSibling: () => null,
    patchProp: () => {},
  })
  const passthrough = vue.defineComponent({ setup: (_, { slots }) => () => vue.h('container', [slots.default?.(), slots.overlay?.()]) })
  const app = renderer.createApp({ setup: () => () => vue.h(component, {
    value: [{ column: 'currentValue', termType: 'lte', value: 100, type: 'and' },
      { column: 'currentValue', termType: 'gte', value: 150, type: 'and' }],
    showValueType: false,
    onChange: value => changes.push(JSON.parse(JSON.stringify(value))),
  }) })
  app.component('ADropdown', passthrough)
  app.component('ASpace', passthrough)
  app.component('AMenuItem', passthrough)
  app.component('AIcon', vue.defineComponent({ render: () => null }))
  app.component('AMenu', vue.defineComponent({
    emits: ['click'],
    setup: (_, { emit, slots }) => {
      menu = { select: key => emit('click', { key }) }
      return () => vue.h('menu', slots.default?.())
    },
  }))
  app.mount({ children: [] })
  try {
    assert.equal(changes.length, 0)
    menu.select('or')
    await vue.nextTick()
    assert.equal(changes.length, 1)
    assert.equal(changes[0][1].type, 'or')
    menu.select('and')
    await vue.nextTick()
    assert.equal(changes.length, 2)
    assert.equal(changes[1][1].type, 'and')
  } finally { app.unmount() }
})

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const remapping = createRequire(require.resolve('vite/package.json'))('@jridgewell/remapping')
export const coreRoot = fileURLToPath(new URL('../..', import.meta.url))
export const sourceRoot = resolve(coreRoot, 'src')
const instrumented = '/private/tmp/device-metric-stage2-core/instrumented'

/** Run real TS/SFC modules with only external UI, browser and transport boundaries replaced. */
export function createMetricLoader(stubs = {}) {
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename).exports
    let source = readFileSync(filename, 'utf8')
    if (Object.hasOwn(stubs, '__metricGlob')) source = source.replaceAll('import.meta.glob', "require('__metricGlob')")
    let sfcMap
    if (filename.endsWith('.vue')) {
      const { descriptor } = parse(source, { filename })
      const script = compileScript(descriptor, { id: filename, inlineTemplate: true })
      source = script.content
      sfcMap = script.map
    }
    const output = resolve(instrumented, relative(coreRoot, filename).replace(/\.(ts|vue)$/, '.cjs'))
    mkdirSync(dirname(output), { recursive: true })
    const transpiled = ts.transpileModule(source.replaceAll('import.meta.env', '({})'), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, sourceMap: true, inlineSources: true },
    })
    const generatedMap = JSON.parse(transpiled.sourceMapText)
    const mapped = sfcMap ? remapping([generatedMap, sfcMap], () => null) : generatedMap
    mapped.sources = mapped.sources.map(() => filename)
    mapped.file = output
    writeFileSync(`${output}.map`, JSON.stringify(mapped))
    const code = transpiled.outputText.replace(/\/\/# sourceMappingURL=.*$/, '') + `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(mapped)).toString('base64')}`
    writeFileSync(output, code)
    const loaded = new Module(output)
    loaded.filename = output
    loaded.paths = Module._nodeModulePaths(coreRoot)
    cache.set(filename, loaded)
    loaded.require = id => {
      if (Object.hasOwn(stubs, id)) return stubs[id]
      if (id === 'vue') return vue
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) return require(id)
      const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(sourceRoot, id.slice('@jetlinks-web-core/'.length))
      const target = [base, `${base}.ts`, `${base}.vue`, resolve(base, 'index.ts')].find(item => existsSync(item) && /\.(ts|vue)$/.test(item))
      if (Object.hasOwn(stubs, target)) return stubs[target]
      if (!target) throw new Error(`Unresolved test import ${id} from ${filename}`)
      if (target.endsWith('.vue') && !target.includes('/components/Metric/')) return { default: passthrough('external-shell'), __esModule: true }
      return load(target)
    }
    loaded._compile(code, output)
    return loaded.exports
  }
  return file => load(resolve(sourceRoot, file))
}

export const passthrough = name => vue.defineComponent({ name, inheritAttrs: true, setup: (_props, { slots }) => () => vue.h(name, Object.values(slots).flatMap(slot => slot?.())) })
export const flush = async () => { await vue.nextTick(); await new Promise(resolve => setImmediate(resolve)); await vue.nextTick() }

export function createMetricRenderer() {
  class TestButton { focus(options) { this.focused = options } get isConnected() { return !!this.parent } get disabled() { return !!this.props.disabled } }
  globalThis.HTMLButtonElement = TestButton
  const node = (type, text = '') => Object.assign(type === 'button' ? new TestButton() : {}, { type, text, props: {}, style: {}, children: [], parent: null })
  const renderer = vue.createRenderer({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = parent; const at = anchor ? parent.children.indexOf(anchor) : -1; at < 0 ? parent.children.push(child) : parent.children.splice(at, 0, child) },
    remove(child) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null },
    setText: (element, text) => { element.text = text }, setElementText: (element, text) => { element.text = text; element.children = [] },
    setComment: (element, text) => { element.text = text }, patchProp: (element, key, _prior, next) => { element.props[key] = next },
    parentNode: element => element.parent, nextSibling: element => element.parent?.children[element.parent.children.indexOf(element) + 1] || null,
  })
  return { renderer, root: node('root') }
}
export function walk(node, predicate) { return [node, ...node.children.flatMap(child => walk(child, predicate))].filter(predicate) }
export const textContent = node => node.text + node.children.map(textContent).join('')

import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'

const require = createRequire(import.meta.url)
const sourceRoot = fileURLToPath(new URL('../../src', import.meta.url))

/** Execute real canvas modules while replacing only explicit UI and browser boundaries. */
export function createDashboardLoader(stubs = {}) {
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename).exports
    let source = readFileSync(filename, 'utf8')
    if (filename.endsWith('.vue')) {
      const { descriptor } = parse(source, { filename })
      source = compileScript(descriptor, { id: filename, inlineTemplate: true }).content
    }
    const module = { exports: {} }
    cache.set(filename, module)
    new Function('require', 'module', 'exports', transformSync(source, { loader: 'ts', format: 'cjs', target: 'es2022' }).code)(id => {
      if (Object.hasOwn(stubs, id)) return stubs[id]
      if (id === 'vue') return vue
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) return require(id)
      const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(sourceRoot, id.slice('@jetlinks-web-core/'.length))
      const target = [base, base + '.ts', base + '.vue', resolve(base, 'index.ts')].find(file => existsSync(file) && /\.(ts|vue)$/.test(file))
      if (!target) throw new Error('Unresolved canvas test import ' + id + ' from ' + filename)
      if (target.endsWith('.vue')) return { default: passthrough('external-shell'), __esModule: true }
      return load(target)
    }, module, module.exports)
    return module.exports
  }
  return file => load(resolve(sourceRoot, file))
}
export const passthrough = name => vue.defineComponent({ name, inheritAttrs: true, setup: (_props, { slots }) => () => vue.h(name, Object.values(slots).flatMap(slot => slot?.())) })

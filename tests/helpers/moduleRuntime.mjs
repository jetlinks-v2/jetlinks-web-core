import { readFileSync, existsSync } from 'node:fs'
import { createRequire, Module } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const require = createRequire(import.meta.url)
export const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url))

/** Execute real menu modules, replacing only Vite discovery and external transport. */
export function createModuleLoader(stubs = {}) {
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename).exports
    const source = readFileSync(filename, 'utf8')
      .replaceAll('import.meta.glob', "require('__moduleGlob')")
      .replaceAll('import.meta.env', '({})')
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    })
    const loaded = new Module(filename)
    cache.set(filename, loaded)
    loaded.require = id => {
      if (Object.hasOwn(stubs, id)) return stubs[id]
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) return require(id)
      const base = id.startsWith('.') ? resolve(dirname(filename), id) : resolve(sourceRoot, id.slice('@jetlinks-web-core/'.length))
      const target = [base, `${base}.ts`, resolve(base, 'index.ts')].find(item => existsSync(item) && item.endsWith('.ts'))
      if (Object.hasOwn(stubs, target)) return stubs[target]
      if (!target) throw new Error(`Unresolved test import ${id} from ${filename}`)
      return load(target)
    }
    loaded._compile(outputText, filename)
    return loaded.exports
  }
  return file => load(resolve(sourceRoot, file))
}

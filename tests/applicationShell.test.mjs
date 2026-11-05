import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const src = fileURLToPath(new URL('../src/', import.meta.url))

/**
 * 运行真实的 `applicationShell.ts`，只把 `modules()` 换成测试提供的模块表。
 * 收集顺序、优先级排序、告警与回退逻辑都走生产代码。
 */
function createLoader(moduleTable) {
  const cache = new Map()
  const load = filename => {
    if (cache.has(filename)) return cache.get(filename)
    const exports = {}
    cache.set(filename, exports)
    const code = ts.transpileModule(
      readFileSync(filename, 'utf8').replaceAll('import.meta.env', '({})'),
      { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
    ).outputText
    new Function('require', 'exports', code)(id => {
      if (id === '@jetlinks-web-core/utils/modules') {
        return { modules: () => moduleTable }
      }
      if (!id.startsWith('.') && !id.startsWith('@jetlinks-web-core/')) {
        return require(id)
      }
      const base = id.startsWith('.')
        ? resolve(dirname(filename), id)
        : resolve(src, id.slice('@jetlinks-web-core/'.length))
      return load(resolve(base, 'index.ts').replace(/\/index\.ts$/, '') === base ? `${base}.ts` : base)
    }, exports)
    return exports
  }
  return () => load(resolve(src, 'layout/runtime/applicationShell.ts'))
}

const declaration = name => ({
  component: async () => ({ name }),
  match: ({ hasMenu }) => hasMenu(name),
})

const context = (...codes) => ({
  applicationId: 'app-1',
  hasMenu: code => codes.includes(code),
})

function setup(t, modules) {
  const load = createLoader(modules)
  const shell = load()
  shell.resetApplicationShellCache()
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args.join(' '))
  t.after(() => { console.warn = originalWarn })
  return { shell, warnings }
}

test('resolves the module that matches the current application menus', t => {
  const { shell } = setup(t, {
    'fire-ui': { name: 'fire-ui', default: { priority: 10, getApplicationShell: () => declaration('fire') } },
    'park-ui': { name: 'park-ui', default: { priority: 0, getApplicationShell: () => declaration('park') } },
  })

  assert.equal(shell.resolveApplicationShell(context('fire'))?.moduleName, 'fire-ui')
  assert.equal(shell.resolveApplicationShell(context('park'))?.moduleName, 'park-ui')
})

test('returns undefined so the host falls back to the default application layout', t => {
  const { shell } = setup(t, {
    'fire-ui': { name: 'fire-ui', default: { priority: 10, getApplicationShell: () => declaration('fire') } },
  })

  assert.equal(shell.resolveApplicationShell(context('unrelated')), undefined)
  assert.equal(shell.resolveApplicationShell({ applicationId: 'app-1', hasMenu: () => false }), undefined)
})

test('higher priority wins and the losing declaration is reported', t => {
  const { shell, warnings } = setup(t, {
    'low-ui': { name: 'low-ui', default: { priority: 1, getApplicationShell: () => declaration('shared') } },
    'high-ui': { name: 'high-ui', default: { priority: 9, getApplicationShell: () => declaration('shared') } },
  })

  assert.equal(shell.resolveApplicationShell(context('shared'))?.moduleName, 'high-ui')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /low-ui/)
  assert.match(warnings[0], /high-ui/)
})

test('a throwing match is skipped without blocking other modules', t => {
  const { shell, warnings } = setup(t, {
    'broken-ui': {
      name: 'broken-ui',
      default: { priority: 10, getApplicationShell: () => ({ component: async () => ({}), match: () => { throw new Error('boom') } }) },
    },
    'ok-ui': { name: 'ok-ui', default: { priority: 0, getApplicationShell: () => declaration('ok') } },
  })

  assert.equal(shell.resolveApplicationShell(context('ok'))?.moduleName, 'ok-ui')
  assert.match(warnings[0], /broken-ui/)
})

test('declared but unmatched shells warn once and still fall back', t => {
  const { shell, warnings } = setup(t, {
    'fire-ui': { name: 'fire-ui', default: { priority: 10, getApplicationShell: () => declaration('fire') } },
  })

  assert.equal(shell.resolveApplicationShell(context('unrelated')), undefined)
  assert.equal(shell.resolveApplicationShell(context('unrelated')), undefined)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /fire-ui/)
  assert.match(warnings[0], /falling back/)
})

test('declarations without match never take over the application shell', t => {
  const { shell } = setup(t, {
    'silent-ui': {
      name: 'silent-ui',
      default: { priority: 100, getApplicationShell: () => ({ component: async () => ({}) }) },
    },
  })

  assert.equal(shell.resolveApplicationShell(context('anything')), undefined)
  assert.equal(shell.listApplicationShells().length, 1)
})

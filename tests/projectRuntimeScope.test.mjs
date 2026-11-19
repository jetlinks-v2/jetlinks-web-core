import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

function runtime({ scope = 'project', path = '/', privateDeployment = false, configuredProject = '', cloud = false } = {}) {
  const filename = new URL('../src/utils/project-runtime.ts', import.meta.url)
  const env = { VITE_APP_RUNTIME_SCOPE: scope, VITE_APP_PROJECT_CODE: configuredProject, BASE_URL: '/' }
  const source = readFileSync(filename, 'utf8').replaceAll('import.meta.env', JSON.stringify(env))
  const ast = ts.createSourceFile('runtime.ts', source, ts.ScriptTarget.Latest, true)
  const code = ts.transpileModule(ast.statements.filter(node => !ts.isImportDeclaration(node) && !(ts.isExportDeclaration(node) && node.moduleSpecifier))
    .map(node => node.getText(ast)).join('\n'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module, exports: module.exports,
    getProjectCodeFromPathnameLocation: () => path.split('/').filter(Boolean)[0] || '',
    isProjectStorageEnabled: () => !privateDeployment, isPrivateDeployment: () => privateDeployment,
    isFromCloud: () => cloud,
  })
  return module.exports
}

test('SaaS project build distinguishes root admin from a project URL prefix', () => {
  assert.equal(runtime({ path: '/' }).isProjectRuntime(), false)
  assert.equal(runtime({ path: '/project-one/' }).isProjectRuntime(), true)
})

test('explicit tenant scope, fixed project id and private standalone mode retain their semantics', () => {
  assert.equal(runtime({ scope: 'tenant', path: '/project-one/' }).isProjectRuntime(), false)
  assert.equal(runtime({ configuredProject: 'fixed' }).isProjectRuntime(), true)
  assert.equal(runtime({ privateDeployment: true }).isProjectRuntime(), true)
})

test('auto scope requires a project prefix and excludes cloud proxy context', () => {
  assert.equal(runtime({ scope: 'auto' }).isProjectRuntime(), false)
  assert.equal(runtime({ scope: 'auto', path: '/one/' }).isProjectRuntime(), true)
  assert.equal(runtime({ scope: 'auto', path: '/one/', cloud: true }).isProjectRuntime(), false)
})

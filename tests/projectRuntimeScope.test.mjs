import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { buildSync } from 'esbuild'

// 执行实际路径解析和入口判断，仅隔离浏览器及外部包。
const { outputFiles } = buildSync({
  entryPoints: [fileURLToPath(new URL('../src/utils/project-runtime.ts', import.meta.url))],
  bundle: true, write: false, format: 'cjs', external: ['@jetlinks-web/*'],
  define: { 'import.meta.env': 'env' },
})

function runtime({ scope = 'project', path = '/', privateDeployment = false, configuredProject = '', terminal } = {}) {
  const module = { exports: {} }
  vm.runInNewContext(outputFiles[0].text, {
    module, exports: module.exports, require: () => ({}),
    env: {
      VITE_APP_RUNTIME_SCOPE: scope, VITE_APP_ENVIRONMENT: privateDeployment ? '' : 'saas',
      VITE_APP_PROJECT_CODE: configuredProject, BASE_URL: '/',
    },
    window: { location: new URL(path, 'https://runtime.example') },
    localStorage: { getItem: key => key === 'terminal' ? terminal ?? null : null },
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
  assert.equal(runtime({ configuredProject: 'fixed', path: '/index.html' }).isProjectRuntime(), true)
  assert.equal(runtime({ configuredProject: 'fixed', path: '/api/ui/edge/cloud/default/' }).isProjectRuntime(), false)
  assert.equal(runtime({ privateDeployment: true }).isProjectRuntime(), true)
})

test('auto scope requires a project prefix', () => {
  assert.equal(runtime({ scope: 'auto' }).isProjectRuntime(), false)
  assert.equal(runtime({ scope: 'auto', path: '/one/' }).isProjectRuntime(), true)
})

for (const scope of ['project', 'auto']) {
  test(`${scope}: root index.html is the admin entry, not a project code`, () => {
    const admin = runtime({ scope, path: '/index.html#/overview' })
    assert.equal(admin.getProjectCodeFromLocation(), '')
    assert.equal(admin.isProjectRuntime(), false)
    assert.equal(runtime({ scope, path: '/one/index.html#/overview' }).isProjectRuntime(), true)
  })

  test(`${scope}: edge proxy is not a project, including on first load`, () => {
    for (const terminal of [undefined, 'cloud-pc', 'cloud']) {
      const edge = runtime({ scope, path: '/api/ui/edge/cloud/default/#/login', terminal })
      assert.equal(edge.getProjectCodeFromLocation(), '')
      assert.equal(edge.isProjectRuntime(), false)
    }
    const project = runtime({ scope, path: '/one/#/overview?next=/ui/edge/cloud/default/', terminal: 'cloud-pc' })
    assert.equal(project.isProjectRuntime(), true)
  })
}
